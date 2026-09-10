import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3000);
const browserChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL as
  | "chrome"
  | "msedge"
  | undefined;

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: /live-compose.*\.spec\.ts/,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
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
