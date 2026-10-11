// Before/after frames for the P03-FE-002 fixes (production preview, in-process).
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { preview } from "vite";
const out = process.argv[2];
const server = await preview({ preview: { port: 4321, strictPort: true } });
const b = await chromium.launch();
for (const [w, h] of [[1440, 900], [768, 1024], [390, 844]]) {
  const dir = `${out}/${w}x${h}`; mkdirSync(dir, { recursive: true });
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.goto("http://localhost:4321/climate-signal-observatory/?quality=high");
  await p.keyboard.press("Escape");
  await p.waitForFunction(() => window.__cso.debug().glFrames > 2);
  const jump = async (id, q, ms, name) => { await p.evaluate(([i, x]) => window.__cso.jumpTo(i, x), [id, q]); await p.waitForTimeout(ms); await p.screenshot({ path: `${dir}/${name}.png` }); };
  await jump("years", 0.08, 2500, "03-s03a-1880");
  await jump("years", 0.96, 1500, "03-s03a-2025");
  for (const q of [0.2, 0.38, 0.86, 0.96]) await jump("strata", q, q > 0.8 ? 2500 : 1200, `04-s04-p${Math.round(q * 100)}`);
  await p.close();
}
await b.close(); await server.close();
