import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import type { AuthSession } from "../../lib/api-client";
import type {
  Article,
  Branch,
  CarePlan,
  MedicalRecord,
  Notification,
  PatientOverview,
  PatientPortalAppointment,
  PatientProfile,
  Prescription,
  DiagnosticResult,
  Doctor,
  HealthPackage,
  MedicalService,
  Specialty,
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

const PATIENT_SESSION: AuthSession = {
  idleExpiresAt: "2026-08-25T12:30:00Z",
  absoluteExpiresAt: "2026-08-25T23:59:00Z",
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

function singlePage<T>(content: T[]): PageEnvelope<T> {
  return {
    content,
    totalElements: content.length,
    totalPages: content.length > 0 ? 1 : 0,
    size: 20,
    number: 0,
    first: true,
    last: true,
    empty: content.length === 0,
  };
}

function eventChunk(eventName: string, data: unknown, eventId?: number): string {
  const lines = [
    `event: ${eventName}`,
    eventId === undefined ? undefined : `id: ${eventId}`,
    `data: ${JSON.stringify(data)}`,
    "",
    "",
  ];
  return lines.filter((line) => line !== undefined).join("\n");
}

function feedReadyEvent(): string {
  return eventChunk("ready", {
    latestEventId: 1,
    replayLimit: 100,
    snapshotFallback: "GET /api/v1/cms/content/{slotKey}?afterEventId={eventId}",
  });
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

test("patient layout waits for hydration and preserves a safe deep-link on unauthenticated fallback", async ({ context }) => {
  let releaseCurrentSession: (() => void) | undefined;
  const currentSessionGate = new Promise<void>((resolve) => {
    releaseCurrentSession = resolve;
  });
  const childRequests: string[] = [];

  await context.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api/v1/auth/browser-sessions/current") {
      await currentSessionGate;
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ code: "AUTHENTICATION_REQUIRED" }),
      });
      return;
    }
    childRequests.push(`${request.method()} ${url.pathname}${url.search}`);
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ code: "UNEXPECTED_CHILD_REQUEST" }),
    });
  });

  const page = await context.newPage();
  await page.goto("/patient/dashboard?paymentAppointmentId=appointment-1#appointments");
  await expect(page.getByText("Đang xác minh phiên đăng nhập an toàn...")).toBeVisible();
  expect(childRequests).toEqual([]);

  releaseCurrentSession?.();
  await expect(page.getByRole("heading", { name: "Đăng nhập để mở cổng thông tin" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Đăng nhập" })).toHaveAttribute(
    "href",
    "/auth/login?next=%2Fpatient%2Fdashboard%3FpaymentAppointmentId%3Dappointment-1%23appointments",
  );
  expect(childRequests).toEqual([]);
});

async function installSearchMocks(context: BrowserContext): Promise<void> {
  const specialty: Specialty = {
    id: "specialty-1",
    name: "Tim mạch",
    slug: "tim-mach",
    description: "Khám tim mạch cho nhu cầu thử nghiệm hard reload.",
    active: true,
  };
  const doctor: Doctor = {
    id: "doctor-1",
    fullName: "BS E2E Search",
    slug: "bs-e2e-search",
    bio: "Bác sĩ thử nghiệm cho luồng tìm kiếm.",
    active: true,
    specialtyName: "Tim mạch",
  };
  const service: MedicalService = {
    id: "service-1",
    name: "Khám tim mạch",
    slug: "kham-tim-mach",
    description: "Dịch vụ thử nghiệm cho search.",
    active: true,
  };
  const healthPackage: HealthPackage = {
    id: "package-1",
    name: "Gói tim mạch cơ bản",
    slug: "goi-tim-mach-co-ban",
    description: "Gói kiểm tra cho search hydration.",
    price: 1000000,
    active: true,
  };
  const article: Article = {
    id: "article-1",
    title: "Nhịp tim và chăm sóc chủ động",
    slug: "nhip-tim-va-cham-soc-chu-dong",
    summary: "Bài viết thử nghiệm cho luồng tìm kiếm.",
    publishedAt: "2026-08-21T00:00:00Z",
    active: true,
  };
  const branch: Branch = {
    id: "branch-1",
    name: "Bệnh viện E2E Search",
    slug: "benh-vien-e2e-search",
    address: "123 Đường Thử Nghiệm, Quận 1, TP. HCM",
    phone: "028 1234 5678",
    workingHours: "Thứ 2 - Chủ nhật · 07:00 - 20:00",
    emergencyHotline: "1900 1234",
    mapUrl: null,
    amenities: ["Cấp cứu", "Đặt lịch nhanh"],
    active: true,
  };

  await context.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() !== "GET") {
      throw new Error(`Unexpected non-GET request: ${request.method()} ${url.pathname}${url.search}`);
    }

    switch (url.pathname) {
      case "/api/v1/auth/browser-sessions/current":
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(PATIENT_SESSION),
        });
        return;
      case "/api/v1/hospital/specialties":
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(singlePage([specialty])) });
        return;
      case "/api/v1/hospital/doctors":
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(singlePage([doctor])) });
        return;
      case "/api/v1/hospital/services":
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(singlePage([service])) });
        return;
      case "/api/v1/hospital/packages":
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(singlePage([healthPackage])) });
        return;
      case "/api/v1/hospital/articles":
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(singlePage([article])) });
        return;
      case "/api/v1/hospital/branches":
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(singlePage([branch])) });
        return;
      case "/api/v1/ai/search":
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            results: [{
              source_type: "specialty",
              source_id: specialty.id,
              title: specialty.name,
              content: specialty.description,
              score: 0.97,
              citation: {
                source_type: "specialty",
                source_id: specialty.id,
                title: specialty.name,
              },
            }],
            query: url.searchParams.get("q") ?? "",
            specialty: specialty.slug,
            provenance: "test",
          }),
        });
        return;
      case "/api/v1/cms/content/events":
        await route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          headers: {
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
          body: feedReadyEvent(),
        });
        return;
      case "/api/v1/patient/profile":
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ avatarUrl: null }),
        });
        return;
      default:
        if (url.pathname.startsWith("/api/v1/cms/content/")) {
          await route.fulfill({
            status: 404,
            contentType: "application/json",
            body: JSON.stringify({ message: "Slot chưa được xuất bản." }),
          });
          return;
        }
        throw new Error(`Unexpected API request: ${request.method()} ${url.pathname}${url.search}`);
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
      case "/api/v1/auth/browser-sessions/current":
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(PATIENT_SESSION),
        });
        return;
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
      case "/api/v1/patient/overview":
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            latestAppointment: null,
            appointmentCount: 0,
            diagnosticResultCount: 0,
            prescriptionCount: 0,
            hasNewDiagnosticResult: false,
            hasNewPrescription: false,
            unreadNotificationCount: 0,
            unreadConsultationCount: 0,
            openCarePlanTaskCount: 0,
          } satisfies PatientOverview),
        });
        return;
      case "/api/v1/patient/care-plans":
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([] satisfies CarePlan[]),
        });
        return;
      case "/api/v1/hospital/branches":
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(emptyPage<Branch>()),
        });
        return;
      default:
        throw new Error(`Unexpected API request: ${request.method()} ${url.pathname}${url.search}`);
    }
  });

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

  const browserStorage = await page.evaluate(() => ({
    local: { ...localStorage },
    session: { ...sessionStorage },
  }));
  expect(browserStorage.session).not.toHaveProperty("healthcare.auth.session");
  expect(JSON.stringify(browserStorage)).not.toMatch(/accessToken|refreshToken|Bearer/i);

  expect(browserIssues).toEqual([]);
});

test("failed logout keeps the HttpOnly browser session authoritative and retryable across reload", async ({ context }, testInfo) => {
  const configuredBaseUrl = String(testInfo.project.use.baseURL ?? "http://localhost:3100");
  const appUrl = new URL(configuredBaseUrl);
  const secureCookieUrl = `https://${appUrl.host}/`;
  const sessionCookieValue = "opaque-e2e-session-secret";
  const csrfCookieValue = "opaque-e2e-csrf-secret";
  const browserIssues: string[] = [];
  let currentSessionRequests = 0;
  let logoutRequests = 0;

  await context.addCookies([
    {
      name: "__Host-healthcare_session",
      value: sessionCookieValue,
      url: secureCookieUrl,
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    },
    {
      name: "__Host-healthcare_csrf",
      value: csrfCookieValue,
      url: secureCookieUrl,
      httpOnly: false,
      secure: true,
      sameSite: "Lax",
    },
  ]);

  await context.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === "/api/v1/auth/browser-sessions/current") {
      if (request.method() === "GET") {
        currentSessionRequests += 1;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(PATIENT_SESSION),
        });
        return;
      }
      if (request.method() === "DELETE") {
        logoutRequests += 1;
        await route.fulfill({
          status: 502,
          contentType: "application/json",
          body: JSON.stringify({ code: "BFF_UPSTREAM_UNAVAILABLE" }),
        });
        return;
      }
    }

    if (request.method() !== "GET") {
      throw new Error(`Unexpected non-GET request: ${request.method()} ${url.pathname}${url.search}`);
    }

    switch (url.pathname) {
      case "/api/v1/patient/profile":
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(PATIENT_PROFILE) });
        return;
      case "/api/v1/patient/appointments":
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(emptyPage<PatientPortalAppointment>()) });
        return;
      case "/api/v1/patient/medical-records":
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([] satisfies MedicalRecord[]) });
        return;
      case "/api/v1/patient/prescriptions":
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([] satisfies Prescription[]) });
        return;
      case "/api/v1/patient/diagnostic-results":
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([] satisfies DiagnosticResult[]) });
        return;
      case "/api/v1/notifications":
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(emptyPage<Notification>()) });
        return;
      case "/api/v1/patient/overview":
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            latestAppointment: null,
            appointmentCount: 0,
            diagnosticResultCount: 0,
            prescriptionCount: 0,
            hasNewDiagnosticResult: false,
            hasNewPrescription: false,
            unreadNotificationCount: 0,
            unreadConsultationCount: 0,
            openCarePlanTaskCount: 0,
          } satisfies PatientOverview),
        });
        return;
      case "/api/v1/patient/care-plans":
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([] satisfies CarePlan[]) });
        return;
      case "/api/v1/hospital/branches":
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(emptyPage<Branch>()) });
        return;
      default:
        throw new Error(`Unexpected API request: ${request.method()} ${url.pathname}${url.search}`);
    }
  });

  const page = await context.newPage();
  monitorBrowserIssues(page, browserIssues);
  await page.goto("/patient/dashboard");
  await expect(page.getByRole("heading", { name: "Xin chào, E2E Patient" })).toBeVisible();

  const cookiesBeforeLogout = await context.cookies(secureCookieUrl);
  expect(cookiesBeforeLogout).toEqual(expect.arrayContaining([
    expect.objectContaining({
      name: "__Host-healthcare_session",
      value: sessionCookieValue,
      httpOnly: true,
      secure: true,
    }),
    expect.objectContaining({
      name: "__Host-healthcare_csrf",
      value: csrfCookieValue,
      secure: true,
    }),
  ]));

  const logoutButton = page.getByRole("button", { name: "Đăng xuất" });
  await logoutButton.click();
  const retryStatus = page.getByRole("status").filter({
    hasText: "Không thể đăng xuất an toàn. Phiên của bạn vẫn đang hoạt động. Vui lòng thử lại.",
  });
  await expect(retryStatus).toBeVisible();
  await expect(logoutButton).toBeEnabled();
  await expect(page).toHaveURL(/\/patient\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Xin chào, E2E Patient" })).toBeVisible();
  await expect(page.getByText("BFF_UPSTREAM_UNAVAILABLE")).toHaveCount(0);
  expect(logoutRequests).toBe(1);

  const cookiesAfterFailedLogout = await context.cookies(secureCookieUrl);
  expect(cookiesAfterFailedLogout.find((cookie) => cookie.name === "__Host-healthcare_session")?.value).toBe(sessionCookieValue);
  expect(cookiesAfterFailedLogout.find((cookie) => cookie.name === "__Host-healthcare_csrf")?.value).toBe(csrfCookieValue);
  expect(await page.evaluate(() => document.cookie)).not.toContain("__Host-healthcare_session");

  await page.reload();
  await expect(page.getByRole("heading", { name: "Xin chào, E2E Patient" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Đăng xuất" })).toBeEnabled();
  await expect(page).toHaveURL(/\/patient\/dashboard$/);
  expect(currentSessionRequests).toBeGreaterThanOrEqual(2);

  const cookiesAfterReload = await context.cookies(secureCookieUrl);
  expect(cookiesAfterReload.find((cookie) => cookie.name === "__Host-healthcare_session")?.value).toBe(sessionCookieValue);
  const browserStorage = await page.evaluate(() => ({
    local: { ...localStorage },
    session: { ...sessionStorage },
  }));
  expect(JSON.stringify(browserStorage)).not.toMatch(/accessToken|refreshToken|Bearer|opaque-e2e-session-secret|opaque-e2e-csrf-secret/i);
  expect(browserIssues).toEqual([]);
});

test("lost logout acknowledgement reconciles a committed revocation before redirecting", async ({ context }) => {
  let currentSessionRequests = 0;
  const browserIssues: string[] = [];

  await context.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api/v1/auth/browser-sessions/current") {
      if (request.method() === "DELETE") {
        // The server may have committed revocation before the response was
        // lost. The client must reconcile instead of restoring stale metadata.
        await route.abort("connectionreset");
        return;
      }
      currentSessionRequests += 1;
      if (currentSessionRequests === 1) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(PATIENT_SESSION) });
      } else {
        await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ code: "AUTHENTICATION_REQUIRED" }) });
      }
      return;
    }

    if (request.method() !== "GET") {
      throw new Error(`Unexpected non-GET request: ${request.method()} ${url.pathname}${url.search}`);
    }
    switch (url.pathname) {
      case "/api/v1/patient/profile":
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(PATIENT_PROFILE) });
        return;
      case "/api/v1/patient/appointments":
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(emptyPage<PatientPortalAppointment>()) });
        return;
      case "/api/v1/patient/medical-records":
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([] satisfies MedicalRecord[]) });
        return;
      case "/api/v1/patient/prescriptions":
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([] satisfies Prescription[]) });
        return;
      case "/api/v1/patient/diagnostic-results":
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([] satisfies DiagnosticResult[]) });
        return;
      case "/api/v1/notifications":
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(emptyPage<Notification>()) });
        return;
      case "/api/v1/patient/overview":
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            latestAppointment: null,
            appointmentCount: 0,
            diagnosticResultCount: 0,
            prescriptionCount: 0,
            hasNewDiagnosticResult: false,
            hasNewPrescription: false,
            unreadNotificationCount: 0,
            unreadConsultationCount: 0,
            openCarePlanTaskCount: 0,
          } satisfies PatientOverview),
        });
        return;
      case "/api/v1/patient/care-plans":
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([] satisfies CarePlan[]) });
        return;
      case "/api/v1/hospital/branches":
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(emptyPage<Branch>()) });
        return;
      default:
        throw new Error(`Unexpected API request: ${request.method()} ${url.pathname}${url.search}`);
    }
  });

  const page = await context.newPage();
  monitorBrowserIssues(page, browserIssues);
  await page.goto("/patient/dashboard");
  await expect(page.getByRole("heading", { name: "Xin chào, E2E Patient" })).toBeVisible();

  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL(/\/auth\/login$/);
  await expect(page.getByRole("heading", { name: "Đăng nhập tài khoản" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Xin chào, E2E Patient" })).toHaveCount(0);
  expect(currentSessionRequests).toBe(2);
  expect(browserIssues).toEqual([]);
});

test("search page survives hard reload with a preloaded session", async ({ context }) => {
  const browserIssues: string[] = [];
  await installSearchMocks(context);

  const page = await context.newPage();
  monitorBrowserIssues(page, browserIssues);

  await page.goto("/search?q=tim");
  await expect(page.getByRole("heading", { name: "Tìm đúng điểm bắt đầu cho nhu cầu chăm sóc" })).toBeVisible();
  await expect(page.getByText("Có phiên đăng nhập")).toBeVisible();

  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Có phiên đăng nhập")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tìm đúng điểm bắt đầu cho nhu cầu chăm sóc" })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("healthcare.auth.session"))).toBeNull();

  expect(browserIssues).toEqual([]);
});
