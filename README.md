# HackMIT 2026 - Struggle Detection for Young Writers

Detects when a non-verbal child is struggling while learning to write, gives them
support only when needed.

## Repo layout

| Folder | Owner | What lives there |
| --- | --- | --- |
| `struggle-vision/struggle-vision/` Python vision: phone camera -> MediaPipe -> stopped/fidget detector (will move to `vision/`) |
| `frontend/` React + Vite + Tailwind web app (pages, components, Firebase, scoring) |
| `firebase/` Firestore security rules |

## How the parts connect

```
phone camera -> vision (Python) --WebSocket ws://localhost:8765--> frontend (React) --> Firebase (sessions)
```

## Run it

1. Vision: `cd struggle-vision/struggle-vision && pip install -r requirements.txt fastapi uvicorn && python -m struggle_vision.server --source 1`
2. Frontend: `cd frontend && cp .env.example .env.local` (fill in Firebase keys) `&& npm install && npm run dev`
3. Open http://localhost:5173 on the SAME laptop that runs the vision script.
