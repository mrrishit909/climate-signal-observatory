"""Before (stage-b) / after (fix-a1) sheet for the DESIGN_AUDIT P03 fixes. python3 tests/fix-a1-sheet.py"""
import os
from PIL import Image, ImageDraw
E = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "artifacts", "evidence")
rows = [(f"stage-b/{vp}/06-s06-p90.png", f"fix-a1/{vp}/06-s06-p90-after.png", f"S06 p0.90 {vp}") for vp in ("1440x900", "768x1024", "390x844")]
rows += [("stage-b/390x844/05-s05-p30.png", "fix-a1/390x844/05-s05-p30-after.png", "S05 p0.30 390x844"), ("", "fix-a1/390x844/05-s05-p30-more-open-after.png", "S05 MORE open 390x844"),
         ("", "fix-a1/360x800/06-s06-p90-after.png", "S06 360x800"), ("", "fix-a1/360x800/05-s05-p30-after.png", "S05 360x800")]
H = 560
def fit(p):
    im = Image.open(os.path.join(E, p)).convert("RGB"); return im.resize((int(im.width * H / im.height), H))
pairs = [((fit(a) if a else None), fit(b), t) for a, b, t in rows]
W = max(max((a.width if a else 0), b.width) for a, b, _ in pairs)
s = Image.new("RGB", (2 * W + 16, len(pairs) * (H + 24)), (40, 40, 40)); d = ImageDraw.Draw(s)
for i, (a, b, t) in enumerate(pairs):
    y = i * (H + 24)
    d.text((4, y + 5), f"BEFORE · {t}" if a else f"(no before frame) · {t}", fill=(255, 255, 0)); d.text((W + 20, y + 5), "AFTER", fill=(120, 255, 120))
    if a: s.paste(a, (0, y + 20))
    s.paste(b, (W + 16, y + 20))
s.save(os.path.join(E, "fix-a1", "sheet-before-after.png")); print("ok")
