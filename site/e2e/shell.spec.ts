import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const isLocal = (url: string) => /^(http:\/\/(localhost|127\.0\.0\.1):\d+\/|data:|blob:)/.test(url);
type Hook = { __cso: { getProgress: (id: string) => number; jumpTo: (id: string, p?: number) => void } };
const IDS = ["signal", "record", "years", "regions", "strata", "zero", "futures", "evidence", "observatory", "surface"];

/** Every test starts with fresh sessionStorage, so the intro plays: Esc completes it (as a visitor can). */
async function open(page: Page, q = "?quality=high") {
  await page.goto(q);
  await page.evaluate(() => document.fonts.ready);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(450);
}

test("shell renders ten scene tracks with the static LCP headline", async ({ page }) => {
  await open(page);
  await expect(page).toHaveTitle("Climate Signal Observatory");
  await expect(page.locator("section.track")).toHaveCount(10);
  await expect(page.locator("h1[data-hero]")).toHaveText("The planet is keeping a record.");
  await expect(page.locator("#strata-title")).toContainText("Unwrap the planet");
});

test("zero external requests while visiting every scene", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (r) => { if (!isLocal(r.url())) external.push(r.url()); });
  await open(page);
  for (const id of IDS) {
    await page.evaluate((i) => (window as unknown as Hook).__cso.jumpTo(i), id);
    await page.waitForTimeout(150);
  }
  await page.waitForLoadState("networkidle");
  expect(external).toEqual([]);
});

test("desktop nav: keyboard jump, aria-current, focus, back", async ({ page, isMobile }) => {
  test.skip(!!isMobile, "desktop bar only");
  await open(page);
  const nav = page.getByRole("navigation", { name: "Chapters", exact: true });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("link", { name: "SIGNAL" })).toHaveAttribute("aria-current", "location");
  const years = nav.getByRole("link", { name: "YEARS" });
  await years.focus();
  await page.keyboard.press("Enter");
  await expect(years).toHaveAttribute("aria-current", "location");
  await expect(page).toHaveURL(/#years$/);
  await expect(page.locator("#years-title")).toBeFocused();
  const p = await page.evaluate(() => (window as unknown as Hook).__cso.getProgress("years"));
  expect(Math.abs(p - 0.5)).toBeLessThan(0.01);
  await nav.getByRole("link", { name: "STRATA" }).click();
  await expect(page).toHaveURL(/#strata$/);
  await page.goBack();
  await expect(page).toHaveURL(/#years$/);
  await expect(years).toHaveAttribute("aria-current", "location");
});

test("S08 keeps OBSERVATORY active in the nav", async ({ page, isMobile }) => {
  test.skip(!!isMobile, "desktop bar only");
  await open(page);
  await page.evaluate(() => (window as unknown as Hook).__cso.jumpTo("surface", 0.5));
  await expect(page.getByRole("navigation", { name: "Chapters", exact: true }).getByRole("link", { name: "OBSERVATORY" })).toHaveAttribute("aria-current", "location");
});

test("mobile menu pill: open, Esc closes and returns focus, item jumps", async ({ page, isMobile }) => {
  test.skip(!isMobile, "T/M pill only");
  await open(page);
  const pill = page.locator(".nav-pill.is-fixed .menu-pill");
  await expect(pill).toBeVisible();
  await expect(pill).toContainText("SIGNAL");
  await pill.click();
  await expect(pill).toHaveAttribute("aria-expanded", "true");
  const panel = page.locator("#menu-panel");
  await expect(panel).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(pill).toHaveAttribute("aria-expanded", "false");
  await expect(pill).toBeFocused();
  await pill.click();
  await panel.getByRole("link", { name: "STRATA" }).click();
  await expect(page).toHaveURL(/#strata$/);
  await expect(pill).toContainText("STRATA");
});

test("reduced motion renders in flow: no pinned stages, no blur, static frames", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto("", { waitUntil: "networkidle" });
  await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
  const sticky = await page.evaluate(() => [...document.querySelectorAll(".stage")].filter((s) => getComputedStyle(s).position === "sticky").length);
  expect(sticky).toBe(0);
  const blurred = await page.evaluate(() => [...document.querySelectorAll(".wr-word")].filter((w) => getComputedStyle(w).filter !== "none").length);
  expect(blurred).toBe(0);
  await expect(page.locator(".scene-years .years-static canvas")).toHaveCount(4);
  await expect(page.locator(".strata-static canvas")).toHaveCount(5);
  await expect(page.locator(".planet-layer").first()).toBeHidden();
  await ctx.close();
});

test("axe: no serious or critical violations on the intro end state and S03a", async ({ page }) => {
  await open(page);
  const check = async () => {
    const results = await new AxeBuilder({ page }).analyze();
    const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  };
  await check();
  await page.evaluate(() => (window as unknown as Hook).__cso.jumpTo("years", 0.6));
  await page.waitForTimeout(600);
  await check();
});

test("production build excludes the dev gallery", async ({ page }) => {
  await page.goto("?gallery");
  await expect(page.locator(".gallery")).toHaveCount(0);
  await expect(page.locator("section.track")).toHaveCount(10);
});
