"""Before (QA pass 3) / after (fix-a4) sheet for S08 and S02 at 8 viewports. python3 tests/fix-a4-sheet.py"""
import os
from PIL import Image, ImageDraw

E = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "artifacts", "evidence")
QA, AF = os.path.join(E, "qa-3", "screenshots"), os.path.join(E, "fix-a4", "after")
H = 300
VPS = ["1920x1080", "1440x900", "1280x720", "1024x768", "768x1024", "390x844", "375x812", "360x800"]
FR = ["s02-p45", "s08-p30", "s08-p60", "s08-p98"]


def before(vp, fr):
    pre, suf = fr.split("-")
    d = os.path.join(QA, vp)
    hits = sorted(n for n in os.listdir(d) if n.startswith(pre) and n.endswith(f"-{suf}.jpg")) if os.path.isdir(d) else []
    return os.path.join(d, hits[0]) if hits else None


def fit(p):
    im = Image.open(p).convert("RGB")
    return im.resize((max(1, int(im.width * H / im.height)), H))


for fr in FR:
    rows = [(before(vp, fr), os.path.join(AF, vp, fr + ".jpg"), vp) for vp in VPS if os.path.exists(os.path.join(AF, vp, fr + ".jpg"))]
    pairs = [(fit(a) if a else None, fit(b), vp) for a, b, vp in rows]
    W = max(max(a.width if a else 0, b.width) for a, b, _ in pairs)
    s = Image.new("RGB", (2 * W + 16, len(pairs) * (H + 24)), (40, 40, 40))
    d = ImageDraw.Draw(s)
    for i, (a, b, vp) in enumerate(pairs):
        y = i * (H + 24)
        d.text((4, y + 5), f"BEFORE (QA-3) {vp} {fr}" if a else f"(no QA-3 frame) {vp} {fr}", fill=(255, 255, 0))
        d.text((W + 20, y + 5), f"AFTER (FIX-A4) {vp} {fr}", fill=(120, 255, 120))
        if a:
            s.paste(a, (0, y + 20))
        s.paste(b, (W + 16, y + 20))
    s.save(os.path.join(E, "fix-a4", f"sheet-{fr}.jpg"), quality=75)
    print(fr, len(pairs))
