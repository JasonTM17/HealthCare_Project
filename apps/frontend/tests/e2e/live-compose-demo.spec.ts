import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { businessDate } from "../../lib/business-time";
import type { CmsContent, CmsContentHistoryEntry } from "../../lib/cms-client";
import type {
  AppointmentDetails,
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
// Keep the default aligned with BFF_PUBLIC_ORIGIN. The BFF's Secure __Host-
// cookies are intentionally host-bound and are not retained by Chromium when
// the suite silently mixes 127.0.0.1 with localhost.
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const MAILPIT_API_URL = process.env.PLAYWRIGHT_MAILPIT_API_URL ?? "http://127.0.0.1:8025";
// The disposable Compose profile keeps the Spring API behind the same
// server-to-server credential used by the Next.js BFF. Direct live-test API
// calls may present that credential through the process environment without
// ever storing it in the repository or browser.
const BFF_SERVICE_TOKEN = process.env.PLAYWRIGHT_BFF_SERVICE_TOKEN?.trim() ?? "";
const API_REQUESTS_BYPASS_BFF = new URL(API_BASE_URL).origin !== new URL(BASE_URL).origin;
const API_TIMEOUT_MS = 12_000;
// V58 realigns every `*.healthcare.local` demo account to this credential; the
// V56 hash is no longer what the live database accepts.
// The .local compose personas are seeded by db/seed/seed-local-data.sql,
// which pins a compose-specific password distinct from the hosted .com demo.
const DEMO_PASSWORD = "LocalDemo!2026";
const DEMO_PATIENT = {
  email: "patient@healthcare.local",
  name: "Bệnh nhân Local",
  phone: "0900000001",
};
const DEMO_DOCTOR_EMAIL = "doctor@healthcare.local";
const DEMO_ADMIN_EMAIL = "admin@healthcare.local";
const HYDRATION_ERROR_PATTERN = /hydration|hydration failed|text content does not match|minified react error|react has detected/i;

/**
 * Mirrors `PLACEHOLDER_HERO_COPY_PATTERN` in app/page.tsx. The homepage refuses
 * to render a hero payload matching it, so fixture-flavoured copy can never
 * reach a patient. The live test must therefore publish copy that provably
 * survives that guard, or the product would reject the test's own payload and
 * the assertion would be measuring nothing.
 */
const CMS_HERO_PLACEHOLDER_GUARD = /(?:Live Compose|Live CMS|demo|test)/i;

/**
 * The publish payload is authored here rather than derived from whatever the
 * database happens to hold. Deriving it by appending to the stored title (the
 * previous shape of this test) inherited ambient pollution — this local database
 * carries `Bệnh viện Đa khoa Quốc tế Realtime Test`, written by an earlier manual
 * action and re-persisted by the cleanup below — and the `test` substring made
 * the guard discard the payload, so the hero kept rendering the designed
 * composition and the publish assertion failed for a reason unrelated to CMS
 * round-tripping.
 *
 * Every field is set explicitly so no stored value can push the joined guard
 * source over the line. These strings are real clinical Vietnamese, are absent
 * from the repository's excluded default copy (`Đồng hành cùng sức khỏe gia
 * đình` and the two alternates, plus the long default body in `HomeHeroCopy`),
 * and are asserted against the guard below before the publish is attempted.
 */
const CMS_HERO_PUBLISH_PAYLOAD = {
  eyebrow: "Chủ động chăm sóc sức khỏe định kỳ",
  title: "Nâng cao chất lượng khám chữa bệnh cho người dân",
  body: "Đội ngũ bác sĩ chuyên khoa và hệ thống đặt lịch trực tuyến giúp bạn chọn đúng cơ sở phù hợp mà không phải chờ đợi tại quầy.",
  ctaLabel: "Đặt lịch khám",
  ctaHref: "/dat-lich",
};

function apiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function appUrl(path: string): string {
  return new URL(path, BASE_URL).toString();
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The slot's rendered text, used as the rollback oracle. The seeded default hero
 * deliberately reaches the DOM as the page's own three-line composition, so a
 * raw payload string is not what a visitor sees; comparing the visible text
 * before and after proves the round trip without asserting copy that the design
 * intentionally re-types.
 */
async function slotVisibleText(locator: Locator): Promise<string> {
  return (await locator.innerText()).trim();
}

function applyBffCredential(headers: Headers): void {
  // The same-origin Route Handler owns this reserved header. Only attach it
  // when a diagnostic run intentionally targets Spring directly.
  if (API_REQUESTS_BYPASS_BFF && BFF_SERVICE_TOKEN) {
    headers.set("X-Healthcare-Bff-Token", BFF_SERVICE_TOKEN);
    headers.set("X-Healthcare-Original-Origin", new URL(BASE_URL).origin);
  }
}

type MailpitMessage = {
  ID: string;
  Created: string;
  Subject: string;
  To: Array<{ Address: string }>;
};

type MailpitMessageDetail = {
  HTML?: string;
  Text?: string;
};

type ConsultationAttachment = {
  id: string;
  mimeType: string;
  sizeBytes: number;
  scanStatus: string;
  downloadUrl?: string | null;
  uploadStatus: string;
  uploadUrl?: string | null;
};

type ConsultationMessage = {
  id: string;
  body: string;
  status: string;
  attachments?: ConsultationAttachment[];
};

type ConsultationSummary = {
  id: string;
  appointmentId: string;
  status: string;
};

type CarePlan = {
  id: string;
  appointmentId: string;
  items: Array<{ id: string; status: string }>;
};

type BrowserSession = {
  cookieHeader: string;
  csrfToken: string;
};

async function waitForBookingOtp(bookingCode: string, recipient: string, issuedAfter: number): Promise<string> {
  const deadline = Date.now() + 20_000;
  let lastError: string | undefined;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${MAILPIT_API_URL}/api/v1/messages?limit=50`);
      if (!response.ok) {
        lastError = `Mailpit returned HTTP ${response.status}`;
      } else {
        const payload = await response.json() as { messages?: MailpitMessage[] };
        const messages = payload.messages?.filter((item) => (
          item.Subject === "[HealthCare] Xác nhận đặt lịch" &&
          item.To.some((address) => address.Address.toLowerCase() === recipient.toLowerCase()) &&
          Date.parse(item.Created) >= issuedAfter - 5_000
        )).sort((left, right) => Date.parse(right.Created) - Date.parse(left.Created)) ?? [];
        for (const message of messages) {
          const detailResponse = await fetch(
            `${MAILPIT_API_URL}/api/v1/message/${encodeURIComponent(message.ID)}`,
          );
          if (!detailResponse.ok) continue;
          const detail = await detailResponse.json() as MailpitMessageDetail;
          const content = `${detail.Text ?? ""}\n${detail.HTML ?? ""}`;
          const otp = content.match(/Mã xác minh của bạn là\s+(\d{6})\b/u)?.[1];
          if (otp) return otp;
        }
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `Booking OTP for ${bookingCode} was not captured from Mailpit at ${MAILPIT_API_URL}. ` +
    `Run the Compose E2E stack with Mailpit SMTP. Last error: ${lastError ?? "message not found"}`,
  );
}

async function apiJson<T>(
  path: string,
  init: RequestInit = {},
  session?: BrowserSession,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  const headers = new Headers(init.headers);

  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const method = (init.method ?? "GET").toUpperCase();
  if (!API_REQUESTS_BYPASS_BFF && !["GET", "HEAD", "OPTIONS"].includes(method)) {
    headers.set("Origin", new URL(API_BASE_URL).origin);
  }
  if (session) {
    headers.set("Cookie", session.cookieHeader);
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      headers.set("X-CSRF-Token", session.csrfToken);
    }
  }
  applyBffCredential(headers);

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

async function apiSse(
  path: string,
  init: RequestInit,
  session: BrowserSession,
): Promise<{ deltas: string[]; done: Record<string, unknown> }> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "text/event-stream");
  headers.set("Content-Type", "application/json");
  if (!API_REQUESTS_BYPASS_BFF) {
    headers.set("Origin", new URL(API_BASE_URL).origin);
  }
  headers.set("Cookie", session.cookieHeader);
  headers.set("X-CSRF-Token", session.csrfToken);
  applyBffCredential(headers);
  const response = await fetch(apiUrl(path), { ...init, headers });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Live SSE ${path} returned ${response.status}: ${text.slice(0, 400)}`);
  }

  const deltas: string[] = [];
  let done: Record<string, unknown> | null = null;
  for (const block of text.split(/\r?\n\r?\n/u)) {
    if (!block.trim()) continue;
    let eventName = "message";
    const data: string[] = [];
    for (const line of block.split(/\r?\n/u)) {
      if (line.startsWith("event:")) eventName = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^\s/u, ""));
    }
    const body = data.join("\n");
    if (eventName === "delta") deltas.push(body);
    if (eventName === "done" && body) done = JSON.parse(body) as Record<string, unknown>;
  }
  if (!done) throw new Error(`Live SSE ${path} did not return a done event.`);
  return { deltas, done };
}

async function loginApi(email: string): Promise<BrowserSession> {
  const headers = new Headers({
    Accept: "application/json",
    "Content-Type": "application/json",
  });
  applyBffCredential(headers);
  const response = await fetch(apiUrl("/auth/browser-sessions"), {
    method: "POST",
    headers,
    body: JSON.stringify({ grantType: "PASSWORD", email, password: DEMO_PASSWORD }),
  });
  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Live API /auth/browser-sessions returned ${response.status}: ${responseText.slice(0, 400)}`);
  }

  const headerValues = typeof (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === "function"
    ? (response.headers as Headers & { getSetCookie: () => string[] }).getSetCookie()
    : (response.headers.get("set-cookie") ?? "").split(/,(?=\s*__Host-)/u).filter(Boolean);
  const cookiePairs = headerValues
    .map((value) => value.split(";", 1)[0]?.trim())
    .filter((value): value is string => Boolean(value && value.includes("=")));
  const cookieHeader = cookiePairs.join("; ");
  const csrfToken = cookiePairs
    .find((value) => value.startsWith("__Host-healthcare_csrf="))
    ?.slice("__Host-healthcare_csrf=".length);
  if (!cookieHeader || !csrfToken) {
    throw new Error("Live API browser-session login did not return both security cookies.");
  }
  return { cookieHeader, csrfToken };
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

async function loadPublishedHomepageHero(): Promise<CmsContent> {
  return apiJson<CmsContent>("/cms/content/homepage.hero?afterEventId=0");
}

async function restorePublishedHomepageHero(initialHero: CmsContent): Promise<void> {
  const currentHero = await loadPublishedHomepageHero();
  if (
    currentHero.payload.title === initialHero.payload.title
    && currentHero.payload.body === initialHero.payload.body
  ) {
    return;
  }

  const adminSession = await loginApi(DEMO_ADMIN_EMAIL);
  const history = await apiJson<CmsContentHistoryEntry[]>(
    "/admin/cms/content/homepage.hero/history?limit=50",
    {},
    adminSession,
  );
  const target = history.find((entry) => (
    entry.rollbackAvailable
    && entry.version === initialHero.version
    && entry.payload?.title === initialHero.payload.title
    && entry.payload?.body === initialHero.payload.body
  ));
  if (!target) {
    throw new Error(`CMS cleanup could not find rollback snapshot for homepage.hero version ${initialHero.version}.`);
  }

  await apiJson<CmsContent>(
    "/admin/cms/content/homepage.hero/rollback",
    {
      method: "POST",
      body: JSON.stringify({
        changeId: target.eventId,
        expectedVersion: currentHero.version,
      }),
    },
    adminSession,
  );
}

function requireCmsText(value: string | undefined, label: string): string {
  if (!value) {
    throw new Error(`Missing live CMS ${label} for homepage.hero.`);
  }
  return value;
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
  // Exact matching: the password field's reveal toggle is labelled
  // "Hiện mật khẩu", which a substring `getByLabel("Mật khẩu")` also matches.
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  if (nextPath !== "/") {
    await expect(page).toHaveURL(new RegExp(escapeForRegExp(nextPath)));
  }
  await expect(page.getByRole("heading", { name: expectedHeading })).toBeVisible();
}

async function bookAppointmentThroughPublicUi(page: Page, selection: BookableDemoSlot): Promise<AppointmentDetails> {
  await page.goto(appUrl("/"));
  await expect(page.getByText(/\d+ cơ sở đang hiển thị/, { exact: true })).toBeVisible();
  await page.locator("button.button--nav").first().click();
  const bookingDialog = page.getByRole("dialog", { name: "Đặt lịch trực tuyến nhanh chóng" });
  await expect(bookingDialog).toBeVisible();
  await expect(bookingDialog.getByRole("heading", { name: "Bạn muốn được hỗ trợ ở chuyên khoa nào?" })).toBeVisible();

  await bookingDialog.getByLabel("Chuyên khoa").selectOption(selection.specialty.id);
  await bookingDialog.getByRole("button", { name: /Tiếp tục: Chọn cơ sở/ }).click();
  await bookingDialog.getByLabel("Cơ sở bệnh viện / phòng khám").selectOption(selection.branch.id);
  await bookingDialog.getByRole("button", { name: /Tiếp tục: Chọn bác sĩ/ }).click();
  const doctorSelect = bookingDialog.getByLabel("Bác sĩ chuyên gia");
  // The wizard only ever lists doctors for the specialty it currently holds, so a
  // missing option here means one of the selections was discarded on the way in.
  // Matching the option's own value asserts the exact doctor identity, and
  // asserting it before selecting turns that into a named 15s failure; without
  // it `selectOption` retried the same absent option until the whole test budget
  // was gone, and the bare timeout hid the cause.
  const wantedDoctorOption = doctorSelect.locator(`option[value="${selection.doctor.id}"]`);
  await expect(wantedDoctorOption,
    `the booking wizard does not offer ${selection.doctor.fullName} (${selection.specialty.name}) `
    + `at ${selection.branch.name}; the specialty and doctor selections were not preserved `
    + "across the wizard's filtered doctor load")
    .toHaveCount(1, { timeout: 15_000 });
  await doctorSelect.selectOption(selection.doctor.id);
  await bookingDialog.getByRole("button", { name: /Tiếp tục: Chọn ngày/ }).click();
  await bookingDialog.getByLabel("Ngày khám mong muốn").fill(selection.date);
  await bookingDialog.getByRole("button", { name: /Xem khung giờ/ }).click();

  await bookingDialog.getByRole("button", { name: new RegExp(`^${selection.slot.startTime.slice(0, 5)}\\b`) }).click();
  await bookingDialog.getByRole("button", { name: /Tiếp tục: Điền thông tin/ }).click();

  await bookingDialog.getByLabel(/Họ và tên bệnh nhân/).fill(DEMO_PATIENT.name);
  await bookingDialog.getByLabel(/Số điện thoại liên hệ/).fill(DEMO_PATIENT.phone);
  await bookingDialog.getByLabel(/Email nhận mã OTP/).fill(DEMO_PATIENT.email);
  await bookingDialog.getByLabel("Triệu chứng hoặc lý do khám bệnh").fill("Live Compose browser E2E: đau đầu và chóng mặt.");
  await bookingDialog.getByLabel(/Tôi đồng ý để HealthCare xử lý/).check();

  const holdIssuedAt = Date.now();
  const holdResponse = page.waitForResponse((response) => (
    response.url().includes("/api/v1/appointments/hold") &&
    response.request().method() === "POST"
  ));
  await bookingDialog.getByRole("button", { name: /Giữ chỗ và nhận mã OTP/ }).click();
  const hold = await holdResponse;
  if (!hold.ok()) {
    throw new Error(`Hold request failed: ${await hold.text()}`);
  }
  const holdPayload = await hold.json() as { bookingCode: string };
  const bookingOtp = await waitForBookingOtp(holdPayload.bookingCode, DEMO_PATIENT.email, holdIssuedAt);

  const confirmResponse = page.waitForResponse((response) => (
    response.url().includes("/api/v1/appointments/confirm") &&
    response.request().method() === "POST"
  ));
  await bookingDialog.getByLabel("Nhập mã OTP 6 số xác thực").fill(bookingOtp);
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

/**
 * Follow a patient-portal deep link the way a patient does after receiving a
 * notification, and leave the dashboard showing exactly that tab.
 *
 * The dashboard mounts one section per tab (`currentTab === "appointments"` and
 * friends), so a locator scoped to another tab's section cannot resolve. It also
 * resolves the tab from the URL hash on mount only: `goto` on a URL that differs
 * from the current one by its fragment alone is an in-page scroll, not a document
 * load, and would keep the data the dashboard fetched when the patient signed in
 * — which is older than anything booked afterwards. The reload is what makes
 * "the patient can see it" a real assertion instead of a stale-render accident.
 */
async function openPatientDashboardTab(page: Page, tab: "appointments" | "notifications"): Promise<void> {
  await page.goto(appUrl(`/patient/dashboard#${tab}`));
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.locator(`#${tab}`)).toBeVisible();
}

async function expectPatientCanSeeAppointment(page: Page, bookingCode: string): Promise<void> {
  await expect(page.getByRole("heading", { name: /Xin chào/ })).toBeVisible();
  await openPatientDashboardTab(page, "appointments");
  await expect(page.locator("#appointments")).toContainText(bookingCode);
  await openPatientDashboardTab(page, "notifications");
  await expect(page.locator("#notifications")).toContainText(bookingCode);
  await expect(page.locator("#notifications")).toContainText("Lịch hẹn đã xác nhận");
}

async function submitPaymentThroughPatientUi(page: Page, bookingCode: string): Promise<string> {
  await openPatientDashboardTab(page, "appointments");
  const appointmentCard = page.locator(".portal-appointment").filter({ hasText: bookingCode });
  await appointmentCard.getByRole("button", { name: new RegExp(`Thanh toán cho lịch ${bookingCode}`) }).click();

  const paymentPanel = page.getByRole("region", { name: "Thanh toán chuyển khoản" });
  await expect(paymentPanel.getByRole("heading", { name: `Thanh toán lịch ${bookingCode}` })).toBeVisible();
  await expect(paymentPanel.getByRole("img", { name: new RegExp(`VietQR.*${bookingCode}`) })).toBeVisible();
  await expect(paymentPanel.getByText("Nội dung chuyển khoản")).toBeVisible();
  await expect(paymentPanel.getByRole("button", { name: "Tải mã VietQR" })).toBeVisible();

  const reference = `E2E-${Date.now()}`;
  const submitResponse = page.waitForResponse((response) => (
    response.url().includes("/payment/submit") && response.request().method() === "POST"
  ));
  await paymentPanel.getByLabel("Mã giao dịch từ ứng dụng ngân hàng").fill(reference);
  await paymentPanel.getByRole("button", { name: "Tôi đã chuyển khoản" }).click();
  const submitted = await submitResponse;
  if (!submitted.ok()) {
    throw new Error(`Payment submission failed: ${await submitted.text()}`);
  }
  await expect(paymentPanel).toContainText("Đang chờ đối soát");
  await expect(appointmentCard).toContainText("Chờ đối soát");
  return reference;
}

/**
 * The simulated payment loop (HC-01, decision D-01) exercised in a real
 * browser.
 *
 * Payments are simulated: the platform has no money rails, the patient's
 * reported transfer only ever reaches `PENDING_VERIFICATION`, and an
 * administrator accepting it is the sole transition to `PAID`.
 * `admin@healthcare.local` is a synthetic demo principal and — because the
 * payment is simulated — the demo boundary lets it complete that review loop
 * exactly as a production operator would, so the hosted demo can demonstrate
 * the full journey end to end.
 */
async function expectDemoAdminPaymentApprovalSucceeds(
  browser: Browser,
  bookingCode: string,
  reference: string,
  browserIssues: string[],
): Promise<void> {
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await newMonitoredPage(context, browserIssues);
  try {
    await loginViaUi(page, DEMO_ADMIN_EMAIL, "/admin", "Điều hành bệnh viện");
    await page.goto(appUrl("/admin/payments"));
    await expect(page.getByRole("heading", { name: "Đối soát chuyển khoản" })).toBeVisible();
    const paymentRow = page.getByRole("row").filter({ hasText: bookingCode });
    await expect(paymentRow).toBeVisible();
    await expect(paymentRow).toContainText(reference);
    await expect(paymentRow).toContainText("Chờ đối soát");
    await paymentRow.getByRole("button", { name: "Duyệt thanh toán" }).click();
    // Confirmation is the in-page `ConfirmActionDialog`, not a native dialog, so
    // a `page.on("dialog")` handler would never fire and the row would sit
    // pending for an unrelated reason.
    const approveDialog = page.getByRole("dialog", { name: "Phê duyệt thanh toán" });
    await expect(approveDialog.getByText(bookingCode)).toBeVisible();
    const reviewResponse = page.waitForResponse((response) => (
      response.url().includes("/admin/payments/") && response.request().method() === "PATCH"
    ));
    await approveDialog.getByRole("button", { name: "Phê duyệt thanh toán" }).click();
    const approved = await reviewResponse;
    expect(approved.status()).toBe(200);
    await expect(approveDialog).toHaveCount(0);
    await expect(paymentRow).toContainText("Đã thanh toán");
  } finally {
    await context.close();
  }
}

async function expectPatientSeesConfirmedPayment(page: Page, bookingCode: string): Promise<void> {
  await openPatientDashboardTab(page, "appointments");
  const appointmentCard = page.locator(".portal-appointment").filter({ hasText: bookingCode });
  await expect(appointmentCard).toContainText("Đã thanh toán");
  await openPatientDashboardTab(page, "notifications");
  await expect(page.locator("#notifications")).toContainText("Thanh toán đã được xác nhận");
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
    await page.getByRole("button", { name: "Làm mới lịch" }).click();
    await expect(page.locator("#daily-appointments")).toContainText(bookingCode);
    await expect(page.locator(".portal-appointment").filter({ hasText: bookingCode })).toContainText("Đã xác nhận");
  } finally {
    await context.close();
  }
}

/**
 * Type the admin appointment date filter until the value reaches React state.
 *
 * The list route is streamed, so a `fill` that lands before the client attaches
 * its change handler is overwritten by the next controlled render: the input
 * reads back empty, "Lọc" then filters on nothing, and the row search fails far
 * from its cause. The "Xóa lọc" affordance only renders while the component
 * holds a draft filter, so seeing it is the proof the value got through.
 */
async function setAdminAppointmentDateFilter(page: Page, date: string): Promise<void> {
  await expect(async () => {
    await page.getByLabel("Ngày khám").fill(date);
    await expect(page.getByRole("button", { name: "Xóa lọc" })).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 20_000 });
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
    await loginViaUi(page, DEMO_ADMIN_EMAIL, "/admin", "Điều hành bệnh viện");
    await page.getByRole("navigation", { name: "Điều hướng quản trị" }).getByRole("link", { name: "Lịch hẹn" }).click();
    await expect(page.getByRole("heading", { name: "Danh sách lịch hẹn" })).toBeVisible();
    await setAdminAppointmentDateFilter(page, date);
    await page.getByRole("button", { name: "Lọc" }).click();
    const appointmentRow = page.getByRole("row").filter({ hasText: bookingCode });
    await expect(appointmentRow).toBeVisible();
    await expect(appointmentRow).toContainText("Đã xác nhận");
  } finally {
    await context.close();
  }
}

async function exercisePrivateChannels(appointment: AppointmentDetails): Promise<void> {
  const patientSession = await loginApi(DEMO_PATIENT.email);
  const doctorSession = await loginApi(DEMO_DOCTOR_EMAIL);
  const adminSession = await loginApi(DEMO_ADMIN_EMAIL);
  let consultationId: string | undefined;
  let conversationId: string | undefined;

  try {
    const consultation = await apiJson<ConsultationSummary>("/patient/consultations", {
      method: "POST",
      body: JSON.stringify({
        appointmentId: appointment.id,
        subject: "Theo dõi sau buổi khám synthetic",
        consentAccepted: true,
        consentVersion: "consultation-v1",
      }),
    }, patientSession);
    consultationId = consultation.id;
    expect(consultation.appointmentId).toBe(appointment.id);

    const patientMessage = await apiJson<ConsultationMessage>(
      `/patient/consultations/${consultationId}/messages`,
      {
        method: "POST",
        headers: { "Idempotency-Key": `compose-consultation-${appointment.id}` },
        body: JSON.stringify({ body: "Tôi muốn xác nhận hướng dẫn chuẩn bị sau buổi khám." }),
      },
      patientSession,
    );
    expect(patientMessage.status).toBe("SENT");

    const adminQueue = await apiJson<Array<Record<string, unknown>>>(
      "/admin/consultations/queue",
      {},
      adminSession,
    );
    const adminRow = adminQueue.find((row) => row.threadId === consultationId);
    expect(adminRow).toBeDefined();
    expect(Object.keys(adminRow ?? {})).not.toEqual(expect.arrayContaining([
      "subject", "body", "patientName", "email", "phone", "patientProfileId",
    ]));

    const doctorMessage = await apiJson<ConsultationMessage>(
      `/doctor/consultations/${consultationId}/messages`,
      {
        method: "POST",
        headers: { "Idempotency-Key": `compose-doctor-reply-${appointment.id}` },
        body: JSON.stringify({ body: "Bác sĩ đã nhận được câu hỏi và sẽ theo dõi trong cửa sổ tư vấn." }),
      },
      doctorSession,
    );
    expect(doctorMessage.status).toBe("SENT");
    await apiJson<void>(`/patient/consultations/${consultationId}/read`, {
      method: "POST",
      body: JSON.stringify({ throughMessageId: doctorMessage.id }),
    }, patientSession);

    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    );
    const sha256Hash = createHash("sha256").update(png).digest("hex");
    const attachmentIntentRequest = apiJson<ConsultationAttachment>(
      `/patient/consultations/${consultationId}/attachments/intents`,
      {
        method: "POST",
        body: JSON.stringify({
          messageId: patientMessage.id,
          mimeType: "image/png",
          sizeBytes: png.length,
          sha256Hash,
        }),
      },
      patientSession,
    );
    // Object storage plus the AV scanner is provisioned per deployment, and the
    // contract for an unprovisioned one is a fail-closed 503 — never a half-open
    // upload slot. Both branches are asserted here so a backend that loses its
    // storage configuration still says so out loud.
    const attachmentIntent: ConsultationAttachment | Error = await attachmentIntentRequest
      .catch((error: unknown) => error instanceof Error ? error : new Error(String(error)));
    if (attachmentIntent instanceof Error) {
      expect(attachmentIntent.message).toContain("returned 503");
      expect(attachmentIntent.message).toContain("CONSULTATION_ATTACHMENT_STORAGE_UNAVAILABLE");
      test.info().annotations.push({
        type: "notice",
        description: "Consultation attachments are not provisioned in this live environment: the fail-closed 503 "
          + "is asserted instead of the upload round trip. That round trip is covered by "
          + "ConsultationAttachmentIntegrationTest and ConsultationAttachmentScanWorkerTest.",
      });
    } else {
      const intent = attachmentIntent;
      expect(intent.uploadStatus).toBe("REQUESTED");
      expect(intent.uploadUrl).toBeTruthy();
      const uploadResponse = await fetch(intent.uploadUrl!, {
        method: "PUT",
        headers: { "Content-Type": "image/png", "Content-Length": String(png.length) },
        body: png,
      });
      expect(uploadResponse.ok).toBeTruthy();
      await apiJson<ConsultationAttachment>(
        `/patient/consultations/${consultationId}/attachments/${intent.id}/complete`,
        { method: "POST", body: "{}" },
        patientSession,
      );

      let scanned: ConsultationAttachment | undefined;
      const scanDeadline = Date.now() + 30_000;
      while (Date.now() < scanDeadline) {
        scanned = await apiJson<ConsultationAttachment>(
          `/patient/consultations/${consultationId}/attachments/${intent.id}`,
          {},
          patientSession,
        );
        if (scanned.scanStatus === "CLEAN" || scanned.scanStatus === "REJECTED") break;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      expect(scanned?.scanStatus).toBe("CLEAN");
      const patientDownload = await apiJson<ConsultationAttachment>(
        `/patient/consultations/${consultationId}/attachments/${intent.id}/download`,
        {},
        patientSession,
      );
      expect(patientDownload.downloadUrl).toMatch(/^https?:\/\//u);
      const downloaded = await fetch(patientDownload.downloadUrl!);
      expect(downloaded.ok).toBeTruthy();
      expect(Buffer.compare(Buffer.from(await downloaded.arrayBuffer()), png)).toBe(0);
      const doctorAttachment = await apiJson<ConsultationAttachment>(
        `/doctor/consultations/${consultationId}/attachments/${intent.id}`,
        {},
        doctorSession,
      );
      expect(doctorAttachment.scanStatus).toBe("CLEAN");
    }

    const carePlan = await apiJson<CarePlan>("/doctor/care-plans", {
      method: "POST",
      body: JSON.stringify({
        appointmentId: appointment.id,
        title: "Theo dõi sau khám",
        items: [{ goal: "Theo dõi triệu chứng trong 7 ngày", reminder: "Ghi nhận mỗi tối" }],
      }),
    }, doctorSession);
    expect(carePlan.appointmentId).toBe(appointment.id);
    expect(carePlan.items[0]?.status).toBe("OPEN");
    const patientPlans = await apiJson<CarePlan[]>("/patient/care-plans", {}, patientSession);
    expect(patientPlans.some((plan) => plan.id === carePlan.id)).toBeTruthy();

    const policy = await apiJson<{ policyVersion: string }>("/ai/chat-policy", {}, patientSession);
    const conversation = await apiJson<{ id: string }>("/ai/conversations", {
      method: "POST",
      body: JSON.stringify({ title: "Compose synthetic support", mode: "HOSPITAL_SUPPORT" }),
    }, patientSession);
    conversationId = conversation.id;
    await apiJson(`/ai/conversations/${conversationId}/consent`, {
      method: "PUT",
      body: JSON.stringify({ accepted: true, policyVersion: policy.policyVersion }),
    }, patientSession);
    const exchange = await apiJson<{
      assistantMessage: { status: string; safetyAction: string; suggestedActions: Array<{ href: string }> };
    }>(`/ai/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Idempotency-Key": `compose-chat-${appointment.id}` },
      body: JSON.stringify({ content: "Bệnh viện có những dịch vụ nào?" }),
    }, patientSession);
    expect(exchange.assistantMessage.status).toBe("COMPLETED");
    const streamed = await apiSse(
      `/ai/conversations/${conversationId}/messages/stream`,
      {
        method: "POST",
        headers: { "Idempotency-Key": `compose-stream-${appointment.id}` },
        body: JSON.stringify({ content: "Hãy tóm tắt cách đặt lịch khám." }),
      },
      patientSession,
    );
    const streamedExchange = streamed.done as {
      assistantMessage?: { status?: string; content?: string | null };
    };
    expect(streamedExchange.assistantMessage?.status).toBe("COMPLETED");
    expect(streamed.deltas.join("")).toBe(streamedExchange.assistantMessage?.content ?? "");
    const emergency = await apiJson<{
      assistantMessage: { safetyAction: string; suggestedActions: Array<{ href: string }> };
    }>(`/ai/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Idempotency-Key": `compose-emergency-${appointment.id}` },
      body: JSON.stringify({ content: "Tôi đang khó thở dữ dội, hãy gọi cấp cứu ngay." }),
    }, patientSession);
    expect(emergency.assistantMessage.safetyAction).toBe("EMERGENCY");
    expect(emergency.assistantMessage.suggestedActions.some((action) => action.href === "tel:115")).toBeTruthy();
  } finally {
    if (conversationId) {
      await apiJson(`/ai/conversations/${conversationId}`, { method: "DELETE" }, patientSession).catch(() => undefined);
    }
    if (consultationId) {
      await apiJson(`/patient/consultations/${consultationId}`, { method: "DELETE" }, patientSession).catch(() => undefined);
    }
  }
}

test.describe("live Compose role-based demo", () => {
  // Four authenticated roles cross several portals and round trips, so the
  // suite needs a long overall budget. That budget must not become the timeout
  // of every individual action: Playwright leaves `actionTimeout`/
  // `navigationTimeout` unset, which makes them fall back to the test timeout
  // and lets one stuck click or response waiter silently consume all 300s.
  // Restoring the shipped 30s default keeps the budget for real work and makes
  // a stalled step report as a stalled step.
  test.use({ actionTimeout: 30_000, navigationTimeout: 30_000 });
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
      const paymentReference = await submitPaymentThroughPatientUi(patientPage, bookingCode);
      await expectDemoAdminPaymentApprovalSucceeds(browser, bookingCode, paymentReference, browserIssues);
      await expectPatientSeesConfirmedPayment(patientPage, bookingCode);
      await exercisePrivateChannels(appointment);
      await expectDoctorCanSeeAppointment(browser, bookingCode, selection.date, browserIssues);
      await expectAdminCanSeeAppointment(browser, bookingCode, selection.date, browserIssues);
      await cleanupLiveAppointment(bookingCode);
      bookingCode = undefined;
      expect(browserIssues).toEqual([]);
    } finally {
      if (bookingCode) {
        await cleanupLiveAppointment(bookingCode).catch(() => undefined);
      }
      // Teardown must never replace the real failure. When the test times out,
      // Playwright has already torn the browser down and these closes reject
      // with "Target page, context or browser has been closed", which is what
      // the report showed instead of the step that hung. The worker recycles the
      // browser regardless, so a failed close is not a leak.
      await bookingPage.context().close().catch(() => undefined);
      await patientPage.context().close().catch(() => undefined);
    }
  });

  test("live CMS homepage hero publish and rollback update the public shell", async ({ browser }) => {
    const browserIssues: string[] = [];
    const initialHero = await loadPublishedHomepageHero();
    const initialTitle = requireCmsText(initialHero.payload.title, "title");
    const initialBody = requireCmsText(initialHero.payload.body, "body");
    const {
      eyebrow: updatedEyebrow,
      title: updatedTitle,
      body: updatedBody,
      ctaLabel: updatedCtaLabel,
      ctaHref: updatedCtaHref,
    } = CMS_HERO_PUBLISH_PAYLOAD;
    const publishedVersion = initialHero.version + 1;
    const rolledBackVersion = initialHero.version + 2;

    // Preconditions, asserted before anything is written: if the payload the
    // harness publishes could ever be mistaken for fixture copy, the product is
    // entitled to ignore it and the publish assertion below would be vacuous.
    const guardSource = Object.values(CMS_HERO_PUBLISH_PAYLOAD).join(" ");
    expect(CMS_HERO_PLACEHOLDER_GUARD.test(guardSource),
      `the harness publish payload must not match ${CMS_HERO_PLACEHOLDER_GUARD}`).toBe(false);
    expect(updatedTitle).not.toBe("Đồng hành cùng sức khỏe gia đình");
    expect(updatedTitle).not.toBe("Chăm sóc sức khỏe toàn diện cho cả gia đình bạn");
    expect(updatedTitle).not.toBe("Tìm chuyên khoa, bác sĩ và đặt lịch khám");

    const publicContext = await browser.newContext({ baseURL: BASE_URL });
    const adminContext = await browser.newContext({ baseURL: BASE_URL });
    const publicPage = await newMonitoredPage(publicContext, browserIssues);
    const adminPage = await newMonitoredPage(adminContext, browserIssues);
    let publicMainFrameNavigationsAfterLoad = 0;

    try {
      await publicPage.goto(appUrl("/"));
      const heroSlot = publicPage.locator('[data-cms-live-slot="hero"]');
      // Sample the shell only after the authoritative live read, so the baseline
      // is published content rather than the pre-hydration fallback.
      await expect(heroSlot).toHaveAttribute("data-cms-version", String(initialHero.version));
      await expect(heroSlot).toHaveAttribute("data-cms-live-source", "live-backend");
      const prePublishHero = await slotVisibleText(heroSlot);
      expect(prePublishHero).not.toContain("Đang tải nội dung live");
      expect(prePublishHero.length).toBeGreaterThan(0);
      publicPage.on("framenavigated", (frame) => {
        if (frame === publicPage.mainFrame()) publicMainFrameNavigationsAfterLoad += 1;
      });

      await loginViaUi(adminPage, DEMO_ADMIN_EMAIL, "/admin", "Điều hành bệnh viện");
      await adminPage.goto(appUrl("/admin/content"));
      await expect(adminPage.getByRole("heading", { name: "Chỉnh sửa một component theo slot" })).toBeVisible();
      await expect(adminPage.locator("#cms-payload-title")).toHaveValue(initialTitle);
      await expect(adminPage.locator("#cms-payload-body")).toHaveValue(initialBody);

      // Every guard-visible field is written, so no value left in the database
      // can decide the outcome of this run.
      await adminPage.locator("#cms-payload-eyebrow").fill(updatedEyebrow);
      await adminPage.locator("#cms-payload-title").fill(updatedTitle);
      await adminPage.locator("#cms-payload-body").fill(updatedBody);
      await adminPage.locator("#cms-payload-ctaLabel").fill(updatedCtaLabel);
      await adminPage.locator("#cms-payload-ctaHref").fill(updatedCtaHref);
      await adminPage.getByRole("button", { name: "Xuất bản" }).click();

      await expect(adminPage.getByText(`Đã xuất bản homepage.hero, version ${publishedVersion}.`)).toBeVisible();
      // Admin-authored copy must reach the patient shell verbatim, which is only
      // observable because the payload above is not placeholder-shaped.
      await expect(heroSlot).toContainText(updatedTitle);
      await expect(heroSlot).toContainText(updatedBody);
      await expect(heroSlot).toContainText(updatedEyebrow);
      await expect(heroSlot).toHaveAttribute("data-cms-version", String(publishedVersion));
      const rollbackTarget = adminPage.getByRole("listitem").filter({ hasText: `v${initialHero.version} ·` });
      await expect(rollbackTarget).toBeVisible();
      await expect(rollbackTarget.getByRole("button", { name: "Rollback snapshot" })).toBeEnabled();
      await rollbackTarget.getByRole("button", { name: "Rollback snapshot" }).click();

      await expect(adminPage.getByText(new RegExp(`Đã rollback homepage\\.hero về snapshot event #\\d+, version mới ${rolledBackVersion}\\.`, "u"))).toBeVisible();
      // The rollback must restore the shell byte-for-byte, which also proves the
      // pre-publish state was the live slot's own rendering and not a stale frame.
      await expect
        .poll(async () => await slotVisibleText(heroSlot), { timeout: 20_000 })
        .toBe(prePublishHero);
      await expect(heroSlot).not.toContainText(updatedTitle);
      await expect(heroSlot).not.toContainText(updatedBody);
      await expect(heroSlot).toHaveAttribute("data-cms-version", String(rolledBackVersion));

      expect(publicMainFrameNavigationsAfterLoad).toBe(0);
      expect(browserIssues).toEqual([]);
    } finally {
      await restorePublishedHomepageHero(initialHero);
      await adminPage.context().close();
      await publicPage.context().close();
    }
  });
});
