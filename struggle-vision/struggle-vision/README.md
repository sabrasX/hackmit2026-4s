# struggle-vision

Camera-based detection of when a child is **struggling while writing**, using
[MediaPipe](https://developers.google.com/mediapipe) hand tracking and
[OpenCV](https://opencv.org/). Point a phone at the child's writing hand and the
app raises a flag when it sees any of these signals:

| Signal | What it looks like |
|---|---|
| **Stopped** | the hand stays in one spot *and* the fingers go quiet, for several seconds |
| **Twiddling** | the hand is turned over, palm up, with the fingers busy — playing with the pencil |
| **Wrong position** | the fingers are straighter than the grip a teacher demonstrated — the hand has gone flat on the page |

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

Three measurements come off the joints. The first two are in *hand sizes* (wrist
to middle knuckle), so nothing depends on how far away the camera is:

- **Grip travel** — the path of the grip point, the midpoint between thumb tip
  and index tip. This is where the pencil goes.
- **Articulation** — how fast the finger joints move once the hand's own
  position, rotation and scale are divided out. Sliding the whole hand across
  the page contributes nothing; only fingers bending register. Landmark jitter
  is about as big as real finger motion, so the pose is smoothed
  (`pose_smoothing`) and a per-joint floor (`joint_noise`) subtracted first.
- **Finger extension** — the bend at each of the fifteen finger joints, in
  degrees, where 180° is a dead straight finger. Averaged across the hand, this
  is how open or closed the hand is. Angles need no normalising at all: they
  already ignore position, size and rotation, which is what makes them
  comparable between two different people's hands.

From those:

- **Stopped:** the grip point stays inside a box of `still_extent` hand sizes
  for `stop_seconds` **and** articulation stays under `stall_articulation`.
  Both conditions matter — a hand parked in one spot with the fingers still
  working isn't stalled, it's doing something.
- **Twiddling:** the palm is towards the camera *and* articulation is over
  `twiddle_articulation`, for `twiddle_confirm_s`. Writing is filmed from the
  back of the hand, so seeing the palm at all means the hand has been turned
  over; add busy fingers to that and the child is playing with the pencil
  rather than writing with it. Which face we're looking at comes from the
  winding order of wrist → index knuckle → pinky knuckle, combined with the
  left/right label the tracker reports.
- **Wrong position:** the fingers are, on average, more than `flat_tolerance_deg`
  straighter than the demonstrated grip, for `flat_confirm_s`. See
  [Calibration](#calibration).
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
stall from a busy hand, and which way the hand is facing.

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

Stopped and twiddling work the moment you point it at a hand. Hand position needs a
one-off calibration first, below.

| Key | |
|---|---|
| `c` | record the hand position being demonstrated (takes `calibrate_seconds`) |
| `x` | clear the recorded position and stop checking it |
| `r` | clear the motion history and start the clocks over |
| `q` | quit |

## Calibration

The **teacher holds the correct writing grip in front of the camera and presses `c`**.
The app records for three seconds, takes the median angle at each of the fifteen finger
joints, and saves them to `calibration.json`. From then on — including on later runs,
since the file is loaded automatically — the child's fingers are compared against those
angles, and a sustained flattening raises **WRONG POSITION**.

```bash
python -m struggle_vision --source 0                          # loads calibration.json if present
python -m struggle_vision --calibration grade2.json           # keep one per class or per child
python -m struggle_vision --no-calibration                    # skip position checking entirely
```

### Why joint angles, and why only "straighter"

Writing is not a fixed hand shape. The joints move constantly as letters are formed,
so anything that asks "does this pose match the template?" will fire on ordinary
writing. Two things make the signal robust instead:

**It measures angles, not positions.** Bend is what actually distinguishes the two
states. A writing grip has every finger flexed; a hand lying flat on the page has them
all open. On the synthetic hands, the writing grip averages 144° across the fifteen
joints and the flat hand 177° — a 32° gap, far larger than anything letter formation
produces.

**It only counts fingers getting straighter.** The comparison is one-directional:
`finger_extension - reference`, flagged when it exceeds `flat_tolerance_deg`. Writing
bends and straightens the joints by a few degrees in both directions and nets out near
zero; going flat opens all fifteen at once and stays there. Measured on traces where
every joint is actively working, writing peaks at **+8°** and a flat hand sits at
**+30°**, against a 20° threshold.

A side effect is that gripping *tighter* is never flagged. A white-knuckle grip is a
real problem, but it isn't this one, and folding it in would cost the clean separation
above.

Angles also travel between hands better than positions do. An adult and a child hold a
pencil at broadly similar joint angles even though their hands are different sizes and
proportions, so a teacher's demonstration transfers reasonably well. Per-child
calibration is still more accurate — just press `c` with the child holding the pencil
properly — but it matters much less than it would for a pose template.

Calibration is refused if the grip keeps changing while recording (more than
`calibrate_max_wobble_deg`) or if too few frames had a hand in them, and it says which.
Hold the grip still and press `c` again.

Any setting can be overridden on the command line:

```bash
python -m struggle_vision --source 1 --stop-seconds 8 --twiddle-articulation 0.08
python -m struggle_vision --help        # full list
```

### Output

Each session writes `logs/session_YYYYMMDD_HHMMSS.csv` (disable with `--no-log`), sampled
every 0.2 s:

| column | meaning |
|---|---|
| `t_sec` | seconds since the session started |
| `hand_visible` | detection flag (0/1) |
| `stopped`, `twiddling`, `struggling`, `bad_posture` | signal flags (0/1) |
| `still_extent`, `articulation`, `palm_up` | the raw numbers behind stopped and twiddling |
| `finger_extension`, `extension_excess` | mean joint angle, and how far above the demonstrated grip it sits |

## Streaming to a web UI

`server.py` runs the same camera loop headless and pushes each status over a
WebSocket, for a live dashboard or graph.

```bash
python -m struggle_vision.server --source 0            # ws://0.0.0.0:8765
python -m struggle_vision.server --port 9000 --hz 10   # different port, faster stream
python -m struggle_vision.server --show                # also open a local preview window
```

It takes every `--flag` the CLI does, plus `--host`, `--port`, `--hz` (messages per
second, default 5) and `--show`. The camera runs on its own thread and the socket side
samples the latest status, so a slow or disconnected client never stalls the camera,
and the stream rate is independent of the frame rate.

### Message format

One JSON object per message, camelCase, flat:

```json
{
  "t": 12.34,
  "handVisible": true,
  "stopped": false,
  "twiddling": true,
  "struggling": true,
  "badPosture": false,
  "reasons": ["TWIDDLING"],
  "stillExtent": 0.41,
  "articulation": 0.093,
  "palmUp": true,
  "fingerExtension": 148.2,
  "extensionExcess": 3.9,
  "calibrated": true,
  "calibrating": false,
  "calibrationProgress": 0.0,
  "calibrationError": null
}
```

`reasons` holds the human-readable labels for whatever is currently firing, ready to
print. Every number is a plain JSON number, so the whole object can be dropped straight
into a chart series.

### Commands from the client

Send JSON back over the same socket to drive calibration from the UI:

```js
send({ type: 'calibrate' })          // start recording the demonstrated grip
send({ type: 'clearCalibration' })   // forget it, stop checking hand position
send({ type: 'reset' })              // clear motion history, restart the clocks
```

Watch `calibrating` and `calibrationProgress` for a progress bar, then `calibrated` or
`calibrationError` for the result. Unknown commands and malformed JSON are ignored
rather than dropping the connection.

## Tuning

All defaults are in [`struggle_vision/config.py`](struggle_vision/config.py). The live
numbers are printed along the bottom of the video window.

1. Record 30 s of the child (or a volunteer) writing normally and note the range of
   `finger speed` (articulation).
2. Record 30 s of the hand resting completely still, then 30 s of the pencil being
   twiddled with the hand turned over.
3. Set `stall_articulation` between the resting hand and writing.
4. Set `twiddle_articulation` between a still upturned hand and a twiddling one.
5. Adjust `stop_seconds` to whatever counts as "too long" for your setting.
6. For hand position: after calibrating, watch the `+N vs the demonstrated grip`
   figure on the overlay while the child writes properly, then while they let the hand
   go flat. Put `flat_tolerance_deg` between the two. On synthetic traces those peak at
   +8 deg and +30 deg against a default limit of +20.

The articulation defaults were calibrated on synthetic traces with a 100 px hand and
~1.2 px of landmark noise; a different camera, resolution or distance will shift them,
so step 2 is worth doing before you trust the numbers.

## Project layout

```
struggle_vision/
  config.py      all tunable settings
  detector.py    detection logic (pure numpy, unit-tested)
  hands.py       MediaPipe HandLandmarker wrapper (model download, landmarks, drawing)
  tracking.py    OpenCV helpers: camera access
  cli.py         main loop: overlay + CSV logging
  server.py      WebSocket server: same loop, streams JSON to the web UI
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
- **Everything reads as twiddling:** the fingers are jittering in the landmarks. Improve
  the lighting and framing first, then lower `pose_smoothing` or raise `joint_noise`.
- **Twiddling is never caught:** check the `palm` readout on the overlay. If it says
  `down` while the hand is clearly turned over, the tracker is reporting the wrong
  handedness — don't mirror the camera image, MediaPipe assumes it isn't. If the palm
  reads `UP` correctly, lower `twiddle_articulation`.
- **"Calibration failed: the hand kept changing shape":** hold the grip still for the
  full three seconds, or raise `calibrate_max_wobble_deg`.
- **WRONG POSITION never clears:** the grip was recorded on a much more tightly curled
  hand than the child's. Re-calibrate on the child (`c`), or raise `flat_tolerance_deg`.
- **A flat hand is never caught:** the reference was probably recorded while the hand
  was already half-open. Re-calibrate with a properly curled grip and check the
  `fingers N deg` readout — a real writing grip should read well under 160.

## Limitations

- One hand, one child, one camera. Hand detection can drop out when fingers are heavily
  occluded, and articulation is only as good as the landmarks: if the fingers aren't
  clearly visible, the stall and twiddle signals degrade.
- Tuned for right-handed writers filmed from the left; thresholds are not yet validated on real footage.
- Joint angles are measured on the 2D projection, so a finger pointing towards the
  camera reads as more bent than it is. Calibrate from the same viewpoint you film from.
  MediaPipe also returns 3D world landmarks, which would give true anatomical angles;
  the detector doesn't use them yet.
- "Hand gone flat" is the only posture problem it knows about. A fist grip, a thumb
  wrapped over the fingers, or a wrist hooked above the line all read as fine.
- It detects *signals that often go with struggle*, not struggle itself. A long pause can just be thinking.

## Privacy

This tool is designed for use with children. It processes video locally, doesn't save video
and doesn't send anything over the network; only numeric signals are logged. Get consent from
the child's guardian and school before filming, and don't commit recordings to the repo
(`.gitignore` excludes common video formats and `logs/`).

## License

MIT, see [LICENSE](LICENSE). Replace `<YOUR NAME>` in the license file before publishing.
