// P03-QA-005: L16/L19 contrast over EVERY visible text element (DOM-built, no selector list), plus the S08 ghost-floor sweep.
// Run from site/: SHOTS=<dir> node ../artifacts/evidence/qa-4/probe/l19.mjs [contrast,ghost]; then python3 l19-contrast.py <dir>
import { chromium } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path"; import { fileURLToPath } from "node:url";
const OUT = dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:4321/climate-signal-observatory/";
const parts = new Set((process.argv[2] ?? "contrast,ghost").split(","));
const VPS = [[1920, 1080], [1440, 900], [1280, 720], [1024, 768], [768, 1024], [390, 844], [375, 812], [360, 800]];
const LAND = [["s00end", null], ["signal", 0.78], ["record", 0.14], ["years", 0.5], ["regions", 0.35], ["strata", 0.89], ["zero", 0.3], ["futures", 0.42], ["futures", 0.9], ["evidence", 0.3], ["observatory", null], ["surface", 0.3], ["surface", 0.6], ["surface", 0.98]];
const b = await chromium.launch();
const ctxFor = (w, h, extra = {}) => b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: w < 1024, isMobile: w < 768, ...extra });
const ready = (p) => p.waitForFunction(() => window.__cso && window.__cso.debug().glFrames > 2, null, { timeout: 60000 }).catch(() => {});

// every visible element that owns a non-empty text node, in the viewport, with its effective opacity
const collect = () => {
  const out = [];
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const el = n.parentElement; if (!el || seen.has(el) || !n.textContent.trim()) continue; seen.add(el);
    if (el.closest(".sr-only, script, style, noscript, [aria-hidden=true] .sr-only")) continue;
    // content of a closed <details> is not painted (Chrome keeps its boxes); its <summary> is
    { const d = el.closest("details:not([open])"); if (d && !el.closest("summary")) continue; }
    let op = 1, hidden = false;
    for (let x = el; x; x = x.parentElement) { const c = getComputedStyle(x); if (c.display === "none" || c.visibility === "hidden") { hidden = true; break; } op *= +c.opacity; }
    if (hidden || op < 0.02) continue;
    const rg = document.createRange(); rg.selectNodeContents(el); const r = rg.getBoundingClientRect();
    if (r.width < 3 || r.height < 3 || r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) continue;
    const cs = getComputedStyle(el);
    const disabled = !!el.closest("[aria-disabled=true], :disabled");
    out.push({ t: n.textContent.trim().slice(0, 50), cls: String(el.className).slice(0, 40), x: Math.max(0, r.left), y: Math.max(0, r.top), w: Math.min(innerWidth, r.right) - Math.max(0, r.left), h: Math.min(innerHeight, r.bottom) - Math.max(0, r.top), op: +op.toFixed(3), color: cs.color, fs: parseFloat(cs.fontSize), disabled, ghost: el.classList.contains("wr-word") });
  }
  return out;
};

if (parts.has("contrast")) {
  const SHOTS = process.env.SHOTS; mkdirSync(SHOTS, { recursive: true });
  const rows = [];
  for (const [w, h] of VPS) {
    const ctx = await ctxFor(w, h); const p = await ctx.newPage();
    await p.goto(`${BASE}?quality=high`); await ready(p);
    await p.waitForFunction(() => !window.__cso.introStats().playing, null, { timeout: 30000 }).catch(() => {}); await p.waitForTimeout(1500);
    for (const [id, q] of LAND) {
      if (id !== "s00end") { await p.evaluate(([i, x]) => window.__cso.jumpTo(i, x ?? undefined), [id, q]); await p.waitForTimeout(2400); }
      const f = `${w}x${h}-${id}-${q ?? "l"}.png`;
      await p.screenshot({ path: join(SHOTS, f) });
      const els = await p.evaluate(collect);
      rows.push({ vp: `${w}x${h}`, state: `${id}@${q ?? "l"}`, shot: f, els });
    }
    await ctx.close();
    console.log("contrast", w, "done");
  }
  writeFileSync(join(OUT, "l19-boxes.json"), JSON.stringify(rows));
}

if (parts.has("ghost")) {
  const res = [];
  for (const [w, h] of [[1440, 900], [1280, 720], [768, 1024], [390, 844], [360, 800]]) {
    const ctx = await ctxFor(w, h); const p = await ctx.newPage();
    await p.goto(`${BASE}?quality=high`); await ready(p); await p.keyboard.press("Escape"); await p.waitForTimeout(800);
    // nav-path jump into S08 (same jumpTo the nav uses) and a deep link: is the paragraph resolved where it is shown?
    await p.evaluate(() => window.__cso.jumpTo("surface")); await p.waitForTimeout(2500);
    const words = () => p.evaluate(() => [...document.querySelectorAll(".surface-para .wr-word")].map((e) => { let op = 1; for (let x = e; x; x = x.parentElement) op *= +getComputedStyle(x).opacity; const r = e.getBoundingClientRect(); return { op: +op.toFixed(3), inView: r.bottom > 0 && r.top < innerHeight && r.width > 0, filter: getComputedStyle(e).filter }; }));
    const land = await words();
    await p.screenshot({ path: join(OUT, "shots", `s08-jump-${w}.jpg`), type: "jpeg", quality: 55 });
    res.push({ vp: `${w}x${h}`, at: "jumpTo(surface) landing", progress: await p.evaluate(() => window.__cso.getProgress?.("surface") ?? null), minOp: Math.min(...land.map((x) => x.op)), maxOp: Math.max(...land.map((x) => x.op)), nWords: land.length });
    // natural scroll sweep through the S08 track
    const y0 = await p.evaluate(() => { window.__cso.jumpTo("surface", 0); return scrollY; });
    const y1 = await p.evaluate(() => { window.__cso.jumpTo("surface", 1); return scrollY; });
    await p.evaluate((y) => window.scrollTo(0, y), y0 - 200); await p.waitForTimeout(800);
    for (let k = 0; k <= 40; k++) {
      const y = y0 + ((y1 - y0) * k) / 40;
      await p.evaluate((yy) => window.scrollTo(0, yy), y); await p.waitForTimeout(350);
      const ws = (await words()).filter((x) => x.inView);
      const vis = ws.filter((x) => x.op >= 0.02);
      const under = vis.filter((x) => x.op < 0.55);
      res.push({ vp: `${w}x${h}`, at: `scroll p=${(k / 40).toFixed(3)}`, nVisible: vis.length, minVisibleOp: vis.length ? Math.min(...vis.map((x) => x.op)) : null, underFloor: under.length, sampleUnder: under.slice(0, 3) });
      if (under.length) { console.log("GHOST<0.55", w, (k / 40).toFixed(3), under.length, JSON.stringify(under[0])); if (under.length && k % 2 === 0) await p.screenshot({ path: join(OUT, "shots", `ghost-${w}-${k}.jpg`), type: "jpeg", quality: 55 }); }
    }
    await ctx.close();
  }
  writeFileSync(join(OUT, "l19-ghost.json"), JSON.stringify(res, null, 1));
  console.log("ghost rows", res.length, "under-floor rows", res.filter((r) => r.underFloor).length, "landings", JSON.stringify(res.filter((r) => r.at.startsWith("jump"))));
}
await b.close();
