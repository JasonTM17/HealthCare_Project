import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import path from "node:path";

// The compose browser suite intentionally calls the local Spring API directly
// so it can verify role boundaries and Mailpit/AV behavior. Load the ignored
// repository-root `.env` through Next's supported test-runner loader, then map
// the server-only credential to the test-only name consumed by the spec. The
// value stays in this Node process and is never exposed to the browser.
loadEnvConfig(path.resolve(__dirname, "..", ".."));
if (!process.env.PLAYWRIGHT_BFF_SERVICE_TOKEN && process.env.BACKEND_BFF_SERVICE_TOKEN) {
  process.env.PLAYWRIGHT_BFF_SERVICE_TOKEN = process.env.BACKEND_BFF_SERVICE_TOKEN;
}

// The local BFF issues __Host- cookies with Secure enabled. Use the same
// localhost origin as BFF_PUBLIC_ORIGIN by default so browser sessions are
// retained; callers can still override PLAYWRIGHT_BASE_URL explicitly.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const browserChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL as
  | "chrome"
  | "msedge"
  | undefined;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /live-compose.*\.spec\.ts/,
  timeout: 120_000,
  expect: {
    timeout: 20_000,
  },
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  workers: 1,
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...(browserChannel ? { channel: browserChannel } : {}),
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
