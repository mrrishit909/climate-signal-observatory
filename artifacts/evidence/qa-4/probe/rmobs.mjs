// QA-003: reduced-motion OBS composition at 768/1024/390 after a long settle.
import { chromium } from "@playwright/test";
import { dirname, join } from "node:path"; import { fileURLToPath } from "node:url";
const OUT = dirname(fileURLToPath(import.meta.url));
const b = await chromium.launch();
for (const [w, h] of [[768, 1024], [1024, 768], [390, 844], [1440, 900]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce", hasTouch: w < 1024, isMobile: w < 768 }); const p = await ctx.newPage();
  await p.goto("http://localhost:4321/climate-signal-observatory/?quality=high"); await p.waitForTimeout(5000);
  await p.evaluate(() => window.__cso.jumpTo("observatory")); await p.waitForTimeout(5000);
  const r = await p.evaluate(() => { const t = document.querySelector("#observatory h2, #observatory [data-scene-heading]")?.getBoundingClientRect(); const rail = document.querySelector(".obs-rail")?.getBoundingClientRect(); return { title: t && [t.left, t.top, t.right, t.bottom].map(Math.round), rail: rail && [rail.left, rail.top, rail.right, rail.bottom].map(Math.round), railPos: getComputedStyle(document.querySelector(".obs-rail")).position }; });
  console.log(w, JSON.stringify(r));
  await p.screenshot({ path: join(OUT, "shots", `rm-obs-${w}.jpg`), type: "jpeg", quality: 70 });
  await ctx.close();
}
await b.close();
