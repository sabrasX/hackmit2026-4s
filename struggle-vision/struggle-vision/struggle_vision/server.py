"""WebSocket server: streams detector output as JSON for the web UI.

The camera loop runs in its own thread (OpenCV reads are blocking) and keeps a
single latest-status dictionary. The asyncio side samples that dictionary at a
fixed rate and pushes it to every connected client, so a slow or absent client
never holds up the camera, and the stream rate doesn't depend on the frame rate.

Run it with:  python -m struggle_vision.server --source 0
"""

import argparse
import asyncio
import json
import queue
import threading
import time
from dataclasses import fields
from pathlib import Path

import websockets

from .config import Config
from .detector import StruggleDetector, load_calibration, save_calibration
from .hands import HandTracker, draw_hand
from .scoring import WEIGHTS, score_parts, struggle_score
from .tracking import list_cameras, open_camera

DEFAULT_HOST = "0.0.0.0"
DEFAULT_PORT = 8765


def status_payload(t: float, st, det, cfg: Config = None) -> dict:
    """Status as the front end wants it: flat, JSON-safe, camelCase.

    Everything is forced through float()/bool() on the way out. Several of these
    come back from numpy as np.float64 or np.bool_, which json.dumps refuses.
    """
    def num(x, places):
        return round(float(x), places)

    return {
        "t": num(t, 3),
        "handVisible": bool(st.hand_visible),
        # signals
        "stopped": bool(st.stopped),
        "palmFacingAway": bool(st.palm_facing_away),
        "struggling": bool(st.struggling),
        "badPosture": bool(st.bad_posture),
        "reasons": list(st.reasons),
        # the one number the web UI graphs, so both ends agree on it
        "struggleScore": num(struggle_score(st, cfg), 1),
        "scoreParts": {k: num(v, 1) for k, v in score_parts(st, cfg).items()},
        # the raw numbers behind them, for graphing
        "stillExtent": num(st.still_extent, 4),
        "articulation": num(st.articulation, 4),
        "fingerExtension": num(st.finger_extension, 2),
        "extensionExcess": num(st.extension_excess, 2),
        # calibration state, so the UI can drive it
        "calibrated": bool(st.calibrated),
        "calibrating": bool(det.calibrating),
        "calibrationProgress": num(det.calibration_progress(t), 3),
        "calibrationError": det.calibration_error,
    }


def draw_overlay(frame, st, det, t: float, cfg: Config):
    """The live preview a judge watches: the score and the parts it is made of."""
    import cv2

    h, w = frame.shape[:2]
    if det.calibrating:
        pct = int(100 * det.calibration_progress(t))
        cv2.rectangle(frame, (0, 0), (w - 1, h - 1), (0, 200, 255), 8)
        cv2.putText(frame, f"CALIBRATING {pct}% - hold the correct writing position",
                    (15, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 200, 255), 2)
        return

    score = struggle_score(st, cfg)
    colour = (0, 200, 0) if score < 40 else (0, 200, 255) if score <= 70 else (0, 0, 255)
    cv2.rectangle(frame, (0, 0), (w - 1, h - 1), colour, 8 if score > 70 else 2)
    cv2.putText(frame, f"STRUGGLE SCORE {score:.0f}/100", (15, 45),
                cv2.FONT_HERSHEY_SIMPLEX, 1.1, colour, 3)

    # the bar chart of contributions, so the number is never a black box
    y = 80
    for name, points in score_parts(st, cfg).items():
        full = int(100 * WEIGHTS[name])
        cv2.rectangle(frame, (15, y), (15 + full * 3, y + 16), (70, 70, 70), 1)
        if points > 0:
            cv2.rectangle(frame, (15, y), (15 + int(points * 3), y + 16), colour, -1)
        cv2.putText(frame, f"{name} {points:.0f}/{full}", (15 + full * 3 + 10, y + 14),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (220, 220, 220), 1)
        y += 24

    detail = (f"still extent {st.still_extent:.2f}   finger speed {st.articulation:.2f}   "
              f"palm {'away' if st.palm_facing_away else 'down'}   "
              f"{'no hand' if not st.hand_visible else 'hand seen'}")
    cv2.putText(frame, detail, (15, h - 15), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)


class VisionWorker(threading.Thread):
    """Owns the camera, the tracker and the detector. Nothing else touches them."""

    daemon = True

    def __init__(self, cfg, source, model=None, calibration=None, show=True):
        super().__init__(name="vision")
        self.cfg = cfg
        self.source = source
        self.model = model
        self.calibration = Path(calibration) if calibration else None
        self.show = show
        self._latest = None
        self._lock = threading.Lock()
        self._commands = queue.Queue()
        self._stop = threading.Event()
        self.error = None

    # ---------- talking to the worker ----------
    def submit(self, command: dict):
        """Queue a command from a client. Applied on the camera thread."""
        self._commands.put(command)

    def snapshot(self):
        with self._lock:
            return self._latest

    def stop(self):
        self._stop.set()

    # ---------- the loop ----------
    def _apply_commands(self, det, t, hand_visible):
        while True:
            try:
                command = self._commands.get_nowait()
            except queue.Empty:
                return
            kind = str(command.get("type", "")).lower()
            if kind == "calibrate":
                if hand_visible:
                    det.start_calibration(t)
                else:
                    det.cancel_calibration("no hand in view")
            elif kind in ("clearcalibration", "clear_calibration"):
                det.set_reference(None)
            elif kind == "reset":
                det.reset_motion()
            else:
                print(f"Ignoring unknown command: {command!r}")

    def _save_if_calibrated(self, det, was_calibrating):
        if not (was_calibrating and not det.calibrating):
            return
        if det.calibration_error:
            print(f"Calibration failed: {det.calibration_error}")
        elif self.calibration is not None:
            try:
                save_calibration(self.calibration, det.reference)
                print(f"Recorded the writing grip and saved it to {self.calibration}.")
            except OSError as exc:
                print(f"Could not save to {self.calibration}: {exc}")

    def run(self):
        import cv2                                  # only needed on this thread

        cap = open_camera(self.source)
        if not cap.isOpened():
            self.error = "Could not open the camera. Try --list."
            print(self.error)
            return

        tracker = HandTracker(self.model)
        det = StruggleDetector(self.cfg)
        if self.calibration is not None and self.calibration.exists():
            try:
                det.set_reference(load_calibration(self.calibration))
                print(f"Loaded the writing grip from {self.calibration}: fingers at "
                      f"{det.reference.extension:.0f} deg.")
            except (ValueError, KeyError, OSError) as exc:
                print(f"Ignoring {self.calibration}: {exc}")

        t0 = time.monotonic()
        was_calibrating = False
        try:
            while not self._stop.is_set():
                ok, frame = cap.read()
                if not ok:
                    self.error = "The camera stopped returning frames."
                    print(self.error)
                    break
                t = time.monotonic() - t0

                scale = self.cfg.frame_width / frame.shape[1]
                frame = cv2.resize(frame, (self.cfg.frame_width, int(frame.shape[0] * scale)))

                pts, side = tracker.detect(frame, t)
                if pts is not None:
                    det.update_hand(t, pts, handedness=side)
                    if self.show:
                        draw_hand(frame, pts)
                det.check_hand_lost(t)

                self._apply_commands(det, t, pts is not None)
                self._save_if_calibrated(det, was_calibrating)
                was_calibrating = det.calibrating

                st = det.evaluate(t)
                with self._lock:
                    self._latest = status_payload(t, st, det, self.cfg)

                if self.show:
                    draw_overlay(frame, st, det, t, self.cfg)
                    cv2.imshow("struggle-vision (server)", frame)
                    if (cv2.waitKey(1) & 0xFF) == ord("q"):
                        break
        finally:
            cap.release()
            tracker.close()
            if self.show:
                cv2.destroyAllWindows()


async def serve(worker: VisionWorker, host: str, port: int, hz: float):
    clients = set()

    async def handler(ws, *_):                      # *_ absorbs `path` on older websockets
        clients.add(ws)
        print(f"Client connected ({len(clients)} now).")
        try:
            async for raw in ws:
                try:
                    command = json.loads(raw)
                except json.JSONDecodeError:
                    continue                        # ignore junk rather than dropping the client
                if isinstance(command, dict):
                    worker.submit(command)
        except websockets.ConnectionClosed:
            pass
        finally:
            clients.discard(ws)
            print(f"Client disconnected ({len(clients)} left).")

    async with websockets.serve(handler, host, port):
        print(f"Streaming on ws://{host}:{port} at {hz:g} Hz. Ctrl-C to stop.")
        period = 1.0 / hz
        while worker.is_alive():
            await asyncio.sleep(period)
            payload = worker.snapshot()
            if payload is None or not clients:
                continue
            message = json.dumps(payload)
            await asyncio.gather(*(c.send(message) for c in list(clients)),
                                 return_exceptions=True)
        print(f"Camera thread stopped: {worker.error or 'no reason given'}")


def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(
        prog="struggle-vision-server",
        description="Stream struggle-vision signals to a web UI over WebSockets.",
    )
    ap.add_argument("--source", default="0", help="camera index (0, 1, 2...) or a stream URL")
    ap.add_argument("--list", action="store_true", help="probe camera indexes and exit")
    ap.add_argument("--host", default=DEFAULT_HOST, help=f"default: {DEFAULT_HOST}")
    ap.add_argument("--port", type=int, default=DEFAULT_PORT, help=f"default: {DEFAULT_PORT}")
    ap.add_argument("--hz", type=float, default=5.0, help="messages per second (default: 5)")
    ap.add_argument("--model", default=None, help="path to hand_landmarker.task")
    ap.add_argument("--calibration", default="calibration.json",
                    help="where the demonstrated grip is stored (default: calibration.json)")
    ap.add_argument("--no-calibration", action="store_true",
                    help="ignore any saved calibration and don't check hand position")
    ap.add_argument("--no-show", dest="show", action="store_false",
                    help="run headless; by default a live preview window opens")
    ap.add_argument("--show", dest="show", action="store_true", default=True,
                    help=argparse.SUPPRESS)
    group = ap.add_argument_group("detector settings (defaults live in config.py)")
    for f in fields(Config):
        group.add_argument("--" + f.name.replace("_", "-"), dest=f.name, type=f.type, default=None,
                           help=f"default: {f.default}")
    return ap


def main(argv=None):
    args = build_parser().parse_args(argv)
    if args.list:
        list_cameras()
        return

    cfg = Config(**{f.name: getattr(args, f.name) for f in fields(Config)
                    if getattr(args, f.name) is not None})
    source = int(args.source) if args.source.isdigit() else args.source

    worker = VisionWorker(cfg, source, args.model,
                          None if args.no_calibration else args.calibration, args.show)
    worker.start()
    try:
        asyncio.run(serve(worker, args.host, args.port, args.hz))
    except KeyboardInterrupt:
        print("Stopping.")
    finally:
        worker.stop()
        worker.join(timeout=2.0)


if __name__ == "__main__":
    main()
