import { expect, test } from "@playwright/test";

/**
 * L4 / D-001: every artifact, in every scene that consumes it, fails visibly: an in-viewport alert inside that
 * scene names the file, its RETRY re-requests exactly once, and the alert clears.
 */
const CASES: [string, number | undefined, string[]][] = [
  ["signal", 0.78, ["facts.json", "coastlines.json", "grid_gistemp_2deg_intro.i8.bin.gz"]],
  ["record", 0.14, ["facts.json", "meta.json", "ar6.json", "grid_gistemp_2deg.meta.json", "grid_hadcrut5_5deg.meta.json"]],
  ["years", 0.5, ["series_annual.json", "co2.json", "extremes.json", "coastlines.json", "grid_gistemp_2deg.i8.bin.gz"]],
  ["regions", 0.1, ["facts.json", "trends.json", "regional.json", "coastlines.json", "grid_trends_gistemp_2deg.i8.bin.gz"]],
  ["strata", 0.89, ["facts.json", "validation.json", "series_annual.json", "coastlines.json", "grid_gistemp_2deg.i8.bin.gz"]],
  ["zero", 0.3, ["series_annual.json", "trends.json", "changepoints.json"]],
  ["futures", 0.42, ["series_annual.json", "facts.json", "ar6.json"]],
  ["evidence", 0.95, ["facts.json", "meta.json", "validation.json", "agreement.json", "trends.json", "co2.json", "grid_gistemp_2deg.meta.json"]],
  ["observatory", undefined, ["grid_gistemp_2deg.i8.bin.gz", "grid_trends_gistemp_2deg.i8.bin.gz", "regional.json", "coastlines.json"]],
  ["surface", 0.95, ["facts.json", "meta.json"]],
];
const stem = (f: string) => f.replace(/\.i8\.bin\.gz$|\.json$/, "").toUpperCase();

test.describe.configure({ timeout: 60_000 });
for (const [scene, p, files] of CASES) for (const file of files) {
  test(`${scene}: ${file} fails visibly in the scene and RETRY recovers with one re-request`, async ({ page }) => {
    let block = true, hits = 0;
    await page.route(`**/data/${file}`, (r) => { hits++; return block ? r.fulfill({ status: 404, body: "" }) : r.continue(); });
    await page.goto("?quality=high");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !!(window as unknown as { __cso?: unknown }).__cso);
    await page.evaluate(([i, q]) => (window as unknown as { __cso: { jumpTo: (i: string, p?: number) => void } }).__cso.jumpTo(i as string, q as number | undefined), [scene, p] as const);
    const alert = page.locator(`#${scene} [role=alert]`).filter({ hasText: stem(file) }).first();
    await expect(alert).toBeVisible({ timeout: 20000 });
    await expect(alert).toBeInViewport();
    const before = hits;
    block = false;
    // L12 / D-020: the RETRY is the top element at its centre, and a real pointer click there (not locator.click) retries
    const btn = alert.getByRole("button", { name: "RETRY" });
    await expect(btn).toBeInViewport();
    const hit = await btn.evaluate((b) => {
      const r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, t = document.elementFromPoint(x, y);
      const h1 = document.getElementById("hero-title"), a = b.closest("[role=alert]")!.getBoundingClientRect(), hr = h1?.getBoundingClientRect();
      const onHero = !!hr && hr.width > 0 && getComputedStyle(h1!).visibility !== "hidden" && Number(getComputedStyle(h1!).opacity) > 0.05
        && Math.min(a.right, hr.right) > Math.max(a.left, hr.left) && Math.min(a.bottom, hr.bottom) > Math.max(a.top, hr.top);
      return { x, y, top: !!t && b.contains(t), onHero };
    });
    expect(hit.top, "elementFromPoint at the RETRY centre is the button").toBe(true);
    expect(hit.onHero, "the alert does not overlap the visible hero headline").toBe(false);
    await page.mouse.click(hit.x, hit.y);
    // the alert first gives way to RETRYING, so wait for the re-request to land, then for the scene to settle
    await expect.poll(() => hits - before, { timeout: 20000 }).toBeGreaterThanOrEqual(1);
    await expect(page.locator(`#${scene}`).getByText(`RETRYING ${stem(file)}`)).toHaveCount(0, { timeout: 20000 });
    await page.waitForTimeout(500);
    await expect(page.locator(`#${scene} [role=alert]`).filter({ hasText: stem(file) })).toHaveCount(0);
    expect(hits - before, `requests: ${hits} total, ${before} before RETRY`).toBe(1);
  });
}
