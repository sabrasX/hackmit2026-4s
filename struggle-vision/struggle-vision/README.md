# struggle-vision

Camera-based detection of when a child is **struggling while writing**, using
[MediaPipe](https://developers.google.com/mediapipe) hand tracking and
[OpenCV](https://opencv.org/). Point a phone at the child's writing hand and the
app raises a flag when it sees any of these signals:

| Signal | What it looks like |
|---|---|
| **Stopped** | the hand stays in one spot *and* the fingers go quiet, for several seconds |
| **Fidget** | back-and-forth motion with no progress across the page, or fingers churning in place |

It needs nothing but the hand: no tape, no markers, no setup on the pencil.
Everything runs locally. It shows a live overlay and writes a timestamped CSV
log so you can build end-of-session summaries or line it up with other sensors.

> **Status:** early prototype. The detector logic is unit-tested on synthetic
> motion traces, but the default thresholds are starting guesses and need tuning
> against real footage (see [Tuning](#tuning)).

## How it works

```
phone camera ──► OpenCV frame ──► MediaPipe HandLandmarker ──► 21 joints ──┬─► grip travel ───┐
                                                                           │                  ├─► StruggleDetector ──► overlay + CSV
                                                                           └─► articulation ──┘
```

Two measurements come off the joints, both in *hand sizes* (wrist to middle
knuckle) so nothing depends on how far away the camera is:

- **Grip travel** — the path of the grip point, the midpoint between thumb tip
  and index tip. This is where the pencil goes.
- **Articulation** — how fast the finger joints move once the hand's own
  position, rotation and scale are divided out. Sliding the whole hand across
  the page contributes nothing; only fingers bending register. Landmark jitter
  is about as big as real finger motion, so the pose is smoothed
  (`pose_smoothing`) and a per-joint floor (`joint_noise`) subtracted first.

From those:

- **Stopped:** the grip point stays inside a box of `still_extent` hand sizes
  for `stop_seconds` **and** articulation stays under `stall_articulation`.
  Both conditions matter — a hand parked in one spot with the fingers still
  working isn't stalled, it's fidgeting.
- **Fidget:** either the grip point reverses direction more than
  `fidget_rev_per_s` times a second while *path efficiency* (net displacement ÷
  distance travelled) stays under `fidget_max_efficiency`, or articulation
  exceeds `fidget_articulation` while the hand travels less than
  `fidget_max_progress`. The first catches scribbling in place; the second
  catches tapping, twirling and re-gripping, where the hand hardly moves at all.
- **No hand in view** is reported as "no hand detected", never as struggling.

## Hardware setup

**Phone as a webcam.** Use [DroidCam](https://www.dev47apps.com/) (Android/iOS; install the phone app plus
the Windows client) or Iriun Webcam. USB is more reliable than WiFi on busy networks.
Alternatively, use the app's stream URL, e.g. `http://192.168.1.50:4747/video`.

**Camera placement.** Hand tracking needs to see the fingers, and a pure side view hides
them behind the pencil. Mount the phone on a tripod or prop, a little above the desk and
angled slightly toward the front, so the back of the hand is visible and the whole hand
stays in frame. Use even lighting and a plain background. Getting the fingers clearly
in view matters more than anything else here — the finger signal is what separates a
stall from fidgeting.

**Nothing on the pencil.** Earlier versions needed a band of coloured tape; they don't
any more. Everything is read off the hand.

## Install

Python 3.10 or newer. This project uses MediaPipe's Tasks API (`HandLandmarker`), which works on current MediaPipe releases. On first run it downloads the ~8 MB hand model into `models/`.

```bash
git clone https://github.com/<you>/struggle-vision.git
cd struggle-vision
python -m venv .venv
.venv\Scripts\activate          # Windows  (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
```

Or install it as a package (adds a `struggle-vision` command):

```bash
pip install -e .
```

## Usage

```bash
python -m struggle_vision --list                      # find the phone's camera index
python -m struggle_vision --source 1                  # use camera index 1
python -m struggle_vision --source http://192.168.1.50:4747/video
```

Point it at the hand and it starts working; there is nothing to calibrate.
Keys: `q` quit, `r` clear the motion history and start the clocks over.

Any setting can be overridden on the command line:

```bash
python -m struggle_vision --source 1 --stop-seconds 8 --fidget-rev-per-s 7
python -m struggle_vision --help        # full list
```

### Output

Each session writes `logs/session_YYYYMMDD_HHMMSS.csv` (disable with `--no-log`), sampled
every 0.2 s:

| column | meaning |
|---|---|
| `t_sec` | seconds since the session started |
| `hand_visible` | detection flag (0/1) |
| `stopped`, `fidget`, `struggling` | signal flags (0/1) |
| `still_extent`, `reversals_per_s`, `efficiency`, `articulation` | the raw numbers behind the flags |

## Tuning

All defaults are in [`struggle_vision/config.py`](struggle_vision/config.py). The live
numbers are printed along the bottom of the video window.

1. Record 30 s of the child (or a volunteer) writing normally and note the ranges of
   `reversals/s`, `efficiency` and `fingers` (articulation).
2. Record 30 s of the hand resting completely still, and 30 s of deliberate fidgeting
   (tapping, twirling, scribbling in place).
3. Set `fidget_rev_per_s` and `fidget_max_efficiency` between writing and scribbling.
4. Set `fidget_articulation` between writing and tapping, and `stall_articulation`
   between the resting hand and writing.
5. Adjust `stop_seconds` to whatever counts as "too long" for your setting.

The articulation defaults were calibrated on synthetic traces with a 100 px hand and
~1.2 px of landmark noise; a different camera, resolution or distance will shift them,
so step 2 is worth doing before you trust the numbers. Fidget vs. normal writing is the
hardest boundary and the most likely to need per-child tuning.

## Project layout

```
struggle_vision/
  config.py      all tunable settings
  detector.py    detection logic (pure numpy, unit-tested)
  hands.py       MediaPipe HandLandmarker wrapper (model download, landmarks, drawing)
  tracking.py    OpenCV helpers: camera access
  cli.py         main loop: overlay + CSV logging
tests/           synthetic-trace tests, no camera needed
```

## Tests

```bash
pip install -r requirements-dev.txt
pytest
```

CI runs the tests on Python 3.10-3.12. The detector has no OpenCV or MediaPipe dependency.

## Troubleshooting

- **Model download fails (offline or blocked network):** download `hand_landmarker.task` from the URL printed in the error and save it as `models/hand_landmarker.task`, or pass `--model path/to/hand_landmarker.task`.
- **NumPy 1.x/2.x error on import:** `pip install "numpy<2"`.
- **Phone camera not listed:** start the phone app first, then run `--list`; try indexes 1-3, or use the stream URL.
- **Hand flickers or is lost:** raise the phone, light the desk evenly, and make sure the whole hand is in frame.
- **Everything reads as fidget:** the fingers are jittering in the landmarks. Improve the
  lighting and framing first, then lower `pose_smoothing` or raise `joint_noise`.
- **Fidgeting is never caught:** articulation is being smoothed away. Raise `pose_smoothing`
  toward 1.0, or lower `fidget_articulation`.

## Limitations

- One hand, one child, one camera. Hand detection can drop out when fingers are heavily
  occluded, and articulation is only as good as the landmarks: if the fingers aren't
  clearly visible, the stall/fidget distinction degrades.
- Tuned for right-handed writers filmed from the left; thresholds are not yet validated on real footage.
- It detects *signals that often go with struggle*, not struggle itself. A long pause can just be thinking.

## Privacy

This tool is designed for use with children. It processes video locally, doesn't save video
and doesn't send anything over the network; only numeric signals are logged. Get consent from
the child's guardian and school before filming, and don't commit recordings to the repo
(`.gitignore` excludes common video formats and `logs/`).

## License

MIT, see [LICENSE](LICENSE). Replace `<YOUR NAME>` in the license file before publishing.
