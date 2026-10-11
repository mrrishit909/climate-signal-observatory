import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { signed } from "../src/model/format";

const facts = JSON.parse(readFileSync(new URL("../public/data/facts.json", import.meta.url), "utf-8")).facts;
const introMeta = JSON.parse(readFileSync(new URL("../public/data/grid_gistemp_2deg_intro.meta.json", import.meta.url), "utf-8"));
const LATEST: number = facts.latest_complete_year.value;
type Cso = {
  jumpTo: (id: string, p?: number) => void;
  introT: () => number;
  introStats: () => { minR: number; monotonic: boolean; years: number[]; playing: boolean; G0: number };
  debug: () => { radius: number; glFrames: number; scene: string };
  quality: () => { tier: string };
};
const hook = (page: Page) => ({
  jump: (id: string, p: number) => page.evaluate(([i, q]) => (window as unknown as { __cso: Cso }).__cso.jumpTo(i as string, q as number), [id, p] as const),
  get: <T,>(expr: string) => page.evaluate(`window.__cso.${expr}`) as Promise<T>,
});

test("WebGL2 is live in this browser (the GL tests cannot pass vacuously on the fallback)", async ({ page }) => {
  await page.goto("?quality=high");
  await page.waitForFunction(() => document.documentElement.dataset.tier === "high");
  await page.waitForFunction(() => (window as unknown as { __cso: Cso }).__cso.debug().glFrames > 2);
});

test("S00: SKIP is visible at once and the nav arrives within 400ms of the click (measured in-page)", async ({ page, isMobile }) => {
  // instrument before any script runs, so the measurement is in-page and the click can happen at once
  await page.addInitScript((sel) => {
    const w = window as unknown as { __clickT: number; __navT: number };
    w.__clickT = 0; w.__navT = 0;
    addEventListener("click", (e) => { if ((e.target as Element).closest?.(".corner-btn")) w.__clickT = performance.now(); }, true);
    const poll = () => {
      const nav = document.querySelector(sel);
      if (w.__clickT && nav && !nav.classList.contains("is-hidden")) w.__navT = performance.now();
      else requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);
  }, isMobile ? ".nav-pill.is-fixed" : ".nav-bar.is-fixed");
  await page.goto("?quality=high", { waitUntil: "commit" });
  const skip = page.getByRole("button", { name: "SKIP INTRO" });
  await skip.click({ timeout: 15000 }); // the main thread may be busy compiling shaders on software GL; the timing is measured in-page
  await page.waitForFunction(() => (window as unknown as { __navT: number }).__navT > 0, null, { timeout: 3000 });
  const dt = await page.evaluate(() => { const w = window as unknown as { __clickT: number; __navT: number }; return w.__navT - w.__clickT; });
  expect(dt).toBeLessThan(400);
});

test("S00 (test 15): the orb/planet radius is at least 120vh across and never decreases through the intro", async ({ page }) => {
  await page.goto("?quality=high");
  const h = hook(page);
  for (const at of [1000, 2500]) {
    await page.waitForFunction((t) => (window as unknown as { __cso: Cso }).__cso.introT() >= t, at, { timeout: 15000 });
    const d = await h.get<{ radius: number }>("debug()");
    const vh = await page.evaluate(() => innerHeight);
    const G0 = (await h.get<{ G0: number }>("introStats()")).G0;
    expect(d.radius, `radius at ${at}ms`).toBeGreaterThanOrEqual(G0 - 0.01);
    expect(2 * d.radius, `diameter at ${at}ms vs 120vh`).toBeGreaterThanOrEqual(1.2 * vh);
  }
  await page.waitForFunction(() => !(window as unknown as { __cso: Cso }).__cso.introStats().playing, null, { timeout: 15000 });
  const s = await h.get<{ minR: number; monotonic: boolean; G0: number }>("introStats()");
  expect(s.monotonic).toBe(true);
  expect(s.minR).toBeGreaterThanOrEqual(s.G0 - 0.01);
});

test("S00 decade run: the counter only shows DR-1 layer years and lands on the latest complete year", async ({ page }) => {
  await page.goto("?quality=high");
  await page.waitForFunction(() => !(window as unknown as { __cso: Cso }).__cso.introStats().playing, null, { timeout: 15000 });
  const s = await hook(page).get<{ years: number[] }>("introStats()");
  for (const y of s.years) expect(introMeta.years.list).toContain(y);
  expect(s.years.at(-1)).toBe(LATEST);
  await expect(page.locator("[data-intro-year]")).toHaveText(String(LATEST));
  // once per session: a same-session reload starts at the end state
  await page.reload();
  await expect(page.getByRole("button", { name: "REPLAY INTRO" }).first()).toBeAttached();
  expect(await hook(page).get<boolean>("introStats().playing")).toBe(false);
});

test("S03a baseline toggle re-levels the readout to the facts' values (GISTEMP latest year)", async ({ page }) => {
  test.setTimeout(90_000); // loads the HadCRUT5 grid on a shared, software-GL machine
  await page.goto("?quality=high");
  await page.keyboard.press("Escape");
  await hook(page).jump("years", 0.96);
  const global = page.locator("[data-global]");
  await expect(page.locator("[data-year]")).toHaveText(String(LATEST));
  await expect(global).toHaveText(`GLOBAL ${signed(facts.gistemp_latest_year_anomaly_1951_1980.value)} °C VS 1951-1980`);
  await expect(page.locator(".years-readout > .chip")).toContainText("OBSERVED");
  const base = page.locator(".scene-years").getByRole("radiogroup", { name: "BASELINE" });
  await base.getByRole("radio", { name: "1991-2020" }).click();
  await expect(global).toHaveText(`GLOBAL ${signed(facts.gistemp_latest_year_anomaly_1991_2020.value)} °C VS 1991-2020`);
  await expect(page.locator(".years-readout > .chip")).toContainText("DERIVED");
  // 1850-1900 is disabled under GISTEMP, enabled under HadCRUT5; going back snaps and announces
  const b1850 = base.getByRole("radio", { name: /1850-1900/ });
  await expect(b1850).toHaveAttribute("aria-disabled", "true");
  await page.locator(".scene-years").getByRole("radiogroup", { name: "SOURCE" }).getByRole("radio", { name: /HADCRUT5/ }).click();
  await expect(b1850).not.toHaveAttribute("aria-disabled", "true");
  await b1850.click();
  await expect(global).toContainText("VS 1850-1900");
  await page.locator(".scene-years").getByRole("radiogroup", { name: "SOURCE" }).getByRole("radio", { name: /GISTEMP/ }).click();
  await expect(base.getByRole("radio", { name: "1951-1980" })).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".years-controls [aria-live]")).toHaveText("BASELINE SET TO 1951-1980: GISTEMP HAS NO 1850-1900");
  // RESET restores the defaults
  await base.getByRole("radio", { name: "1991-2020" }).click();
  await page.locator(".years-controls").getByRole("button", { name: "RESET" }).click();
  await expect(base.getByRole("radio", { name: "1951-1980" })).toHaveAttribute("aria-checked", "true");
});

test("S03a grid error state: RETRY re-runs the same fetch", async ({ page }) => {
  let block = true, hits = 0;
  await page.route("**/grid_gistemp_2deg.i8.bin.gz", (r) => { hits++; return block ? r.fulfill({ status: 404, body: "" }) : r.continue(); });
  await page.goto("?quality=high");
  await page.keyboard.press("Escape");
  await hook(page).jump("years", 0.5);
  const err = page.locator(".years-readout [role=alert]");
  await expect(err).toContainText("COULD NOT LOAD GRID_GISTEMP_2DEG (HTTP 404)", { timeout: 15000 });
  block = false;
  await err.getByRole("button", { name: "RETRY" }).click();
  await expect.poll(() => hits, { timeout: 15000 }).toBe(2);
  await expect(err).toHaveCount(0, { timeout: 15000 });
  await expect(page.locator(".years-readout .state-line--loading")).toHaveCount(0, { timeout: 15000 });
});

test("S04 lands the core: coverage readout and layer labels are bound to the facts", async ({ page }) => {
  await page.goto("?quality=high");
  await page.keyboard.press("Escape");
  await hook(page).jump("strata", 0.96);
  const pct = (v: number) => String(Math.round(v * 100));
  await expect(page.locator("[data-coverage]")).toHaveText(
    `MEASURED AREA ${pct(facts.gistemp_valid_area_share_first_year.value)}% IN 1880 → ${pct(facts.gistemp_valid_area_share_latest_year.value)}% IN ${LATEST}`, { timeout: 15000 });
  await expect(page.locator("#strata-title")).toHaveText("The ten warmest layers all came after 2010.");
  await expect(page.locator(".core-labels.is-in")).toBeVisible();
});

test("no-WebGL tier: the orb stays an orb with the note, S03a draws a flat map", async ({ page }) => {
  await page.goto("?quality=nogl");
  await page.keyboard.press("Escape");
  await expect(page.locator("html")).toHaveAttribute("data-tier", "nogl");
  await expect(page.getByText("3D GLOBE UNAVAILABLE: FLAT MAPS USED")).toBeVisible();
  await hook(page).jump("years", 0.9);
  await page.waitForTimeout(1500);
  const lit = await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>(".planet-2d")!;
    const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4 * 97) if (d[i]! + d[i + 1]! + d[i + 2]! > 60) n++;
    return n;
  });
  expect(lit).toBeGreaterThan(500);
});

test("LOW tier: no decade run (one crossfade 1880 -> latest) and integer-year hard steps in S03a", async ({ page }) => {
  await page.goto("?quality=low");
  await page.waitForFunction(() => !(window as unknown as { __cso: Cso }).__cso.introStats().playing, null, { timeout: 15000 });
  const s = await hook(page).get<{ years: number[] }>("introStats()");
  expect(s.years.every((y) => y === 1880 || y === LATEST)).toBe(true);
  expect(s.years.at(-1)).toBe(LATEST);
  expect(await hook(page).get<{ tier: string }>("quality()")).toMatchObject({ tier: "low" });
  await hook(page).jump("years", 0.4);
  await page.waitForTimeout(100);
  await hook(page).jump("years", 0.45);
  for (let i = 0; i < 5; i++) {
    const mix = await page.evaluate(() => (window as unknown as { __cso: { yearMix: () => number } }).__cso.yearMix());
    expect([0, 1]).toContain(mix);
    await page.waitForTimeout(40);
  }
});
