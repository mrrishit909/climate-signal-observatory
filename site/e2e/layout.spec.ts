import { chromium, expect, test, type Browser, type Page } from "@playwright/test";

/**
 * QA_LESSONS L1, L2, L3, L5, L7, L8 over every scene landing:
 * - no two text line boxes (or chips) overlap by more than 2px, and none sits under the fixed nav, pill or corner button
 * - in figure scenes, no text sits on the drawn sphere or core
 * - every text box is inside the viewport; the page never scrolls sideways (normal and reduced motion)
 * - every visible text is at least 11px on screen
 * - every honesty chip rendered at 1440 for a landing has a visible counterpart at this width; coloured figures carry a key
 * - the corner button clears the menu pill by 8px or more
 * - with a classic 15px scrollbar, the JS composition class equals the CSS class (L1), and the checks above still hold
 */
const LANDINGS: [string, number | undefined][] = [
  ["signal", 0.78], ["record", 0.14], ["years", 0.5], ["regions", 0.1], ["strata", 0.89], ["zero", 0.3],
  ["futures", 0.42], ["futures", 0.9], ["evidence", 0.95], ["observatory", undefined], ["surface", 0.98],
];
const FIGURE_SCENES = new Set(["years", "regions", "strata", "observatory"]);
/** Elements that are meant to sit on the figure: the inside-core label (on a black backing) and controls drawn over it. */
const ON_FIGURE_OK = ".core-begins, .obs-mark, .obs-mark *";
const VIEWPORTS: [number, number][] = [[1920, 1080], [1440, 900], [1280, 720], [1024, 768], [768, 1024], [390, 844], [375, 812], [360, 800]];

interface Report { hits: string[]; chips: string[]; classes: { js: string; css: string } }

async function audit(page: Page, scene: string): Promise<Report> {
  return page.evaluate(([scene, figureScene, onFigureOk]) => {
    const root = document.getElementById(scene as string)!;
    const W = innerWidth, H = innerHeight, out: string[] = [];
    const visible = (el: Element) => {
      for (let e: Element | null = el; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) < 0.05 || e.classList.contains("sr-only")) return false;
        // the body of a closed <details> is not rendered, only its summary
        if (e.parentElement instanceof HTMLDetailsElement && !e.parentElement.open && e.tagName !== "SUMMARY") return false;
      }
      return true;
    };
    type Box = { r: DOMRect; el: Element; label: string };
    /** what the visitor can see of r: clipped by every overflow-hidden ancestor (deck cards waiting off-stage are not on screen) */
    const clip = (el: Element, r: DOMRect): DOMRect | null => {
      let x0 = r.left, y0 = r.top, x1 = r.right, y1 = r.bottom;
      for (let e = el.parentElement; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.overflowX === "visible" && cs.overflowY === "visible" && cs.clipPath === "none") continue;
        const c = e.getBoundingClientRect();
        x0 = Math.max(x0, c.left); y0 = Math.max(y0, c.top); x1 = Math.min(x1, c.right); y1 = Math.min(y1, c.bottom);
        if (x1 - x0 < 0.5 || y1 - y0 < 0.5) return null;
      }
      return r;
    };
    const boxes: Box[] = [];
    const blockOf = (el: Element) => {
      for (let e: Element | null = el; e; e = e.parentElement) {
        const d = getComputedStyle(e).display;
        if (e instanceof SVGElement ? e.tagName === "text" : d !== "inline" && d !== "inline-block" && d !== "contents") return e;
      }
      return el;
    };
    const label = (el: Element, t: string) => `${el.tagName.toLowerCase()}.${(el.getAttribute("class") ?? "").split(" ")[0]}"${t.trim().slice(0, 24)}"`;
    // text line boxes
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = n.textContent ?? "";
      const el = n.parentElement!;
      if (!t.trim() || !visible(el) || el.closest(".tooltip")) continue;
      if (el.closest("svg")) {
        const r = el.getBoundingClientRect();
        if (r.width > 0.5 && clip(el, r)) boxes.push({ r, el, label: label(el, t) });
        continue;
      }
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) if (r.width > 0.5 && r.height > 0.5 && clip(el, r)) boxes.push({ r, el, label: label(el, t) });
    }
    // fixed chrome the scene must not run under
    const chrome = [...document.querySelectorAll(".nav-bar.is-fixed .nav-bar__track, .nav-bar.is-fixed .nav-bar__utils, .nav-pill.is-fixed .menu-pill, .corner-btn")].filter(visible);
    const inter = (a: DOMRect, b: DOMRect) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2;
    boxes.forEach((a, i) => {
      if (a.r.left < -0.5 || a.r.right > W + 0.5 || a.r.top < -0.5 || a.r.bottom > H + 0.5) out.push(`outside ${a.label} [${Math.round(a.r.left)},${Math.round(a.r.top)},${Math.round(a.r.right)},${Math.round(a.r.bottom)}]`);
      // lines of one paragraph may touch by their leading; different text blocks may not overlap
      for (const b of boxes.slice(i + 1)) if (a.el !== b.el && !a.el.contains(b.el) && !b.el.contains(a.el) && blockOf(a.el) !== blockOf(b.el) && inter(a.r, b.r)) out.push(`${a.label} x ${b.label}`);
      for (const c of chrome) if (inter(a.r, c.getBoundingClientRect())) out.push(`${a.label} under ${label(c, c.textContent ?? "")}`);
      // L7: 11px floor on screen
      const fs = parseFloat(getComputedStyle(a.el).fontSize);
      const scale = a.el instanceof SVGGraphicsElement ? a.el.getScreenCTM()?.a ?? 1 : 1;
      if (fs * scale < 10.95) out.push(`small ${a.label} ${(fs * scale).toFixed(1)}px`);
    });
    // text on the drawn figure
    if (figureScene) {
      const fig = (window as unknown as { __cso: { debug: () => { figure: { discs: number[][]; rects: number[][] } } } }).__cso.debug().figure;
      for (const a of boxes) {
        if (a.el.closest(onFigureOk as string)) continue;
        for (const [cx, cy, r] of fig.discs) {
          const dx = Math.max(a.r.left - cx!, 0, cx! - a.r.right), dy = Math.max(a.r.top - cy!, 0, cy! - a.r.bottom);
          if (dx * dx + dy * dy < (r! - 2) ** 2) out.push(`${a.label} on the sphere`);
        }
        for (const [x0, y0, x1, y1] of fig.rects) if (inter(a.r, new DOMRect(x0!, y0!, x1! - x0!, y1! - y0!))) out.push(`${a.label} on the core`);
      }
    }
    if (document.documentElement.scrollWidth > innerWidth + 0.5) out.push(`sideways scroll ${document.documentElement.scrollWidth} > ${innerWidth}`);
    const chips = [...root.querySelectorAll(".chip")].filter((c) => visible(c) && c.getBoundingClientRect().width > 0)
      .filter((c) => { const r = c.getBoundingClientRect(); return r.left >= -0.5 && r.right <= W + 0.5 && r.top >= -0.5 && r.bottom <= H + 0.5; })
      .map((c) => (c.textContent ?? "").replace(/\s+/g, " ").trim().split(" · ")[0]!);
    const cls = (window as unknown as { __cso: { classes: () => { js: string; css: string } } }).__cso.classes();
    return { hits: [...new Set(out)], chips, classes: cls };
  }, [scene, FIGURE_SCENES.has(scene), ON_FIGURE_OK] as const);
}

async function land(page: Page, scene: string, p: number | undefined) {
  await page.evaluate(([i, q]) => (window as unknown as { __cso: { jumpTo: (i: string, p?: number) => void } }).__cso.jumpTo(i as string, q as number | undefined), [scene, p] as const);
  await page.waitForTimeout(scene === "observatory" || scene === "regions" ? 1600 : 1100);
}
async function open(page: Page, w: number, h: number) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto("?quality=high");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => ((window as unknown as { __cso?: { debug: () => { glFrames: number } } }).__cso?.debug().glFrames ?? 0) > 1);
  await page.evaluate(() => document.fonts.ready);
}

/** Tag kinds each landing shows at 1440 (the reference composition). */
const reference = new Map<string, string[]>();

test.describe("layout: L1 L2 L3 L5 L7 L8", () => {
  test.describe.configure({ timeout: 300_000 });
  test.beforeEach(({ isMobile }) => { test.skip(!!isMobile, "viewports are set per test (desktop project)"); });

  /** Computed once per worker on its own page, at the reference width. */
  async function ensureReference(browser: Browser) {
    if (reference.size) return;
    const page = await browser.newPage();
    await open(page, 1440, 900);
    // the reference waits out the fade-ins (cards, notes) so it holds every tag the landing settles on
    for (const [s, p] of LANDINGS) { await land(page, s, p); await page.waitForTimeout(1200); reference.set(`${s}@${p}`, (await audit(page, s)).chips); }
    await page.close();
  }

  for (const [w, h] of VIEWPORTS) {
    test(`every landing at ${w}x${h}`, async ({ page, browser }) => {
      await ensureReference(browser);
      await open(page, w, h);
      const problems: string[] = [];
      for (const [s, p] of LANDINGS) {
        await land(page, s, p);
        const ref = reference.get(`${s}@${p}`) ?? [];
        const missing = (chips: string[]) => [...new Set(ref)].map((tag) => [tag, ref.filter((c) => c === tag).length, chips.filter((c) => c === tag).length] as const).filter(([, want, have]) => have < want);
        // tags fade in with their blocks: re-audit (up to 3 s) until the landing has settled, then judge the settled frame
        let r = await audit(page, s);
        for (let k = 0; k < 6 && missing(r.chips).length; k++) { await page.waitForTimeout(500); r = await audit(page, s); }
        problems.push(...r.hits.map((x) => `${s}@${p ?? "-"}: ${x}`));
        for (const [tag, want, have] of missing(r.chips)) problems.push(`${s}@${p ?? "-"}: tag ${tag} shown ${want}x at 1440, ${have}x here`);
        expect(r.classes.js).toBe(r.classes.css);
      }
      if (w < 1024) {
        const gap = await page.evaluate(() => {
          const a = document.querySelector(".nav-pill.is-fixed .menu-pill")!.getBoundingClientRect(), b = document.querySelector(".corner-btn")!.getBoundingClientRect();
          return b.left - a.right;
        });
        if (gap < 8) problems.push(`corner button ${gap.toFixed(1)}px from the pill (L8 needs 8)`);
      }
      expect(problems).toEqual([]);
    });
  }

  for (const [w, h] of [[768, 1024], [390, 844], [375, 812], [360, 800], [1440, 900]] as [number, number][]) {
    test(`reduced motion at ${w}x${h}: no sideways scroll in any scene (L5)`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
      const page = await ctx.newPage();
      await page.goto("", { waitUntil: "networkidle" });
      for (const [s] of LANDINGS) {
        await page.evaluate((id) => document.getElementById(id)!.scrollIntoView(), s);
        await page.waitForTimeout(150);
        const sw = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
        expect(sw[0], `${s} at ${w}`).toBeLessThanOrEqual(sw[1]!);
      }
      await ctx.close();
    });
  }
});

test.describe("layout with a classic 15px scrollbar (L1)", () => {
  test.describe.configure({ timeout: 240_000 });
  test.beforeEach(({ isMobile }) => { test.skip(!!isMobile, "desktop project only"); });
  let browser: Browser;
  test.beforeAll(async () => { browser = await chromium.launch({ ignoreDefaultArgs: ["--hide-scrollbars"] }); });
  test.afterAll(async () => { await browser.close(); });
  for (const [w, h] of [[1024, 768], [768, 1024]] as [number, number][]) {
    test(`${w}x${h} classic: the JS class equals the CSS class and every landing stays collision-free`, async ({ baseURL }) => {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      await page.addInitScript(() => addEventListener("DOMContentLoaded", () => {
        const s = document.createElement("style");
        s.textContent = "::-webkit-scrollbar { width: 15px; height: 15px; } ::-webkit-scrollbar-thumb { background: #555; }";
        document.head.appendChild(s);
      }));
      await page.goto(`${baseURL}?quality=high`);
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => ((window as unknown as { __cso?: { debug: () => { glFrames: number } } }).__cso?.debug().glFrames ?? 0) > 1);
      expect(await page.evaluate(() => innerWidth - document.documentElement.clientWidth)).toBeGreaterThan(10);
      const problems: string[] = [];
      for (const [s, p] of LANDINGS) {
        await land(page, s, p);
        const r = await audit(page, s);
        expect(r.classes.js, `${s}`).toBe(r.classes.css);
        problems.push(...r.hits.filter((x) => !x.startsWith("sideways")).map((x) => `${s}@${p ?? "-"}: ${x}`));
      }
      expect(problems).toEqual([]);
      await page.close();
    });
  }
});
