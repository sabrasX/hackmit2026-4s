# TODO: reuse cli.py's camera loop (open_camera, HandTracker, StruggleDetector) in a background thread
# Serve a FastAPI WebSocket at ws://localhost:8765/ws and send the latest Status as JSON every 0.2 s
# JSON keys: t, handVisible, stopped, fidget, struggling, stillExtent, reversalsPerS, efficiency, articulation
# On {"type": "reset"} from the browser call det.reset_motion(). Needs: pip install fastapi uvicorn
