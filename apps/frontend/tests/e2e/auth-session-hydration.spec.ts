import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import type {
  AuthSession,
  Article,
  Branch,
  MedicalRecord,
  Notification,
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

test("search page survives hard reload with a preloaded session", async ({ context }) => {
  const browserIssues: string[] = [];
  await installSearchMocks(context);

  await context.addInitScript(({ key, session }) => {
    window.sessionStorage.setItem(key, JSON.stringify(session));
  }, { key: AUTH_STORAGE_KEY, session: PATIENT_SESSION });

  const page = await context.newPage();
  monitorBrowserIssues(page, browserIssues);

  await page.goto("/search?q=tim");
  await expect(page.getByRole("heading", { name: "Tìm đúng điểm bắt đầu cho nhu cầu chăm sóc" })).toBeVisible();
  await expect(page.getByText("Có phiên đăng nhập")).toBeVisible();

  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Có phiên đăng nhập")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tìm đúng điểm bắt đầu cho nhu cầu chăm sóc" })).toBeVisible();

  expect(browserIssues).toEqual([]);
});
