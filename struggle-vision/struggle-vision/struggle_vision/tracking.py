"""OpenCV helpers: camera access."""

import cv2


def open_camera(src):
    # CAP_DSHOW is the reliable backend on Windows for webcam-style devices
    if isinstance(src, int):
        return cv2.VideoCapture(src, cv2.CAP_DSHOW)
    return cv2.VideoCapture(src)


def list_cameras(n: int = 6):
    for i in range(n):
        cap = cv2.VideoCapture(i, cv2.CAP_DSHOW)
        ok, frame = cap.read()
        if ok:
            print(f"index {i}: OK ({frame.shape[1]}x{frame.shape[0]})")
        else:
            print(f"index {i}: nothing")
        cap.release()
