import os, json, time, threading, collections
from datetime import datetime, timezone
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

def save(now):
    global last_save
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
    doc = {
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
    tmp = SESSION_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, indent=2)
    os.replace(tmp, SESSION_FILE)
    last_save = now

def record(state, p=0.0):
    now = time.time()
    p = float(p)
    changed = not (segments and segments[-1]["state"] == state)
    samples.append({"unix": round(now, 3), "utc": iso(now), "state": state, "confidence": round(p, 3)})
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
        record("calibrating")
        return

    rows.append([f[0] - baseline[0], f[1] / baseline[1], f[2]])
    if len(rows) < 20:
        record("warming_up")
        return

    res = runner.classify(np.array(rows).flatten().tolist())
    cls = res["result"]["classification"]
    label = max(cls, key=cls.get)
    record("stressed" if label.startswith("stress") else label, cls[label])

App.run(user_loop=loop)