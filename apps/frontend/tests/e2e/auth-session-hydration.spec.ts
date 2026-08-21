import { expect, test, type Page } from "@playwright/test";
import type {
  AuthSession,
  MedicalRecord,
  Notification,
  PatientPortalAppointment,
  PatientProfile,
  Prescription,
  DiagnosticResult,
} from "../../types/hospital";

type PageEnvelope<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  empty: boolean;
};

const AUTH_STORAGE_KEY = "healthcare.auth.session";

const PATIENT_SESSION: AuthSession = {
  accessToken: "e2e-patient-token",
  refreshToken: "e2e-refresh-token",
  tokenType: "Bearer",
  expiresIn: 3600,
  user: {
    id: "patient-1",
    email: "patient@healthcare.local",
    displayName: "E2E Patient",
    roles: ["ROLE_PATIENT"],
  },
};

const PATIENT_PROFILE: PatientProfile = {
  id: "patient-1",
  fullName: "E2E Patient",
  phone: "0900000001",
  email: "patient@healthcare.local",
  dateOfBirth: null,
  gender: null,
  address: null,
  emergencyContactName: null,
  emergencyContactPhone: null,
  updatedAt: "2026-08-21T00:00:00Z",
};

const HYDRATION_ERROR_PATTERN = /hydration|hydration failed|text content does not match|minified react error|react has detected/i;

function emptyPage<T>(): PageEnvelope<T> {
  return {
    content: [],
    totalElements: 0,
    totalPages: 1,
    size: 20,
    number: 0,
    first: true,
    last: true,
    empty: true,
  };
}

function monitorBrowserIssues(page: Page, browserIssues: string[]): void {
  page.on("pageerror", (error) => {
    browserIssues.push(`pageerror: ${error.message}`);
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (HYDRATION_ERROR_PATTERN.test(text)) {
      browserIssues.push(`console error: ${text}`);
    }
  });
}

test("patient dashboard survives hard reload with a preloaded session", async ({ context }) => {
  const browserIssues: string[] = [];

  await context.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() !== "GET") {
      throw new Error(`Unexpected non-GET request: ${request.method()} ${url.pathname}${url.search}`);
    }

    switch (url.pathname) {
      case "/api/v1/patient/profile":
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(PATIENT_PROFILE),
        });
        return;
      case "/api/v1/patient/appointments":
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(emptyPage<PatientPortalAppointment>()),
        });
        return;
      case "/api/v1/patient/medical-records":
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([] satisfies MedicalRecord[]),
        });
        return;
      case "/api/v1/patient/prescriptions":
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([] satisfies Prescription[]),
        });
        return;
      case "/api/v1/patient/diagnostic-results":
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([] satisfies DiagnosticResult[]),
        });
        return;
      case "/api/v1/notifications":
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(emptyPage<Notification>()),
        });
        return;
      default:
        throw new Error(`Unexpected API request: ${request.method()} ${url.pathname}${url.search}`);
    }
  });

  await context.addInitScript(({ key, session }) => {
    window.sessionStorage.setItem(key, JSON.stringify(session));
  }, { key: AUTH_STORAGE_KEY, session: PATIENT_SESSION });

  const page = await context.newPage();
  monitorBrowserIssues(page, browserIssues);

  await page.goto("/patient/dashboard");
  await expect(page.getByRole("heading", { name: "Xin chào, E2E Patient" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Lưu hồ sơ" })).toBeVisible();

  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Xin chào, E2E Patient" })).toBeVisible();
  await expect(page.locator("#appointments")).toContainText("Chưa có lịch hẹn");
  await expect(page.getByRole("button", { name: "Lưu hồ sơ" })).toBeVisible();

  expect(browserIssues).toEqual([]);
});
