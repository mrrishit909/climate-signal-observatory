"""MOTION_SYSTEM test 16: P02 and P03 open/close frames side by side (P02 read only). python3 tests/p02-compare.py"""
import os
from PIL import Image, ImageDraw
H = os.path.dirname(os.path.abspath(__file__))
P02 = os.path.expanduser("~/data-frontier/projects/02-market-microstructure-lab/artifacts/evidence/stage-b1")
P03 = os.path.join(H, "..", "..", "artifacts", "evidence", "stage-b")
rows = [("P02 S00", [f"{P02}/{{vp}}/00-fix1-s00-t0250.png", f"{P02}/{{vp}}/00-fix1-s00-t3700.png", f"{P02}/{{vp}}/00-fix1-s00-t4550.png"]),
        ("P03 S00", [f"{P03}/{{vp}}/00-s00-t0600.png", f"{P03}/{{vp}}/00-s00-t1800.png", f"{P03}/{{vp}}/00-s00-t3000.png", f"{P03}/{{vp}}/00-s00-t4600-end.png"]),
        ("P03 S08", [f"{P03}/{{vp}}/09-s08-p45.png", f"{P03}/{{vp}}/09-s08-p60.png", f"{P03}/{{vp}}/09-s08-p95.png"])]
for vp, sc in [("1440x900", 0.25), ("390x844", 0.4)]:
    ims = [[Image.open(p.format(vp=vp)).convert("RGB") if os.path.exists(p.format(vp=vp)) else None for p in r[1]] for r in rows]
    w, h = [int(d * sc) for d in (ims[1][0] or ims[0][0]).size]
    sheet = Image.new("RGB", (120 + 4 * (w + 6), len(rows) * (h + 22)), (40, 40, 40))
    dr = ImageDraw.Draw(sheet)
    for i, (label, _) in enumerate(rows):
        dr.text((6, i * (h + 22) + h // 2), label, fill=(255, 255, 0))
        for j, im in enumerate(ims[i]):
            x, y = 120 + j * (w + 6), i * (h + 22) + 18
            if im: sheet.paste(im.resize((w, h)), (x, y))
            else: dr.text((x + 4, y + h // 2), "NOT YET BUILT IN P02", fill=(200, 200, 200))
    dr.text((120, (len(rows) - 1) * (h + 22) + 2), "P02 S08 frames do not exist yet (stage-b1 has no closing); P03 S08 shown alone", fill=(200, 200, 200))
    out = os.path.join(P03, f"p02-vs-p03-open-close-{vp}.png")
    sheet.save(out)
    print(out)
