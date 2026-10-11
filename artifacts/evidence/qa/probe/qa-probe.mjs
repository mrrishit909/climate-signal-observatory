// P03-QA-002 probe (independent QA). Run from site/: node ../artifacts/evidence/qa/probe/qa-probe.mjs [part,...]
// Parts: errors, axe, keyboard, text, nogl, paint. Writes JSON + screenshots next to this file.
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:4321/climate-signal-observatory/";
const parts = new Set((process.argv[2] ?? "errors,axe,keyboard,text,nogl,paint").split(","));
const VPS = { D: { width: 1440, height: 900 }, M: { width: 390, height: 844 } };
const res = {};
const save = (k) => writeFileSync(join(OUT, `${k}.json`), JSON.stringify(res[k], null, 1));
mkdirSync(join(OUT, "shots"), { recursive: true });
const browser = await chromium.launch();
const ctxFor = (vp, extra = {}) => browser.newContext({ viewport: vp, deviceScaleFactor: 1, hasTouch: vp.width < 1024, isMobile: vp.width < 768, ...extra });
const ready = (page) => page.waitForFunction(() => window.__cso && window.__cso.debug().glFrames > 2, null, { timeout: 60000 });
const jump = async (page, id, p, ms = 1800) => { await page.evaluate(([i, q]) => window.__cso.jumpTo(i, q), [id, p ?? null].map((x) => x ?? undefined)); await page.waitForTimeout(ms); };
const alertsInView = (page) => page.evaluate(() => [...document.querySelectorAll("[role=alert]")].map((a) => {
  const r = a.getBoundingClientRect(), s = getComputedStyle(a);
  return { text: a.textContent.trim(), inView: r.width > 0 && r.bottom > 0 && r.top < innerHeight && s.visibility !== "hidden" && s.display !== "none", top: Math.round(r.top), section: a.closest("section")?.id ?? null };
}));

// ---------------------------------------------------------------- 6: route-block each artifact
const BLOCKS = [
  ["facts.json", ["signal", "record", "regions", "strata", "futures", "evidence", "surface"]],
  ["trends.json", ["regions", "zero", "evidence"]],
  ["regional.json", ["regions", "observatory"]],
  ["ar6.json", ["record", "futures"]],
  ["co2.json", ["years", "evidence"]],
  ["extremes.json", ["years"]],
  ["series_annual.json", ["years", "zero", "futures"]],
  ["changepoints.json", ["zero"]],
  ["grid_gistemp_2deg_intro.i8.bin.gz", ["signal"]],
  ["grid_gistemp_2deg.i8.bin.gz", ["years", "strata", "observatory"]],
  ["grid_trends_gistemp_2deg.i8.bin.gz", ["regions"]],
  ["coastlines.json", ["years", "observatory"]],
  ["meta.json", ["record", "evidence", "surface"]],
  ["grid_gistemp_2deg.meta.json", ["record", "years"]],
];
if (parts.has("errors")) {
  res.errors = [];
  for (const [vk, vp] of Object.entries(VPS)) {
    for (const [file, scenes] of BLOCKS) {
      for (const scene of scenes) {
        const ctx = await ctxFor(vp); const page = await ctx.newPage();
        let block = true, hits = 0;
        const rx = new RegExp(`/data/${file.replace(/\./g, "\\.")}(\\?|$)`);
        await page.route(rx, (r) => { hits++; return block ? r.fulfill({ status: 404, body: "" }) : r.continue(); });
        await page.goto(`${BASE}?quality=high`); await ready(page).catch(() => {});
        await page.keyboard.press("Escape"); await page.waitForTimeout(400);
        await jump(page, scene, undefined, 2500);
        const before = await alertsInView(page);
        const tag = `${vk}-${file.replace(/\W+/g, "_")}-${scene}`;
        await page.screenshot({ path: join(OUT, "shots", `err-${tag}.jpg`), type: "jpeg", quality: 60 });
        const hitsBefore = hits;
        const btn = page.locator("[role=alert] button", { hasText: "RETRY" }).filter({ visible: true });
        const visibleRetries = await btn.count();
        let after = null, hitsAfter = hitsBefore, recovered = null;
        // pick the RETRY inside an alert that is in the viewport
        const hit = await page.evaluate(() => { const bs = [...document.querySelectorAll("[role=alert] button")]; const i = bs.findIndex((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < innerHeight && /RETRY/.test(b.textContent); }); if (i < 0) return { idx: -1 };
          const r = bs[i].getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; const top = document.elementFromPoint(x, y);
          return { idx: i, x, y, covered: !(top === bs[i] || bs[i].contains(top)), topEl: top ? `${top.tagName}.${top.className}` : null, section: bs[i].closest("section")?.id }; });
        const idx = hit.idx;
        if (idx >= 0) {
          block = false;
          if (hit.covered) await page.locator("[role=alert] button").nth(idx).evaluate((b) => b.click()); // keyboard/AT path; pointer is blocked
          else await page.mouse.click(hit.x, hit.y);
          await page.waitForTimeout(2500);
          after = await alertsInView(page); hitsAfter = hits;
          recovered = !after.some((a) => a.inView);
          await page.screenshot({ path: join(OUT, "shots", `err-${tag}-after.jpg`), type: "jpeg", quality: 60 });
        }
        res.errors.push({ vp: vk, file, scene, hit, hitsBefore, retryInViewport: idx >= 0, visibleRetries, alertsBefore: before, refetches: hitsAfter - hitsBefore, recovered, alertsAfter: after });
        console.log(vk, file, scene, "covered", hit.covered ?? null, hit.topEl ?? "", "retrySection", hit.section ?? null, "inViewAlert", before.filter((a) => a.inView).map((a) => a.text).join(" | ") || "NONE", "retry", idx >= 0, "refetch", hitsAfter - hitsBefore, "recovered", recovered);
        await ctx.close();
      }
    }
  }
  save("errors");
}

// ---------------------------------------------------------------- 4a: axe per section, normal + reduced, 1440 + 390, incl. nav jumps
const IDS = ["signal", "record", "years", "regions", "strata", "zero", "futures", "evidence", "observatory", "surface"];
if (parts.has("axe")) {
  res.axe = [];
  for (const [vk, vp] of Object.entries(VPS)) {
    for (const rm of ["no-preference", "reduce"]) {
      const ctx = await ctxFor(vp, { reducedMotion: rm }); const page = await ctx.newPage();
      await page.goto(`${BASE}?quality=high`); await ready(page).catch(() => {});
      await page.keyboard.press("Escape"); await page.waitForTimeout(800);
      const run = async (label) => {
        const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        const v = r.violations.map((x) => ({ id: x.id, impact: x.impact, n: x.nodes.length, sample: x.nodes.slice(0, 3).map((n) => `${n.target.join(" ")} :: ${n.failureSummary?.split("\n").slice(1, 2).join("")}`) }));
        res.axe.push({ vp: vk, motion: rm, at: label, violations: v });
        console.log("axe", vk, rm, label, v.map((x) => `${x.id}(${x.impact})x${x.n}`).join(",") || "clean");
      };
      await run("intro-end");
      for (const id of IDS) { await jump(page, id, undefined, 1600); await run(`landing:${id}`); }
      // nav jumps (real clicks)
      for (const id of ["years", "zero", "observatory"]) try {
        if (vk === "D") await page.locator(`.nav-bar.is-fixed a[href="#${id}"]`).click({ timeout: 8000 });
        else { await page.locator(".nav-pill.is-fixed .menu-pill").click({ timeout: 8000 }); await page.waitForTimeout(500); await run(`menu-open-before-${id}`); await page.locator(`#menu-panel a[href="#${id}"]`).click({ timeout: 8000 }); }
        await page.waitForTimeout(1600); await run(`navjump:${id}`);
      } catch (e) { res.axe.push({ vp: vk, motion: rm, at: `navjump:${id}`, error: e.message.split("\n")[0] }); console.log("NAV CLICK FAILED", vk, rm, id, e.message.split("\n").slice(0, 8).join(" ")); await page.screenshot({ path: join(OUT, "shots", `navfail-${vk}-${rm}-${id}.jpg`), type: "jpeg", quality: 65 }); }
      await ctx.close();
    }
  }
  save("axe");
}

// ---------------------------------------------------------------- 4b: keyboard journey
if (parts.has("keyboard")) {
  const k = res.keyboard = {};
  const ctx = await ctxFor(VPS.D); const page = await ctx.newPage();
  await page.goto(`${BASE}?quality=high`); await ready(page).catch(() => {});
  const active = () => page.evaluate(() => { const a = document.activeElement; return a ? `${a.tagName.toLowerCase()}${a.className ? "." + String(a.className).split(" ").join(".") : ""} "${(a.getAttribute("aria-label") || a.textContent || "").trim().slice(0, 50)}"` : null; });
  k.firstTabs = [];
  for (let i = 0; i < 4; i++) { await page.keyboard.press("Tab"); k.firstTabs.push(await active()); }
  await page.keyboard.press("Escape"); await page.waitForTimeout(800);
  // S03a baseline radios incl. disabled 1850-1900 under GISTEMP
  await jump(page, "years", 0.5, 2000);
  await page.locator('#years [role=radiogroup][aria-label=BASELINE] [role=radio][aria-checked=true]').focus();
  const cl = () => page.evaluate(() => window.__cso.getClimate());
  k.s03a = [];
  for (const key of ["ArrowRight", "ArrowRight", "ArrowLeft"]) { await page.keyboard.press(key); await page.waitForTimeout(300); k.s03a.push({ key, baseline: (await cl()).baseline, focus: await active() }); }
  await page.locator('#years [role=radiogroup][aria-label=BASELINE] [role=radio]', { hasText: "1850-1900" }).click({ force: true }); await page.waitForTimeout(300);
  k.s03a.push({ action: "click disabled 1850-1900 under GISTEMP", baseline: (await cl()).baseline });
  await page.locator('#years [role=radiogroup][aria-label=SOURCE] [role=radio][aria-checked=true]').focus();
  await page.keyboard.press("ArrowRight"); await page.waitForTimeout(400);
  k.s03a.push({ key: "SOURCE ArrowRight", climate: await cl() });
  await page.locator('#years [role=radiogroup][aria-label=BASELINE] [role=radio]', { hasText: "1850-1900" }).click(); await page.waitForTimeout(300);
  k.s03a.push({ action: "click 1850-1900 under HadCRUT5", climate: await cl() });
  await page.locator('#years [role=radiogroup][aria-label=SOURCE] [role=radio]', { hasText: "GISTEMP" }).click(); await page.waitForTimeout(400);
  k.s03a.push({ action: "switch back to GISTEMP while 1850-1900 selected", climate: await cl(), text: await page.locator("#years .years-readout").innerText() });
  await page.screenshot({ path: join(OUT, "shots", "kb-s03a-gistemp-after-1850.jpg"), type: "jpeg", quality: 70 });
  await page.evaluate(() => window.__cso.setClimate({ source: "gistemp", baseline: "1951-1980" }));
  // S05 clamp + handles
  await jump(page, "zero", 0.3, 2000);
  k.s05 = [];
  await page.locator("#zero .clamp__grip").focus();
  for (const key of ["ArrowRight", "ArrowRight", "ArrowLeft", "ArrowLeft", "ArrowLeft"]) { await page.keyboard.press(key); await page.waitForTimeout(400); k.s05.push({ key, baseline: (await cl()).baseline, valuetext: await page.locator("#zero .clamp__grip").getAttribute("aria-valuetext"), offer: await page.locator("#zero").getByText("SWITCH TO HADCRUT5").count() }); }
  await page.screenshot({ path: join(OUT, "shots", "kb-s05-clamp.jpg"), type: "jpeg", quality: 70 });
  const handles = page.locator("#zero .handle");
  k.s05handles = [];
  for (let h = 0; h < await handles.count(); h++) {
    const el = handles.nth(h); await el.focus();
    const v0 = await el.getAttribute("aria-valuenow");
    await page.keyboard.press("ArrowRight"); await page.waitForTimeout(200); const v1 = await el.getAttribute("aria-valuenow");
    await page.keyboard.press("PageUp"); await page.waitForTimeout(200); const v2 = await el.getAttribute("aria-valuenow");
    await page.keyboard.press("End"); await page.waitForTimeout(200); const v3 = await el.getAttribute("aria-valuenow");
    await page.keyboard.press("Home"); await page.waitForTimeout(200); const v4 = await el.getAttribute("aria-valuenow");
    k.s05handles.push({ label: await el.getAttribute("aria-label"), start: v0, right: v1, pageUp: v2, end: v3, home: v4, result: await page.locator("#zero .result-naive, #zero [class*=result]").first().innerText().catch(() => null) });
  }
  await page.screenshot({ path: join(OUT, "shots", "kb-s05-handles.jpg"), type: "jpeg", quality: 70 });
  // OBS core slider, globe rotate, Enter inspector, Esc
  await jump(page, "observatory", undefined, 2500);
  const o = () => page.evaluate(() => { const s = window.__cso.obs(); return { year: s.year, lon0: s.lon0, lat0: s.lat0, region: s.region, cell: s.cell }; });
  k.obs = [];
  await page.locator(".obs-core").focus();
  for (const key of ["ArrowLeft", "PageDown", "Home", "End", "Shift+ArrowUp", "Shift+ArrowDown"]) { await page.keyboard.press(key); await page.waitForTimeout(350); k.obs.push({ key, ...(await o()) }); }
  await page.locator(".obs-globe").focus();
  for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp"]) { await page.keyboard.press(key); await page.waitForTimeout(500); k.obs.push({ key: `globe ${key}`, ...(await o()) }); }
  await page.keyboard.press("Enter"); await page.waitForTimeout(900);
  k.obs.push({ key: "globe Enter", ...(await o()), dialog: await page.locator(".inspector[role=dialog]").count(), focus: await active() });
  await page.screenshot({ path: join(OUT, "shots", "kb-obs-inspector.jpg"), type: "jpeg", quality: 70 });
  await page.keyboard.press("Escape"); await page.waitForTimeout(600);
  k.obs.push({ key: "Escape", ...(await o()), dialog: await page.locator(".inspector[role=dialog]").count(), focus: await active() });
  // wheel over the globe scrolls the page
  const g = await page.locator(".obs-globe").boundingBox();
  const y0 = await page.evaluate(() => scrollY);
  await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2); await page.mouse.wheel(0, 600); await page.waitForTimeout(900);
  k.obsWheel = { before: y0, after: await page.evaluate(() => scrollY) };
  await ctx.close();
  // mobile pill: Esc closes, focus returns
  const mc = await ctxFor(VPS.M); const mp = await mc.newPage();
  await mp.goto(`${BASE}?quality=high`); await ready(mp).catch(() => {}); await mp.keyboard.press("Escape"); await mp.waitForTimeout(600);
  await mp.locator(".nav-pill.is-fixed .menu-pill").focus(); await mp.keyboard.press("Enter"); await mp.waitForTimeout(500);
  const openState = await mp.locator(".nav-pill.is-fixed .menu-pill").getAttribute("aria-expanded");
  await mp.keyboard.press("Escape"); await mp.waitForTimeout(400);
  k.mobileMenu = { open: openState, afterEsc: await mp.locator(".nav-pill.is-fixed .menu-pill").getAttribute("aria-expanded"), focusIsPill: await mp.evaluate(() => document.activeElement?.classList.contains("menu-pill")) };
  await mc.close();
  res.keyboard = k; save("keyboard"); console.log(JSON.stringify(k, null, 1));
}

// ---------------------------------------------------------------- 5: on-screen text per landing (honesty spot checks) + hidden chips
if (parts.has("text")) {
  res.text = {};
  for (const [vk, vp] of Object.entries(VPS)) {
    const ctx = await ctxFor(vp); const page = await ctx.newPage();
    await page.goto(`${BASE}?quality=high`); await ready(page).catch(() => {}); await page.keyboard.press("Escape"); await page.waitForTimeout(800);
    const out = res.text[vk] = {};
    const pts = { signal: [0.78], record: [0.14, 0.45, 0.82], years: [0.5, 0.96], regions: [0.1, 0.35, 0.6, 0.85], strata: [0.89], zero: [0.3], futures: [0.42, 0.9], evidence: [0.05, 0.3, 0.6, 0.95], observatory: [undefined], surface: [0.98] };
    for (const [id, ps] of Object.entries(pts)) for (const p of ps) {
      await jump(page, id, p, 2000);
      out[`${id}@${p ?? "landing"}`] = await page.evaluate((sid) => {
        const sec = document.getElementById(sid);
        const vis = (el) => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && s.visibility !== "hidden" && +s.opacity > 0.05; };
        const text = [...sec.querySelectorAll("p, h2, h3, li, button, span.chip, figcaption, td, th, text")].filter(vis).map((e) => e.innerText?.trim() ?? e.textContent.trim()).filter(Boolean);
        const hiddenChips = [...document.querySelectorAll(".chip")].filter((c) => getComputedStyle(c).display === "none").map((c) => c.textContent.trim());
        return { text: [...new Set(text)], hiddenChips };
      }, id);
    }
    out.allText = await page.evaluate(() => document.body.innerText);
    await ctx.close();
  }
  save("text");
}

// ---------------------------------------------------------------- 3b: no-WebGL fallback
if (parts.has("nogl")) {
  res.nogl = [];
  for (const [vk, vp] of Object.entries(VPS)) {
    const ctx = await ctxFor(vp); const page = await ctx.newPage();
    const errs = []; page.on("pageerror", (e) => errs.push(e.message));
    await page.goto(`${BASE}?quality=nogl`); await page.waitForTimeout(6000);
    await page.screenshot({ path: join(OUT, "shots", `nogl-${vk}-s00.jpg`), type: "jpeg", quality: 70 });
    for (const [id, p] of [["years", 0.5], ["regions", 0.35], ["strata", 0.89], ["observatory", undefined], ["surface", 0.6], ["surface", 0.98]]) {
      await jump(page, id, p, 2500);
      await page.screenshot({ path: join(OUT, "shots", `nogl-${vk}-${id}-${p ?? "l"}.jpg`), type: "jpeg", quality: 70 });
    }
    res.nogl.push({ vp: vk, errors: errs, quality: await page.evaluate(() => window.__cso.quality()), note: await page.evaluate(() => document.body.innerText.match(/[^\n]*(FLAT|WEBGL|3D)[^\n]*/g)) });
    await ctx.close();
  }
  save("nogl");
}

// ---------------------------------------------------------------- 3c: grids load after first paint
if (parts.has("paint")) {
  res.paint = [];
  for (const [vk, vp] of Object.entries(VPS)) {
    const ctx = await ctxFor(vp); const page = await ctx.newPage();
    await page.goto(BASE); await page.waitForTimeout(6000);
    res.paint.push({ vp: vk, ...(await page.evaluate(() => {
      const paint = Object.fromEntries(performance.getEntriesByType("paint").map((e) => [e.name, Math.round(e.startTime)]));
      const lcp = performance.getEntriesByType("largest-contentful-paint");
      const rs = performance.getEntriesByType("resource").filter((r) => /\.(gz|json)$/.test(r.name)).map((r) => ({ file: r.name.split("/").pop(), start: Math.round(r.startTime), end: Math.round(r.responseEnd), bytes: r.transferSize }));
      return { paint, rs };
    })) });
    await ctx.close();
  }
  save("paint"); console.log(JSON.stringify(res.paint, null, 1));
}

// ---------------------------------------------------------------- collisions + clipping at landing states, all viewports (+ classic)
if (parts.has("collide")) {
  const ALLV = [[1920, 1080], [1440, 900], [1024, 768], [768, 1024], [390, 844], [375, 812], [360, 800]];
  const STATES = [["signal", 0.78], ["record", 0.14], ["record", 0.45], ["record", 0.82], ["years", 0.5], ["years", 0.96], ["regions", 0.1], ["regions", 0.35], ["regions", 0.6], ["regions", 0.85],
    ["strata", 0.45], ["strata", 0.89], ["zero", 0.3], ["futures", 0.42], ["futures", 0.9], ["evidence", 0.05], ["evidence", 0.3], ["evidence", 0.6], ["evidence", 0.95], ["observatory", null], ["surface", 0.6], ["surface", 0.98]];
  const classic = process.argv.includes("--classic");
  const cb = classic ? await chromium.launch({ headless: false, ignoreDefaultArgs: ["--hide-scrollbars"] }) : browser;
  const list = classic ? [[1024, 768], [768, 1024]] : ALLV;
  const key = classic ? "collide-classic" : "collide";
  res[key] = [];
  for (const [w, h] of list) {
    const ctx = await cb.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: w < 1024, isMobile: w < 768 });
    if (classic) await ctx.addInitScript(() => addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = "html{overflow-y:scroll!important}::-webkit-scrollbar{width:15px}::-webkit-scrollbar-thumb{background:#777}"; document.head.append(s); }));
    const page = await ctx.newPage();
    await page.goto(`${BASE}?quality=high`); await ready(page).catch(() => {}); await page.keyboard.press("Escape"); await page.waitForTimeout(800);
    for (const [id, p] of STATES) {
      await jump(page, id, p ?? undefined, 2200);
      const r = await page.evaluate((sid) => {
        const cw = document.documentElement.clientWidth, vh = innerHeight;
        const sec = document.getElementById(sid);
        const roots = [sec, document.querySelector(".nav-bar.is-fixed"), document.querySelector(".nav-pill.is-fixed"), document.querySelector(".corner-btn")].filter(Boolean);
        const items = [];
        const visible = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === "none" || s.visibility === "hidden" || +s.opacity < 0.05) return false; if (e.classList.contains("sr-only") || e.getAttribute("aria-hidden") === "true" && e.closest(".wr-ghost")) return false; } return true; };
        for (const root of roots) {
          const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
          for (let n = tw.nextNode(); n; n = tw.nextNode()) {
            if (!n.textContent.trim()) continue;
            const el = n.parentElement; if (!el || !visible(el)) continue;
            const s = getComputedStyle(el); if (s.position === "absolute" && s.clip !== "auto" && el.className.includes?.("sr")) continue;
            const rg = document.createRange(); rg.selectNodeContents(n);
            for (const b of rg.getClientRects()) {
              if (b.width < 2 || b.height < 2 || b.bottom < 0 || b.top > vh) continue;
              // clipped by a scroller/overflow ancestor?
              let clipBy = null;
              for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.overflowX !== "visible" || cs.overflowY !== "visible") { const er = e.getBoundingClientRect(); if (b.right > er.right + 1 || b.left < er.left - 1 || b.bottom > er.bottom + 1 || b.top < er.top - 1) { clipBy = e.className || e.tagName; } break; } }
              items.push({ t: n.textContent.trim().slice(0, 40), el, x0: b.left, x1: b.right, y0: b.top, y1: b.bottom, clipBy });
            }
          }
        }
        const overlaps = [];
        for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
          const a = items[i], b = items[j];
          if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el) || a.clipBy || b.clipBy) continue;
          const ix = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), iy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
          if (ix > 2 && iy > 2) overlaps.push(`"${a.t}" x "${b.t}" (${Math.round(ix)}x${Math.round(iy)}px @${Math.round(a.x0)},${Math.round(a.y0)})`);
        }
        const offscreen = items.filter((a) => !a.clipBy && (a.x0 < -1 || a.x1 > cw + 1)).map((a) => `"${a.t}" ${Math.round(a.x0)}..${Math.round(a.x1)} of ${cw}`);
        const scrolledOut = items.filter((a) => a.clipBy).map((a) => `"${a.t}" in ${String(a.clipBy).slice(0, 30)}`);
        return { cw, scrollW: document.documentElement.scrollWidth, overlaps: [...new Set(overlaps)], offscreen: [...new Set(offscreen)], scrolledOut: [...new Set(scrolledOut)].slice(0, 12) };
      }, id);
      res[key].push({ vp: `${w}x${h}${classic ? "-classic" : ""}`, state: `${id}@${p ?? "landing"}`, ...r });
      if (r.overlaps.length || r.offscreen.length || r.scrollW > r.cw) {
        console.log(`${w}x${h}`, id, p, "overlaps", r.overlaps.length, "offscreen", r.offscreen.length, "sw", r.scrollW, r.cw);
        await page.screenshot({ path: join(OUT, "shots", `col-${w}x${h}${classic ? "c" : ""}-${id}-${p ?? "l"}.jpg`), type: "jpeg", quality: 65 });
      }
    }
    await ctx.close();
  }
  if (classic) await cb.close();
  save(key);
}

// ---------------------------------------------------------------- honesty chips rendered vs hidden per scene, D/T/M
if (parts.has("chips")) {
  res.chips = {};
  for (const [w, h] of [[1440, 900], [768, 1024], [390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 1024, isMobile: w < 768 }); const page = await ctx.newPage();
    await page.goto(`${BASE}?quality=high`); await ready(page).catch(() => {}); await page.keyboard.press("Escape"); await page.waitForTimeout(800);
    for (const [id, p] of [["signal", 0.78], ["record", 0.45], ["years", 0.96], ["regions", 0.35], ["strata", 0.89], ["zero", 0.3], ["futures", 0.9], ["evidence", 0.95], ["observatory", null], ["surface", 0.98]]) {
      await jump(page, id, p ?? undefined, 2000);
      res.chips[`${w}x${h} ${id}`] = await page.evaluate((sid) => [...document.getElementById(sid).querySelectorAll(".chip")].map((c) => {
        let why = null; for (let e = c; e && e !== document.body; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === "none") { why = `display:none on ${e.className || e.tagName}`; break; } if (s.visibility === "hidden") { why = "visibility:hidden"; break; } if (+s.opacity < 0.05) { why = `opacity ${s.opacity} on ${String(e.className).slice(0, 30)}`; break; } }
        const r = c.getBoundingClientRect(); if (!why && (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth)) why = "off-screen";
        return { chip: c.textContent.trim(), hidden: why };
      }), id);
    }
    await ctx.close();
  }
  save("chips");
  for (const [k, v] of Object.entries(res.chips)) for (const c of v) if (c.hidden) console.log(k, "|", c.chip, "|", c.hidden);
}
await browser.close();
