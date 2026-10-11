"""Before (QA pass, artifacts/evidence/qa) / after (fix-a2) sheets, one per viewport, for the frames the QA report cites.
python3 tests/fix-a2-sheet.py  ->  artifacts/evidence/fix-a2/sheets/before-after-<viewport>.jpg"""
import os
from PIL import Image, ImageDraw

E = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "artifacts", "evidence")
QA, FX = os.path.join(E, "qa", "screenshots"), os.path.join(E, "fix-a2", "screenshots")
OUT = os.path.join(E, "fix-a2", "sheets")
# frames cited by D-002..D-019: S01 landing, S03a, S03b, S04 p89, S05 p30, S06, S07 p95, OBS default and inspector, S08
CITED = ("s01-", "s03a-00", "s03a-01-p50", "s03b-00", "s04-01-p89", "s04-04-p89", "s05-00-p30", "s05-01-p30", "s06-00-p42", "s06-01-p42", "s06-01-p90", "s06-02-p90",
         "s07-01-p95", "s07-03-p95", "obs-00", "obs-02-inspector", "obs-04-inspector", "s08-00-p30", "s08-01-p30", "s08-01-p60", "s08-02-p60", "s08-02-p98", "s08-04-p98")
H = 420
os.makedirs(OUT, exist_ok=True)


def fit(p):
    im = Image.open(p).convert("RGB")
    return im.resize((max(1, int(im.width * H / im.height)), H))


for vp in sorted(os.listdir(FX)):
    if not os.path.isdir(os.path.join(FX, vp)):
        continue
    names = sorted(n for n in os.listdir(os.path.join(FX, vp)) if n.endswith(".jpg") and n.startswith(CITED))
    rows = [(os.path.join(QA, vp, n) if os.path.exists(os.path.join(QA, vp, n)) else None, os.path.join(FX, vp, n), n) for n in names]
    if not rows:
        continue
    pairs = [(fit(a) if a else None, fit(b), n) for a, b, n in rows]
    W = max(max(a.width if a else 0, b.width) for a, b, _ in pairs)
    s = Image.new("RGB", (2 * W + 16, len(pairs) * (H + 24)), (40, 40, 40))
    d = ImageDraw.Draw(s)
    for i, (a, b, n) in enumerate(pairs):
        y = i * (H + 24)
        d.text((4, y + 5), f"BEFORE (QA) {vp} {n}" if a else f"(no QA frame) {vp} {n}", fill=(255, 255, 0))
        d.text((W + 20, y + 5), f"AFTER (FIX-A2) {vp} {n}", fill=(120, 255, 120))
        if a:
            s.paste(a, (0, y + 20))
        s.paste(b, (W + 16, y + 20))
    s.save(os.path.join(OUT, f"before-after-{vp}.jpg"), quality=70)
    print(vp, len(pairs))
