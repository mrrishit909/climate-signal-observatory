// QA-002: horizontal overflow per scene under reduced motion (and normal), 390/375/360/768/1440.
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path"; import { fileURLToPath } from "node:url";
const OUT = dirname(fileURLToPath(import.meta.url));
const IDS = ["signal", "record", "years", "regions", "strata", "zero", "futures", "evidence", "observatory", "surface"];
const b = await chromium.launch(); const res = [];
for (const [w, h] of [[1440, 900], [768, 1024], [390, 844], [375, 812], [360, 800]]) for (const rm of ["no-preference", "reduce"]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: rm, hasTouch: w < 1024, isMobile: w < 768 }); const p = await ctx.newPage();
  await p.goto("http://localhost:4321/climate-signal-observatory/?quality=high"); await p.waitForTimeout(4000); await p.keyboard.press("Escape"); await p.waitForTimeout(600);
  for (const id of IDS) {
    await p.evaluate((i) => window.__cso.jumpTo(i), id); await p.waitForTimeout(1200);
    const r = await p.evaluate(() => { const d = document.documentElement; const wide = [...document.querySelectorAll("body *")].filter((e) => { const q = e.getBoundingClientRect(); return q.right > d.clientWidth + 1 && q.width > 0 && getComputedStyle(e).position !== "fixed"; }).slice(0, 5).map((e) => `${e.tagName}.${String(e.className).slice(0, 40)} right=${Math.round(e.getBoundingClientRect().right)}`); window.scrollBy(500, 0); const sx = scrollX; window.scrollTo(0, scrollY); return { scrollW: d.scrollWidth, clientW: d.clientWidth, scrollXAfterNudge: sx, wide }; });
    res.push({ vp: `${w}x${h}`, motion: rm, at: id, ...r });
    if (r.scrollXAfterNudge > 0) console.log(w, rm, id, JSON.stringify(r));
  }
  await ctx.close();
}
writeFileSync(join(OUT, "rm-overflow.json"), JSON.stringify(res, null, 1)); await b.close();
