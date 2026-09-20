"""All tunable settings in one place.

Distances are measured in "hand sizes" (wrist -> middle knuckle), so the values
don't depend on how far the camera is from the desk. Speeds are in hand sizes
per second. Every default is a starting guess: tune it against real footage
(see README, "Tuning").
Any field can also be overridden on the command line, e.g. --stop-seconds 8.
"""

from dataclasses import dataclass


@dataclass
class Config:
    # --- video ---
    frame_width: int = 960              # frames are resized to this width for speed

    # --- 1) stopped: hand parked in one spot with quiet fingers ---
    stop_seconds: float = 1.0
    still_extent: float = 0.30          # box the grip point stays inside, in hand sizes
    stall_articulation: float = 0.5    # finger speed still quiet enough to count as stalled
    fidget_articulation: float = 2.0    # finger speed well past writing: a full fidget score

    # --- 2) palm facing away: read straight off the landmarks, nothing to tune ---

    # --- 3) hand gone flat: finger joint angles vs. the demonstrated grip ---
    # Angles are in degrees, 180 being a dead straight finger. Writing moves the
    # joints by a few degrees; a hand flattening onto the page opens all fifteen
    # at once, so the gap between the two is wide.
    calibrate_seconds: float = 3.0      # how long the demonstrated grip is recorded for
    calibrate_min_frames: int = 20      # fewer good frames than this => calibration failed
    calibrate_max_wobble_deg: float = 8.0   # the grip must be held this steady while recording
    flat_tolerance_deg: float = 20.0    # straighter than the grip by this much => flat
    flat_confirm_s: float = 0.5         # flat this long => flag it
    posture_smoothing: float = 0.15     # EMA weight on the newest measurement

    # --- joints ---
    # Landmark jitter is the same size as real finger motion, so the pose is
    # smoothed and a per-joint floor is subtracted before anything is measured.
    pose_smoothing: float = 0.35        # EMA weight on the newest pose (lower = smoother)
    joint_noise: float = 0.020          # per-joint per-frame jitter floor, in hand sizes
    artic_window_s: float = 3.0         # finger speed is averaged over this window

    # --- general ---
    hand_lost_s: float = 1.5            # hand unseen this long => reset history ("away", not "struggling")
    log_every_s: float = 0.2
