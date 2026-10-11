"""MOTION_SYSTEM test 16 recomposed by QA-002: P02 (read only) vs P03 QA frames, S00 and S08, D and M."""
import os
from PIL import Image, ImageDraw
Q = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
P02 = os.path.expanduser("~/data-frontier/projects/02-market-microstructure-lab/artifacts/evidence")
rows = lambda vp: [
 ("P02 S00", [f"{P02}/stage-b1/{vp}/00-fix1-s00-t0250.png", f"{P02}/stage-b1/{vp}/00-fix1-s00-t3700.png", f"{P02}/stage-b1/{vp}/00-fix1-s00-t4550.png", None]),
 ("P03 S00", [f"{Q}/screenshots/{vp}/00-s00-t0500.jpg", f"{Q}/screenshots/{vp}/00-s00-t1500.jpg", f"{Q}/screenshots/{vp}/00-s00-t3000.jpg", f"{Q}/screenshots/{vp}/00-s00-end.jpg"]),
 ("P02 S08", [f"{P02}/stage-b2/{vp}/07-s08-a-lowering.png", f"{P02}/stage-b2/{vp}/07-s08-b-echo.png", f"{P02}/stage-b2/{vp}/07-s08-c-giant-orb.png", None]),
 ("P03 S08", [f"{Q}/screenshots/{vp}/s08-01-p30.jpg", f"{Q}/screenshots/{vp}/s08-02-p60.jpg", f"{Q}/screenshots/{vp}/s08-03-p90.jpg", f"{Q}/screenshots/{vp}/s08-04-p98.jpg"])]
for vp, sc in [("1440x900", 0.22), ("390x844", 0.36)]:
    R = rows(vp); w0, h0 = map(int, vp.split("x")); w, h = int(w0 * sc), int(h0 * sc)
    sheet = Image.new("RGB", (90 + 4 * (w + 6), len(R) * (h + 20)), (40, 40, 40)); dr = ImageDraw.Draw(sheet)
    for i, (label, ps) in enumerate(R):
        dr.text((6, i * (h + 20) + h // 2), label, fill=(255, 255, 0))
        for j, p in enumerate(ps):
            x, y = 90 + j * (w + 6), i * (h + 20) + 16
            if p and os.path.exists(p): sheet.paste(Image.open(p).convert("RGB").resize((w, h)), (x, y)); dr.text((x, y - 13), os.path.basename(p)[:34], fill=(180, 180, 180))
    for gray in (False, True):
        out = os.path.join(Q, f"p02-vs-p03-open-close-{vp}{'-grey' if gray else ''}.jpg")
        (sheet.convert("L") if gray else sheet).save(out, quality=80); print(out)
