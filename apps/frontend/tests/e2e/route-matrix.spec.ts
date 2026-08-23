import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import type { AuthSession } from "../../types/hospital";

const AUTH_STORAGE_KEY = "healthcare.auth.session";
const SCREENSHOT_ROOT = resolve(
  process.cwd(),
  "../../plans/260822-2330-healthcare-platform-fe-be-chatbot/assets/ui-matrix",
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
] as const;

const DOCTOR_ROUTES = [
  "/doctor",
  "/doctor/dashboard",
  "/doctor/appointments",
] as const;

const ADMIN_ROUTES = [
  "/admin",
  "/admin/appointments",
  "/admin/branches",
  "/admin/doctors",
  "/admin/specialties",
  "/admin/services",
  "/admin/catalog",
  "/admin/schedules",
  "/admin/content",
] as const;

const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 1000 },
] as const;

function session(role: "PATIENT" | "DOCTOR" | "ADMIN"): AuthSession {
  return {
    accessToken: `route-matrix-${role.toLowerCase()}-token`,
    refreshToken: `route-matrix-${role.toLowerCase()}-refresh`,
    tokenType: "Bearer",
    expiresIn: 3600,
    user: {
      id: `route-matrix-${role.toLowerCase()}`,
      email: `${role.toLowerCase()}@route-matrix.local`,
      displayName: `Route Matrix ${role}`,
      roles: [`ROLE_${role}`],
    },
  };
}

async function installUnavailableApi(context: BrowserContext): Promise<void> {
  await context.route("**/api/v1/**", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ code: "SERVICE_UNAVAILABLE", message: "Route matrix unavailable fixture" }),
    });
  });
}

async function installSession(context: BrowserContext, value: AuthSession): Promise<void> {
  await context.addInitScript(({ key, authSession }) => {
    window.sessionStorage.setItem(key, JSON.stringify(authSession));
  }, { key: AUTH_STORAGE_KEY, authSession: value });
}

function screenshotSlug(route: string): string {
  const normalized = route.split("?")[0].replace(/^\/+|\/+$/g, "").replaceAll("/", "-");
  return normalized || "home";
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
      () => page.evaluate(() => document.body?.innerText.trim().length ?? 0),
      { message: `${route} should not render blank` },
    ).toBeGreaterThan(20);
    await expect.poll(
      () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
      { message: `${route} should not overflow horizontally` },
    ).toBeLessThanOrEqual(1);
    await expect.poll(
      () => page.evaluate(() => {
        const visible = (element: Element): boolean => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
        };
        return Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))
          .filter(visible)
          .map((anchor) => anchor.getAttribute("href")?.trim() ?? "")
          .filter((href) => href === "" || href === "#" || href.toLowerCase().startsWith("javascript:"));
      }),
      { message: `${route} should not expose dead anchors` },
    ).toEqual([]);
    await expect.poll(
      () => page.evaluate(() => {
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
      }),
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
        if (process.env.UI_MATRIX_SCREENSHOTS === "1" && screenshotRoutes.has(route)) {
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
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test("public and auth routes render safe unavailable states", async ({ context, page }) => {
    await installUnavailableApi(context);
    await auditRoutes(page, PUBLIC_ROUTES, new Set(["/", "/dat-lich", "/auth/login"]));
  });

  test("patient routes preserve owner-facing portal states", async ({ context, page }) => {
    await installSession(context, session("PATIENT"));
    await installUnavailableApi(context);
    await auditRoutes(page, PATIENT_ROUTES, new Set(["/patient/dashboard", "/patient/chat"]));
  });

  test("doctor routes preserve authorized operations states", async ({ context, page }) => {
    await installSession(context, session("DOCTOR"));
    await installUnavailableApi(context);
    await auditRoutes(page, DOCTOR_ROUTES, new Set(["/doctor/dashboard"]));
  });

  test("admin routes preserve role-gated operations states", async ({ context, page }) => {
    await installSession(context, session("ADMIN"));
    await installUnavailableApi(context);
    await auditRoutes(page, ADMIN_ROUTES, new Set(["/admin", "/admin/appointments"]));
  });
});
