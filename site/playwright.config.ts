import { defineConfig, devices } from "@playwright/test";

// Always runs against the production build (vite preview), never the dev server.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  // other agents share this CPU (software WebGL suites); more than 2 workers times out
  workers: 2,
  // shared machine (other agents run browsers on 4301/4311): one retry absorbs software-WebGL timeouts
  retries: 1,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:4321/climate-signal-observatory/" },
  webServer: {
    command: "npm run build && npm run preview",
    url: "http://localhost:4321/climate-signal-observatory/",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
  ],
});
