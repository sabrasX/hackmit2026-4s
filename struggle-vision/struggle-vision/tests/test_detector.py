"""Synthetic-trace tests for the detector logic (no camera needed).

Hand size is 100 px, camera runs at 30 fps, landmark noise ~1.2 px.
"""

import math
import random

import numpy as np
import pytest

from struggle_vision import (Config, PostureReference, StruggleDetector, load_calibration,
                             save_calibration)
from struggle_vision.detector import joint_angles, palm_towards_camera

HS = 100.0
FPS = 30

# A right hand built joint by joint, in hand-size units: wrist at the origin,
# middle knuckle exactly one unit up the frame (so the hand size is 1), each
# finger walked outwards from its knuckle. Fingers come from flexion angles
# rather than hard-coded points, so a writing grip and a flat hand differ the
# way real ones do: by how far each joint is bent.
#
# Per finger: knuckle position, the direction it leaves the knuckle (degrees,
# -90 being straight up the frame), and the three bone lengths.
FINGER_SHAPE = {
    "thumb":  ((-0.25, -0.20), -140, (0.30, 0.22, 0.18)),
    "index":  ((-0.20, -0.95), -100, (0.40, 0.24, 0.18)),
    "middle": ((0.00, -1.00), -92, (0.44, 0.26, 0.19)),
    "ring":   ((0.20, -0.95), -84, (0.40, 0.24, 0.18)),
    "pinky":  ((0.38, -0.85), -76, (0.32, 0.20, 0.16)),
}
# degrees of flexion at each of the three joints, walking out along the finger
WRITING_BENDS = {
    "thumb": (15, 25, 15), "index": (30, 55, 25), "middle": (25, 50, 25),
    "ring": (35, 70, 30), "pinky": (40, 75, 35),
}
FLAT_BENDS = {name: (3, 4, 2) for name in FINGER_SHAPE}   # only the natural curve left


def build_hand(bends):
    """The 21 landmarks for a hand with the given flexion at every joint."""
    pts = [np.zeros(2)]
    for name, (knuckle, direction, lengths) in FINGER_SHAPE.items():
        p = np.array(knuckle, dtype=float)
        pts.append(p.copy())
        angle = direction
        for length, bend in zip(lengths, bends[name]):
            angle += bend                                  # curling towards the palm
            p = p + length * np.array([math.cos(math.radians(angle)),
                                       math.sin(math.radians(angle))])
            pts.append(p.copy())
    return np.array(pts)


def mirror(pts):
    """The same hand seen from the other side. Mirroring preserves joint angles."""
    out = pts.copy()
    out[:, 0] *= -1
    return out


# build_hand lays out a right hand with the palm towards the camera. Writing is
# filmed from the back of the hand, so that's the mirror image; turning the hand
# over to play with the pencil is the un-mirrored one.
TEMPLATE = mirror(build_hand(WRITING_BENDS))    # holding a pencil, back of hand to camera
FLAT = mirror(build_hand(FLAT_BENDS))           # collapsed flat onto the page
PALM_UP = build_hand(WRITING_BENDS)             # same grip, hand turned over
# joints that curl when the fingers move: the two outermost of each finger
CURLING = [3, 4, 7, 8, 11, 12, 15, 16, 19, 20]

# the two outermost joints of the three fingers that don't hold the pencil, so a
# test can churn them while leaving the thumb/index grip point perfectly still
SPARE_CURLING = [11, 12, 15, 16, 19, 20]


def hand(x, y, curl=0.0, joints=CURLING, template=TEMPLATE):
    """The 21 landmarks in pixels, centred on (x, y), fingers curled by `curl`."""
    pts = template.copy()
    pts[joints, 1] += curl
    return pts * HS + np.array([x, y])


def run(path, secs, cfg=None, gap=None, curl=None, landmarks=True, joints=CURLING,
        template=TEMPLATE):
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
                pts = hand(x, y, curl(t) if curl else 0.0, joints, template)
                det.update_hand(t, pts + np.array([[rng.gauss(0, 1.2), rng.gauss(0, 1.2)]
                                                   for _ in range(len(pts))]))
            else:
                grip = (TEMPLATE[4] + TEMPLATE[8]) / 2 * HS + np.array([x, y])
                det.update_hand(t, grip + np.array([rng.gauss(0, 1.2), rng.gauss(0, 1.2)]), HS)
        det.check_hand_lost(t)
        out.append((t, det.evaluate(t)))
    return out


def feed(det, secs, t0=0.0, template=TEMPLATE, rng=None, x=400, y=300):
    """Hold a pose in front of the detector for `secs`. Returns the last timestamp."""
    rng = rng or random.Random(7)
    t = t0
    for i in range(int(secs * FPS)):
        t = t0 + i / FPS
        pts = hand(x, y, template=template)
        det.update_hand(t, pts + np.array([[rng.gauss(0, 1.2), rng.gauss(0, 1.2)]
                                           for _ in range(len(pts))]))
        det.check_hand_lost(t)
    return t


def calibrated_detector(cfg=None):
    """A detector that has watched a teacher demonstrate the writing position."""
    det = StruggleDetector(cfg or Config())
    det.start_calibration(0.0)
    t = feed(det, det.cfg.calibrate_seconds + 0.5)
    assert det.reference is not None, det.calibration_error
    return det, t + 1.0 / FPS


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
    """Hand in one spot but fingers still working: not a stall."""
    out = run(lambda t: (400, 300), 10, curl=lambda t: 0.12 * math.sin(2 * math.pi * 3.0 * t))
    assert first(out, "stopped") is None


@pytest.mark.parametrize("amp,freq", [(6, 2.5), (10, 3.0), (15, 3.5)])
def test_normal_writing_is_not_flagged(amp, freq):
    """Hand tracks across the page while the fingers form letters."""
    def path(t):
        return (300 + 20 * freq * t + amp * math.sin(2 * math.pi * freq * t),
                300 + amp * math.cos(2 * math.pi * 1.7 * t))
    out = run(path, 10, curl=lambda t: 0.04 * math.sin(2 * math.pi * 2.0 * t))
    assert not any(s.stopped or s.twiddling for _, s in out)


# ---------- twiddling ----------

def test_palm_towards_camera_tells_the_two_sides_apart():
    assert palm_towards_camera(PALM_UP * HS, "Right")
    assert not palm_towards_camera(TEMPLATE * HS, "Right")
    # a left hand is the mirror image, so the answers swap over
    assert not palm_towards_camera(PALM_UP * HS, "Left")
    assert palm_towards_camera(TEMPLATE * HS, "Left")


def test_hand_turned_over_with_busy_fingers_is_twiddling():
    out = run(lambda t: (400, 300), 8, template=PALM_UP,
              curl=lambda t: 0.12 * math.sin(2 * math.pi * 3.0 * t))
    assert first(out, "twiddling") is not None


def test_busy_fingers_palm_down_is_not_twiddling():
    """The same finger motion while writing normally: not twiddling."""
    out = run(lambda t: (400, 300), 8,
              curl=lambda t: 0.12 * math.sin(2 * math.pi * 3.0 * t))
    assert first(out, "twiddling") is None
    assert not any(s.palm_up for _, s in out)


def test_hand_turned_over_but_still_is_not_twiddling():
    """Resting an upturned hand isn't playing with the pencil."""
    out = run(lambda t: (400, 300), 8, template=PALM_UP)
    assert first(out, "twiddling") is None
    assert all(s.palm_up for t, s in out if s.hand_visible)


def test_a_brief_flip_is_not_twiddling():
    det = StruggleDetector()
    t = feed(det, 4.0, template=PALM_UP)          # busy hand needs finger motion first
    assert not det.evaluate(t).twiddling


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


# ---------- calibration and hand position ----------

def test_calibration_records_the_demonstrated_grip():
    det, _ = calibrated_detector()
    assert not det.calibrating
    assert det.calibration_error is None
    assert det.reference.angles.shape == (15,)
    assert det.reference.wobble < Config().calibrate_max_wobble_deg
    # a writing grip has properly bent fingers, nowhere near straight
    assert 120 < det.reference.extension < 160


def test_a_flat_hand_really_does_have_straighter_joints():
    """The premise the whole signal rests on."""
    writing = joint_angles(TEMPLATE * HS)
    flat = joint_angles(FLAT * HS)
    assert flat.mean() > writing.mean() + 25
    assert (flat > writing).all()


def test_the_same_pose_is_not_flagged():
    det, t = calibrated_detector()
    t = feed(det, 3.0, t0=t, rng=random.Random(99))
    st = det.evaluate(t)
    assert st.calibrated and not st.bad_posture


def test_hand_gone_flat_is_wrong_position():
    det, t = calibrated_detector()
    t = feed(det, 3.0, t0=t, template=FLAT)
    st = det.evaluate(t)
    assert st.bad_posture and st.extension_excess > Config().flat_tolerance_deg


def test_writing_moves_the_joints_without_tripping_the_flag():
    """Forming letters bends and straightens the fingers the whole time. That
    must not read as the hand going flat."""
    det, t = calibrated_detector()
    rng = random.Random(5)
    worst = 0.0
    for i in range(int(8.0 * FPS)):
        t += 1.0 / FPS
        # every joint working, plus a slow drift in how hard the pencil is gripped
        wiggle = {name: tuple(b + 10 * math.sin(2 * math.pi * 2.5 * t + j)
                              + 6 * math.sin(2 * math.pi * 0.3 * t)
                              for j, b in enumerate(bends))
                  for name, bends in WRITING_BENDS.items()}
        pts = build_hand(wiggle) * HS + np.array([300 + 30 * t, 300])
        det.update_hand(t, pts + np.array([[rng.gauss(0, 1.2), rng.gauss(0, 1.2)]
                                           for _ in range(21)]))
        st = det.evaluate(t)
        assert not st.bad_posture
        worst = max(worst, st.extension_excess)
    # and with real headroom, not by a hair
    assert worst < 0.6 * Config().flat_tolerance_deg


def test_gripping_tighter_is_not_flagged():
    """Only straighter counts. A child clenching the pencil is a different
    problem, and this signal shouldn't claim to catch it."""
    det, t = calibrated_detector()
    tight = build_hand({n: tuple(b + 20 for b in bends)
                        for n, bends in WRITING_BENDS.items()})
    t = feed(det, 3.0, t0=t, template=tight)
    st = det.evaluate(t)
    assert not st.bad_posture and st.extension_excess < 0


def test_brief_position_change_is_not_flagged():
    """Reaching for an eraser shouldn't raise the flag."""
    det, t = calibrated_detector()
    t = feed(det, det.cfg.flat_confirm_s * 0.4, t0=t, template=FLAT)
    assert not det.evaluate(t).bad_posture


def test_recovering_the_position_clears_the_flag():
    det, t = calibrated_detector()
    t = feed(det, 3.0, t0=t, template=FLAT)
    assert det.evaluate(t).bad_posture
    t = feed(det, 3.0, t0=t + 1.0 / FPS)
    assert not det.evaluate(t).bad_posture


def test_calibration_rejects_a_hand_that_keeps_changing_shape():
    det = StruggleDetector()
    det.start_calibration(0.0)
    rng = random.Random(3)
    t = 0.0
    for i in range(int((det.cfg.calibrate_seconds + 0.5) * FPS)):
        t = i / FPS
        pts = hand(400, 300, template=TEMPLATE if (i // 8) % 2 else FLAT)
        det.update_hand(t, pts + np.array([[rng.gauss(0, 1.2), rng.gauss(0, 1.2)]
                                           for _ in range(21)]))
    assert det.reference is None
    assert "kept changing shape" in det.calibration_error


def test_losing_the_hand_cancels_calibration():
    det = StruggleDetector()
    det.start_calibration(0.0)
    t = feed(det, 1.0)
    det.check_hand_lost(t + det.cfg.hand_lost_s + 0.1)
    assert not det.calibrating and det.reference is None
    assert "left the frame" in det.calibration_error


def test_without_calibration_position_is_never_flagged():
    out = run(lambda t: (400, 300), 6, joints=[], landmarks=True)
    assert not any(s.calibrated or s.bad_posture for _, s in out)


def test_clearing_the_reference_turns_the_check_off():
    det, t = calibrated_detector()
    t = feed(det, 3.0, t0=t, template=FLAT)
    assert det.evaluate(t).bad_posture
    det.set_reference(None)
    assert not det.evaluate(t).bad_posture and not det.evaluate(t).calibrated


def test_calibration_survives_a_save_and_load(tmp_path):
    det, _ = calibrated_detector()
    path = tmp_path / "calibration.json"
    save_calibration(path, det.reference)
    back = load_calibration(path)
    assert np.allclose(back.angles, det.reference.angles)
    assert back.wobble == pytest.approx(det.reference.wobble)


def test_loading_a_foreign_calibration_is_rejected(tmp_path):
    path = tmp_path / "bad.json"
    path.write_text('{"version": 999, "angles": [], "wobble": 0.0}')
    with pytest.raises(ValueError):
        load_calibration(path)


def test_loading_a_wrong_shaped_calibration_is_rejected(tmp_path):
    path = tmp_path / "short.json"
    save_calibration(path, PostureReference(np.zeros(5), 0.0))
    with pytest.raises(ValueError):
        load_calibration(path)


def test_reset_motion_clears_history():
    out_det = StruggleDetector()
    for i in range(60):
        out_det.update_hand(i / FPS, hand(400, 300))
    out_det.reset_motion()
    assert not out_det.pos and not out_det.artic and out_det.articulation == 0.0
