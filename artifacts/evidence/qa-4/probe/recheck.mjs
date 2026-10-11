// QA-002 rechecks of single states with long waits (load-confound control) and the inspector path length.
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path"; import { fileURLToPath } from "node:url";
const OUT = dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:4321/climate-signal-observatory/";
const b = await chromium.launch(); const out = {};
for (const [w, h] of [[390, 844], [1440, 900]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 1024, isMobile: w < 768 }); const p = await ctx.newPage();
  await p.goto(`${BASE}?quality=high`); await p.waitForFunction(() => window.__cso?.debug().glFrames > 2, null, { timeout: 60000 });
  await p.keyboard.press("Escape"); await p.waitForTimeout(1000);
  await p.evaluate(() => window.__cso.jumpTo("signal", 0.78)); await p.waitForTimeout(6000);
  await p.screenshot({ path: `${OUT}/shots/recheck-${w}-s01-landing-6s.jpg`, type: "jpeg", quality: 75 });
  out[`${w} s01 cards opacity`] = await p.evaluate(() => [...document.querySelectorAll(".note, .notification, [class*=note]")].slice(0, 6).map((n) => `${n.className}:${getComputedStyle(n).opacity}`));
  await p.evaluate(() => window.__cso.jumpTo("observatory")); await p.waitForTimeout(2500);
  await p.evaluate(() => window.__cso.setObs({ cell: { row: 37, col: 72 } })); await p.waitForTimeout(3000);
  out[`${w} inspector`] = await p.evaluate(() => { const path = document.querySelector(".inspector__line"); const cs = getComputedStyle(path); return { totalLength: Math.round(path.getTotalLength()), dasharray: cs.strokeDasharray, dashoffset: cs.strokeDashoffset, lastPointX: path.getAttribute("d").split(/[ML]/).filter(Boolean).at(-1) }; });
  await p.screenshot({ path: `${OUT}/shots/recheck-${w}-inspector.jpg`, type: "jpeg", quality: 75 });
  await ctx.close();
}
writeFileSync(join(OUT, "recheck.json"), JSON.stringify(out, null, 1)); console.log(JSON.stringify(out, null, 1));
await b.close();
