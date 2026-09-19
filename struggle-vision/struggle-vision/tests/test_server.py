"""The wire format the web UI depends on, and the socket layer around it.

No camera needed: the detector is driven from synthetic hands, and the
end-to-end test swaps the camera worker for a stub.
"""

import asyncio
import json

import pytest
import websockets

from struggle_vision import StruggleDetector
from struggle_vision.server import serve, status_payload

from test_detector import FLAT, FPS, PALM_UP, calibrated_detector, feed

EXPECTED_KEYS = {
    "t", "handVisible", "stopped", "twiddling", "struggling", "badPosture", "reasons",
    "stillExtent", "articulation", "palmUp", "fingerExtension", "extensionExcess",
    "calibrated", "calibrating", "calibrationProgress", "calibrationError",
}


def payload_after(det, t):
    return status_payload(t, det.evaluate(t), det)


def test_payload_has_exactly_the_documented_keys():
    det = StruggleDetector()
    t = feed(det, 2.0)
    assert set(payload_after(det, t)) == EXPECTED_KEYS


@pytest.mark.parametrize("build", [
    lambda: (StruggleDetector(), 0.0),                       # nothing seen yet
    lambda: (lambda d: (d, feed(d, 6.0)))(StruggleDetector()),   # stalled
    calibrated_detector,                                     # mid-session, calibrated
])
def test_payload_is_json_serialisable(build):
    """numpy floats and bools leak in easily and json.dumps refuses them."""
    det, t = build()
    text = json.dumps(payload_after(det, t))
    for value in json.loads(text).values():
        assert value is None or isinstance(value, (bool, int, float, str, list))


def test_payload_reports_a_stall():
    det = StruggleDetector()
    t = feed(det, 7.0)
    p = payload_after(det, t)
    assert p["stopped"] and p["struggling"] and "STOPPED" in p["reasons"]


def test_payload_reports_twiddling():
    det = StruggleDetector()
    t = 0.0
    for i in range(int(6.0 * FPS)):                          # palm up, fingers working
        t = i / FPS
        det.update_hand(t, _twiddling_hand(t))
    p = payload_after(det, t)
    assert p["palmUp"] and p["twiddling"] and p["struggling"]


def test_payload_reports_a_flat_hand():
    det, t = calibrated_detector()
    t = feed(det, 3.0, t0=t, template=FLAT)
    p = payload_after(det, t)
    assert p["badPosture"] and p["calibrated"] and p["extensionExcess"] > 0


def test_payload_tracks_calibration_progress():
    det = StruggleDetector()
    det.start_calibration(0.0)
    t = feed(det, 1.5)
    p = payload_after(det, t)
    assert p["calibrating"] and 0.0 < p["calibrationProgress"] < 1.0
    assert not p["calibrated"]


# ---------- the socket layer ----------

class StubWorker:
    """Stands in for the camera thread."""

    def __init__(self):
        self.commands = []
        self.alive = True

    def snapshot(self):
        return {"t": 1.25, "stopped": True, "reasons": ["STOPPED"]}

    def submit(self, command):
        self.commands.append(command)

    def is_alive(self):
        return self.alive


def test_a_client_receives_the_stream_and_can_send_commands():
    """Also pins the handler signature, which differs across websockets versions."""
    port = 8791

    async def scenario():
        worker = StubWorker()
        server = asyncio.ensure_future(serve(worker, "127.0.0.1", port, hz=20))
        await asyncio.sleep(0.3)
        async with websockets.connect(f"ws://127.0.0.1:{port}") as ws:
            first = json.loads(await asyncio.wait_for(ws.recv(), timeout=3))
            await ws.send(json.dumps({"type": "calibrate"}))
            await ws.send("not json at all")          # must not drop the connection
            await ws.send(json.dumps({"type": "reset"}))
            second = json.loads(await asyncio.wait_for(ws.recv(), timeout=3))
        worker.alive = False
        server.cancel()
        try:
            await server
        except asyncio.CancelledError:
            pass
        return first, second, worker.commands

    first, second, commands = asyncio.run(scenario())
    assert first["t"] == 1.25 and first["reasons"] == ["STOPPED"]
    assert second == first
    assert commands == [{"type": "calibrate"}, {"type": "reset"}]


def _twiddling_hand(t):
    import math

    import numpy as np

    from test_detector import CURLING, HS
    pts = PALM_UP.copy()
    pts[CURLING, 1] += 0.12 * math.sin(2 * math.pi * 3.0 * t)
    return pts * HS + np.array([400.0, 300.0])
