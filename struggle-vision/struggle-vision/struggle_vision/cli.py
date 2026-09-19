"""Command-line app: camera -> MediaPipe hand -> detector -> overlay + CSV log."""

import argparse
import csv
import time
from dataclasses import fields
from datetime import datetime
from pathlib import Path

import cv2

from .config import Config
from .detector import StruggleDetector, load_calibration, save_calibration
from .hands import HandTracker, draw_hand
from .tracking import list_cameras, open_camera

HELP_LINE = "c calibrate   x clear calibration   r reset   q quit"


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
    ap.add_argument("--calibration", default="calibration.json",
                    help="where the demonstrated hand position is stored (default: calibration.json)")
    ap.add_argument("--no-calibration", action="store_true",
                    help="ignore any saved calibration and don't check hand position")
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

    calib_path = Path(args.calibration)
    if not args.no_calibration and calib_path.exists():
        try:
            det.set_reference(load_calibration(calib_path))
            print(f"Loaded the writing grip from {calib_path}: fingers at "
                  f"{det.reference.extension:.0f} deg (wobble {det.reference.wobble:.1f}).")
        except (ValueError, KeyError, OSError) as exc:
            print(f"Ignoring {calib_path}: {exc}")
    elif not args.no_calibration:
        print(f"No calibration yet. Have the teacher hold the correct writing position "
              f"and press 'c' to record it ({cfg.calibrate_seconds:.0f}s).")

    cv2.namedWindow("struggle-vision")

    log_file = log = None
    if not args.no_log:
        log_dir = Path(args.log_dir)
        log_dir.mkdir(parents=True, exist_ok=True)
        log_file = open(log_dir / f"session_{datetime.now():%Y%m%d_%H%M%S}.csv", "w", newline="")
        log = csv.writer(log_file)
        log.writerow(["t_sec", "hand_visible", "stopped", "twiddling", "struggling", "bad_posture",
                      "still_extent", "articulation", "palm_up",
                      "finger_extension", "extension_excess"])

    prev = {}
    was_calibrating = False
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
        pts, side = tracker.detect(frame, t)
        if pts is not None:
            det.update_hand(t, pts, handedness=side)
            draw_hand(frame, pts)
            cv2.circle(frame, tuple(det.grip.astype(int)), 6, (0, 255, 255), -1)
        det.check_hand_lost(t)

        # --- calibration finishing ---
        if was_calibrating and not det.calibrating:
            if det.calibration_error:
                print(f"Calibration failed: {det.calibration_error}")
            else:
                print(f"Recorded the writing grip: fingers at "
                      f"{det.reference.extension:.0f} deg (wobble {det.reference.wobble:.1f}).")
                try:
                    save_calibration(calib_path, det.reference)
                    print(f"Saved to {calib_path}.")
                except OSError as exc:
                    print(f"Could not save to {calib_path}: {exc}")
        was_calibrating = det.calibrating

        # --- decisions ---
        st = det.evaluate(t)
        for name, on in (("STOPPED", st.stopped), ("WRONG POSITION", st.twiddling),
                         ("WRONG POSITION", st.bad_posture)):
            if on and not prev.get(name):
                print(f"[{t:7.1f}s] {name}")
            prev[name] = on

        # --- overlay ---
        if det.calibrating:
            pct = int(100 * det.calibration_progress(t))
            cv2.rectangle(frame, (0, 0), (w - 1, h - 1), (0, 200, 255), 8)
            cv2.putText(frame, f"CALIBRATING {pct}% - hold the correct writing position",
                        (15, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 200, 255), 2)
            cv2.imshow("struggle-vision", frame)
            if (cv2.waitKey(1) & 0xFF) == ord("q"):
                break
            continue

        alert = st.struggling or st.bad_posture
        if st.struggling:
            text, colour = "STRUGGLING: " + ", ".join(st.reasons), (0, 0, 255)
        elif st.bad_posture:
            text, colour = "WRONG POSITION: hand gone flat", (0, 0, 255)
        elif not st.hand_visible:
            text, colour = "no hand detected", (160, 160, 160)
        else:
            text, colour = "OK", (0, 200, 0)
        cv2.rectangle(frame, (0, 0), (w - 1, h - 1), colour, 8 if alert else 2)
        cv2.putText(frame, text, (15, 40), cv2.FONT_HERSHEY_SIMPLEX, 1.0, colour, 2)

        if not st.calibrated:
            note, note_colour = "no hand position recorded - press 'c' to calibrate", (0, 200, 255)
        elif st.struggling and st.bad_posture:
            note, note_colour = "also: HAND FLAT", (0, 0, 255)
        else:
            note, note_colour = (f"fingers {st.finger_extension:.0f} deg, "
                                 f"{st.extension_excess:+.0f} vs the demonstrated grip "
                                 f"(flat at +{cfg.flat_tolerance_deg:.0f})"), (200, 200, 200)
        cv2.putText(frame, note, (15, 72), cv2.FONT_HERSHEY_SIMPLEX, 0.6, note_colour, 2)
        cv2.putText(frame, HELP_LINE, (15, h - 38), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (180, 180, 180), 1)

        dbg = (f"still extent {st.still_extent:.2f} (<{cfg.still_extent})   "
               f"finger speed {st.articulation:.3f} (quiet <={cfg.stall_articulation}, "
               f"busy >={cfg.twiddle_articulation})   "
               f"palm {'faced away' if st.palm_up else 'down'}")
        cv2.putText(frame, dbg, (15, h - 15), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

        # --- log ---
        if log is not None and t - last_log >= cfg.log_every_s:
            log.writerow([f"{t:.2f}", int(st.hand_visible), int(st.stopped), int(st.twiddling),
                          int(st.struggling), int(st.bad_posture), f"{st.still_extent:.3f}",
                          f"{st.articulation:.3f}", int(st.palm_up),
                          f"{st.finger_extension:.1f}", f"{st.extension_excess:.1f}"])
            last_log = t

        cv2.imshow("struggle-vision", frame)
        key = cv2.waitKey(1) & 0xFF
        if key == ord("q"):
            break
        if key == ord("r"):
            det.reset_motion()
        if key == ord("c"):
            if st.hand_visible:
                print(f"Recording the hand position for {cfg.calibrate_seconds:.0f}s - hold it still.")
                det.start_calibration(t)
            else:
                print("No hand in view - can't calibrate.")
        if key == ord("x"):
            det.set_reference(None)
            print("Cleared the hand position; position checking is off until you calibrate again.")

    cap.release()
    tracker.close()
    if log_file is not None:
        log_file.close()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
