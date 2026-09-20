"""OpenCV helpers: camera access."""

import sys

import cv2


def _backend():
    """The capture backend that actually works on this OS.

    DirectShow is Windows-only - asking for it on macOS or Linux makes every
    camera index fail to open, with no error to say why.
    """
    if sys.platform == "win32":
        return cv2.CAP_DSHOW
    if sys.platform == "darwin":
        return cv2.CAP_AVFOUNDATION
    return cv2.CAP_ANY


def open_camera(src):
    if isinstance(src, int):
        return cv2.VideoCapture(src, _backend())
    return cv2.VideoCapture(src)


def list_cameras(n: int = 6):
    for i in range(n):
        cap = cv2.VideoCapture(i, _backend())
        ok, frame = cap.read()
        if ok:
            print(f"index {i}: OK ({frame.shape[1]}x{frame.shape[0]})")
        else:
            print(f"index {i}: nothing")
        cap.release()
