// P03-FIXA-004 after-frames: S08 at p 0.3/0.6/0.98 and S02 at p 0.45 on the 8 viewports. Usage: node tests/fix-a4-capture.mjs (server on 4321)
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "artifacts", "evidence", "fix-a4", "after");
const b = await chromium.launch();
for (const [w, h] of [[1920, 1080], [1440, 900], [1280, 720], [1024, 768], [768, 1024], [390, 844], [375, 812], [360, 800]]) {
  mkdirSync(join(OUT, `${w}x${h}`), { recursive: true });
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.goto("http://localhost:4321/climate-signal-observatory/?quality=high");
  await p.waitForFunction(() => window.__cso && window.__cso.debug().glFrames > 1, null, { timeout: 60000 });
  await p.keyboard.press("Escape");
  for (const [id, q, n] of [["record", 0.45, "s02-p45"], ["surface", 0.3, "s08-p30"], ["surface", 0.6, "s08-p60"], ["surface", 0.98, "s08-p98"]]) {
    await p.evaluate(([i, x]) => window.__cso.jumpTo(i, x), [id, q]);
    await p.waitForTimeout(id === "surface" && q > 0.9 ? 3500 : 1800);
    await p.screenshot({ path: join(OUT, `${w}x${h}`, `${n}.jpg`), type: "jpeg", quality: 72 });
  }
  await p.close();
}
await b.close();
console.log("ok");
