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
    stop_seconds: float = 5.0
    still_extent: float = 0.30          # box the grip point stays inside, in hand sizes
    stall_articulation: float = 0.04    # finger speed still quiet enough to count as stalled

    # --- 2) fidget: going back and forth, or fingers churning in place ---
    fidget_window_s: float = 3.0
    sample_hz: float = 15.0
    step_noise: float = 0.03            # grip steps smaller than this count as landmark jitter
    fidget_rev_per_s: float = 6.0       # direction reversals per second
    fidget_max_efficiency: float = 0.25  # net displacement / path length
    fidget_articulation: float = 0.06   # finger speed that counts as churning
    fidget_max_progress: float = 0.60   # churning only counts if the hand travelled less than this

    # --- joints ---
    # Landmark jitter is the same size as real finger motion, so the pose is
    # smoothed and a per-joint floor is subtracted before anything is measured.
    pose_smoothing: float = 0.35        # EMA weight on the newest pose (lower = smoother)
    joint_noise: float = 0.020          # per-joint per-frame jitter floor, in hand sizes

    # --- general ---
    hand_lost_s: float = 1.5            # hand unseen this long => reset history ("away", not "struggling")
    log_every_s: float = 0.2
