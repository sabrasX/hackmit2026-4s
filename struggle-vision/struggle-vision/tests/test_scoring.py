"""The struggle score, and the ceiling the web UI's support thresholds sit under."""

import pytest

from struggle_vision import Config, struggle_score
from struggle_vision.scoring import WEIGHTS, score_parts

from test_detector import PALM_AWAY, feed
from struggle_vision import StruggleDetector


def status(**overrides):
    base = dict(hand_visible=True, stopped=False, still_extent=0.1, articulation=0.0,
                palm_facing_away=False, bad_posture=False, finger_extension=150.0,
                extension_excess=0.0, calibrated=True)
    base.update(overrides)
    return type("St", (), base)


def test_calm_writing_scores_zero():
    assert struggle_score(status()) == 0


def test_each_signal_is_worth_its_weight():
    assert struggle_score(status(stopped=True)) == 100 * WEIGHTS["stopped"]
    assert struggle_score(status(palm_facing_away=True)) == 100 * WEIGHTS["wrongPosition"]
    assert struggle_score(status(bad_posture=True)) == 100 * WEIGHTS["wrongPosition"]
    assert struggle_score(status(hand_visible=False)) == 100 * WEIGHTS["handMissing"]


def test_fidget_ramps_with_finger_speed():
    cfg = Config()
    quiet = struggle_score(status(articulation=cfg.stall_articulation), cfg)
    busy = struggle_score(status(articulation=cfg.fidget_articulation), cfg)
    assert quiet == 0
    assert busy == 100 * WEIGHTS["fidget"]
    assert 0 < struggle_score(status(articulation=1.2), cfg) < busy


def test_a_missing_hand_cannot_also_be_fidgeting():
    parts = score_parts(status(hand_visible=False, articulation=5.0))
    assert parts["fidget"] == 0


@pytest.mark.parametrize("worst", [
    status(stopped=True, palm_facing_away=True),
    status(stopped=True, bad_posture=True),
])
def test_the_worst_real_state_scores_sixty(worst):
    """The web UI's top support level must stay under this, or it never fires.

    A stopped hand has quiet fingers by definition, so it never earns fidget
    points as well, and a hand that isn't in view earns nothing but its own 15.
    """
    assert struggle_score(worst) == 60


def test_a_real_stalled_hand_scores_above_the_video_threshold():
    det = StruggleDetector()
    t = feed(det, 7.0, template=PALM_AWAY)
    # level 3 in frontend/src/config.js is 48, after up to 10 points of baseline discount
    assert struggle_score(det.evaluate(t)) >= 58
