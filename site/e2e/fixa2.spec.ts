import { expect, test, type Page } from "@playwright/test";

/** P03-FIXA-002 verification tests for D-005, D-006, D-007 (L9) and the minors D-012, D-013, D-015, D-016, D-018, D-019. */
type Hook = {
  jumpTo: (i: string, p?: number) => void;
  setObs: (o: Record<string, unknown>) => void;
  debug: () => { glFrames: number; figure: { discs: number[][]; rects: number[][] } };
};
const hook = (page: Page) => page.evaluate(() => !!(window as unknown as { __cso?: Hook }).__cso);
async function open(page: Page, w: number, h: number) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto("?quality=high");
  await page.keyboard.press("Escape");
  await expect.poll(() => hook(page)).toBe(true);
  await page.waitForFunction(() => ((window as unknown as { __cso: Hook }).__cso.debug().glFrames ?? 0) > 1);
}
async function land(page: Page, id: string, p?: number, wait = 1200) {
  await page.evaluate(([i, q]) => (window as unknown as { __cso: Hook }).__cso.jumpTo(i as string, q as number | undefined), [id, p] as const);
  await page.waitForTimeout(wait);
}
const overlap = (a: DOMRect | null, b: DOMRect | null) => !!a && !!b && Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;

test.describe("FIX-A2 verification", () => {
  test.describe.configure({ timeout: 120_000 });
  test.beforeEach(({ isMobile }) => { test.skip(!!isMobile, "viewports are set per test (desktop project)"); });

  test("D-005: the inspector draws the whole series (no dash shorter than the path; ends at the last valid year)", async ({ page }) => {
    for (const [w, h] of [[1440, 900], [390, 844]] as const) {
      await open(page, w, h);
      await land(page, "observatory", undefined, 1600);
      await page.evaluate(() => (window as unknown as { __cso: Hook }).__cso.setObs({ cell: { row: 37, col: 72 } }));
      const path = page.locator(".inspector__line");
      await expect(path).toBeVisible();
      await page.waitForTimeout(1200); // past the 600ms draw
      const r = await path.evaluate((el: SVGPathElement) => {
        const len = el.getTotalLength(), end = el.getPointAtLength(len), cs = getComputedStyle(el);
        const dash = cs.strokeDasharray === "none" ? Infinity : Math.min(...cs.strokeDasharray.split(/[ ,]+/).map(parseFloat));
        return { len, dash, offset: parseFloat(cs.strokeDashoffset) || 0, endX: end.x, lastX: Number(el.dataset.lastX), measured: Number(el.dataset.length), stroke: el.isPointInStroke(end) };
      });
      expect(r.dash, `dasharray vs length ${r.len} at ${w}`).toBeGreaterThanOrEqual(r.len);
      expect(r.offset).toBe(0);
      expect(Math.abs(r.endX - r.lastX), `${w}`).toBeLessThan(1);
      expect(r.measured).toBeCloseTo(r.len, 3);
      expect(r.stroke).toBe(true);
    }
  });

  for (const [w, h] of [[390, 844], [375, 812], [360, 800]] as const) {
    test(`D-006 at ${w}x${h}: the S01 cards are clear of the caption, readable, and the statement clears the globe`, async ({ page }) => {
      await open(page, w, h);
      await land(page, "signal", 0.78, 3000); // past the cards' typing
      const r = await page.evaluate(() => {
        const vis = (el: Element | null) => !!el && getComputedStyle(el).visibility !== "hidden" && Number(getComputedStyle(el).opacity) > 0.05 && el.getBoundingClientRect().width > 0;
        const notes = [...document.querySelectorAll(".s01-cards .note")];
        const caption = document.querySelector(".signal-foot .signal-note");
        const lum = (c: string) => {
          const [r, g, b] = (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
          return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
        };
        const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05); };
        const opacity = (el: Element) => { let o = 1; for (let e: Element | null = el; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity); return o; };
        return {
          n: notes.length,
          captionHits: vis(caption) ? notes.filter((n) => { const a = n.getBoundingClientRect(), b = caption!.getBoundingClientRect(); return Math.min(a.right, b.right) > Math.max(a.left, b.left) && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top); }).length : 0,
          notes: notes.map((n) => {
            const body = n.querySelector(".note__body")!;
            return { contrast: contrast(getComputedStyle(body).color, getComputedStyle(n).backgroundColor), opacity: opacity(body) };
          }),
          statementBottom: document.querySelector(".s01-statement")!.getBoundingClientRect().bottom,
          disc: (window as unknown as { __cso: Hook }).__cso.debug().figure.discs[0] ?? null,
        };
      });
      expect(r.n).toBe(2);
      expect(r.captionHits).toBe(0);
      for (const n of r.notes) { expect(n.contrast).toBeGreaterThanOrEqual(4.5); expect(n.opacity).toBeGreaterThan(0.99); }
      // composited contrast from the screenshot: nothing (scrim, caption) dims the text, whatever the stacking says
      for (const body of await page.locator(".s01-cards .note .note__body").all()) {
        const png = (await page.screenshot({ clip: (await body.boundingBox())! })).toString("base64");
        const seen = await page.evaluate(async (b64) => {
          const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
          const cv = new OffscreenCanvas(bmp.width, bmp.height), x = cv.getContext("2d")!;
          x.drawImage(bmp, 0, 0);
          const d = x.getImageData(0, 0, bmp.width, bmp.height).data, count = new Map<number, number>();
          for (let i = 0; i < d.length; i += 4) { const k = ((d[i]! >> 3) << 10) | ((d[i + 1]! >> 3) << 5) | (d[i + 2]! >> 3); count.set(k, (count.get(k) ?? 0) + 1); }
          const bgKey = [...count.entries()].sort((a, b) => b[1] - a[1])[0]![0];
          const lin = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
          const L = (r: number, g: number, b: number) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
          const bg = L(((bgKey >> 10) & 31) * 8 + 4, ((bgKey >> 5) & 31) * 8 + 4, (bgKey & 31) * 8 + 4);
          let best = 1;
          for (let i = 0; i < d.length; i += 4) { const l = L(d[i]!, d[i + 1]!, d[i + 2]!); best = Math.max(best, (Math.max(l, bg) + 0.05) / (Math.min(l, bg) + 0.05)); }
          return best;
        }, png);
        expect(seen, "text vs card background in the rendered pixels").toBeGreaterThanOrEqual(4.5);
      }
      expect(r.disc).not.toBeNull();
      expect(r.statementBottom).toBeLessThanOrEqual(r.disc![1]! - r.disc![2]!);
    });
  }

  for (const [w, h] of [[1440, 900], [1024, 768], [390, 844]] as const) {
    test(`D-007 / L9 at ${w}x${h}: the OBS grid RETRY is the top element at its centre and a plain click re-fetches`, async ({ page }) => {
      let block = true, hits = 0;
      await page.route("**/data/grid_gistemp_2deg.i8.bin.gz", (r) => { hits++; return block ? r.fulfill({ status: 404, body: "" }) : r.continue(); });
      await page.setViewportSize({ width: w, height: h });
      await page.goto("?quality=high");
      await page.keyboard.press("Escape");
      await expect.poll(() => hook(page)).toBe(true);
      await land(page, "observatory", undefined, 1600);
      const btn = page.locator("#observatory [role=alert]").filter({ hasText: "GRID_GISTEMP_2DEG" }).first().getByRole("button", { name: "RETRY" });
      await expect(btn).toBeInViewport();
      expect(await btn.evaluate((b) => { const r = b.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!t && b.contains(t); })).toBe(true);
      const before = hits;
      block = false;
      await btn.click();
      await expect.poll(() => hits - before, { timeout: 20000 }).toBe(1);
    });
  }

  test("D-012: S08 shows a tag on the cells at p0.3 and p0.6", async ({ page }) => {
    await open(page, 1440, 900);
    for (const p of [0.3, 0.6]) {
      await land(page, "surface", p);
      await expect(page.locator("#surface .chip").filter({ hasText: "OBSERVED" }).first()).toBeInViewport();
    }
  });

  test("D-013: the first Tab after load lands in the chapter nav or SKIP INTRO, not in an off-screen scene", async ({ page }) => {
    await page.goto("?quality=high");
    await expect.poll(() => hook(page)).toBe(true);
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest(".nav-bar, .nav-pill, .corner-btn"))).toBe(true);
  });

  test("D-015: with reduced motion on a phone, after the S08 landing the menu pill takes a plain click and jumps", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", hasTouch: true });
    const page = await ctx.newPage();
    await page.goto("", { waitUntil: "networkidle" });
    await page.evaluate(() => document.getElementById("surface")!.scrollIntoView());
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.locator(".nav-pill.is-fixed .menu-pill").click();
    await page.locator("#menu-panel .nav__item", { hasText: "YEARS" }).click();
    await expect(page.locator("#years")).toBeInViewport();
    await ctx.close();
  });

  test("D-016: the region step dots are 24px targets", async ({ page }) => {
    for (const [w, h] of [[1440, 900], [390, 844]] as const) {
      await open(page, w, h);
      await land(page, "regions", 0.1);
      for (const b of await page.locator(".step-dot").all()) {
        const r = (await b.boundingBox())!;
        expect(r.width).toBeGreaterThanOrEqual(24); expect(r.height).toBeGreaterThanOrEqual(24);
      }
    }
  });

  test("D-018: at 768x1024 the S01 headline is not clipped at the top", async ({ page }) => {
    await open(page, 768, 1024);
    await land(page, "signal", 0.78, 1500);
    expect((await page.locator("h1[data-hero]").boundingBox())!.y).toBeGreaterThanOrEqual(0);
  });

  test("D-019: at 1440 and 1024 the inspector leaves PLAY and the docked core uncovered", async ({ page }) => {
    for (const [w, h] of [[1440, 900], [1024, 768]] as const) {
      await open(page, w, h);
      await land(page, "observatory", undefined, 1600);
      await page.evaluate(() => (window as unknown as { __cso: Hook }).__cso.setObs({ cell: { row: 37, col: 72 } }));
      await expect(page.locator(".inspector")).toBeVisible();
      await page.waitForTimeout(800);
      const [ins, play, core] = await Promise.all([".inspector", ".obs-play", ".obs-core"].map((s) => page.locator(s).evaluate((e) => e.getBoundingClientRect().toJSON() as DOMRect)));
      expect(overlap(ins!, play!), `${w}`).toBe(false);
      expect(overlap(ins!, core!), `${w}`).toBe(false);
    }
  });
});
