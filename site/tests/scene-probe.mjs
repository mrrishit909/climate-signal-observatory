// Quick look at every scene at a few progress points (production preview, in-process).
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { preview } from "vite";
const out = process.argv[2], only = process.argv[3];
const server = await preview({ preview: { port: 4321, strictPort: true } });
const b = await chromium.launch();
const shots = [["signal", 0.7], ["record", 0.14], ["record", 0.5], ["regions", 0.1], ["regions", 0.6], ["zero", 0.3], ["zero", 0.1], ["futures", 0.2], ["futures", 0.9], ["evidence", 0.5], ["evidence", 0.95], ["observatory", 0], ["surface", 0.2], ["surface", 0.6], ["surface", 0.95]];
for (const [w, h] of [[1440, 900], [768, 1024], [390, 844]].filter(([w, h]) => !only || only === `${w}x${h}`)) {
  const dir = `${out}/${w}x${h}`; mkdirSync(dir, { recursive: true });
  const p = await b.newPage({ viewport: { width: w, height: h } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  await p.goto("http://localhost:4321/climate-signal-observatory/?quality=high");
  await p.keyboard.press("Escape");
  await p.waitForFunction(() => window.__cso.debug().glFrames > 2);
  for (const [id, q] of shots) {
    await p.evaluate(([i, x]) => window.__cso.jumpTo(i, x), [id, q]);
    await p.waitForTimeout(id === "observatory" || id === "regions" ? 2500 : 1300);
    await p.screenshot({ path: `${dir}/${id}-${String(Math.round(q * 100)).padStart(2, "0")}.png` });
  }
  console.log(`${w}x${h}`, errs.slice(0, 5).join(" | ") || "no errors");
  await p.close();
}
await b.close(); await server.close();
