"""Before (QA pass 2, artifacts/evidence/qa-2) / after (fix-a3/after) sheets per defect, plus the reduced-motion landings.
python3 tests/fix-a3-sheet.py  ->  artifacts/evidence/fix-a3/sheets/*.jpg"""
import os
from PIL import Image, ImageDraw

E = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "artifacts", "evidence")
QA, AF, OUT = os.path.join(E, "qa-2"), os.path.join(E, "fix-a3", "after"), os.path.join(E, "fix-a3", "sheets")
os.makedirs(OUT, exist_ok=True)
H = 420


def before(name):
    for p in (os.path.join(QA, "probe", "shots", name + ".jpg"),):
        if os.path.exists(p):
            return p
    if "-s05-" in name:  # e.g. 1024x768-s05-00-p30
        vp, rest = name.split("-", 1)
        p = os.path.join(QA, "screenshots", vp, rest + ".jpg")
        return p if os.path.exists(p) else None
    if name.startswith("00-s00-t"):
        p = os.path.join(QA, "screenshots", "1440x900", name + ".jpg")
        return p if os.path.exists(p) else None
    return None


def fit(p):
    im = Image.open(p).convert("RGB")
    return im.resize((max(1, int(im.width * H / im.height)), H))


def sheet(title, names):
    rows = [(before(n), os.path.join(AF, n + ".jpg"), n) for n in names if os.path.exists(os.path.join(AF, n + ".jpg"))]
    if not rows:
        return
    pairs = [(fit(a) if a else None, fit(b), n) for a, b, n in rows]
    W = max(max(a.width if a else 0, b.width) for a, b, _ in pairs)
    s = Image.new("RGB", (2 * W + 16, len(pairs) * (H + 24)), (40, 40, 40))
    d = ImageDraw.Draw(s)
    for i, (a, b, n) in enumerate(pairs):
        y = i * (H + 24)
        d.text((4, y + 5), f"BEFORE (QA-2) {n}" if a else f"(no QA-2 frame) {n}", fill=(255, 255, 0))
        d.text((W + 20, y + 5), f"AFTER (FIX-A3) {n}", fill=(120, 255, 120))
        if a:
            s.paste(a, (0, y + 20))
        s.paste(b, (W + 16, y + 20))
    s.save(os.path.join(OUT, f"{title}.jpg"), quality=72)
    print(title, len(pairs))


IDS = ["signal", "record", "years", "regions", "strata", "zero", "futures", "evidence", "observatory", "surface"]
sheet("D-020-s01-error-1440", ["err-D-facts_json-signal"])
sheet("D-021-s00-resting-frame", [f"s00end-{w}" for w in (390, 375, 360, 768, 1440)])
sheet("D-022-reduced-motion-observatory", [f"rm-obs-{w}" for w in (1440, 1024, 768, 390)])
sheet("D-010-s05-labels", ["1024x768-s05-00-p30", "768x1024-s05-01-p30", "390x844-s05-01-p30", "360x800-s05-01-p30"])
sheet("D-017-decade-run", ["00-s00-t2500", "00-s00-t3000"])
sheet("D-023-obs-to-s08", ["ring-1440-84", "ring-1440-85", "ring-1440-86"])
sheet("D-024-reduced-motion-s05-phones", ["col-390x844r-zero-0.3", "col-375x812r-zero-0.3", "col-360x800r-zero-0.3"])
for w in (1440, 768, 390):
    sheet(f"reduced-motion-landings-{w}", [f"rmland-{w}-{i}" for i in IDS])
