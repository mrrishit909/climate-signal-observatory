// QA-003: what is the thin white circle at scroll step 85/90 (OBS -> S08 boundary)?
import { chromium } from "@playwright/test";
import { dirname, join } from "node:path"; import { fileURLToPath } from "node:url";
const OUT = dirname(fileURLToPath(import.meta.url));
const b = await chromium.launch();
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 1024, isMobile: w < 768 }); const p = await ctx.newPage();
  await p.goto("http://localhost:4321/climate-signal-observatory/?quality=high"); await p.waitForFunction(() => window.__cso?.debug().glFrames > 2, null, { timeout: 60000 });
  await p.keyboard.press("Escape"); await p.waitForTimeout(800);
  for (const f of [83, 84, 85, 85.5, 86]) {
    await p.evaluate((k) => { const H = document.documentElement.scrollHeight - innerHeight; window.scrollTo(0, H * k / 90); }, f); await p.waitForTimeout(300);
    const d = await p.evaluate(() => ({ ...window.__cso.debug(), y: scrollY, sec: [...document.querySelectorAll("section")].find((s) => { const r = s.getBoundingClientRect(); return r.top <= innerHeight / 2 && r.bottom >= innerHeight / 2; })?.id }));
    console.log(w, f, JSON.stringify(d));
    await p.screenshot({ path: join(OUT, "shots", `ring300-${w}-${f}.jpg`), type: "jpeg", quality: 70 });
  }
  await ctx.close();
}
await b.close();
