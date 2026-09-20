"""The struggle score: the detector's signals collapsed into one 0-100 number.

The score lives here, next to the detector that produces the signals, so the
overlay, the WebSocket stream and the web UI's graph all read the same number
instead of each inventing their own.

Four signals contribute, each worth a fixed share of the score:

* **stopped** - the hand parked with quiet fingers (a stall).
* **wrong position** - palm turned off the page, or the hand gone flat.
* **hand missing** - no hand in view at all.
* **fidget** - finger speed above what writing needs, ramped between
  `stall_articulation` (quiet) and `fidget_articulation` (full marks).

Every share is 0 when its signal is clear, so a child writing calmly scores 0.
"""

from .config import Config

WEIGHTS = {
    "stopped": 0.35,
    "wrongPosition": 0.25,
    "fidget": 0.25,
    "handMissing": 0.15,
}


def _ramp(value: float, low: float, high: float) -> float:
    if high <= low:
        return 0.0
    return min(1.0, max(0.0, (value - low) / (high - low)))


def score_parts(status, cfg: Config = None) -> dict:
    """Each signal's contribution to the score, in points out of 100."""
    c = cfg or Config()
    fidget = _ramp(status.articulation, c.stall_articulation, c.fidget_articulation)
    shares = {
        "stopped": 1.0 if status.stopped else 0.0,
        "wrongPosition": 1.0 if (status.palm_facing_away or status.bad_posture) else 0.0,
        "fidget": fidget if status.hand_visible else 0.0,
        "handMissing": 0.0 if status.hand_visible else 1.0,
    }
    return {name: round(100.0 * WEIGHTS[name] * share, 1) for name, share in shares.items()}


def struggle_score(status, cfg: Config = None) -> float:
    """How much the child is struggling right now, 0 (calm) to 100."""
    return round(sum(score_parts(status, cfg).values()), 1)
