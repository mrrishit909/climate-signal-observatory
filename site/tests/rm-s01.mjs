// Re-capture the reduced-motion S01 frame after the layout fix (stage-b).
import { chromium } from "@playwright/test";
import { preview } from "vite";
const server = await preview({ preview: { port: 4321, strictPort: true } });
const b = await chromium.launch();
for (const [w, h] of [[1440, 900], [768, 1024], [390, 844]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
  await p.goto("http://localhost:4321/climate-signal-observatory/", { waitUntil: "networkidle" }); await p.waitForTimeout(1500);
  await p.screenshot({ path: `../artifacts/evidence/stage-b/${w}x${h}/11-rm-s01.png` }); await p.close();
}
await b.close(); await server.close();
