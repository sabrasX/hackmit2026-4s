# HackMIT 2026 - Struggle Detection for Young Writers

Detects when a non-verbal child is struggling while learning to write, gives them
support only when needed.

## Repo layout

| Folder | Owner | What lives there |
| --- | --- | --- |
| `struggle-vision/struggle-vision/` | Saba | Python vision: phone camera -> MediaPipe -> stopped/fidget detector (will move to `vision/`) |
| `frontend/` | Frontend teammate + Sahith | React + Vite + Tailwind web app (pages, components, Firebase, scoring) |
| `firebase/` | Sahith | Firestore security rules |

## How the parts connect

```
phone camera -> vision (Python) --WebSocket ws://localhost:8765--> frontend (React) --> Firebase (sessions)
```

The vision service turns each frame into a **struggle score** out of 100 (pen stopped 35,
hand out of position 25, restless fingers 25, hand out of view 15) and sends it with every
status message. The web app averages that score per word for the results graph, and uses
the rolling 5-second score to decide when to encourage, show a trace, or play a video of
the word being written.

## Run it

1. Vision: `cd struggle-vision/struggle-vision && pip install -r requirements.txt fastapi uvicorn && python -m struggle_vision.server --source 1`
   - A live preview window opens automatically (pass `--no-show` to run headless): it draws the
     tracked hand, the current struggle score and the bar for each signal feeding it, so you can
     watch the score being made while the web app runs. Press `q` in that window to stop.
2. Frontend: `cd frontend && cp .env.example .env.local` (fill in Firebase keys) `&& npm install && npm run dev`
3. Open http://localhost:5173 on the SAME laptop that runs the vision script.
4. Optional: drop clips of each word being written into `frontend/public/videos/` (`welcome.mp4`,
   `to.mp4`, ...). They play beside the word when the struggle score stays high.
