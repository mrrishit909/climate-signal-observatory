// P03-QA-004: QA_LESSONS L16 (tag/caption contrast from screenshot pixels), L17 (panels close on scene change),
// L18 (unit-bearing elements agree in every frame of the S03a/S05 baseline toggles).
// Run from site/: node ../artifacts/evidence/qa-3/probe/lessons.mjs [l16,l17,l18]  (L16 clips go to $CLIPS, then contrast.py)
import { chromium } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path"; import { fileURLToPath } from "node:url";
const OUT = dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:4321/climate-signal-observatory/";
const parts = new Set((process.argv[2] ?? "l16,l17,l18").split(","));
const VPS = [[1920, 1080], [1440, 900], [1280, 720], [1024, 768], [768, 1024], [390, 844], [375, 812], [360, 800]];
const LAND = [["s00end", null], ["signal", 0.78], ["record", 0.14], ["years", 0.5], ["regions", 0.35], ["strata", 0.89], ["zero", 0.3], ["futures", 0.42], ["futures", 0.9], ["evidence", 0.3], ["observatory", null], ["surface", 0.3], ["surface", 0.98]];
const b = await chromium.launch();
const ctxFor = (w, h, extra = {}) => b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: w < 1024, isMobile: w < 768, ...extra });
const ready = (p) => p.waitForFunction(() => window.__cso && window.__cso.debug().glFrames > 2, null, { timeout: 60000 }).catch(() => {});
const res = {};

if (parts.has("l16")) {
  const CLIPS = process.env.CLIPS; mkdirSync(CLIPS, { recursive: true });
  res.l16 = [];
  for (const [w, h] of VPS) {
    const ctx = await ctxFor(w, h); const p = await ctx.newPage();
    await p.goto(`${BASE}?quality=high`); await ready(p);
    await p.waitForFunction(() => !window.__cso.introStats().playing, null, { timeout: 30000 }).catch(() => {}); await p.waitForTimeout(1200);
    for (const [id, q] of LAND) {
      if (id !== "s00end") { await p.evaluate(([i, x]) => window.__cso.jumpTo(i, x ?? undefined), [id, q]); await p.waitForTimeout(2200); }
      const sid = id === "s00end" ? "signal" : id;
      const boxes = await p.evaluate((s) => [...document.querySelectorAll(`#${s} .chip, #${s} [class*=caption], #${s} .surface-foot`)].map((e) => {
        const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
        let vis = r.width > 4 && r.height > 4 && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth;
        for (let x = e; x && vis; x = x.parentElement) { const c = getComputedStyle(x); if (c.display === "none" || c.visibility === "hidden" || +c.opacity < 0.05) vis = false; }
        return vis ? { t: e.textContent.trim().slice(0, 40), x: r.left, y: r.top, w: r.width, h: r.height, color: cs.color } : null;
      }).filter(Boolean), sid);
      for (const [k, bx] of boxes.entries()) {
        const f = `${w}x${h}-${id}-${q ?? "l"}-${k}.png`;
        await p.screenshot({ path: join(CLIPS, f), clip: { x: bx.x, y: bx.y, width: bx.w, height: bx.h } });
        res.l16.push({ vp: `${w}x${h}`, state: `${id}@${q ?? "l"}`, file: f, text: bx.t, color: bx.color });
      }
    }
    await ctx.close();
  }
  writeFileSync(join(OUT, "l16-clips.json"), JSON.stringify(res.l16, null, 1));
  console.log("l16 clips", res.l16.length);
}

if (parts.has("l17")) {
  res.l17 = [];
  const others = ["signal", "record", "years", "regions", "strata", "zero", "futures", "evidence", "surface"];
  for (const [w, h] of [[1440, 900], [768, 1024], [390, 844]]) {
    const ctx = await ctxFor(w, h); const p = await ctx.newPage();
    await p.goto(`${BASE}?quality=high`); await ready(p); await p.keyboard.press("Escape"); await p.waitForTimeout(800);
    const panels = [
      ["inspector", async () => { await p.evaluate(() => window.__cso.jumpTo("observatory")); await p.waitForTimeout(1800); await p.evaluate(() => window.__cso.setObs({ cell: { row: 37, col: 72 } })); await p.waitForTimeout(900); }, () => p.evaluate(() => { const e = document.querySelector(".inspector"); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < innerHeight && getComputedStyle(e).visibility !== "hidden"; })],
      ["s05-more", async () => { await p.evaluate(() => window.__cso.jumpTo("zero", 0.3)); await p.waitForTimeout(1500); await p.evaluate(() => document.querySelector("#zero .zero-more")?.click()); await p.waitForTimeout(700); }, () => p.evaluate(() => document.querySelector("#zero .zero-more")?.getAttribute("aria-expanded") === "true")],
      ["menu", async () => { await p.evaluate(() => document.querySelector(".nav-pill.is-fixed .menu-pill")?.click()); await p.waitForTimeout(600); }, () => p.evaluate(() => document.querySelector(".nav-pill.is-fixed .menu-pill")?.getAttribute("aria-expanded") === "true")],
    ];
    for (const [name, open, isOpen] of panels) {
      if (name === "menu" && w >= 1024) continue;
      await open();
      const opened = await isOpen();
      for (const dest of others) {
        if (!(await isOpen())) await open();
        await p.evaluate((d) => window.__cso.jumpTo(d), dest); await p.waitForTimeout(1300);
        const still = await isOpen();
        // L12 on the destination: nav/pill top-of-stack at its centre
        const navOk = await p.evaluate(() => { const e = document.querySelector(".nav-pill.is-fixed .menu-pill") ?? document.querySelector(".nav-bar.is-fixed .nav__item"); const r = e.getBoundingClientRect(); if (!r.width) return true; const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return t === e || e.contains(t); });
        res.l17.push({ vp: `${w}x${h}`, panel: name, opened, dest, stillOpen: still, navTopOfStack: navOk });
        if (still || !navOk) { console.log("L17", w, name, dest, "stillOpen", still, "nav", navOk); await p.screenshot({ path: join(OUT, "shots", `l17-${w}-${name}-${dest}.jpg`), type: "jpeg", quality: 55 }); }
      }
      await p.keyboard.press("Escape");
    }
    await ctx.close();
  }
  writeFileSync(join(OUT, "l17.json"), JSON.stringify(res.l17, null, 1));
  console.log("l17 cases", res.l17.length, "failures", res.l17.filter((x) => x.stillOpen || !x.navTopOfStack).length);
}

if (parts.has("l18")) {
  res.l18 = [];
  for (const [w, h] of [[1440, 900], [768, 1024], [390, 844]]) for (const rm of ["no-preference", "reduce"]) {
    const ctx = await ctxFor(w, h, { reducedMotion: rm }); const p = await ctx.newPage();
    await p.goto(`${BASE}?quality=high`); await ready(p); await p.keyboard.press("Escape"); await p.waitForTimeout(800);
    for (const [scene, q] of [["years", 0.5], ["zero", 0.3]]) {
      for (const [from, to] of [["1951-1980", "1991-2020"], ["1991-2020", "1951-1980"]]) {
        await p.evaluate(([s, x, f]) => { window.__cso.setClimate({ baseline: f }); window.__cso.jumpTo(s, x); }, [scene, q, from]); await p.waitForTimeout(1800);
        const btn = await p.evaluate(([s, t]) => { const bs = [...document.querySelectorAll(`#${s} [role=radio]`)].filter((b) => b.textContent.trim() === t && b.getBoundingClientRect().width > 0); const b = bs.find((x) => { const r = x.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, [scene, to]);
        if (!btn) { res.l18.push({ vp: `${w}x${h}`, motion: rm, scene, to, error: "no visible radio" }); continue; }
        // start per-frame sampling of every visible baseline-bearing text node in the section, then a real pointer click
        await p.evaluate((s) => {
          window.__l18 = []; const t0 = performance.now();
          const tick = () => {
            const sec = document.getElementById(s); const seen = new Set();
            const tw = document.createTreeWalker(sec, NodeFilter.SHOW_TEXT);
            for (let n = tw.nextNode(); n; n = tw.nextNode()) {
              const m = n.textContent.match(/(1951-1980|1991-2020|1850-1900)/g); if (!m) continue;
              const el = n.parentElement; if (el.closest("[role=radio], [role=radiogroup], .chip-btn, .sr-only, [aria-hidden=true] .seg-ctl__label, .invariance")) continue; // .invariance names both baselines on purpose ("slope under A = slope under B")
              let vis = true; for (let x = el; x && vis; x = x.parentElement) { const c = getComputedStyle(x); if (c.display === "none" || c.visibility === "hidden" || +c.opacity < 0.05) vis = false; }
              const r = el.getBoundingClientRect(); if (!vis || r.width === 0 || r.bottom < 0 || r.top > innerHeight) continue;
              for (const v of m) seen.add(v);
            }
            window.__l18.push({ t: Math.round(performance.now() - t0), seen: [...seen] });
            if (performance.now() - t0 < 1600) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }, scene);
        if (w < 1024) await p.touchscreen.tap(btn.x, btn.y); else await p.mouse.click(btn.x, btn.y);
        await p.waitForTimeout(1800);
        const frames = await p.evaluate(() => window.__l18);
        const mixed = frames.filter((f) => f.seen.filter((v) => v !== "1850-1900").length > 1);
        const final = frames.at(-1)?.seen ?? [];
        res.l18.push({ vp: `${w}x${h}`, motion: rm, scene, from, to, frames: frames.length, mixedFrames: mixed.length, firstMixed: mixed[0] ?? null, final, applied: (await p.evaluate(() => window.__cso.getClimate().baseline)) });
        if (mixed.length) console.log("L18 mixed", w, rm, scene, from, "->", to, mixed.length, "of", frames.length, JSON.stringify(mixed[0]));
      }
    }
    await ctx.close();
  }
  writeFileSync(join(OUT, "l18.json"), JSON.stringify(res.l18, null, 1));
  console.log("l18 cases", res.l18.length, "mixed", res.l18.filter((x) => x.mixedFrames).length);
}
await b.close();
