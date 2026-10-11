import { expect, test } from "@playwright/test";

/** P03-FIXA-003: D-021 / L16 (pixel contrast of every tag and caption), D-022 / L15 (reduced-motion figures paint), D-010, D-024. */
type Hook = { jumpTo: (i: string, p?: number) => void; debug: () => { glFrames: number } };
const LANDINGS: [string, number | undefined][] = [
  ["signal", 0], ["signal", 0.78], ["record", 0.14], ["years", 0.5], ["regions", 0.1], ["strata", 0.89], ["zero", 0.3],
  ["futures", 0.42], ["futures", 0.9], ["evidence", 0.95], ["observatory", undefined], ["surface", 0.3], ["surface", 0.6], ["surface", 0.98],
];
const VIEWPORTS: [number, number][] = [[1920, 1080], [1440, 900], [1280, 720], [1024, 768], [768, 1024], [390, 844], [375, 812], [360, 800]];

test.describe("FIX-A3", () => {
  test.describe.configure({ timeout: 600_000 });
  test.beforeEach(({ isMobile }) => { test.skip(!!isMobile, "viewports are set per test (desktop project)"); });

  for (const [w, h] of VIEWPORTS) {
    test(`L16 / L19 / D-021 / D-025 at ${w}x${h}: every visible text element reads at 4.5:1 or better in the rendered pixels`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto("?quality=high");
      await page.waitForFunction(() => ((window as unknown as { __cso?: Hook }).__cso?.debug().glFrames ?? 0) > 1);
      await page.keyboard.press("Escape");
      const bad: string[] = [];
      let probed = false;
      for (const [s, p] of LANDINGS) {
        await page.evaluate(([i, q]) => (window as unknown as { __cso: Hook }).__cso.jumpTo(i as string, q as number | undefined), [s, p] as const);
        await page.waitForTimeout(s === "signal" ? 3000 : 1600); // S00: the resting frame after the intro; S01: past the cards' typing
        // L19 self-check: a low-contrast element with a class no test names must be caught
        if (!probed) await page.evaluate(() => { const e = document.createElement("p"); e.className = "l19-probe-unlisted"; e.textContent = "PROBE TEXT"; e.style.cssText = "position:absolute;left:40%;top:40%;margin:0;padding:6px;background:#000;color:#333;font:400 14px monospace;z-index:20"; document.querySelector("#signal .stage-content")!.appendChild(e); });
        // L19: the list comes from the DOM: every visible element that owns a text node, in the scene and fully on screen
        // (disabled controls are exempt from contrast, WCAG 1.4.3)
        const boxes = await page.evaluate((id) => [...document.getElementById(id as string)!.querySelectorAll("*")].filter((e) => {
          if (![...e.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? "").trim())) return false;
          if (e.closest(".sr-only, .tooltip, :disabled, .is-disabled")) return false;
          for (let x: Element | null = e; x; x = x.parentElement) {
            const cs = getComputedStyle(x);
            if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) < 0.05) return false;
            if (x.parentElement instanceof HTMLDetailsElement && !x.parentElement.open && x.tagName !== "SUMMARY") return false;
          }
          // a word still mid-reveal (WordReveal scrub below full opacity) is the transition itself, not resting text
          if (e.classList.contains("wr-word") && Number(getComputedStyle(e).opacity) < 0.99) return false;
          const r = e.getBoundingClientRect();
          // wholly inside every clipping ancestor (a scrolled list's cut-off line is not on screen)
          for (let x = e.parentElement; x; x = x.parentElement) {
            const cs = getComputedStyle(x);
            if (cs.overflowX === "visible" && cs.overflowY === "visible") continue;
            const c = x.getBoundingClientRect();
            if (r.left < c.left - 0.5 || r.right > c.right + 0.5 || r.top < c.top - 0.5 || r.bottom > c.bottom + 0.5) return false;
          }
          return r.width > 4 && r.height > 4 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
        }).map((e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height, label: `${e.tagName.toLowerCase()}.${(e.getAttribute("class") ?? "").split(" ")[0]} "${(e.textContent ?? "").trim().slice(0, 30)}"` }; }), s);
        // one viewport shot per landing; every box is measured from it in the page
        const shot = (await page.screenshot()).toString("base64");
        const seen = await page.evaluate(async ([b64, list]) => {
          const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
          const cv = new OffscreenCanvas(bmp.width, bmp.height), x = cv.getContext("2d")!, k = bmp.width / innerWidth;
          x.drawImage(bmp, 0, 0);
          const lin = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
          const L = (r: number, g: number, b: number) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
          return (list as { x: number; y: number; width: number; height: number }[]).map((b) => {
            const d = x.getImageData(Math.round(b.x * k), Math.round(b.y * k), Math.max(1, Math.round(b.width * k)), Math.max(1, Math.round(b.height * k))).data, count = new Map<number, number>();
            for (let i = 0; i < d.length; i += 4) { const q = ((d[i]! >> 3) << 10) | ((d[i + 1]! >> 3) << 5) | (d[i + 2]! >> 3); count.set(q, (count.get(q) ?? 0) + 1); }
            const bgKey = [...count.entries()].sort((a, c) => c[1] - a[1])[0]![0];
            const bg = L(((bgKey >> 10) & 31) * 8 + 4, ((bgKey >> 5) & 31) * 8 + 4, (bgKey & 31) * 8 + 4);
            let best = 1;
            for (let i = 0; i < d.length; i += 4) { const l = L(d[i]!, d[i + 1]!, d[i + 2]!); best = Math.max(best, (Math.max(l, bg) + 0.05) / (Math.min(l, bg) + 0.05)); }
            return best;
          });
        }, [shot, boxes] as const);
        boxes.forEach((b, i) => { if (seen[i]! < 4.5) bad.push(`${s}@${p ?? "-"}: ${b.label} ${seen[i]!.toFixed(2)}:1`); });
        if (!probed) {
          probed = true;
          expect(bad.some((x) => x.includes("l19-probe-unlisted")), "the DOM-built list catches an unlisted low-contrast element").toBe(true);
          bad.splice(0, bad.length, ...bad.filter((x) => !x.includes("l19-probe-unlisted")));
          await page.evaluate(() => document.querySelector(".l19-probe-unlisted")?.remove());
        }
      }
      expect(bad).toEqual([]);
    });
  }

  const FIGURE: Record<string, string> = {
    signal: "#signal .still-planet", record: "#record .story-card", years: "#years .years-static canvas", regions: "#regions .regions-static canvas",
    strata: "#strata .strata-static canvas", zero: "#zero .zero-plot", futures: "#futures .fut-plot", evidence: "#evidence .ev-stack",
    observatory: "#observatory .obs-static", surface: "#surface .still-planet",
  };
  for (const [w, h] of [[1440, 900], [768, 1024], [390, 844]] as const) {
    test(`L15 / D-022 at ${w}x${h} under reduced motion: every scene's figure has a size and painted pixels; the OBS rail clears the head`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
      const page = await ctx.newPage();
      await page.goto("", { waitUntil: "networkidle" });
      for (const [id, sel] of Object.entries(FIGURE)) {
        // scroll by script and clip the viewport shot: the static paints are long tasks, so Playwright's element-stability wait is not used
        const box = await page.evaluate((q) => {
          const e = document.querySelector(q)!;
          e.scrollIntoView({ block: "center" });
          const r = e.getBoundingClientRect();
          return { w: r.width, h: r.height, x: Math.max(0, r.left), y: Math.max(0, r.top), x1: Math.min(innerWidth, r.right), y1: Math.min(innerHeight, r.bottom) };
        }, sel);
        await page.waitForTimeout(600);
        expect(box.w > 0 && box.h > 0, `${id}: ${sel} is ${box.w}x${box.h}`).toBe(true);
        const lit = await page.evaluate(async (b64) => {
          const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
          const cv = new OffscreenCanvas(bmp.width, bmp.height), x = cv.getContext("2d")!;
          x.drawImage(bmp, 0, 0);
          const d = x.getImageData(0, 0, bmp.width, bmp.height).data;
          let n = 0;
          for (let i = 0; i < d.length; i += 4) if (Math.max(d[i]!, d[i + 1]!, d[i + 2]!) > 40) n++;
          return n;
        }, (await page.screenshot({ clip: { x: box.x, y: box.y, width: box.x1 - box.x, height: box.y1 - box.y } })).toString("base64"));
        expect(lit, `${id}: painted pixels in ${sel}`).toBeGreaterThan(400);
      }
      const hit = await page.evaluate(() => {
        document.getElementById("observatory")!.scrollIntoView();
        const rail = document.querySelector("#obs-rail, .obs-rail")!.getBoundingClientRect();
        const cs = getComputedStyle(document.querySelector(".obs-rail")!);
        if (cs.display === "none") return [];
        return ["#observatory [data-scene-heading]", "[data-obs-readout]"].filter((s) => {
          const r = document.querySelector(s)!.getBoundingClientRect();
          return Math.min(r.right, rail.right) > Math.max(r.left, rail.left) && Math.min(r.bottom, rail.bottom) > Math.max(r.top, rail.top);
        });
      });
      expect(hit, "the rail overlaps").toEqual([]);
      await ctx.close();
    });
  }

  for (const [w, h] of [[1024, 768], [768, 1024], [390, 844], [375, 812], [360, 800]] as const) {
    test(`D-010 at ${w}x${h}: no S05 value label is struck by the series`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto("?quality=high");
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => ((window as unknown as { __cso?: Hook }).__cso?.debug().glFrames ?? 0) > 1);
      await page.evaluate(() => (window as unknown as { __cso: Hook }).__cso.jumpTo("zero", 0.3));
      await page.waitForTimeout(1600);
      const struck = await page.evaluate(() => {
        const out: string[] = [];
        const lines = [...document.querySelectorAll<SVGPathElement>(".zero-plot .giss-line, .zero-plot .had-line")];
        for (const t of document.querySelectorAll<SVGTextElement>(".zero-plot text[data-hz]")) {
          const r = t.getBoundingClientRect();
          for (const p of lines) {
            const m = p.getScreenCTM()!, len = p.getTotalLength();
            for (let s = 0; s <= len; s += 1) {
              const q = p.getPointAtLength(s), X = m.a * q.x + m.c * q.y + m.e, Y = m.b * q.x + m.d * q.y + m.f;
              if (X > r.left && X < r.right && Y > r.top && Y < r.bottom) { out.push(`${t.textContent} x ${p.getAttribute("class")}`); break; }
            }
          }
        }
        return out;
      });
      expect(struck).toEqual([]);
    });
  }

  for (const [w, h] of [[390, 844], [375, 812], [360, 800]] as const) {
    test(`D-024 at ${w}x${h} under reduced motion: the S05 note is clear of the clamp label and every other text`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
      const page = await ctx.newPage();
      await page.goto("", { waitUntil: "networkidle" });
      await page.evaluate(() => document.getElementById("zero")!.scrollIntoView());
      await page.waitForTimeout(400);
      const hits = await page.evaluate(() => {
        const note = document.querySelector(".zero-rm")!.getBoundingClientRect();
        return [...document.querySelectorAll("#zero .clamp__label, #zero text, #zero p, #zero .chip, #zero .chip-btn")].filter((e) => !e.classList.contains("zero-rm") && !e.classList.contains("sr-only") && !e.closest(".sr-only")).filter((e) => {
          const r = e.getBoundingClientRect();
          return r.width > 0 && Math.min(r.right, note.right) - Math.max(r.left, note.left) > 1 && Math.min(r.bottom, note.bottom) - Math.max(r.top, note.top) > 1;
        }).map((e) => `${e.className.toString()} "${(e.textContent ?? "").slice(0, 20)}"`);
      });
      expect(hits).toEqual([]);
      await ctx.close();
    });
  }
});
