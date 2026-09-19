"""Synthetic-trace tests for the detector logic (no camera needed).

Hand size is 100 px, camera runs at 30 fps, landmark noise ~1.2 px.
"""

import math
import random

import numpy as np
import pytest

from struggle_vision import Config, StruggleDetector

HS = 100.0
FPS = 30

# A plausible right hand in hand-size units: wrist at the origin, middle knuckle
# one unit away up the frame, fingers extending past it. Only the shape matters.
TEMPLATE = np.array([
    (0.00, 0.00),                                              # 0  wrist
    (-0.25, -0.20), (-0.45, -0.40), (-0.60, -0.55), (-0.72, -0.68),   # 1-4  thumb
    (-0.20, -0.95), (-0.25, -1.30), (-0.27, -1.50), (-0.28, -1.65),   # 5-8  index
    (0.00, -1.00), (0.02, -1.38), (0.03, -1.60), (0.03, -1.75),       # 9-12 middle
    (0.20, -0.95), (0.25, -1.28), (0.27, -1.48), (0.28, -1.62),       # 13-16 ring
    (0.38, -0.85), (0.45, -1.10), (0.48, -1.26), (0.50, -1.38),       # 17-20 pinky
])
# joints that curl when the fingers move: the two outermost of each finger
CURLING = [3, 4, 7, 8, 11, 12, 15, 16, 19, 20]


# the same for the three fingers that don't hold the pencil, so a test can churn
# them while leaving the thumb/index grip point perfectly still
SPARE_CURLING = [11, 12, 15, 16, 19, 20]


def hand(x, y, curl=0.0, joints=CURLING):
    """The 21 landmarks in pixels, centred on (x, y), fingers curled by `curl`."""
    pts = TEMPLATE.copy()
    pts[joints, 1] += curl
    return pts * HS + np.array([x, y])


def run(path, secs, cfg=None, gap=None, curl=None, landmarks=True, joints=CURLING):
    """Simulate `secs` seconds. path(t)->(x, y) is where the hand sits;
    curl(t)->float bends the fingers; gap=(a, b) hides the hand between a and b."""
    rng = random.Random(1)
    det = StruggleDetector(cfg or Config())
    out = []
    for i in range(int(secs * FPS)):
        t = i / FPS
        x, y = path(t)
        if not (gap and gap[0] <= t < gap[1]):
            if landmarks:
                pts = hand(x, y, curl(t) if curl else 0.0, joints)
                det.update_hand(t, pts + np.array([[rng.gauss(0, 1.2), rng.gauss(0, 1.2)]
                                                   for _ in range(len(pts))]))
            else:
                grip = (TEMPLATE[4] + TEMPLATE[8]) / 2 * HS + np.array([x, y])
                det.update_hand(t, grip + np.array([rng.gauss(0, 1.2), rng.gauss(0, 1.2)]), HS)
        det.check_hand_lost(t)
        out.append((t, det.evaluate(t)))
    return out


def first(out, attr):
    return next((t for t, s in out if getattr(s, attr)), None)


def peak(out, attr, after=0.0):
    return max(getattr(s, attr) for t, s in out if t >= after)


# ---------- stopped ----------

def test_still_hand_is_flagged_only_after_stop_seconds():
    out = run(lambda t: (400, 300), 8)
    t = first(out, "stopped")
    assert t is not None and 4.5 <= t <= 5.5


def test_brief_pause_is_not_flagged():
    out = run(lambda t: (400, 300) if t < 3 else (400 + 60 * (t - 3), 300), 8)
    assert first(out, "stopped") is None


def test_parked_hand_with_busy_fingers_is_not_stalled():
    """Hand in one spot but fingers working: that is fidgeting, not a stall."""
    out = run(lambda t: (400, 300), 10, curl=lambda t: 0.12 * math.sin(2 * math.pi * 3.0 * t))
    assert first(out, "stopped") is None
    assert first(out, "fidget") is not None


# ---------- fidget ----------

@pytest.mark.parametrize("amp,freq", [(6, 2.5), (10, 3.0), (15, 3.5)])
def test_normal_writing_is_not_flagged(amp, freq):
    """Hand tracks across the page while the fingers form letters: roughly one
    letter, and one letter's worth of forward progress, per oscillation."""
    def path(t):
        return (300 + 20 * freq * t + amp * math.sin(2 * math.pi * freq * t),
                300 + amp * math.cos(2 * math.pi * 1.7 * t))
    out = run(path, 10, curl=lambda t: 0.04 * math.sin(2 * math.pi * 2.0 * t))
    assert not any(s.stopped or s.fidget for _, s in out)


@pytest.mark.parametrize("freq", [3, 4, 5])
def test_fast_back_and_forth_is_fidget(freq):
    def path(t):
        return (400 + 30 * math.sin(2 * math.pi * freq * t),
                300 + 10 * math.sin(2 * math.pi * (freq - 1) * t))
    out = run(path, 8)
    assert first(out, "fidget") is not None


def test_finger_tapping_in_place_is_fidget():
    """The hand barely moves; only the joints give it away."""
    out = run(lambda t: (400, 300), 8, curl=lambda t: 0.10 * math.sin(2 * math.pi * 4.0 * t))
    assert first(out, "fidget") is not None


def test_churning_fingers_alone_is_fidget():
    """Only the three spare fingers move, so the grip point is perfectly still
    and the reversal test sees nothing: the joints have to catch this."""
    out = run(lambda t: (400, 300), 10, joints=SPARE_CURLING,
              curl=lambda t: 0.12 * math.sin(2 * math.pi * 3.0 * t))
    late = [s for t, s in out if t >= 3.5]
    assert max(s.reversals_per_s for s in late) < Config().fidget_rev_per_s
    assert first(out, "fidget") is not None


# ---------- articulation ----------

def test_sliding_the_whole_hand_does_not_read_as_finger_motion():
    """Articulation must be blind to the hand's own travel across the page."""
    out = run(lambda t: (200 + 120 * t, 300), 6)
    assert peak(out, "articulation", after=1.0) < Config().stall_articulation


def test_still_hand_reads_near_zero_articulation():
    out = run(lambda t: (400, 300), 6)
    assert peak(out, "articulation", after=1.0) < Config().stall_articulation


# ---------- hand lost ----------

def test_losing_the_hand_is_not_struggling():
    out = run(lambda t: (400, 300), 12, gap=(1, 12))
    assert not any(s.struggling for _, s in out)
    assert not out[-1][1].hand_visible


def test_hand_returning_after_a_gap_restarts_the_clock():
    out = run(lambda t: (400, 300), 14, gap=(2, 6))
    t = first(out, "stopped")
    assert t is not None and t > 6 + 4.5


# ---------- input shapes ----------

def test_bare_grip_point_still_works():
    """Callers with their own tracker can feed a single point plus a hand size."""
    out = run(lambda t: (400, 300), 8, landmarks=False)
    t = first(out, "stopped")
    assert t is not None and 4.5 <= t <= 5.5
    assert all(s.articulation == 0.0 for _, s in out)


def test_bare_grip_point_requires_hand_size():
    det = StruggleDetector()
    with pytest.raises(ValueError):
        det.update_hand(0.0, (100.0, 100.0))


def test_reset_motion_clears_history():
    out_det = StruggleDetector()
    for i in range(60):
        out_det.update_hand(i / FPS, hand(400, 300))
    out_det.reset_motion()
    assert not out_det.pos and not out_det.artic and out_det.articulation == 0.0
