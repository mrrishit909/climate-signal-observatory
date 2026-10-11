// QA-002: is the fixed nav (D bar / M pill) the top element at every landing, normal and reduced motion?
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path"; import { fileURLToPath } from "node:url";
const OUT = dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:4321/climate-signal-observatory/";
const IDS = ["signal", "record", "years", "regions", "strata", "zero", "futures", "evidence", "observatory", "surface"];
const b = await chromium.launch(); const res = [];
for (const [w, h] of [[1440, 900], [390, 844]]) for (const rm of ["no-preference", "reduce"]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: rm, hasTouch: w < 1024, isMobile: w < 768 }); const p = await ctx.newPage();
  await p.goto(`${BASE}?quality=high`); await p.waitForTimeout(4000); await p.keyboard.press("Escape"); await p.waitForTimeout(800);
  for (const id of IDS) {
    await p.evaluate((i) => window.__cso.jumpTo(i), id); await p.waitForTimeout(1500);
    const r = await p.evaluate(() => {
      const t = document.querySelector(".nav-pill.is-fixed .menu-pill") ?? document.querySelector(".nav-bar.is-fixed .nav__item");
      const vis = getComputedStyle(t).display !== "none" && t.getBoundingClientRect().width > 0;
      const els = [...document.querySelectorAll(".nav-pill.is-fixed .menu-pill, .nav-bar.is-fixed .nav__item, .corner-btn")].filter((e) => e.getBoundingClientRect().width > 0);
      return els.map((e) => { const q = e.getBoundingClientRect(); const top = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return { el: e.textContent.trim().slice(0, 14), ok: top === e || e.contains(top), top: top ? `${top.tagName}.${String(top.className).slice(0, 30)} in #${top.closest("section")?.id ?? "-"}` : null }; }).filter((x) => !x.ok);
    });
    res.push({ vp: `${w}x${h}`, motion: rm, at: id, blocked: r });
    if (r.length) { console.log(w, rm, id, JSON.stringify(r)); await p.screenshot({ path: join(OUT, "shots", `navblock-${w}-${rm}-${id}.jpg`), type: "jpeg", quality: 65 }); }
  }
  await ctx.close();
}
writeFileSync(join(OUT, "navblock.json"), JSON.stringify(res, null, 1)); await b.close();
