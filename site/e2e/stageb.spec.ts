import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fixed, signed } from "../src/model/format";

const json = (f: string) => JSON.parse(readFileSync(new URL(`../public/data/${f}`, import.meta.url), "utf-8"));
const facts = json("facts.json").facts;
const trends = json("trends.json");
const ar6 = json("ar6.json");
const LATEST: number = facts.latest_complete_year.value;

async function open(page: Page) {
  await page.goto("?quality=high");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => ((window as unknown as { __cso?: { debug: () => { glFrames: number } } }).__cso?.debug().glFrames ?? 0) > 1, null, { timeout: 20000 });
}
const jump = (page: Page, id: string, p?: number) => page.evaluate(([i, q]) => (window as unknown as { __cso: { jumpTo: (i: string, p?: number) => void } }).__cso.jumpTo(i as string, q as number | undefined), [id, p] as const);

test.describe.configure({ timeout: 90_000 });

test("S01: the two notification cards are bound to the facts", async ({ page }) => {
  await open(page);
  await jump(page, "signal", 0.78);
  await expect(page.locator(".s01-cards")).toContainText(`THE PLANET AVERAGED ${signed(facts.gistemp_latest_year_anomaly_1951_1980.value)} °C ABOVE ITS 1951-1980 NORMAL.`, { timeout: 10000 });
  await expect(page.locator(".s01-cards")).toContainText(`${fixed(facts.co2_mlo_latest_ppm.value, 2)} PPM OF CO2`);
});

test("S02: four provenance cards, a coverage strip with one bar per GISTEMP year, and the AR6 page reference", async ({ page }) => {
  await open(page);
  await jump(page, "record", 0.8);
  await expect(page.locator(".scene-record .story-card")).toHaveCount(4);
  await expect(page.locator(".scene-record .coverage-strip rect")).toHaveCount(146);
  await expect(page.locator(".record-sources")).toContainText(`PRINTED PAGE ${ar6.source.page_printed}`);
});

test("S03b: state 3 at p 0.6 forward and backward; ledger clicks turn the globe; period chips change the trends", async ({ page }) => {
  await open(page);
  await jump(page, "regions", 0.3);
  await jump(page, "regions", 0.6);
  await expect(page.locator(".regions-title")).toHaveText("The least-watched south");
  await jump(page, "regions", 0.95);
  await jump(page, "regions", 0.6);
  await expect(page.locator(".regions-title")).toHaveText("The least-watched south");
  const arctic = trends.series.find((s: { series_id: string }) => s.series_id === "gistemp_band_arctic").fits.find((f: { period: string }) => f.period === "1975_latest");
  const ledger = page.locator(".ledger");
  await expect(ledger).toContainText(`${signed(arctic.slope_per_decade)} °C / DECADE (${fixed(arctic.ci_ar1[0], 2)} TO ${fixed(arctic.ci_ar1[1], 2)})`);
  await page.getByRole("radio", { name: "SINCE 1880" }).click();
  const a1880 = trends.series.find((s: { series_id: string }) => s.series_id === "gistemp_band_arctic").fits.find((f: { period: string }) => f.period === "1880_latest");
  await expect(ledger).toContainText(`${signed(a1880.slope_per_decade)} °C / DECADE`);
  // keyboard on the globe group (works on every viewport; M shows only the active ledger row)
  await page.locator(".scene-regions .globe-hit").focus();
  await page.keyboard.press("ArrowUp");
  await expect(page.locator(".scene-regions").getByRole("button", { name: "RESET VIEW" })).toBeVisible();
  await expect(page.locator(".ledger li").nth(3)).toHaveClass(/is-active/);
  // the band naming rule: never the polar circle
  expect(await page.locator(".scene-regions").textContent()).not.toMatch(new RegExp(["arctic", "circle"].join(" "), "i"));
});

test("S03a: +2 C cells toggle adds the area share line and RESET clears it", async ({ page }) => {
  await open(page);
  await jump(page, "years", 0.96);
  await page.getByRole("button", { name: "+2 °C CELLS" }).click();
  await expect(page.locator("[data-plus2]")).toContainText("% OF MEASURED AREA AT +2 °C OR MORE", { timeout: 15000 });
  await page.locator(".years-controls").getByRole("button", { name: "RESET" }).click();
  await expect(page.locator("[data-plus2]")).toHaveCount(0);
});

test("S04: hovering a stratum names its year and global value; a click sets the shared year", async ({ page, isMobile }) => {
  test.skip(!!isMobile, "hover is a pointer affordance");
  await open(page);
  await jump(page, "strata", 0.96);
  const hit = page.locator(".core-hit");
  await expect(hit).toBeVisible({ timeout: 15000 });
  const box = (await hit.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 2);
  await expect(page.locator(".tooltip.is-visible")).toContainText(`${LATEST} · GLOBAL ${signed(facts.gistemp_latest_year_anomaly_1951_1980.value)} °C`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const y = await page.evaluate(() => (window as unknown as { __cso: { obs: () => { year: number } } }).__cso.obs().year);
  expect(y).toBeGreaterThan(1920);
  expect(y).toBeLessThan(1960);
});

test("S05: the client trend matches trends.json; changing only the baseline leaves the slope and shows the check; RESET restores", async ({ page }) => {
  await open(page);
  await jump(page, "zero", 0.3);
  const fit = trends.series.find((s: { series_id: string }) => s.series_id === "gistemp_glb").fits.find((f: { period: string }) => f.period === "1975_latest");
  const result = page.locator("[data-result]");
  const want = `TREND 1975-${LATEST}: ${signed(fit.slope_per_decade)} °C PER DECADE · 95% CI ${fixed(fit.ci_ar1[0], 2)} TO ${fixed(fit.ci_ar1[1], 2)} (AR(1)-ADJUSTED)`;
  await expect(result).toHaveText(want, { timeout: 15000 });
  await page.locator(".zero-controls").getByRole("radio", { name: "1991-2020" }).click();
  await expect(result).toHaveText(want);
  await expect(page.locator("[data-invariance]")).toContainText("✓");
  await expect(page.locator(".zero-plot")).toContainText("= 1991-2020 MEAN");
  await page.locator(".zero-controls").getByRole("radio", { name: "1850-1900" }).click({ force: true }); // aria-disabled: the offer appears, the baseline does not change
  await expect(page.getByRole("button", { name: "SWITCH TO HADCRUT5" })).toBeVisible();
  await page.getByRole("slider", { name: "Trend window from" }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(result).toContainText(`TREND 1974-${LATEST}`);
  if (await page.getByRole("button", { name: "MORE CONTROLS" }).isVisible()) await page.getByRole("button", { name: "MORE CONTROLS" }).click();
  await page.locator(".zero-controls").getByRole("button", { name: "RESET" }).click();
  await expect(result).toHaveText(want);
});

test("S06: every bracket is the AR6 table value, the PREDICTED chip is shown, and no line joins record and futures", async ({ page }) => {
  await open(page);
  await jump(page, "futures", 0.9);
  await expect(page.locator(".fut-br")).toHaveCount(15);
  const rows = await page.locator(".scene-futures table tbody tr").allTextContents();
  for (const s of ar6.scenarios) for (const r of s.rows) expect(rows).toContain(`${s.id}${r.period}${r.best_estimate_c}${r.very_likely_low_c} to ${r.very_likely_high_c}`);
  await expect(page.locator(".scene-futures .chip--predicted")).toContainText("NOT OUR PROJECTION");
  expect(await page.locator(".fut-plot polyline").count()).toBe(0);
  expect(await page.locator(".fut-windows rect[data-obs], .fut-observed .fut-bracket").count()).toBe(0);
  const callout = facts.hadcrut5_latest_year_anomaly_1850_1900.value >= 1.5 && ar6.observed_derived.hadcrut5_rebased_1850_1900.mean_2005_2024 < 1.5;
  await expect(page.locator(".fut-callout")).toHaveCount(callout ? 1 : 0);
  await page.getByRole("radio", { name: /SSP5-8.5/ }).click();
  await expect(page.locator(".fut-br.is-sel")).toHaveCount(3);
});

test("S07: seven exchanges with receipts; SIMULATED appears once on the whole page", async ({ page }) => {
  await open(page);
  await jump(page, "evidence", 0.95);
  await expect(page.locator(".ev-ex")).toHaveCount(7);
  await expect(page.locator(".receipt a")).toHaveAttribute("href", /trends\.json$/);
  expect(await page.locator(".chip--simulated").count()).toBe(1);
  await expect(page.locator(".scene-evidence")).toContainText("ASSOCIATION, NOT ATTRIBUTION");
});

test("S08: the surface fills the frame (no limb) and the caption is the facts, once, even after re-crossing", async ({ page }) => {
  await open(page);
  await jump(page, "surface", 0.6);
  await page.waitForTimeout(400);
  const d = await page.evaluate(() => ({ r: (window as unknown as { __cso: { debug: () => { radius: number } } }).__cso.debug().radius, half: Math.hypot(innerWidth, innerHeight) / 2 }));
  expect(d.r).toBeGreaterThanOrEqual(d.half);
  await jump(page, "surface", 0.95);
  const cap = page.locator("[data-caption]");
  await expect(cap).toContainText(`${LATEST}: ${signed(facts.gistemp_latest_year_anomaly_1951_1980.value)} °C ABOVE 1951-1980 · GISTEMP v4`, { timeout: 10000 });
  await jump(page, "surface", 0.7);
  await jump(page, "surface", 0.95);
  await expect(cap).toHaveCount(1, { timeout: 10000 });
});

test("OBS: 1998 HadCRUT5 far north: the readout equals the data table; a click opens the inspector; Esc closes it", async ({ page, isMobile }) => {
  await open(page);
  await jump(page, "observatory");
  await page.waitForTimeout(800);
  await page.evaluate(() => { const c = (window as unknown as { __cso: { setClimate: (x: object) => void; setObs: (x: object) => void } }).__cso; c.setClimate({ source: "hadcrut5" }); c.setObs({ year: 1998, region: "arctic" }); });
  const readout = page.locator("[data-obs-readout]");
  await expect(readout).toContainText("1998 · HADCRUT5 · 1951-1980 · NORTHERN HIGH LATITUDES", { timeout: 20000 });
  await page.locator(".obs-table summary").evaluate((el) => (el.parentElement as HTMLDetailsElement).open = true);
  const row = (await page.locator(".obs-table tbody tr").first().locator("td").nth(1).textContent())!;
  await expect(readout).toContainText(`→ ${row} °C`);
  const reg = json("regional.json");
  const r = reg.rows.find((x: { band: string; source: string }) => x.band === "arctic" && x.source === "hadcrut5").values["1951-1980"][reg.years.indexOf(1998)];
  expect(Math.abs(Number(row) - r)).toBeLessThan(0.02);
  const globe = page.locator(".obs-globe");
  const b = (await globe.boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  const insp = page.getByRole("dialog");
  await expect(insp).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(insp).toHaveCount(0);
  if (!isMobile) {
    const y0 = await page.evaluate(() => scrollY);
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(y0);
  }
});

test("WebGL context loss: the orb holds with a note, then the 3D view is rebuilt", async ({ page }) => {
  await open(page);
  await jump(page, "years", 0.5);
  await page.waitForTimeout(500);
  await page.evaluate(() => (window as unknown as { __loseCtx: WEBGL_lose_context | null }).__loseCtx = (document.querySelector(".planet-gl") as HTMLCanvasElement).getContext("webgl2")!.getExtension("WEBGL_lose_context"));
  await page.evaluate(() => (window as unknown as { __loseCtx: WEBGL_lose_context }).__loseCtx.loseContext());
  await expect(page.locator("html")).toHaveAttribute("data-gl", "lost");
  await expect(page.getByText("RESTORING 3D VIEW")).toBeVisible();
  await page.evaluate(() => (window as unknown as { __loseCtx: WEBGL_lose_context }).__loseCtx.restoreContext());
  await expect(page.locator("html")).toHaveAttribute("data-gl", "", { timeout: 10000 });
  const f0 = await page.evaluate(() => (window as unknown as { __cso: { debug: () => { glFrames: number } } }).__cso.debug().glFrames);
  await jump(page, "years", 0.6);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __cso: { debug: () => { glFrames: number } } }).__cso.debug().glFrames)).toBeGreaterThan(0);
  expect(f0).toBeGreaterThanOrEqual(0);
});

test("reduced motion: every Stage B scene renders statically and stays usable", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto("", { waitUntil: "networkidle" });
  await expect(page.locator(".regions-static canvas")).toHaveCount(4);
  await expect(page.locator(".ev-ex")).toHaveCount(7);
  await expect(page.locator(".obs-static")).toHaveCount(1);
  await expect(page.locator(".fut-br")).toHaveCount(15);
  await ctx.close();
});

test("axe on S03b, S05, S06, S07 and OBS: no serious or critical violations", async ({ page }) => {
  await open(page);
  for (const [id, p] of [["regions", 0.1], ["zero", 0.3], ["futures", 0.9], ["evidence", 0.95], ["observatory", undefined]] as const) {
    await jump(page, id, p);
    await page.waitForTimeout(700);
    const res = await new AxeBuilder({ page }).analyze();
    const bad = res.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(bad.map((v) => `${id} ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  }
});
