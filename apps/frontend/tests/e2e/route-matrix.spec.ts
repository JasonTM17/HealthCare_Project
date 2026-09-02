import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import {
  assertNoSensitiveBrowserStorage,
  browserSessionFixture,
  installMockBrowserSession,
} from "./helpers/browser-session";

const FULL_VISUAL_MATRIX = process.env.UI_MATRIX_FULL === "1";
const SCREENSHOT_ROOT = resolve(
  process.cwd(),
  process.env.UI_MATRIX_SCREENSHOT_ROOT
    ?? "../../plans/260822-2330-healthcare-platform-fe-be-chatbot/assets/ui-matrix",
);

const PUBLIC_ROUTES = [
  "/",
  "/about",
  "/branches",
  "/branches/route-audit",
  "/specialties",
  "/specialties/route-audit",
  "/doctors",
  "/doctors/route-audit",
  "/services",
  "/services/route-audit",
  "/packages",
  "/packages/route-audit",
  "/articles",
  "/articles/route-audit",
  "/benh-pho-bien",
  "/benh-pho-bien/route-audit",
  "/faq",
  "/huong-dan",
  "/search?q=tim-mach",
  "/contact",
  "/careers",
  "/dat-lich",
  "/tra-cuu",
  "/chinh-sach-bao-mat",
  "/bac-si/route-audit",
  "/chuyen-khoa/route-audit",
  "/goi-kham/route-audit",
  "/login",
  "/auth/login",
  "/auth/register",
  "/auth/verify-email",
  "/auth/forgot-password",
  "/auth/reset-password",
] as const;

const PATIENT_ROUTES = [
  "/patient",
  "/patient/dashboard",
  "/patient/profile",
  "/patient/appointments",
  "/patient/appointments/00000000-0000-0000-0000-000000000001",
  "/patient/medical-records",
  "/patient/prescriptions",
  "/patient/diagnostic-results",
  "/patient/documents",
  "/patient/notifications",
  "/patient/preferences",
  "/patient/chat",
  "/patient/care-plan",
  "/patient/consultations",
  "/patient/consultations/00000000-0000-0000-0000-000000000001",
  "/patient/health-questions",
] as const;

const DOCTOR_ROUTES = [
  "/doctor",
  "/doctor/ai-content-reviews",
  "/doctor/dashboard",
  "/doctor/appointments",
  "/doctor/care-plans",
  "/doctor/consultations",
  "/doctor/consultations/00000000-0000-0000-0000-000000000001",
  "/doctor/health-questions",
] as const;

const ADMIN_ROUTES = [
  "/admin",
  "/admin/ai-content-reviews",
  "/admin/appointments",
  "/admin/branches",
  "/admin/doctors",
  "/admin/specialties",
  "/admin/services",
  "/admin/catalog",
  "/admin/consultations",
  "/admin/schedules",
  "/admin/content",
  "/admin/health-questions",
  "/admin/payments",
] as const;

const VIEWPORTS = FULL_VISUAL_MATRIX
  ? [
    { name: "320", width: 320, height: 720 },
    { name: "375", width: 375, height: 812 },
    { name: "414", width: 414, height: 896 },
    { name: "768", width: 768, height: 1024 },
    { name: "1024", width: 1024, height: 900 },
    { name: "1440", width: 1440, height: 1000 },
  ]
  : [
    { name: "mobile", width: 375, height: 812 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1440, height: 1000 },
  ];

function session(role: "PATIENT" | "DOCTOR" | "ADMIN") {
  return browserSessionFixture(role, `route-matrix-${role.toLowerCase()}`, `Route Matrix ${role}`);
}

async function installUnavailableApi(context: BrowserContext): Promise<void> {
  await context.route("**/api/v1/**", async (route) => {
    expect(route.request().headers()["authorization"]).toBeUndefined();
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ code: "SERVICE_UNAVAILABLE", message: "Route matrix unavailable fixture" }),
    });
  });
}

function screenshotSlug(route: string): string {
  const normalized = route.split("?")[0].replace(/^\/+|\/+$/g, "").replaceAll("/", "-");
  return normalized || "home";
}

async function evaluateAfterNavigation<T>(action: () => Promise<T>, retryValue: T): Promise<T> {
  try {
    return await action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/execution context was destroyed|most likely because of a navigation/i.test(message)) {
      return retryValue;
    }
    throw error;
  }
}

async function assertRouteSurface(page: Page, route: string): Promise<void> {
  const errors: string[] = [];
  const onPageError = (error: Error): void => {
    errors.push(error.message);
  };
  page.on("pageerror", onPageError);

  try {
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(response?.status(), `${route} should return a document`).toBeLessThan(500);
    await page.waitForTimeout(120);

    if (route.startsWith("/admin")) {
      await expect.poll(
        () => page.locator(".admin-shell").count(),
        { message: `${route} should finish the admin access gate` },
      ).toBe(1);
    } else if (
      route === "/patient"
      || route.startsWith("/patient/")
      || route === "/doctor"
      || route.startsWith("/doctor/")
    ) {
      await expect.poll(
        () => page.locator(".portal-shell").count(),
        { message: `${route} should finish the portal access gate` },
      ).toBe(1);
    }

    await expect.poll(
      () => evaluateAfterNavigation(
        () => page.evaluate(() => document.body?.innerText.trim().length ?? 0),
        0,
      ),
      { message: `${route} should not render blank` },
    ).toBeGreaterThan(20);
    await expect.poll(
      () => evaluateAfterNavigation(
        () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
        Number.MAX_SAFE_INTEGER,
      ),
      { message: `${route} should not overflow horizontally` },
    ).toBeLessThanOrEqual(1);
    await expect.poll(
      () => evaluateAfterNavigation(() => page.evaluate(() => {
        const visible = (element: Element): boolean => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
        };
        return Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))
          .filter(visible)
          .map((anchor) => anchor.getAttribute("href")?.trim() ?? "")
          .filter((href) => href === "" || href === "#" || href.toLowerCase().startsWith("javascript:"));
      }), ["__navigation_in_progress__"]),
      { message: `${route} should not expose dead anchors` },
    ).toEqual([]);
    await expect.poll(
      () => evaluateAfterNavigation(() => page.evaluate(() => {
        const visible = (element: Element): boolean => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
        };
        return Array.from(document.querySelectorAll<HTMLButtonElement>("button:not([disabled])"))
          .filter(visible)
          .filter((button) => !(
            button.textContent?.trim()
            || button.getAttribute("aria-label")?.trim()
            || button.getAttribute("title")?.trim()
          )).length;
      }), 1),
      { message: `${route} should label active buttons` },
    ).toBe(0);
    expect(errors, `${route} should not raise page errors`).toEqual([]);
  } finally {
    page.off("pageerror", onPageError);
  }
}

async function auditRoutes(
  page: Page,
  routes: readonly string[],
  screenshotRoutes: ReadonlySet<string>,
): Promise<void> {
  if (process.env.UI_MATRIX_SCREENSHOTS === "1") {
    await mkdir(SCREENSHOT_ROOT, { recursive: true });
  }

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    for (const route of routes) {
      await test.step(`${viewport.name} ${route}`, async () => {
        await assertRouteSurface(page, route);
        if (
          process.env.UI_MATRIX_SCREENSHOTS === "1"
          && (FULL_VISUAL_MATRIX || screenshotRoutes.has(route))
        ) {
          await page.screenshot({
            fullPage: true,
            path: resolve(SCREENSHOT_ROOT, `${screenshotSlug(route)}-${viewport.name}.png`),
          });
        }
      });
    }
  }
}

test.describe("responsive route-action matrix", () => {
  // The bounded default remains suitable for CI smoke coverage. The explicit
  // full mode intentionally audits every route at six viewports and therefore
  // receives a larger per-persona budget without changing the test oracle.
  test.describe.configure({ mode: "serial", timeout: FULL_VISUAL_MATRIX ? 900_000 : 240_000 });

  test("public and auth routes render safe unavailable states", async ({ context, page }) => {
    await installUnavailableApi(context);
    await auditRoutes(page, PUBLIC_ROUTES, new Set(["/", "/dat-lich", "/auth/login"]));
    await assertNoSensitiveBrowserStorage(page);
  });

  test("patient routes preserve owner-facing portal states", async ({ context, page }) => {
    await installUnavailableApi(context);
    await installMockBrowserSession(context, session("PATIENT"));
    await auditRoutes(page, PATIENT_ROUTES, new Set(["/patient/dashboard", "/patient/chat"]));
    await assertNoSensitiveBrowserStorage(page);
  });

  test("doctor routes preserve authorized operations states", async ({ context, page }) => {
    await installUnavailableApi(context);
    await installMockBrowserSession(context, session("DOCTOR"));
    await auditRoutes(page, DOCTOR_ROUTES, new Set(["/doctor/dashboard"]));
    await assertNoSensitiveBrowserStorage(page);
  });

  test("admin routes preserve role-gated operations states", async ({ context, page }) => {
    await installUnavailableApi(context);
    await installMockBrowserSession(context, session("ADMIN"));
    await auditRoutes(page, ADMIN_ROUTES, new Set(["/admin", "/admin/appointments"]));
    await assertNoSensitiveBrowserStorage(page);
  });
});
