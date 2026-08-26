import { expect, type BrowserContext, type Page } from "@playwright/test";
import type { AuthUser } from "../../../types/hospital";

export interface BrowserSessionFixture {
  user: AuthUser;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
}

export function browserSessionFixture(
  role: "PATIENT" | "DOCTOR" | "ADMIN",
  id: string,
  displayName: string,
): BrowserSessionFixture {
  return {
    user: {
      id,
      email: `${id}@e2e.healthcare.local`,
      displayName,
      roles: [`ROLE_${role}`],
      emailVerified: true,
    },
    idleExpiresAt: "2099-01-01T00:30:00Z",
    absoluteExpiresAt: "2099-01-01T12:00:00Z",
  };
}

function expectedBrowserOrigin(): string {
  return new URL(
    process.env.PLAYWRIGHT_BASE_URL
      ?? `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? "3100"}`,
  ).origin;
}

export async function installMockBrowserSession(
  target: BrowserContext | Page,
  session: BrowserSessionFixture | null,
): Promise<void> {
  await target.route("**/api/v1/auth/browser-sessions/current", async (route) => {
    const request = route.request();
    expect(request.method()).toBe("GET");
    expect(new URL(request.url()).origin).toBe(expectedBrowserOrigin());
    expect(request.headers()["authorization"]).toBeUndefined();
    await route.fulfill({
      status: session ? 200 : 401,
      contentType: "application/json",
      headers: { "Cache-Control": "no-store" },
      body: JSON.stringify(session ?? { code: "BROWSER_SESSION_REQUIRED" }),
    });
  });
}

export async function assertNoSensitiveBrowserStorage(
  page: Page,
  sensitiveValues: readonly string[] = [],
): Promise<void> {
  const storageText = await page.evaluate(() => {
    const entries = (storage: Storage, label: string): string[] => (
      Array.from({ length: storage.length }, (_, index) => {
        const key = storage.key(index) ?? "";
        return `${label}:${key}=${storage.getItem(key) ?? ""}`;
      })
    );
    return [...entries(localStorage, "local"), ...entries(sessionStorage, "session")].join("\n");
  });

  expect(storageText).not.toMatch(/healthcare\.auth\.session|accessToken|refreshToken|Bearer\s+/iu);
  for (const value of sensitiveValues) {
    expect(storageText).not.toContain(value);
  }
}
