// QA-003: S02 active-card clipping on phones after long settle; S00 end chip visibility on phones.
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path"; import { fileURLToPath } from "node:url";
const OUT = dirname(fileURLToPath(import.meta.url));
const b = await chromium.launch(); const res = {};
for (const [w, h] of [[390, 844], [375, 812], [360, 800], [768, 1024], [1440, 900]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 1024, isMobile: w < 768 }); const p = await ctx.newPage();
  await p.goto("http://localhost:4321/climate-signal-observatory/?quality=high"); await p.waitForFunction(() => window.__cso?.debug().glFrames > 2, null, { timeout: 60000 });
  await p.waitForFunction(() => !window.__cso.introStats().playing, null, { timeout: 30000 }).catch(() => {}); await p.waitForTimeout(1500);
  res[`${w} s00-end`] = await p.evaluate(() => [...document.querySelectorAll("#signal .chip, #signal .hero-caption, #signal [class*=caption]")].slice(0, 4).map((c) => { let o = 1; for (let e = c; e; e = e.parentElement) o *= +getComputedStyle(e).opacity; const r = c.getBoundingClientRect(); return { t: c.textContent.trim().slice(0, 40), effOpacity: +o.toFixed(2), color: getComputedStyle(c).color, top: Math.round(r.top) }; }));
  await p.screenshot({ path: join(OUT, "shots", `s00end-${w}.jpg`), type: "jpeg", quality: 70 });
  for (const q of [0.3, 0.45, 0.6, 0.75]) {
    await p.evaluate((x) => window.__cso.jumpTo("record", x), q); await p.waitForTimeout(3500);
    res[`${w} record@${q}`] = await p.evaluate(() => [...document.querySelectorAll("#record .story-card")].map((c) => { const r = c.getBoundingClientRect(); return { title: c.querySelector(".story-card__title")?.textContent.trim().slice(0, 24), left: Math.round(r.left), right: Math.round(r.right), clipped: r.left < 0 && r.right > 40 || r.right > innerWidth && r.left < innerWidth - 40 }; }).filter((c) => c.right > 0 && c.left < innerWidth));
    if (w < 800) await p.screenshot({ path: join(OUT, "shots", `deck-${w}-${q}.jpg`), type: "jpeg", quality: 65 });
  }
  await ctx.close();
}
writeFileSync(join(OUT, "deck.json"), JSON.stringify(res, null, 1)); console.log(JSON.stringify(res, null, 0)); await b.close();
