"""Struggle-detection logic, from hand joints alone.

Pure numpy: no OpenCV or MediaPipe imports here, so it can be unit-tested and
reused with any hand tracker. Feed it the landmarks once per frame
(update_hand), then ask evaluate(t) what the current state is.

Two signals, both read off the joints:

* **stopped** - the grip point stays inside a small box *and* the fingers stay
  quiet, for `stop_seconds`. Requiring both is what separates a real stall from
  a hand that is parked in one spot but still working.
* **twiddling** - the hand has been turned over, palm towards the camera, and
  the fingers are busy: the child is playing with the pencil, not writing.
* **wrong position** - the fingers are straighter than the writing grip a
  teacher demonstrated during calibration: the hand has gone flat.

Two measurements do the work. *Grip travel* is the path of the point between
thumb tip and index tip, in hand sizes. *Articulation* is how fast the finger
joints move once the hand's own position, rotation and scale are divided out,
so sliding the whole hand across the page contributes nothing to it and only
the fingers bending register.
"""

import json
from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import numpy as np

from .config import Config

CALIBRATION_VERSION = 2

# Indexes into MediaPipe's standard 21-point hand skeleton.
WRIST = 0
THUMB_TIP = 4
INDEX_TIP = 8
MIDDLE_MCP = 9
INDEX_MCP = 5
PINKY_MCP = 17

# Joints whose motion counts as finger articulation: the finger segments from
# the middle knuckle out. The wrist and middle knuckle define the reference
# frame, so they can never move within it and are excluded by construction.
ARTIC_JOINTS = [2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15, 16, 18, 19, 20]

# Each finger as a chain rooted at the wrist, so the bend at every joint can be
# measured from the two bones that meet there.
FINGER_CHAINS = (
    (0, 1, 2, 3, 4),        # thumb
    (0, 5, 6, 7, 8),        # index
    (0, 9, 10, 11, 12),     # middle
    (0, 13, 14, 15, 16),    # ring
    (0, 17, 18, 19, 20),    # pinky
)
N_ANGLES = len(FINGER_CHAINS) * 3


def joint_angles(pts):
    """The bend at every finger joint, in degrees. 180 is dead straight.

    Three per finger (knuckle, middle joint, outer joint). Angles need no
    normalising: they already ignore where the hand is, how big it is and which
    way it points, which is what makes them a fair comparison between two
    different people's hands. Returns None if the hand is too degenerate.
    """
    out = np.empty(N_ANGLES)
    i = 0
    for chain in FINGER_CHAINS:
        for k in (1, 2, 3):
            u = pts[chain[k - 1]] - pts[chain[k]]
            v = pts[chain[k + 1]] - pts[chain[k]]
            nu, nv = np.linalg.norm(u), np.linalg.norm(v)
            if nu < 1e-6 or nv < 1e-6:
                return None
            out[i] = np.degrees(np.arccos(np.clip(np.dot(u, v) / (nu * nv), -1.0, 1.0)))
            i += 1
    return out


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


def palm_towards_camera(pts, handedness: str = "Right") -> bool:
    """True when we're looking at the palm rather than the back of the hand.

    Which way round the knuckles run tells us which face we're seeing: going
    wrist -> index knuckle -> pinky knuckle winds one way for the palm and the
    other for the back, and the two swap over between left and right hands.
    Writing is normally filmed from the back of the hand, so this turning true
    means the hand has been turned over.
    """
    v1 = pts[INDEX_MCP] - pts[WRIST]
    v2 = pts[PINKY_MCP] - pts[WRIST]
    cross = float(v1[0] * v2[1] - v1[1] * v2[0])
    return cross > 0 if str(handedness).lower().startswith("r") else cross < 0


@dataclass
class PostureReference:
    """The writing grip a teacher demonstrated, as joint angles."""
    angles: np.ndarray          # (15,) degrees, one per finger joint
    wobble: float               # how much those angles moved while recording

    @property
    def extension(self) -> float:
        """Mean bend across the hand. Higher means straighter fingers."""
        return float(self.angles.mean())


def save_calibration(path, ref: PostureReference):
    Path(path).write_text(json.dumps({
        "version": CALIBRATION_VERSION,
        "angles": ref.angles.tolist(),
        "wobble": ref.wobble,
    }, indent=1))


def load_calibration(path) -> PostureReference:
    data = json.loads(Path(path).read_text())
    if data.get("version") != CALIBRATION_VERSION:
        raise ValueError(f"{path}: calibration format v{data.get('version')}, expected "
                         f"v{CALIBRATION_VERSION}. Re-calibrate.")
    angles = np.asarray(data["angles"], dtype=float)
    if angles.shape != (N_ANGLES,):
        raise ValueError(f"{path}: expected {N_ANGLES} joint angles, got {angles.shape}")
    return PostureReference(angles, float(data["wobble"]))


@dataclass
class Status:
    hand_visible: bool
    stopped: bool
    twiddling: bool
    still_extent: float
    articulation: float
    palm_up: bool
    bad_posture: bool
    finger_extension: float     # mean joint angle right now, degrees
    extension_excess: float     # how much straighter than the demonstrated grip
    calibrated: bool

    @property
    def struggling(self) -> bool:
        return self.stopped or self.twiddling

    @property
    def reasons(self) -> list:
        pairs = (("STOPPED", self.stopped), ("WRONG POSITION", self.twiddling))
        return [name for name, on in pairs if on]


class StruggleDetector:
    def __init__(self, cfg: Optional[Config] = None):
        self.cfg = cfg or Config()
        self.hand_size = None
        self.last_hand_t = None
        self.grip = None
        self.reference = None         # PostureReference, once a teacher has calibrated
        self.calibration_error = None
        self._calib = None            # in-progress recording
        self.reset_motion()
        self.reset_posture()

    # ---------- housekeeping ----------
    def reset_motion(self):
        self.pos = deque()        # every frame: (t, x, y)
        self.pose = None          # smoothed normalised pose
        self.pose_t = None
        self.artic = deque()      # (t, finger speed in hand sizes/s)
        self.articulation = 0.0
        self.palm_up = False
        self.twiddling = False
        self._twiddle_since = None

    def reset_posture(self):
        self.finger_extension = 0.0
        self.extension_excess = 0.0
        self.bad_posture = False
        self._bad_since = None
        self._posture_seen = False

    def hand_visible(self, t: float) -> bool:
        return self.last_hand_t is not None and (t - self.last_hand_t) < self.cfg.hand_lost_s

    def check_hand_lost(self, t: float):
        if self.last_hand_t is not None and t - self.last_hand_t > self.cfg.hand_lost_s:
            self.reset_motion()
            self.reset_posture()
            if self._calib is not None:
                self.cancel_calibration("the hand left the frame")

    # ---------- calibration ----------
    def start_calibration(self, t: float):
        """Begin recording the pose being demonstrated. Finishes on its own."""
        self._calib = {"start": t, "angles": []}
        self.calibration_error = None

    def cancel_calibration(self, why: Optional[str] = None):
        self._calib = None
        self.calibration_error = why

    def set_reference(self, ref: Optional[PostureReference]):
        self.reference = ref
        self.reset_posture()

    @property
    def calibrating(self) -> bool:
        return self._calib is not None

    def calibration_progress(self, t: float) -> float:
        if self._calib is None:
            return 0.0
        return min(1.0, (t - self._calib["start"]) / self.cfg.calibrate_seconds)

    def _finish_calibration(self):
        c = self.cfg
        recorded = np.array(self._calib["angles"])
        self._calib = None
        if len(recorded) < c.calibrate_min_frames:
            self.calibration_error = (f"only {len(recorded)} good frames - keep the whole hand "
                                      f"in view and try again")
            return
        # median over the window, so a few bad landmark frames don't drag it
        ref = np.median(recorded, axis=0)
        wobble = float(np.abs(recorded - ref).mean())
        if wobble > c.calibrate_max_wobble_deg:
            self.calibration_error = (f"the hand kept changing shape while recording "
                                      f"(wobble {wobble:.1f} deg > {c.calibrate_max_wobble_deg}) - "
                                      f"hold the grip still")
            return
        self.calibration_error = None
        self.set_reference(PostureReference(ref, wobble))

    # ---------- hand ----------
    def update_hand(self, t: float, points, hand_size: Optional[float] = None,
                    handedness: str = "Right"):
        """Feed one frame of hand landmarks.

        points: the (21, 2) array of landmark pixel coordinates. A bare (x, y)
        grip point is also accepted, with hand_size given explicitly; then only
        grip travel is available, and articulation and twiddling stay off.
        handedness: "Left" or "Right", as the tracker reported it. Only used to
        work out which way the hand is facing.
        """
        c = self.cfg
        pts = np.asarray(points, dtype=float)
        if pts.ndim == 2 and pts.shape[0] >= 21:
            grip = (pts[THUMB_TIP] + pts[INDEX_TIP]) / 2.0
            size = float(np.linalg.norm(pts[WRIST] - pts[MIDDLE_MCP]))
            pose = normalise_pose(pts)
            angles = joint_angles(pts)
        elif pts.shape == (2,):
            grip, size, pose, angles = pts, hand_size, None, None
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
        self._update_posture(t, angles)
        self._update_twiddle(t, pts if pose is not None else None, handedness)
        self.last_hand_t = t
        x, y = self.grip

        self.pos.append((t, x, y))
        while self.pos and t - self.pos[0][0] > c.stop_seconds:
            self.pos.popleft()

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
        while self.artic and t - self.artic[0][0] > c.artic_window_s:
            self.artic.popleft()
        self.articulation = float(np.mean([a for _, a in self.artic]))

    def _update_twiddle(self, t, pts, handedness):
        """Pencil twiddling: the hand turned over, fingers busy."""
        c = self.cfg
        if pts is None:
            return
        self.palm_up = palm_towards_camera(pts, handedness)
        if self.palm_up and self.articulation >= c.twiddle_articulation:
            if self._twiddle_since is None:
                self._twiddle_since = t
        else:
            self._twiddle_since = None
        self.twiddling = (self._twiddle_since is not None
                          and t - self._twiddle_since >= c.twiddle_confirm_s)

    def _update_posture(self, t, angles):
        """Record the demonstrated grip, or score the live hand against it."""
        c = self.cfg
        if angles is None:
            return
        if self._calib is not None:
            self._calib["angles"].append(angles)
            if t - self._calib["start"] >= c.calibrate_seconds:
                self._finish_calibration()
            return

        extension = float(angles.mean())
        if not self._posture_seen:
            self.finger_extension, self._posture_seen = extension, True
        else:
            a = c.posture_smoothing
            self.finger_extension = a * extension + (1.0 - a) * self.finger_extension
        if self.reference is None:
            return

        # Only *straighter than demonstrated* counts. Forming letters moves the
        # joints by a few degrees either way; a hand going flat opens every one
        # of them at once, which is a much larger and one-directional change.
        self.extension_excess = self.finger_extension - self.reference.extension
        if self.extension_excess > c.flat_tolerance_deg:
            if self._bad_since is None:
                self._bad_since = t
        else:
            self._bad_since = None
        # hold it for a moment: reaching for an eraser shouldn't raise the flag
        self.bad_posture = (self._bad_since is not None
                            and t - self._bad_since >= c.flat_confirm_s)

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

    # ---------- result ----------
    def evaluate(self, t: float) -> Status:
        visible = self.hand_visible(t)
        stopped, extent = self._stopped(t)
        return Status(visible, stopped, self.twiddling and visible, extent,
                      self.articulation, self.palm_up and visible,
                      self.bad_posture and visible, self.finger_extension,
                      self.extension_excess, self.reference is not None)
