"""Command-line app: camera -> MediaPipe hand -> detector -> overlay + CSV log."""

import argparse
import csv
import time
from dataclasses import fields
from datetime import datetime
from pathlib import Path

import cv2

from .config import Config
from .detector import StruggleDetector
from .hands import HandTracker, draw_hand
from .tracking import list_cameras, open_camera


def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(
        prog="struggle-vision",
        description="Detect when a child is struggling while writing, from the hand alone.",
    )
    ap.add_argument("--source", default="0", help="camera index (0, 1, 2...) or a stream URL")
    ap.add_argument("--list", action="store_true", help="probe camera indexes and exit")
    ap.add_argument("--log-dir", default="logs", help="where session CSVs are written (default: logs)")
    ap.add_argument("--no-log", action="store_true", help="don't write a CSV log")
    ap.add_argument("--model", default=None, help="path to hand_landmarker.task (auto-downloaded if omitted)")
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
    cap = open_camera(source)
    if not cap.isOpened():
        raise SystemExit("Could not open the camera. Try --list, and check the phone app is running.")

    tracker = HandTracker(args.model)
    det = StruggleDetector(cfg)

    cv2.namedWindow("struggle-vision")

    log_file = log = None
    if not args.no_log:
        log_dir = Path(args.log_dir)
        log_dir.mkdir(parents=True, exist_ok=True)
        log_file = open(log_dir / f"session_{datetime.now():%Y%m%d_%H%M%S}.csv", "w", newline="")
        log = csv.writer(log_file)
        log.writerow(["t_sec", "hand_visible", "stopped", "fidget", "struggling",
                      "still_extent", "reversals_per_s", "efficiency", "articulation"])

    prev = {}
    last_log = -1e9
    t0 = time.monotonic()

    while True:
        ok, frame = cap.read()
        if not ok:
            break
        t = time.monotonic() - t0

        scale = cfg.frame_width / frame.shape[1]
        frame = cv2.resize(frame, (cfg.frame_width, int(frame.shape[0] * scale)))
        h, w = frame.shape[:2]

        # --- hand ---
        pts = tracker.detect(frame, t)
        if pts is not None:
            det.update_hand(t, pts)
            draw_hand(frame, pts)
            cv2.circle(frame, tuple(det.grip.astype(int)), 6, (0, 255, 255), -1)
        det.check_hand_lost(t)

        # --- decisions ---
        st = det.evaluate(t)
        for name in ("STOPPED", "FIDGET"):
            on = name in st.reasons
            if on and not prev.get(name):
                print(f"[{t:7.1f}s] struggle signal: {name}")
            prev[name] = on

        # --- overlay ---
        if st.struggling:
            text, colour = "STRUGGLING: " + ", ".join(st.reasons), (0, 0, 255)
        elif not st.hand_visible:
            text, colour = "no hand detected", (160, 160, 160)
        else:
            text, colour = "OK", (0, 200, 0)
        cv2.rectangle(frame, (0, 0), (w - 1, h - 1), colour, 8 if st.struggling else 2)
        cv2.putText(frame, text, (15, 40), cv2.FONT_HERSHEY_SIMPLEX, 1.0, colour, 2)
        dbg = (f"still extent {st.still_extent:.2f} (<{cfg.still_extent})   "
               f"reversals/s {st.reversals_per_s:.1f} (>={cfg.fidget_rev_per_s})   "
               f"efficiency {st.efficiency:.2f} (<={cfg.fidget_max_efficiency})   "
               f"fingers {st.articulation:.2f} (quiet <={cfg.stall_articulation}, "
               f"churn >={cfg.fidget_articulation})")
        cv2.putText(frame, dbg, (15, h - 15), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

        # --- log ---
        if log is not None and t - last_log >= cfg.log_every_s:
            log.writerow([f"{t:.2f}", int(st.hand_visible), int(st.stopped), int(st.fidget),
                          int(st.struggling), f"{st.still_extent:.3f}", f"{st.reversals_per_s:.2f}",
                          f"{st.efficiency:.3f}", f"{st.articulation:.3f}"])
            last_log = t

        cv2.imshow("struggle-vision", frame)
        key = cv2.waitKey(1) & 0xFF
        if key == ord("q"):
            break
        if key == ord("r"):
            det.reset_motion()

    cap.release()
    tracker.close()
    if log_file is not None:
        log_file.close()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
