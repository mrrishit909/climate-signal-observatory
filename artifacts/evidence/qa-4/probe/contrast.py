"""L16: estimate text contrast inside each tag/caption clip from screenshot pixels.
Light text: (L95 + .05) / (L50 + .05); dark text: (L50 + .05) / (L05 + .05); report the larger. usage: python3 contrast.py <clips dir>"""
import json, os, sys
from PIL import Image
D = os.path.dirname(os.path.abspath(__file__)); clips = sys.argv[1]
rows = json.load(open(os.path.join(D, "l16-clips.json")))
def lin(c):
    c /= 255; return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
for r in rows:
    im = Image.open(os.path.join(clips, r["file"])).convert("RGB")
    L = sorted(0.2126 * lin(p[0]) + 0.7152 * lin(p[1]) + 0.0722 * lin(p[2]) for p in im.getdata())
    q = lambda f: L[min(len(L) - 1, int(len(L) * f))]
    r["contrast"] = round(max((q(.95) + .05) / (q(.5) + .05), (q(.5) + .05) / (q(.05) + .05)), 2)
json.dump(rows, open(os.path.join(D, "l16.json"), "w"), indent=1)
low = [r for r in rows if r["contrast"] < 4.5]
print("clips", len(rows), "below 4.5:", len(low))
for r in sorted(low, key=lambda r: r["contrast"])[:40]: print(r["contrast"], r["vp"], r["state"], r["text"])
