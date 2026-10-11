// Which tier does an UNFORCED run pick here? (headless = SwiftShader software GL: not a device measurement)
import { chromium } from "@playwright/test";
import { preview } from "vite";
const server = await preview({ preview: { port: 4321, strictPort: true } });
const b = await chromium.launch();
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.goto("http://localhost:4321/climate-signal-observatory/");
  await p.keyboard.press("Escape");
  await p.waitForFunction(() => window.__cso.quality().median > 0, null, { timeout: 30000 }).catch(() => {});
  console.log(`${w}x${h}`, JSON.stringify(await p.evaluate(() => window.__cso.quality())));
  await p.close();
}
await b.close();
await server.close();
