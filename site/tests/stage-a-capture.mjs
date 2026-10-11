#!/usr/bin/env node
/**
 * Stage A evidence (P03-FE-001): real screenshots of the PRODUCTION preview
 * (npm run build && npm run preview, port 4321), never the dev server.
 * S00 at frozen intro times, S03a at 3 years x 2 baselines, S04 at unwrap
 * progress points, operational states, the no-WebGL tier and reduced motion.
 * Usage: node tests/stage-a-capture.mjs [--only 1440x900] ; then python3 tests/contact-sheet.py ../artifacts/evidence/stage-a
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import http from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "..", "artifacts", "evidence", "stage-a");
const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => (a.startsWith("--") ? [a.slice(2), arr[i + 1]] : null)).filter(Boolean));
const BASE = args.base ?? "http://localhost:4321/climate-signal-observatory/";
const VIEWPORTS = [[1440, 900], [768, 1024], [390, 844]].map(([width, height]) => ({ width, height, label: `${width}x${height}` }))
  .filter((v) => !args.only || args.only.split(",").includes(v.label));
const LATEST = 2025, yearP = (y, first = 1880) => 0.08 + (0.84 * (y - first)) / (LATEST - first);

const wait = (page, ms) => page.waitForTimeout(ms);
const jump = (page, id, p) => page.evaluate(([i, q]) => window.__cso.jumpTo(i, q), [id, p]);
const climate = (page, c) => page.evaluate((x) => window.__cso.setClimate(x), c);

/** Loopback throttle (CDP throttling does not slow loopback here): streams data/* at ~48 KB/s so the loading state is a real in-flight request. */
function throttleProxy(target, port) {
  const t = new URL(target);
  const server = http.createServer((req, res) => {
    const up = http.request({ host: t.hostname, port: t.port, path: req.url, method: req.method, headers: { ...req.headers, host: t.host } }, (r) => {
      res.writeHead(r.statusCode ?? 502, r.headers);
      if (!/\/data\/grid_gistemp_2deg\.i8/.test(req.url ?? "")) return r.pipe(res);
      const queue = [];
      let ended = false;
      r.on("data", (chunk) => { for (let i = 0; i < chunk.length; i += 4096) queue.push(chunk.subarray(i, i + 4096)); });
      r.on("end", () => { ended = true; });
      const pump = setInterval(() => { const n = queue.shift(); if (n) res.write(n); else if (ended) { clearInterval(pump); res.end(); } }, 85);
      res.on("close", () => clearInterval(pump));
    });
    up.on("error", () => res.destroy());
    res.on("close", () => up.destroy());
    req.pipe(up);
  });
  return new Promise((ok) => server.listen(port, "127.0.0.1", () => ok(server)));
}

async function ready(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => window.__cso && document.documentElement.dataset.tier, null, { timeout: 20000 });
}

async function run() {
  // in-process `vite preview` of the built dist/ (run `npm run build` first): a detached server can be reaped on this shared machine
  const server = args.base ? null : await preview({ root: join(HERE, ".."), preview: { port: 4321, strictPort: true } });
  const proxy = await throttleProxy(BASE, 4322);
  const SLOW = BASE.replace(/localhost:\d+/, "127.0.0.1:4322");
  const browser = await chromium.launch();
  const log = [];
  for (const vp of VIEWPORTS) {
    const dir = join(OUT, vp.label);
    mkdirSync(dir, { recursive: true });
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.width < 1024, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const external = [];
    page.on("request", (r) => { if (!/^http:\/\/(localhost|127\.0\.0\.1):43\d\d\//.test(r.url()) && !r.url().startsWith("data:")) external.push(r.url()); });
    page.on("pageerror", (e) => log.push(`${vp.label} pageerror ${e.message}`));
    const shot = async (name) => { await page.screenshot({ path: join(dir, `${name}.png`) }); log.push(`${vp.label}/${name}.png`); };

    // S00 at frozen intro times (the same clock every layer reads), then the real end state
    await page.goto(`${BASE}?quality=high`);
    await ready(page);
    await page.waitForFunction(() => window.__cso.debug().glFrames > 2, null, { timeout: 20000 });
    for (const t of [600, 1300, 1800, 2700]) {
      await page.evaluate((x) => window.__cso.freeze(x), t);
      await wait(page, 500);
      await shot(`01-s00-t${String(t).padStart(4, "0")}`);
    }
    const stats = await page.evaluate(() => window.__cso.introStats());
    await page.evaluate(() => window.__cso.freeze(-1));
    await page.waitForFunction(() => !window.__cso.introStats().playing, null, { timeout: 20000 });
    await wait(page, 600);
    await shot("01-s00-t4600-end");
    log.push(`${vp.label} intro radius min ${stats.minR.toFixed(1)} G0 ${stats.G0.toFixed(1)} vh ${vp.height} (120vh = ${(0.6 * vp.height).toFixed(1)} r) monotonic ${stats.monotonic}`);

    await jump(page, "signal", 0.5); await wait(page, 700); await shot("02-s01-p50");

    // S03a: 3 years x 2 baselines (GISTEMP), then HadCRUT5 on 1850-1900 (the honest sparse picture)
    for (const base of ["1951-1980", "1991-2020"]) {
      await climate(page, { source: "gistemp", baseline: base });
      for (const y of [1880, 1950, LATEST]) {
        await jump(page, "years", Math.min(0.96, yearP(y)));
        await page.waitForFunction((yy) => document.querySelector("[data-year]")?.textContent === String(yy), y, { timeout: 20000 });
        await wait(page, 900);
        await shot(`03-s03a-${y}-${base}`);
      }
    }
    await climate(page, { source: "hadcrut5", baseline: "1850-1900" });
    await jump(page, "years", yearP(1880, 1850));
    await page.waitForFunction(() => /HADCRUT5/.test(document.querySelector(".years-readout > .chip")?.textContent ?? ""), null, { timeout: 20000 });
    await page.waitForFunction(() => !document.querySelector(".years-readout .state-line--loading"), null, { timeout: 30000 });
    await wait(page, 1200);
    await shot("03-s03a-1880-hadcrut5-1850-1900");
    await climate(page, { source: "gistemp", baseline: "1951-1980" });

    // S04: the unwrap at its phase points
    for (const p of [0.03, 0.2, 0.38, 0.52, 0.7, 0.96]) {
      await jump(page, "strata", p);
      await wait(page, p > 0.9 ? 2200 : 900);
      await shot(`04-s04-p${String(Math.round(p * 100)).padStart(2, "0")}`);
    }
    await page.evaluate(() => [...document.querySelectorAll(".strata-foot [role=radio]")].find((b) => /HADCRUT5/.test(b.textContent))?.click());
    await page.waitForFunction(() => !document.querySelector(".strata-loading"), null, { timeout: 30000 });
    await wait(page, 1500);
    await shot("04-s04-p96-hadcrut5");
    await climate(page, { source: "gistemp", baseline: "1951-1980" });

    if (vp.width < 1024) {
      await jump(page, "years", 0.5); await wait(page, 500);
      await page.locator(".nav-pill.is-fixed .menu-pill").click(); await wait(page, 450); await shot("05-menu-open");
      await page.keyboard.press("Escape"); await wait(page, 300);
    }

    // error + RETRY (a real 404 from page.route, then the same fetch succeeds)
    const errPage = await ctx.newPage();
    let block = true;
    await errPage.route("**/grid_gistemp_2deg.i8.bin.gz", (r) => (block ? r.fulfill({ status: 404, body: "" }) : r.continue()));
    await errPage.goto(`${BASE}?quality=high`); await errPage.keyboard.press("Escape");
    await errPage.evaluate(() => window.__cso.jumpTo("years", 0.5));
    await errPage.waitForSelector(".years-readout [role=alert]", { timeout: 20000 });
    await errPage.waitForTimeout(500);
    await errPage.screenshot({ path: join(dir, "06-state-error.png") }); log.push(`${vp.label}/06-state-error.png`);
    block = false;
    await errPage.locator(".years-readout [role=alert] button").click();
    await errPage.waitForFunction(() => !document.querySelector(".years-readout [role=alert]") && !document.querySelector(".years-readout .state-line--loading"), null, { timeout: 30000 });
    await errPage.waitForTimeout(900);
    await errPage.screenshot({ path: join(dir, "06-state-after-retry.png") }); log.push(`${vp.label}/06-state-after-retry.png`);
    await errPage.close();

    // loading: the real request through the throttle, with real byte progress
    const slow = await ctx.newPage();
    await slow.goto(`${SLOW}?quality=high`); await slow.keyboard.press("Escape");
    await slow.evaluate(() => window.__cso.jumpTo("strata", 0.7));
    await slow.waitForFunction(() => /LOADING GRID_GISTEMP_2DEG · [1-9]\d?%/.test(document.querySelector(".strata-loading")?.textContent ?? ""), null, { timeout: 30000 });
    await slow.waitForTimeout(300);
    await slow.screenshot({ path: join(dir, "06-state-loading-s04.png") }); log.push(`${vp.label}/06-state-loading-s04.png`);
    await slow.close();

    // no-WebGL tier
    const ng = await ctx.newPage();
    await ng.goto(`${BASE}?quality=nogl`); await ng.evaluate(() => document.fonts.ready);
    await ng.keyboard.press("Escape"); await ng.waitForTimeout(800);
    await ng.screenshot({ path: join(dir, "07-nogl-s00.png") });
    await ng.evaluate(() => window.__cso.jumpTo("years", 0.9)); await ng.waitForTimeout(2500);
    await ng.screenshot({ path: join(dir, "07-nogl-s03a.png") });
    await ng.evaluate(() => window.__cso.jumpTo("strata", 0.4)); await ng.waitForTimeout(2500);
    await ng.screenshot({ path: join(dir, "07-nogl-s04-p40.png") });
    log.push(`${vp.label}/07-nogl-*`);
    await ng.close();
    await ctx.close();

    // reduced motion: static frames in normal flow
    const rctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, reducedMotion: "reduce", deviceScaleFactor: 1 });
    const rp = await rctx.newPage();
    await rp.goto(BASE, { waitUntil: "networkidle" }); await rp.evaluate(() => document.fonts.ready);
    await rp.waitForTimeout(1500);
    await rp.screenshot({ path: join(dir, "08-reduced-s00.png") });
    for (const [sel, name] of [[".years-static", "08-reduced-s03a"], [".strata-static", "08-reduced-s04"]]) {
      await rp.waitForFunction(() => window.__cso, null);
      await rp.locator(sel).scrollIntoViewIfNeeded();
      await rp.evaluate((s) => document.querySelector(s).scrollIntoView({ block: "center" }), sel);
      await rp.waitForTimeout(2500);
      await rp.screenshot({ path: join(dir, `${name}.png`) });
    }
    log.push(`${vp.label}/08-reduced-*`);
    await rctx.close();
    log.push(`${vp.label} external requests: ${external.length ? external.join(", ") : "none"}`);
  }
  await browser.close();
  proxy.close();
  await server?.close();
  writeFileSync(join(OUT, "capture-log.txt"), log.join("\n") + "\n");
  console.log(log.filter((l) => !l.endsWith(".png")).join("\n"));
}
run().catch((e) => { console.error(e); process.exit(1); });
