"""Struggle-detection logic, from hand joints alone.

Pure numpy: no OpenCV or MediaPipe imports here, so it can be unit-tested and
reused with any hand tracker. Feed it the landmarks once per frame
(update_hand), then ask evaluate(t) what the current state is.

Two signals, both read off the joints:

* **stopped** - the grip point stays inside a small box *and* the fingers stay
  quiet, for `stop_seconds`. Requiring both is what separates a real stall from
  a hand that is parked in one spot but still working.
* **fidget**  - either the grip point reverses direction over and over while
  making no net progress across the page, or the fingers churn away while the
  hand goes nowhere.

Two measurements do the work. *Grip travel* is the path of the point between
thumb tip and index tip, in hand sizes. *Articulation* is how fast the finger
joints move once the hand's own position, rotation and scale are divided out,
so sliding the whole hand across the page contributes nothing to it and only
the fingers bending register.
"""

from collections import deque
from dataclasses import dataclass
from typing import Optional

import numpy as np

from .config import Config

# Indexes into MediaPipe's standard 21-point hand skeleton.
WRIST = 0
THUMB_TIP = 4
INDEX_TIP = 8
MIDDLE_MCP = 9

# Joints whose motion counts as finger articulation: the finger segments from
# the middle knuckle out. The wrist and middle knuckle define the reference
# frame, so they can never move within it and are excluded by construction.
ARTIC_JOINTS = [2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15, 16, 18, 19, 20]


def normalise_pose(pts):
    """Landmarks in a wrist-anchored frame, free of hand position/rotation/scale.

    x runs along wrist -> middle knuckle, y across it, both in hand sizes.
    Returns None if the hand is too degenerate to define a frame.
    """
    v = pts[MIDDLE_MCP] - pts[WRIST]
    length = float(np.linalg.norm(v))
    if length < 1e-6:
        return None
    along = v / length
    across = np.array([-along[1], along[0]])
    rel = (pts - pts[WRIST]) / length
    return np.stack([rel @ along, rel @ across], axis=1)


@dataclass
class Status:
    hand_visible: bool
    stopped: bool
    fidget: bool
    still_extent: float
    reversals_per_s: float
    efficiency: float
    articulation: float

    @property
    def struggling(self) -> bool:
        return self.stopped or self.fidget

    @property
    def reasons(self) -> list:
        pairs = (("STOPPED", self.stopped), ("FIDGET", self.fidget))
        return [name for name, on in pairs if on]


class StruggleDetector:
    def __init__(self, cfg: Optional[Config] = None):
        self.cfg = cfg or Config()
        self.hand_size = None
        self.last_hand_t = None
        self.grip = None
        self.reset_motion()

    # ---------- housekeeping ----------
    def reset_motion(self):
        self.pos = deque()        # every frame: (t, x, y)
        self.samples = deque()    # ~sample_hz: (t, x, y)
        self.last_sample_t = -1e9
        self.pose = None          # smoothed normalised pose
        self.pose_t = None
        self.artic = deque()      # (t, finger speed in hand sizes/s)
        self.articulation = 0.0

    def hand_visible(self, t: float) -> bool:
        return self.last_hand_t is not None and (t - self.last_hand_t) < self.cfg.hand_lost_s

    def check_hand_lost(self, t: float):
        if self.last_hand_t is not None and t - self.last_hand_t > self.cfg.hand_lost_s:
            self.reset_motion()

    # ---------- hand ----------
    def update_hand(self, t: float, points, hand_size: Optional[float] = None):
        """Feed one frame of hand landmarks.

        points: the (21, 2) array of landmark pixel coordinates. A bare (x, y)
        grip point is also accepted, with hand_size given explicitly; then only
        grip travel is available and articulation stays at 0.
        """
        c = self.cfg
        pts = np.asarray(points, dtype=float)
        if pts.ndim == 2 and pts.shape[0] >= 21:
            grip = (pts[THUMB_TIP] + pts[INDEX_TIP]) / 2.0
            size = float(np.linalg.norm(pts[WRIST] - pts[MIDDLE_MCP]))
            pose = normalise_pose(pts)
        elif pts.shape == (2,):
            grip, size, pose = pts, hand_size, None
            if size is None:
                raise ValueError("hand_size is required when passing a bare grip point")
        else:
            raise ValueError(f"expected a (21, 2) landmark array or an (x, y) point, got {pts.shape}")
        if not size or size <= 0:
            return                                             # degenerate hand, skip the frame

        fresh = self.grip is None or not self.hand_visible(t)   # first frame back after a gap
        self.grip = grip if fresh else 0.5 * grip + 0.5 * self.grip   # light smoothing
        self.hand_size = size if self.hand_size is None else 0.95 * self.hand_size + 0.05 * size
        self._update_articulation(t, pose, fresh)
        self.last_hand_t = t
        x, y = self.grip

        self.pos.append((t, x, y))
        while self.pos and t - self.pos[0][0] > c.stop_seconds:
            self.pos.popleft()

        # 0.9 so that a 30 fps camera really gives ~15 Hz samples
        if t - self.last_sample_t >= 0.9 / c.sample_hz:
            self.samples.append((t, x, y))
            self.last_sample_t = t
        while self.samples and t - self.samples[0][0] > c.fidget_window_s + 0.2:
            self.samples.popleft()

    def _update_articulation(self, t, pose, fresh):
        """Track how fast the finger joints move within the hand's own frame."""
        c = self.cfg
        if pose is None:
            return                                             # no landmarks: leave it unknown
        if fresh or self.pose is None:
            self.pose, self.pose_t = pose, t
            return
        dt = t - self.pose_t
        if dt <= 1e-6:
            return
        a = c.pose_smoothing
        smoothed = a * pose + (1.0 - a) * self.pose
        step = np.linalg.norm(smoothed[ARTIC_JOINTS] - self.pose[ARTIC_JOINTS], axis=1)
        # subtract the landmark jitter floor so a perfectly still hand reads ~0
        moved = float(np.clip(step - c.joint_noise, 0.0, None).mean())
        self.pose, self.pose_t = smoothed, t

        self.artic.append((t, moved / dt))
        while self.artic and t - self.artic[0][0] > c.fidget_window_s:
            self.artic.popleft()
        self.articulation = float(np.mean([a for _, a in self.artic]))

    # ---------- signals ----------
    def _stopped(self, t):
        c = self.cfg
        if not self.hand_visible(t) or len(self.pos) < 2:
            return False, 0.0
        span = self.pos[-1][0] - self.pos[0][0]
        xs = [p[1] for p in self.pos]
        ys = [p[2] for p in self.pos]
        extent = max(max(xs) - min(xs), max(ys) - min(ys)) / self.hand_size
        quiet_fingers = self.articulation <= c.stall_articulation
        parked = span >= c.stop_seconds - 0.3 and extent < c.still_extent
        return (parked and quiet_fingers), extent

    def _fidget(self, t):
        c = self.cfg
        if not self.hand_visible(t):
            return False, 0.0, 1.0
        s = [p for p in self.samples if t - p[0] <= c.fidget_window_s]
        if len(s) < c.sample_hz * c.fidget_window_s * 0.6:
            return False, 0.0, 1.0
        pts = np.array([(p[1], p[2]) for p in s]) / self.hand_size
        steps = np.diff(pts, axis=0)
        mags = np.linalg.norm(steps, axis=1)
        path = mags.sum()
        net = float(np.linalg.norm(pts[-1] - pts[0]))
        eff = net / path if path > 1e-6 else 1.0
        sig = steps[mags > c.step_noise]
        reversals = sum(1 for a, b in zip(sig[:-1], sig[1:]) if np.dot(a, b) < 0)
        rate = reversals / c.fidget_window_s

        # the hand wanders back and forth without crossing the page
        wandering = rate >= c.fidget_rev_per_s and eff <= c.fidget_max_efficiency
        # or it stays put while the fingers churn: tapping, twirling, re-gripping
        churning = (len(self.artic) > 0
                    and self.articulation >= c.fidget_articulation
                    and net <= c.fidget_max_progress)
        return (wandering or churning), rate, eff

    # ---------- result ----------
    def evaluate(self, t: float) -> Status:
        stopped, extent = self._stopped(t)
        fidget, rate, eff = self._fidget(t)
        return Status(self.hand_visible(t), stopped, fidget, extent, rate, eff, self.articulation)
