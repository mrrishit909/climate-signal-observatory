// P03-FIX-A1: after frames for the audit's cited S06/S05 frames (production preview, in-process on 4321).
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { preview } from "vite";
const OUT = "../artifacts/evidence/fix-a1";
const server = await preview({ preview: { port: 4321, strictPort: true } });
const b = await chromium.launch();
for (const [w, h] of [[1440, 900], [768, 1024], [390, 844], [375, 812], [360, 800]]) {
  mkdirSync(`${OUT}/${w}x${h}`, { recursive: true });
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.goto("http://localhost:4321/climate-signal-observatory/?quality=high"); await p.keyboard.press("Escape");
  await p.waitForFunction(() => window.__cso?.debug().glFrames > 2);
  await p.evaluate(() => window.__cso.jumpTo("futures", 0.9)); await p.waitForTimeout(1600);
  await p.screenshot({ path: `${OUT}/${w}x${h}/06-s06-p90-after.png` });
  if (w < 768) {
    await p.evaluate(() => window.__cso.jumpTo("zero", 0.3)); await p.waitForTimeout(1400);
    await p.screenshot({ path: `${OUT}/${w}x${h}/05-s05-p30-after.png` });
    await p.getByRole("button", { name: "MORE CONTROLS" }).click(); await p.waitForTimeout(400);
    await p.screenshot({ path: `${OUT}/${w}x${h}/05-s05-p30-more-open-after.png` });
  }
  await p.close();
}
await b.close(); await server.close();
