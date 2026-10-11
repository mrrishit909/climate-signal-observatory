import { expect, test, type Page } from "@playwright/test";

/**
 * P03-FIX-A1 (DESIGN_AUDIT cross-project review 1): every text node, chip and 20-year bar in S06 is
 * collision-free and inside the viewport at D/T/M; S05's mobile controls panel never overprints itself.
 */
type Hit = string[];
async function collisions(page: Page, root: string, sel: string): Promise<Hit> {
  return page.evaluate(([root, sel]) => {
    const vis = (el: Element) => {
      for (let e: Element | null = el; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0 || e.classList.contains("sr-only")) return false;
      }
      const r = el.getBoundingClientRect();
      return r.width > 0.5 && r.height > 0.5;
    };
    // the scene's own text plus the fixed chrome it must not run under (nav bar, menu pill, corner button)
    const els = [...document.querySelector(root)!.querySelectorAll(sel), ...document.querySelectorAll(".nav-bar.is-fixed .nav-bar__track, .nav-bar.is-fixed .nav-bar__utils, .nav-pill.is-fixed .menu-pill, .corner-btn")].filter(vis);
    const name = (e: Element) => `${e.tagName.toLowerCase()}.${(e.getAttribute("class") ?? "").split(" ")[0]}"${(e.textContent ?? "").trim().slice(0, 28)}"`;
    const out: string[] = [];
    els.forEach((a, i) => {
      const r = a.getBoundingClientRect();
      if (r.left < -0.5 || r.right > innerWidth + 0.5) out.push(`overflow ${name(a)} [${Math.round(r.left)}, ${Math.round(r.right)}]`);
      for (const b of els.slice(i + 1)) {
        if (a.contains(b) || b.contains(a)) continue;
        const q = b.getBoundingClientRect();
        const w = Math.min(r.right, q.right) - Math.max(r.left, q.left), h = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top);
        if (w > 1 && h > 1) out.push(`${name(a)} x ${name(b)}`);
      }
    });
    if (document.documentElement.scrollWidth > innerWidth + 0.5) out.push(`page scrolls horizontally: ${document.documentElement.scrollWidth}`);
    return out;
  }, [root, sel] as const);
}
const jump = (page: Page, id: string, p: number) => page.evaluate(([i, q]) => (window as unknown as { __cso: { jumpTo: (i: string, p: number) => void } }).__cso.jumpTo(i as string, q as number), [id, p] as const);

test.describe("P03-FIX-A1 layout collisions", () => {
  test.beforeEach(({ isMobile }) => { test.skip(!!isMobile, "viewports are set per test (desktop project)"); });
  for (const [w, h] of [[1440, 900], [768, 1024], [390, 844], [375, 812], [360, 800]] as const) {
    test(`S06 at ${w}x${h}: no text, chip or bar overlaps another, nothing leaves the viewport, the core has left`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto("?quality=high");
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => (window as unknown as { __cso?: { debug: () => { glFrames: number } } }).__cso?.debug().glFrames ?? 0 > 1);
      for (const p of [0.42, 0.9]) {
        await jump(page, "futures", p);
        await page.waitForTimeout(1200);
        expect(await collisions(page, ".scene-futures", "text, .chip, .chip-btn, p, h2, .fut-mean")).toEqual([]);
      }
      expect(await page.evaluate(() => (window as unknown as { __cso: { debug: () => { coreAlpha: number } } }).__cso.debug().coreAlpha)).toBe(0);
    });
  }
  for (const [w, h] of [[390, 844], [375, 812], [360, 800]] as const) {
    test(`S05 at ${w}x${h}: MORE CONTROLS and the controls never overprint each other or the edge`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto("?quality=high");
      await page.keyboard.press("Escape");
      await jump(page, "zero", 0.3);
      await page.waitForTimeout(1000);
      expect(await collisions(page, ".zero-controls", "button, .tnum, .zero-to, .seg-ctl__label")).toEqual([]);
      await page.getByRole("button", { name: "MORE CONTROLS" }).click();
      await page.waitForTimeout(300);
      expect(await collisions(page, ".zero-controls", "button, .tnum, .zero-to, .seg-ctl__label")).toEqual([]);
    });
  }
});
