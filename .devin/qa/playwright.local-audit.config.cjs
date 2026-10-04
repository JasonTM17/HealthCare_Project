const path = require("node:path");
const { defineConfig, devices } = require("../../apps/frontend/node_modules/@playwright/test");

const localOrigin = "http://localhost:3330";
const base = new URL(process.env.PLAYWRIGHT_BASE_URL || localOrigin);
if (base.origin !== localOrigin || base.pathname !== "/" || base.search || base.hash || base.username || base.password) {
  throw new Error("Local audit browser tests require the isolated localhost:3330 application.");
}
const api = new URL(process.env.PLAYWRIGHT_API_BASE_URL || `${localOrigin}/api/v1`);
if (api.origin !== localOrigin || api.pathname !== "/api/v1" || api.search || api.hash || api.username || api.password) {
  throw new Error("Local audit API tests must use the same-origin isolated BFF.");
}
process.env.PLAYWRIGHT_BASE_URL = localOrigin;
process.env.PLAYWRIGHT_API_BASE_URL = `${localOrigin}/api/v1`;
process.env.PLAYWRIGHT_MAILPIT_API_URL = "http://127.0.0.1:8125";
delete process.env.PLAYWRIGHT_BFF_SERVICE_TOKEN;

const channel = process.env.PLAYWRIGHT_BROWSER_CHANNEL;
if (channel && !["chrome", "msedge"].includes(channel)) {
  throw new Error("Unsupported local audit browser channel.");
}

module.exports = defineConfig({
  testDir: path.resolve(__dirname, "../../apps/frontend/tests/e2e"),
  testMatch: /live-compose.*\.spec\.ts$/,
  outputDir: path.resolve(__dirname, "../../apps/frontend/test-results/local-audit-live"),
  forbidOnly: true,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: "list",
  use: {
    baseURL: localOrigin,
    actionTimeout: 30_000,
    navigationTimeout: 30_000,
    trace: "off",
    video: "off",
    screenshot: "only-on-failure",
  },
  projects: [{
    name: "chromium",
    use: {
      ...devices["Desktop Chrome"],
      ...(channel ? { channel } : {}),
    },
  }],
});
