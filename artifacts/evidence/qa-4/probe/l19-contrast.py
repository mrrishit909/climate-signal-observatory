"""L16/L19: pixel contrast for every visible text element (boxes from l19.mjs). Light text: (p99+.05)/(p50+.05);
dark text: (p50+.05)/(p01+.05); the larger is reported. Threshold 4.5 (3.0 at >= 24 px). Ghost words and disabled
controls are reported separately (ghost words are judged on the 0.55 opacity floor). usage: python3 l19-contrast.py <shots dir>"""
import json, os, sys
from PIL import Image
D = os.path.dirname(os.path.abspath(__file__)); S = sys.argv[1]
rows = json.load(open(os.path.join(D, "l19-boxes.json")))
def lin(c):
    c /= 255; return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
out, n = [], 0
for r in rows:
    im = Image.open(os.path.join(S, r["shot"])).convert("RGB")
    for e in r["els"]:
        if e["w"] < 3 or e["h"] < 3: continue
        box = (int(e["x"]), int(e["y"]), int(e["x"] + e["w"]), int(e["y"] + e["h"]))
        L = sorted(0.2126 * lin(p[0]) + 0.7152 * lin(p[1]) + 0.0722 * lin(p[2]) for p in im.crop(box).getdata())
        if len(L) < 20: continue
        q = lambda f: L[min(len(L) - 1, int(len(L) * f))]
        c = round(max((q(.99) + .05) / (q(.5) + .05), (q(.5) + .05) / (q(.01) + .05)), 2)
        n += 1
        thr = 3.0 if e["fs"] >= 24 else 4.5
        if c < thr: out.append({"vp": r["vp"], "state": r["state"], "t": e["t"], "cls": e["cls"], "fs": e["fs"], "op": e["op"], "ghost": e["ghost"], "disabled": e["disabled"], "contrast": c, "thr": thr})
json.dump({"elements_measured": n, "below": out}, open(os.path.join(D, "l19.json"), "w"), indent=1)
real = [o for o in out if not o["ghost"] and not o["disabled"]]
print("measured", n, "below threshold", len(out), "excluding ghost/disabled", len(real))
from collections import Counter
print(Counter((o["cls"][:25], o["t"][:25]) for o in real).most_common(40))
