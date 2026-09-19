"""MediaPipe Hand Landmarker (Tasks API) wrapper.

Uses the Tasks API, which works on current MediaPipe releases and recent Python
versions. The legacy `mp.solutions` API was removed from newer MediaPipe.
The ~8 MB model file is downloaded once into ./models/ on first run.
"""

import urllib.request
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

MODEL_URL = ("https://storage.googleapis.com/mediapipe-models/hand_landmarker/"
             "hand_landmarker/float16/1/hand_landmarker.task")
DEFAULT_MODEL_PATH = Path("models") / "hand_landmarker.task"

# Standard 21-point hand skeleton (0 = wrist, 4 = thumb tip, 8 = index tip, 9 = middle knuckle)
HAND_CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (3, 4),
    (0, 5), (5, 6), (6, 7), (7, 8),
    (5, 9), (9, 10), (10, 11), (11, 12),
    (9, 13), (13, 14), (14, 15), (15, 16),
    (13, 17), (17, 18), (18, 19), (19, 20), (0, 17),
]


def ensure_model(path=DEFAULT_MODEL_PATH) -> Path:
    path = Path(path)
    if path.exists():
        return path
    path.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading hand model to {path} ...")
    tmp = path.with_suffix(".part")
    try:
        urllib.request.urlretrieve(MODEL_URL, tmp)
    except Exception as exc:
        raise SystemExit(
            f"Could not download the hand model ({exc}).\n"
            f"Download it manually from:\n  {MODEL_URL}\nand save it as {path}"
        )
    tmp.replace(path)
    return path


class HandTracker:
    """detect(frame_bgr, t_sec) -> (21, 2) array of pixel coordinates, or None."""

    def __init__(self, model_path=None):
        path = ensure_model(model_path or DEFAULT_MODEL_PATH)
        options = vision.HandLandmarkerOptions(
            base_options=mp_python.BaseOptions(model_asset_path=str(path)),
            running_mode=vision.RunningMode.VIDEO,
            num_hands=1,
            min_hand_detection_confidence=0.5,
            min_hand_presence_confidence=0.5,
            min_tracking_confidence=0.5,
        )
        self._landmarker = vision.HandLandmarker.create_from_options(options)
        self._last_ts = -1

    def detect(self, frame_bgr, t_sec: float):
        rgb = np.ascontiguousarray(cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB))
        image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        ts = max(int(t_sec * 1000), self._last_ts + 1)       # timestamps must strictly increase
        self._last_ts = ts
        result = self._landmarker.detect_for_video(image, ts)
        if not result.hand_landmarks:
            return None
        h, w = frame_bgr.shape[:2]
        return np.array([[p.x * w, p.y * h] for p in result.hand_landmarks[0]])

    def close(self):
        self._landmarker.close()


def draw_hand(frame, pts):
    for a, b in HAND_CONNECTIONS:
        cv2.line(frame, tuple(pts[a].astype(int)), tuple(pts[b].astype(int)), (0, 200, 0), 2)
    for p in pts:
        cv2.circle(frame, tuple(p.astype(int)), 3, (0, 0, 255), -1)
