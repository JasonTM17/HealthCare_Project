import { defineConfig, devices } from "@playwright/test";
import { availableParallelism } from "node:os";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3000);
const browserChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL as
  | "chrome"
  | "msedge"
  | undefined;
const requestedWorkers = Number.parseInt(process.env.PLAYWRIGHT_WORKERS ?? "", 10);
const defaultWorkers = Math.max(1, Math.floor(availableParallelism() / 2));
const workers = Number.isInteger(requestedWorkers) && requestedWorkers > 0
  ? requestedWorkers
  : Math.min(4, defaultWorkers);

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: /live-compose.*\.spec\.ts/,
  // Preserve Playwright's half-CPU budget while capping large hosts so the
  // production server remains responsive during editor-heavy route tests.
  workers,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  // E2E timing assertions are load-sensitive on shared runners; retry CI
  // failures so one slow pass cannot fail an otherwise-correct oracle.
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `npm run start -- --hostname localhost --port ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      // The HC-14 accessibility budget has its own project below so default
      // e2e runs (`playwright test`) keep their existing scope and timing.
      testIgnore: [/accessibility-budget\.spec\.ts/, /live-compose.*\.spec\.ts/],
      use: {
        ...devices["Desktop Chrome"],
        ...(browserChannel ? { channel: browserChannel } : {}),
      },
    },
    {
      name: "a11y",
      testMatch: /accessibility-budget\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        ...(browserChannel ? { channel: browserChannel } : {}),
      },
    },
  ],
});
