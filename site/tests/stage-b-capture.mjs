#!/usr/bin/env node
/**
 * Stage B evidence (P03-FE-002): production preview (in-process vite preview on 4321), every new scene at 2-4 states,
 * operational states, reduced motion; then python3 tests/contact-sheet.py ../artifacts/evidence/stage-b
 * Usage: node tests/stage-b-capture.mjs [--only 1440x900]
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "..", "artifacts", "evidence", "stage-b");
const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => (a.startsWith("--") ? [a.slice(2), arr[i + 1]] : null)).filter(Boolean));
const BASE = "http://localhost:4321/climate-signal-observatory/";
const VIEWPORTS = [[1440, 900], [768, 1024], [390, 844]].map(([width, height]) => ({ width, height, label: `${width}x${height}` }))
  .filter((v) => !args.only || args.only.split(",").includes(v.label));

const run = async () => {
  const server = await preview({ root: join(HERE, ".."), preview: { port: 4321, strictPort: true } });
  const browser = await chromium.launch();
  const log = [];
  for (const vp of VIEWPORTS) {
    const dir = join(OUT, vp.label);
    mkdirSync(dir, { recursive: true });
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.width < 1024, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const external = [];
    page.on("request", (r) => { if (!/^(http:\/\/(localhost|127\.0\.0\.1):43\d\d\/|data:|blob:)/.test(r.url())) external.push(r.url()); });
    page.on("pageerror", (e) => log.push(`${vp.label} pageerror ${e.message}`));
    const shot = async (name) => { await page.screenshot({ path: join(dir, `${name}.png`) }); log.push(`${vp.label}/${name}.png`); };
    const jump = async (id, p, ms = 1300) => { await page.evaluate(([i, q]) => window.__cso.jumpTo(i, q), [id, p]); await page.waitForTimeout(ms); };
    const ev = (fn, a) => page.evaluate(fn, a);

    await page.goto(`${BASE}?quality=high`);
    await page.waitForFunction(() => window.__cso && window.__cso.debug().glFrames > 2, null, { timeout: 30000 });
    for (const t of [600, 1300, 1800, 3000]) { await ev((x) => window.__cso.freeze(x), t); await page.waitForTimeout(500); await shot(`00-s00-t${String(t).padStart(4, "0")}`); }
    await ev(() => window.__cso.freeze(-1));
    await page.waitForFunction(() => !window.__cso.introStats().playing, null, { timeout: 20000 });
    await page.waitForTimeout(500); await shot("00-s00-t4600-end");

    await jump("signal", 0.78, 2200); await shot("01-s01-p78-cards");
    for (const p of [0.14, 0.45, 0.82]) { await jump("record", p, 1600); await shot(`02-s02-p${Math.round(p * 100)}`); }
    await jump("years", 0.96, 2500); await ev(() => document.querySelector(".plus2")?.click()); await page.waitForTimeout(900); await shot("03-s03a-plus2-on");
    await ev(() => document.querySelector(".plus2")?.click());
    for (const p of [0.1, 0.35, 0.6, 0.85]) { await jump("regions", p, 2200); await shot(`03b-s03b-p${Math.round(p * 100)}`); }
    await ev(() => [...document.querySelectorAll(".ledger button")][2]?.click()); await page.waitForTimeout(1600); await shot("03b-s03b-override-low-band");
    await ev(() => [...document.querySelectorAll('[role=radio]')].find((b) => b.textContent === "SINCE 1991")?.click()); await page.waitForTimeout(900); await shot("03b-s03b-since1991");
    await ev(() => window.__cso.jumpTo("regions", 0.1));
    await jump("strata", 0.96, 2500);
    if (vp.width >= 1024) { const b = await page.locator(".core-hit").boundingBox(); if (b) { await page.mouse.move(b.x + b.width / 2, b.y + 30); await page.waitForTimeout(400); } }
    await shot("04-s04-p96-hover");
    for (const p of [0.08, 0.3]) { await jump("zero", p, 1600); await shot(`05-s05-p${Math.round(p * 100)}`); }
    await ev(() => window.__cso.setClimate({ baseline: "1991-2020" })); await page.waitForTimeout(1000); await shot("05-s05-1991-2020");
    await ev(() => { const s = window.__cso; s.setClimate({ baseline: "1951-1980" }); });
    await ev(() => { [...document.querySelectorAll(".zero-controls [role=radio]")].filter((b) => /LOESS|EXPLORATORY/.test(b.textContent)).forEach((b) => b.click()); });
    await page.waitForTimeout(1000); await shot("05-s05-loess-breaks");
    await ev(() => { [...document.querySelectorAll(".zero-controls [role=radio]")].filter((b) => b.textContent === "OFF").forEach((b) => b.click()); });
    for (const p of [0.15, 0.42, 0.9]) { await jump("futures", p, 1800); await shot(`06-s06-p${Math.round(p * 100)}`); }
    await ev(() => [...document.querySelectorAll(".fut-chip")].find((b) => b.textContent.startsWith("SSP5-8.5"))?.click()); await page.waitForTimeout(600); await shot("06-s06-ssp585");
    await ev(() => [...document.querySelectorAll(".fut-chip")].find((b) => b.textContent.startsWith("SSP2-4.5"))?.click());
    for (const p of [0.3, 0.95]) { await jump("evidence", p, 1600); await shot(`07-s07-p${Math.round(p * 100)}`); }
    await jump("observatory", undefined, 2500); await shot("08-obs-default");
    await ev(() => window.__cso.setObs({ view: "map" })); await page.waitForTimeout(2000); await shot("08-obs-map");
    await ev(() => window.__cso.setObs({ view: "globe", layer: "trend", region: "arctic" })); await page.waitForTimeout(2200); await shot("08-obs-trend-arctic");
    await ev(() => window.__cso.setObs({ layer: "anomaly", region: { lat0: -20, lat1: 20 }, year: 1998 })); await page.waitForTimeout(1200);
    const g = await page.locator(".obs-globe").boundingBox();
    if (g) { await page.mouse.click(g.x + g.width * 0.45, g.y + g.height * 0.5); await page.waitForTimeout(900); }
    await shot("08-obs-slice-inspector");
    await ev(() => window.__cso.setObs({ cell: null, region: null, year: 2025 }));
    for (const p of [0.15, 0.45, 0.6, 0.95]) { await jump("surface", p, p > 0.9 ? 2600 : 1400); await shot(`09-s08-p${Math.round(p * 100)}`); }

    // states: a 404 on ar6.json (S06) and on the HadCRUT5 sidecar (S02), then RETRY recovers
    const ep = await ctx.newPage();
    let block = true;
    await ep.route(/ar6\.json|grid_hadcrut5_5deg\.meta\.json/, (r) => (block ? r.fulfill({ status: 404, body: "" }) : r.continue()));
    await ep.goto(`${BASE}?quality=high`); await ep.keyboard.press("Escape");
    await ep.evaluate(() => window.__cso.jumpTo("futures", 0.9)); await ep.waitForTimeout(1500);
    await ep.screenshot({ path: join(dir, "10-state-s06-ar6-404.png") });
    await ep.evaluate(() => window.__cso.jumpTo("record", 0.3)); await ep.waitForTimeout(1200);
    await ep.screenshot({ path: join(dir, "10-state-s02-meta-404.png") });
    block = false;
    await ep.evaluate(() => [...document.querySelectorAll(".record-state [role=alert] button")].forEach((b) => b.click())); await ep.waitForTimeout(1800);
    await ep.screenshot({ path: join(dir, "10-state-s02-after-retry.png") });
    await ep.close();
    await ctx.close();

    const rctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, reducedMotion: "reduce", deviceScaleFactor: 1 });
    const rp = await rctx.newPage();
    await rp.goto(BASE, { waitUntil: "networkidle" }); await rp.waitForTimeout(1500);
    for (const [sel, name] of [[".scene-signal", "11-rm-s01"], [".regions-static", "11-rm-s03b"], [".scene-zero .zero-plot", "11-rm-s05"], [".scene-futures .fut-plot", "11-rm-s06"], [".ev-stack", "11-rm-s07"], [".obs-static", "11-rm-obs"], [".scene-surface", "11-rm-s08"]]) {
      await rp.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: "start" }), sel);
      await rp.waitForTimeout(1800);
      await rp.screenshot({ path: join(dir, `${name}.png`) });
    }
    await rctx.close();
    log.push(`${vp.label} external requests: ${external.length ? external.join(", ") : "none"}`);
  }
  await browser.close();
  await server.close();
  writeFileSync(join(OUT, "capture-log.txt"), log.join("\n") + "\n");
  console.log(log.filter((l) => !l.endsWith(".png")).join("\n"));
};
run().catch((e) => { console.error(e); process.exit(1); });
