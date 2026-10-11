"""Before (stage-a) / after (stage-b/fixes-after) sheet for the P03-FE-002 fixes. python3 tests/fixes-sheet.py"""
import os
from PIL import Image, ImageDraw
E = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "artifacts", "evidence")
pairs = [("03-s03a-1880-1951-1980", "03-s03a-1880", "gaps on the S03a globe"), ("03-s03a-2025-1951-1980", "03-s03a-2025", "T chip / readout"),
         ("04-s04-p20", "04-s04-p20", "unwrap p0.20 moire"), ("04-s04-p38", "04-s04-p38", "collapse p0.38 moire"), ("04-s04-p96", "04-s04-p96", "landed core: layers, lattice, top ten")]
for vp, sc in [("1440x900", 0.32), ("768x1024", 0.3), ("390x844", 0.42)]:
    ims = [(Image.open(f"{E}/stage-a/{vp}/{a}.png").convert("RGB"), Image.open(f"{E}/stage-b/fixes-after/{vp}/{b}.png").convert("RGB"), t) for a, b, t in pairs]
    w, h = int(ims[0][0].width * sc), int(ims[0][0].height * sc)
    s = Image.new("RGB", (2 * w + 18, len(ims) * (h + 22)), (40, 40, 40)); d = ImageDraw.Draw(s)
    for i, (a, b, t) in enumerate(ims):
        y = i * (h + 22)
        d.text((4, y + 4), f"BEFORE · {t}", fill=(255, 255, 0)); d.text((w + 14, y + 4), "AFTER", fill=(120, 255, 120))
        s.paste(a.resize((w, h)), (0, y + 18)); s.paste(b.resize((w, h)), (w + 12, y + 18))
    s.save(f"{E}/stage-b/fixes-before-after-{vp}.png"); print(vp)
