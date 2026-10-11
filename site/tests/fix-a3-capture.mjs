// P03-FIXA-003 after-frames for the frames QA pass 2 cites (same names as artifacts/evidence/qa-2/probe/shots and screenshots),
// plus every reduced-motion landing at 1440, 768 and 390. Usage: node tests/fix-a3-capture.mjs  (server on 4321)
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const URL = "http://localhost:4321/climate-signal-observatory/";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "artifacts", "evidence", "fix-a3", "after");
mkdirSync(OUT, { recursive: true });
const IDS = ["signal", "record", "years", "regions", "strata", "zero", "futures", "evidence", "observatory", "surface"];
const b = await chromium.launch();
const shot = (p, name) => p.screenshot({ path: join(OUT, `${name}.jpg`), type: "jpeg", quality: 70 });
async function open(w, h, opts = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, ...opts });
  const p = await ctx.newPage();
  if (opts.block) await p.route(`**/data/${opts.block}`, (r) => r.fulfill({ status: 404, body: "" }));
  await p.goto(`${URL}?quality=high`, { waitUntil: "load" });
  return [ctx, p];
}

// D-020: S01 error at desktop (facts.json 404)
{ const [ctx, p] = await open(1440, 900, { block: "facts.json" }); await p.waitForTimeout(1500); await p.keyboard.press("Escape"); await p.evaluate(() => window.__cso.jumpTo("signal")); await p.waitForTimeout(2500); await shot(p, "err-D-facts_json-signal"); await ctx.close(); }
// D-021: the S00 resting frame
for (const [w, h] of [[1440, 900], [768, 1024], [390, 844], [375, 812], [360, 800]]) {
  const [ctx, p] = await open(w, h);
  await p.waitForFunction(() => window.__cso && !window.__cso.introStats().playing, null, { timeout: 30000 });
  await p.waitForTimeout(800); await shot(p, `s00end-${w}`); await ctx.close();
}
// D-017: the decade run mid-blend at t 2500 and 3000 (1440)
{ const [ctx, p] = await open(1440, 900); await p.waitForFunction(() => window.__cso && window.__cso.debug().glFrames > 2, null, { timeout: 60000 });
  for (const t of [2500, 3000]) { await p.evaluate((x) => window.__cso.freeze(x), t); await p.waitForTimeout(450); await shot(p, `00-s00-t${t}`); }
  await ctx.close(); }
// D-010: S05 at 1024, 390, 360 (normal motion)
for (const [w, h, n] of [[1024, 768, "1024x768-s05-00-p30"], [390, 844, "390x844-s05-01-p30"], [360, 800, "360x800-s05-01-p30"], [768, 1024, "768x1024-s05-01-p30"]]) {
  const [ctx, p] = await open(w, h); await p.waitForFunction(() => window.__cso && window.__cso.debug().glFrames > 1); await p.keyboard.press("Escape");
  await p.evaluate(() => window.__cso.jumpTo("zero", 0.3)); await p.waitForTimeout(1800); await shot(p, n); await ctx.close();
}
// D-023: OBS to S08 entry at 1440 (OBS bottom at 0.45, 0.3 and 0.1 of the height)
{ const [ctx, p] = await open(1440, 900); await p.waitForFunction(() => window.__cso && window.__cso.debug().glFrames > 1); await p.keyboard.press("Escape");
  await p.evaluate(() => window.__cso.jumpTo("observatory")); await p.waitForTimeout(1500);
  for (const [f, n] of [[0.45, 84], [0.3, 85], [0.1, 86]]) {
    await p.evaluate((k) => { const r = document.getElementById("observatory").getBoundingClientRect(); scrollBy(0, r.bottom - k * innerHeight); }, f);
    await p.waitForTimeout(1000); await shot(p, `ring-1440-${n}`);
  }
  await ctx.close(); }
// D-022, D-024 and every reduced-motion landing
for (const [w, h] of [[1440, 900], [1024, 768], [768, 1024], [390, 844], [375, 812], [360, 800]]) {
  const [ctx, p] = await open(w, h, { reducedMotion: "reduce" });
  await p.waitForTimeout(3000);
  for (const id of [1440, 768, 390].includes(w) ? IDS : ["observatory", "zero"]) {
    await p.evaluate((i) => window.__cso.jumpTo(i), id); await p.waitForTimeout(2500);
    await shot(p, `rmland-${w}-${id}`);
    if (id === "observatory") await shot(p, `rm-obs-${w}`);
    if (id === "zero" && w <= 390) await shot(p, `col-${w}x${h}r-zero-0.3`);
  }
  await ctx.close();
}
await b.close();
console.log("ok", OUT);
