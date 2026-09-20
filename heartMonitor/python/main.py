import os, json, time, threading, collections
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import numpy as np
from scipy.signal import butter, filtfilt, find_peaks
from arduino.app_utils import App, Bridge
from edge_impulse_linux.runner import ImpulseRunner

HERE = os.path.dirname(os.path.abspath(__file__))
FS = 50

cfg = {"mode": "full", "warmup_s": 20, "cal_seconds": 90,
       "no_finger_ir": 50000, "reset_after_s": 15}
try:
    with open(os.path.join(HERE, "config.json"), encoding="utf-8-sig") as fh:
        cfg.update(json.load(fh))
except Exception as e:
    print("config.json not read, using defaults:", e, flush=True)

runner = ImpulseRunner(os.path.join(HERE, "penpal_stress_checker.eim"))
runner.init()

EXPORT_DIR = os.path.join(HERE, "exports")
os.makedirs(EXPORT_DIR, exist_ok=True)

def iso(ts):
    return datetime.fromtimestamp(ts, timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")

start_ts = time.time()
SESSION_FILE = os.path.join(
    EXPORT_DIR,
    "session_%s_%s.json" % (datetime.fromtimestamp(start_ts, timezone.utc).strftime("%Y%m%d_%H%M%S"), cfg["mode"]))

lock = threading.Lock()
ir_buf = collections.deque(maxlen=FS * 30)
rows = collections.deque(maxlen=20)
cal = []
baseline = None
baseline_info = None
lost_since = None
samples = []
segments = []
events = []
last_save = 0.0
latest = {"state": "starting", "confidence": 0.0, "calibrated": False}

# Port the web app reads this monitor on. Standard library only, so nothing
# extra has to be installed on the board.
HTTP_PORT = int(cfg.get("http_port", 8766))

def on_samples(*v):
    with lock:
        for i in range(0, len(v), 2):
            ir_buf.append(v[i])

Bridge.provide("samples", on_samples)

def beats(ir):
    b, a = butter(2, [0.7, 3.5], btype="band", fs=FS)
    x = filtfilt(b, a, ir)
    if np.corrcoef(x, ir - np.mean(ir))[0, 1] < 0:
        x = -x
    peaks, _ = find_peaks(x, distance=int(0.4 * FS), prominence=np.std(x) * 0.5)
    t = peaks / FS
    ibi = np.diff(t) * 1000
    tb = t[1:]
    ok = (ibi > 400) & (ibi < 1500)
    ibi, tb = ibi[ok], tb[ok]
    if len(ibi) > 5:
        med = np.median(ibi)
        ok = np.abs(ibi - med) < 0.3 * med
        ibi, tb = ibi[ok], tb[ok]
    return tb, ibi

def features(ir):
    tb, ibi = beats(ir)
    t = len(ir) / FS
    w = min(20, t)
    m = tb > t - w
    if m.sum() < 5:
        return None
    hr = 60000 / np.mean(ibi[m])
    rmssd = np.sqrt(np.mean(np.diff(ibi[m]) ** 2))
    slope = np.polyfit(tb, 60000 / ibi, 1)[0] * 60 if len(tb) >= 8 else 0.0
    return float(hr), float(rmssd), float(slope)

def build_doc(now):
    """The session so far, in the same shape that gets written to exports/."""
    totals = {}
    timeline = []
    for s in segments:
        dur = s["last"] + 1 - s["start"]
        totals[s["state"]] = round(totals.get(s["state"], 0) + dur, 1)
        timeline.append({
            "state": s["state"],
            "start_unix": s["start"],
            "end_unix": round(s["last"] + 1, 3),
            "start_utc": iso(s["start"]),
            "end_utc": iso(s["last"] + 1),
            "duration_s": round(dur, 1),
            "mean_confidence": round(s["conf_sum"] / s["n"], 3) if s["state"] in ("calm", "stressed") else None,
        })
    return {
        "session_id": os.path.basename(SESSION_FILE)[:-5],
        "device": "PenPal stress checker (Arduino UNO Q + MAX30102)",
        "mode": cfg["mode"],
        "config": cfg,
        "started_utc": iso(start_ts),
        "last_update_utc": iso(now),
        "baseline": baseline_info,
        "totals_seconds": totals,
        "timeline": timeline,
        "samples": samples,
        "events": events,
    }


def save(now):
    global last_save
    doc = build_doc(now)
    tmp = SESSION_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, indent=2)
    os.replace(tmp, SESSION_FILE)
    last_save = now

class MonitorHandler(BaseHTTPRequestHandler):
    """Read-only JSON for the web app: /status is the live state, /session the lot.

    The browser polls this rather than holding a socket open - the writing app
    only needs the state once a second, and nothing here is shown live.
    """

    def _send(self, payload):
        body = json.dumps(payload).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        # The web app is served from a different origin (Vite, or Vercel).
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?")[0].rstrip("/")
        if path in ("", "/status"):
            self._send(latest)
        elif path == "/session":
            self._send(build_doc(time.time()))
        else:
            self.send_error(404)

    def log_message(self, *_):
        pass                                    # don't drown the state log


def serve_http():
    try:
        ThreadingHTTPServer(("0.0.0.0", HTTP_PORT), MonitorHandler).serve_forever()
    except Exception as exc:
        print("HTTP server not started:", exc, flush=True)


threading.Thread(target=serve_http, daemon=True).start()
print("Heart monitor HTTP on port %d (/status, /session)" % HTTP_PORT, flush=True)


def record(state, p=0.0, feats=None):
    global latest
    now = time.time()
    p = float(p)
    changed = not (segments and segments[-1]["state"] == state)
    sample = {"unix": round(now, 3), "utc": iso(now), "state": state, "confidence": round(p, 3)}
    # The heart rate itself, not just the calm/stressed verdict - the web app
    # reports an average BPM at the end of a writing session.
    if feats is not None:
        sample["hr_bpm"] = round(feats[0], 1)
        sample["rmssd_ms"] = round(feats[1], 1)
    samples.append(sample)
    latest = dict(sample, calibrated=baseline is not None, baseline=baseline_info)
    if changed:
        segments.append({"state": state, "start": round(now, 3), "last": round(now, 3), "n": 1, "conf_sum": p})
    else:
        s = segments[-1]
        s["last"] = round(now, 3)
        s["n"] += 1
        s["conf_sum"] += p
    print("%s %s %.2f" % (time.strftime("%H:%M:%S"), state, p), flush=True)
    if changed or now - last_save >= 10:
        save(now)

def loop():
    global baseline, baseline_info, lost_since, cal
    time.sleep(1)
    now = time.time()
    with lock:
        arr = np.array(ir_buf, float)

    finger = len(arr) >= FS and arr[-FS:].mean() > cfg["no_finger_ir"]
    if not finger:
        if lost_since is None:
            lost_since = now
        with lock:
            ir_buf.clear()
        rows.clear()
        if now - lost_since > cfg["reset_after_s"] and (baseline is not None or cal):
            baseline, baseline_info, cal = None, None, []
            events.append({"utc": iso(now), "event": "baseline_reset"})
        record("no_finger")
        return
    lost_since = None

    if len(arr) < FS * cfg["warmup_s"]:
        record("warming_up")
        return
    f = features(arr)
    if f is None:
        record("poor_signal")
        return

    if baseline is None:
        cal.append(f)
        if len(cal) >= cfg["cal_seconds"]:
            c = np.array(cal)
            baseline = (float(np.median(c[:, 0])), float(np.median(c[:, 1])))
            baseline_info = {"hr_bpm": round(baseline[0], 1), "rmssd_ms": round(baseline[1], 1),
                             "set_utc": iso(now), "calibration_seconds": len(cal)}
            events.append({"utc": iso(now), "event": "baseline_set"})
            for r in c[-20:]:
                rows.append([r[0] - baseline[0], r[1] / baseline[1], r[2]])
        record("calibrating", feats=f)
        return

    rows.append([f[0] - baseline[0], f[1] / baseline[1], f[2]])
    if len(rows) < 20:
        record("warming_up", feats=f)
        return

    res = runner.classify(np.array(rows).flatten().tolist())
    cls = res["result"]["classification"]
    label = max(cls, key=cls.get)
    record("stressed" if label.startswith("stress") else label, cls[label], feats=f)

App.run(user_loop=loop)