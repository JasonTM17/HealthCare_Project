import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { businessDate } from "../../lib/business-time";
import type {
  AppointmentDetails,
  AuthSession,
  Branch,
  Doctor,
  Specialty,
  TimeSlot,
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

type BookableDemoSlot = {
  branch: Branch;
  date: string;
  doctor: Doctor;
  slot: TimeSlot;
  specialty: Specialty;
};

const API_BASE_URL = process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:8080/api/v1";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const API_TIMEOUT_MS = 12_000;
const DEMO_PASSWORD = "LocalDemo!2026";
const DEMO_OTP = "123456";
const DEMO_PATIENT = {
  email: "patient@healthcare.local",
  name: "Bệnh nhân Local",
  phone: "0900000001",
};
const DEMO_DOCTOR_EMAIL = "doctor@healthcare.local";
const DEMO_ADMIN_EMAIL = "admin@healthcare.local";
const HYDRATION_ERROR_PATTERN = /hydration|hydration failed|text content does not match|minified react error|react has detected/i;

function apiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function appUrl(path: string): string {
  return new URL(path, BASE_URL).toString();
}

async function apiJson<T>(
  path: string,
  init: RequestInit = {},
  session?: AuthSession,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  const headers = new Headers(init.headers);

  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (session) {
    headers.set("Authorization", `${session.tokenType} ${session.accessToken}`);
  }

  let response: Response | null = null;
  try {
    response = await fetch(apiUrl(path), {
      ...init,
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Live Compose API is not reachable at ${API_BASE_URL}. ` +
        `Start the stack from docs/LOCAL_RUNBOOK.md, then retry. Cause: ${error.message}`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response) {
    throw new Error(`Live Compose API did not return a response for ${path}.`);
  }

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Live API ${path} returned ${response.status}: ${text.slice(0, 400)}`);
  }
  return (text ? JSON.parse(text) : undefined) as T;
}

async function loginApi(email: string): Promise<AuthSession> {
  return apiJson<AuthSession>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password: DEMO_PASSWORD }),
  });
}

function monitorPageForBrowserIssues(page: Page, browserIssues: string[]): void {
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

async function newMonitoredPage(context: BrowserContext, browserIssues: string[]): Promise<Page> {
  const page = await context.newPage();
  monitorPageForBrowserIssues(page, browserIssues);
  return page;
}

async function cleanupLiveAppointment(bookingCode: string): Promise<void> {
  const cancelled = await apiJson<AppointmentDetails>(
    `/appointments/${encodeURIComponent(bookingCode)}/cancel`,
    {
      method: "POST",
      body: JSON.stringify({
        phone: DEMO_PATIENT.phone,
        reason: "Live Compose E2E cleanup after portal assertions.",
      }),
    },
  );

  if (cancelled.status !== "CANCELLED") {
    throw new Error(`Cleanup for ${bookingCode} left the appointment in status ${cancelled.status}.`);
  }
}

async function resolveDemoDoctor(): Promise<{ branch: Branch; doctor: Doctor; specialty: Specialty }> {
  const doctorSession = await loginApi(DEMO_DOCTOR_EMAIL);
  const doctorProfile = await apiJson<Doctor>("/doctor/profile", {}, doctorSession);
  const [doctors, branches, specialties] = await Promise.all([
    apiJson<PageEnvelope<Doctor>>("/hospital/doctors?size=100"),
    apiJson<PageEnvelope<Branch>>("/hospital/branches?size=100"),
    apiJson<PageEnvelope<Specialty>>("/hospital/specialties?size=100"),
  ]);
  const doctor = doctors.content.find((item) => item.id === doctorProfile.id);

  if (!doctor) {
    throw new Error(`Doctor profile ${doctorProfile.id} is not present in the public doctor catalog.`);
  }

  const branchIds = doctor.branchIds?.length
    ? doctor.branchIds
    : doctor.branchId
      ? [doctor.branchId]
      : [];
  const branch = branches.content.find((item) => branchIds.includes(item.id));
  const specialty = specialties.content.find((item) => doctor.specialtySlugs?.includes(item.slug))
    ?? specialties.content.find((item) => item.name === doctor.specialtyName);

  if (!branch) {
    throw new Error(`Demo doctor ${doctor.fullName} is not linked to an active public branch.`);
  }
  if (!specialty) {
    throw new Error(`Demo doctor ${doctor.fullName} is not linked to an active public specialty.`);
  }

  return { branch, doctor, specialty };
}

async function findBookableSlot(): Promise<BookableDemoSlot> {
  const demoDoctor = await resolveDemoDoctor();

  for (let offset = 1; offset <= 21; offset += 1) {
    const date = businessDate(offset);
    const query = new URLSearchParams({ date, branchId: demoDoctor.branch.id });
    const slots = await apiJson<TimeSlot[]>(
      `/appointments/doctors/${encodeURIComponent(demoDoctor.doctor.id)}/slots?${query.toString()}`,
    );
    const slot = slots.find((item) => item.available && item.branchId === demoDoctor.branch.id);
    if (slot) {
      return { ...demoDoctor, date, slot };
    }
  }

  throw new Error(`No bookable UI-compatible slot was found for ${demoDoctor.doctor.fullName} in the next 21 days.`);
}

async function loginViaUi(page: Page, email: string, nextPath: string, expectedHeading: RegExp | string): Promise<void> {
  await page.goto(appUrl("/"));
  const accountLink = page.locator("a.nav-account-link").first();
  await expect(accountLink).toBeVisible();
  await accountLink.click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mật khẩu").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  if (nextPath !== "/") {
    await expect(page).toHaveURL(new RegExp(nextPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  await expect(page.getByRole("heading", { name: expectedHeading })).toBeVisible();
}

async function bookAppointmentThroughPublicUi(page: Page, selection: BookableDemoSlot): Promise<AppointmentDetails> {
  await page.goto(appUrl("/"));
  await page.locator("button.button--nav").first().click();
  const bookingDialog = page.getByRole("dialog", { name: "Đặt lịch trực tuyến nhanh chóng" });
  await expect(bookingDialog).toBeVisible();
  await expect(bookingDialog.getByRole("heading", { name: "Bạn muốn được hỗ trợ ở chuyên khoa nào?" })).toBeVisible();

  await bookingDialog.getByLabel("Chuyên khoa").selectOption(selection.specialty.id);
  await bookingDialog.getByRole("button", { name: /Tiếp tục: Chọn cơ sở/ }).click();
  await bookingDialog.getByLabel("Cơ sở bệnh viện / phòng khám").selectOption(selection.branch.id);
  await bookingDialog.getByRole("button", { name: /Tiếp tục: Chọn bác sĩ/ }).click();
  await bookingDialog.getByLabel("Bác sĩ chuyên gia").selectOption(selection.doctor.id);
  await bookingDialog.getByRole("button", { name: /Tiếp tục: Chọn ngày/ }).click();
  await bookingDialog.getByLabel("Ngày khám mong muốn").fill(selection.date);
  await bookingDialog.getByRole("button", { name: /Xem khung giờ/ }).click();

  await bookingDialog.getByRole("button", { name: new RegExp(`^${selection.slot.startTime.slice(0, 5)}\\b`) }).click();
  await bookingDialog.getByRole("button", { name: /Tiếp tục: Điền thông tin/ }).click();

  await bookingDialog.getByLabel(/Họ và tên bệnh nhân/).fill(DEMO_PATIENT.name);
  await bookingDialog.getByLabel(/Số điện thoại liên hệ/).fill(DEMO_PATIENT.phone);
  await bookingDialog.getByLabel("Địa chỉ Email (Nhận phiếu khám)").fill(DEMO_PATIENT.email);
  await bookingDialog.getByLabel("Triệu chứng hoặc lý do khám bệnh").fill("Live Compose browser E2E: đau đầu và chóng mặt.");

  const holdResponse = page.waitForResponse((response) => (
    response.url().includes("/api/v1/appointments/hold") &&
    response.request().method() === "POST"
  ));
  await bookingDialog.getByRole("button", { name: /Giữ chỗ và nhận mã OTP/ }).click();
  const hold = await holdResponse;
  if (!hold.ok()) {
    throw new Error(`Hold request failed: ${await hold.text()}`);
  }

  const confirmResponse = page.waitForResponse((response) => (
    response.url().includes("/api/v1/appointments/confirm") &&
    response.request().method() === "POST"
  ));
  await bookingDialog.getByLabel("Nhập mã OTP 6 số xác thực").fill(DEMO_OTP);
  await bookingDialog.getByRole("button", { name: "Hoàn tất đặt lịch khám" }).click();
  const confirmed = await confirmResponse;
  if (!confirmed.ok()) {
    throw new Error(`Confirm request failed: ${await confirmed.text()}`);
  }
  const appointment = await confirmed.json() as AppointmentDetails;

  await expect(bookingDialog.getByRole("heading", { name: "Đặt lịch khám thành công!" })).toBeVisible();
  await expect(bookingDialog.getByText(appointment.bookingCode)).toBeVisible();
  return appointment;
}

async function expectPatientCanSeeAppointment(page: Page, bookingCode: string): Promise<void> {
  await expect(page.getByRole("heading", { name: /Xin chào/ })).toBeVisible();
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.locator("#appointments")).toContainText(bookingCode);
  await expect(page.locator("#notifications")).toContainText(bookingCode);
  await expect(page.locator("#notifications")).toContainText("Lịch hẹn đã xác nhận");
}

async function expectDoctorCanSeeAppointment(
  browser: Browser,
  bookingCode: string,
  date: string,
  browserIssues: string[],
): Promise<void> {
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await newMonitoredPage(context, browserIssues);
  try {
    await loginViaUi(page, DEMO_DOCTOR_EMAIL, "/doctor/dashboard", "Không gian làm việc lâm sàng");
    await page.getByLabel("Ngày xem lịch").fill(date);
    await page.getByRole("button", { name: "Tải lịch" }).click();
    await expect(page.locator("#daily-appointments")).toContainText(bookingCode);
    await expect(page.locator(".portal-appointment").filter({ hasText: bookingCode })).toContainText("Đã xác nhận");
  } finally {
    await context.close();
  }
}

async function expectAdminCanSeeAppointment(
  browser: Browser,
  bookingCode: string,
  date: string,
  browserIssues: string[],
): Promise<void> {
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await newMonitoredPage(context, browserIssues);
  try {
    await loginViaUi(page, DEMO_ADMIN_EMAIL, "/admin", "Quản trị bệnh viện");
    await page.getByRole("navigation", { name: "Điều hướng quản trị" }).getByRole("link", { name: "Lịch hẹn" }).click();
    await expect(page.getByRole("heading", { name: "Danh sách lịch hẹn" })).toBeVisible();
    await page.getByLabel("Ngày khám").fill(date);
    await page.getByRole("button", { name: "Lọc" }).click();
    const appointmentRow = page.getByRole("row").filter({ hasText: bookingCode });
    await expect(appointmentRow).toBeVisible();
    await expect(appointmentRow).toContainText("CONFIRMED");
  } finally {
    await context.close();
  }
}

test.describe("live Compose role-based demo", () => {
  test.describe.configure({ timeout: 300_000 });

  test("books through the public UI and appears in patient, doctor, and admin portals", async ({ browser }) => {
    const selection = await findBookableSlot();
    const browserIssues: string[] = [];
    const bookingContext = await browser.newContext({ baseURL: BASE_URL });
    const bookingPage = await newMonitoredPage(bookingContext, browserIssues);
    const patientContext = await browser.newContext({ baseURL: BASE_URL });
    const patientPage = await newMonitoredPage(patientContext, browserIssues);
    let bookingCode: string | undefined;

    try {
      await loginViaUi(patientPage, DEMO_PATIENT.email, "/patient/dashboard", /Xin chào/);
      const appointment = await bookAppointmentThroughPublicUi(bookingPage, selection);
      bookingCode = appointment.bookingCode;

      await expectPatientCanSeeAppointment(patientPage, bookingCode);
      await expectDoctorCanSeeAppointment(browser, bookingCode, selection.date, browserIssues);
      await expectAdminCanSeeAppointment(browser, bookingCode, selection.date, browserIssues);
      await cleanupLiveAppointment(bookingCode);
      bookingCode = undefined;
      expect(browserIssues).toEqual([]);
    } finally {
      if (bookingCode) {
        await cleanupLiveAppointment(bookingCode).catch(() => undefined);
      }
      await bookingPage.context().close();
      await patientPage.context().close();
    }
  });
});
