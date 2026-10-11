// QA-003: every scene landing under reduced motion at 1440 and 390 (do the static figures paint?).
import { chromium } from "@playwright/test";
import { dirname, join } from "node:path"; import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";
const OUT = dirname(fileURLToPath(import.meta.url));
const IDS = ["signal", "record", "years", "regions", "strata", "zero", "futures", "evidence", "observatory", "surface"];
const b = await chromium.launch(); const res = [];
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce", hasTouch: w < 1024, isMobile: w < 768 }); const p = await ctx.newPage();
  await p.goto("http://localhost:4321/climate-signal-observatory/?quality=high"); await p.waitForTimeout(5000);
  for (const id of IDS) {
    await p.evaluate((i) => window.__cso.jumpTo(i), id); await p.waitForTimeout(2500);
    const c = await p.evaluate((sid) => [...document.querySelectorAll(`#${sid} canvas`)].map((c) => { const r = c.getBoundingClientRect(); return `${c.className || "canvas"} ${Math.round(r.width)}x${Math.round(r.height)}`; }), id);
    res.push({ vp: w, id, canvases: c }); console.log(w, id, c.join(" | "));
    await p.screenshot({ path: join(OUT, "shots", `rmland-${w}-${id}.jpg`), type: "jpeg", quality: 55 });
  }
  await ctx.close();
}
writeFileSync(join(OUT, "rm-landings.json"), JSON.stringify(res, null, 1)); await b.close();
