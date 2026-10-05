import { expect, test } from "@playwright/test";
import { businessDate } from "../../lib/business-time";
import type {
  AppointmentDetails,
  Branch,
  Doctor,
  Specialty,
  TimeSlot,
} from "../../types/hospital";

/**
 * Live Compose lifecycle evidence: the public hold/OTP/confirm chain, a real
 * reschedule, a double-booking negative, owner cancel, and doctor-side
 * visibility — all through the isolated local BFF and Mailpit, never mocks.
 *
 * Mirrors the harness in live-compose-demo.spec.ts (same env contract).
 */

type PageEnvelope<T> = {
  content: T[];
};

type BookableDemoSlot = {
  branch: Branch;
  date: string;
  doctor: Doctor;
  slot: TimeSlot;
  specialty: Specialty;
};

type BrowserSession = {
  cookieHeader: string;
  csrfToken: string;
};

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

const API_BASE_URL = process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:8080/api/v1";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const MAILPIT_API_URL = process.env.PLAYWRIGHT_MAILPIT_API_URL ?? "http://127.0.0.1:8025";
const BFF_SERVICE_TOKEN = process.env.PLAYWRIGHT_BFF_SERVICE_TOKEN?.trim() ?? "";
const API_REQUESTS_BYPASS_BFF = new URL(API_BASE_URL).origin !== new URL(BASE_URL).origin;
const API_TIMEOUT_MS = 12_000;
const DEMO_PASSWORD = "LocalDemo!2026";
const DEMO_PATIENT = {
  email: "patient@healthcare.local",
  name: "Bệnh nhân Local",
  phone: "0900000001",
};
const DEMO_DOCTOR_EMAIL = "doctor@healthcare.local";

function apiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function applyBffCredential(headers: Headers): void {
  if (API_REQUESTS_BYPASS_BFF && BFF_SERVICE_TOKEN) {
    headers.set("X-Healthcare-Bff-Token", BFF_SERVICE_TOKEN);
    headers.set("X-Healthcare-Original-Origin", new URL(BASE_URL).origin);
  }
}

function buildApiHeaders(init: RequestInit, session?: BrowserSession): Headers {
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
    if (API_REQUESTS_BYPASS_BFF && !["GET", "HEAD", "OPTIONS"].includes(method)) {
      headers.set("X-CSRF-Token", session.csrfToken);
    }
  }
  applyBffCredential(headers);
  return headers;
}

async function apiJson<T>(path: string, init: RequestInit = {}, session?: BrowserSession): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const response = await fetch(apiUrl(path), {
      ...init,
      headers: buildApiHeaders(init, session),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Live API ${path} returned ${response.status}: ${text.slice(0, 400)}`);
    }
    return (text ? JSON.parse(text) : undefined) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function apiStatus(
  path: string,
  init: RequestInit = {},
  session?: BrowserSession,
): Promise<{ status: number; body: string }> {
  const response = await fetch(apiUrl(path), { ...init, headers: buildApiHeaders(init, session) });
  return { status: response.status, body: await response.text() };
}

async function loginApi(email: string, password: string = DEMO_PASSWORD): Promise<BrowserSession> {
  const headers = new Headers({
    Accept: "application/json",
    "Content-Type": "application/json",
  });
  if (!API_REQUESTS_BYPASS_BFF) {
    headers.set("Origin", new URL(API_BASE_URL).origin);
  }
  applyBffCredential(headers);
  const response = await fetch(apiUrl("/auth/browser-sessions"), {
    method: "POST",
    headers,
    body: JSON.stringify({ grantType: "PASSWORD", email, password }),
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
          item.Subject === "[HealthCare] Xác nhận đặt lịch"
          && item.To.some((address) => address.Address.toLowerCase() === recipient.toLowerCase())
          && Date.parse(item.Created) >= issuedAfter - 5_000
        )).sort((left, right) => Date.parse(right.Created) - Date.parse(left.Created)) ?? [];
        for (const message of messages) {
          const detailResponse = await fetch(
            `${MAILPIT_API_URL}/api/v1/message/${encodeURIComponent(message.ID)}`,
          );
          if (!detailResponse.ok) continue;
          const detail = await detailResponse.json() as MailpitMessageDetail;
          const content = `${detail.Text ?? ""}\n${detail.HTML ?? ""}`;
          if (!content.includes(bookingCode)) continue;
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
  if (!branch || !specialty) {
    throw new Error(`Demo doctor ${doctor.fullName} is missing an active public branch or specialty.`);
  }
  return { branch, doctor, specialty };
}

async function findTwoBookableSlots(): Promise<{ selection: BookableDemoSlot; alternate: BookableDemoSlot }> {
  const demoDoctor = await resolveDemoDoctor();
  for (let offset = 1; offset <= 21; offset += 1) {
    const date = businessDate(offset);
    const query = new URLSearchParams({ date, branchId: demoDoctor.branch.id });
    const slots = await apiJson<TimeSlot[]>(
      `/appointments/doctors/${encodeURIComponent(demoDoctor.doctor.id)}/slots?${query.toString()}`,
    );
    const available = slots.filter((item) => item.available && item.branchId === demoDoctor.branch.id);
    if (available.length >= 2) {
      return {
        selection: { ...demoDoctor, date, slot: available[0] },
        alternate: { ...demoDoctor, date, slot: available[1] },
      };
    }
  }
  throw new Error(`No day with two bookable slots found for ${demoDoctor.doctor.fullName} in the next 21 days.`);
}

async function holdSlot(selection: BookableDemoSlot, session?: BrowserSession): Promise<string> {
  const hold = await apiJson<{ bookingCode: string }>(
    "/appointments/hold",
    {
      method: "POST",
      body: JSON.stringify({
        doctorId: selection.doctor.id,
        appointmentDate: selection.date,
        startTime: selection.slot.startTime,
        fullName: DEMO_PATIENT.name,
        phone: DEMO_PATIENT.phone,
        email: DEMO_PATIENT.email,
        reasonForVisit: "Live Compose lifecycle E2E: kiểm tra chuyển trạng thái lịch hẹn.",
        specialtyId: selection.specialty.id,
        branchId: selection.branch.id,
        privacyConsent: true,
      }),
    },
    session,
  );
  return hold.bookingCode;
}

async function confirmBooking(bookingCode: string): Promise<AppointmentDetails> {
  const issuedAfter = Date.now() - 60_000;
  const otp = await waitForBookingOtp(bookingCode, DEMO_PATIENT.email, issuedAfter);
  return apiJson<AppointmentDetails>("/appointments/confirm", {
    method: "POST",
    body: JSON.stringify({ bookingCode, otpCode: otp }),
  });
}

test("live appointment lifecycle: hold→OTP→confirm→reschedule→double-book deny→cancel→doctor sees it", async () => {
  test.setTimeout(120_000);
  const patientSession = await loginApi(DEMO_PATIENT.email);
  const doctorSession = await loginApi(DEMO_DOCTOR_EMAIL);

  const { selection, alternate } = await findTwoBookableSlots();

  // ── hold → OTP via real Mailpit → confirm ────────────────────────────
  const issuedAt = Date.now();
  const bookingCode = await holdSlot(selection, patientSession);
  expect(bookingCode).toBeTruthy();
  const otp = await waitForBookingOtp(bookingCode, DEMO_PATIENT.email, issuedAt);
  const confirmed = await apiJson<AppointmentDetails>("/appointments/confirm", {
    method: "POST",
    body: JSON.stringify({ bookingCode, otpCode: otp }),
  });
  expect(confirmed.status).not.toBe("CANCELLED");

  // ── slot occupancy: the taken start time must flip to unavailable ────
  const occupiedSlots = await apiJson<TimeSlot[]>(
    `/appointments/doctors/${encodeURIComponent(selection.doctor.id)}/slots?` +
    `date=${selection.date}&branchId=${selection.branch.id}`,
  );
  const takenSlot = occupiedSlots.find(
    (item) => item.startTime === selection.slot.startTime && item.branchId === selection.branch.id,
  );
  expect(takenSlot, "booked slot must remain visible in the public slot list").toBeTruthy();
  expect(takenSlot!.available).toBe(false);

  // ── double-book negative: a DIFFERENT guest identity must be denied ──
  // A distinct email/phone rules out a same-holder duplicate guard as the
  // deny reason — only slot occupancy can explain the rejection.
  const conflict = await apiStatus("/appointments/hold", {
    method: "POST",
    body: JSON.stringify({
      doctorId: selection.doctor.id,
      appointmentDate: selection.date,
      startTime: selection.slot.startTime,
      fullName: "Khách Kiểm Tra Lifecycle",
      phone: "0900000099",
      email: "lifecycle-probe@healthcare.local",
      reasonForVisit: "Live Compose lifecycle E2E: double-book probe.",
      specialtyId: selection.specialty.id,
      branchId: selection.branch.id,
      privacyConsent: true,
    }),
  });
  expect(conflict.status).toBe(409);
  // The denial must come from the slot-occupancy guard, not request validation:
  // the hold payload is valid, so a 4xx for any other reason (validation,
  // rate limit, auth) fails this oracle.
  expect(conflict.body).toMatch(/vừa có người đặt|đang được giữ chỗ|giữ chỗ/u);

  // ── reschedule to the alternate slot (authenticated owner) ──────────
  const rescheduled = await apiJson<AppointmentDetails>(
    `/appointments/${encodeURIComponent(bookingCode)}/reschedule`,
    {
      method: "POST",
      body: JSON.stringify({
        appointmentDate: alternate.date,
        startTime: alternate.slot.startTime,
        branchId: alternate.branch.id,
      }),
    },
    patientSession,
  );
  expect(rescheduled.appointmentDate?.startsWith(alternate.date)).toBeTruthy();
  expect(rescheduled.startTime?.startsWith(alternate.slot.startTime.slice(0, 5))).toBeTruthy();

  // ── doctor journey: the appointment is visible on the doctor's list ──
  const doctorList = await apiJson<PageEnvelope<AppointmentDetails>>(
    `/doctor/appointments?date=${encodeURIComponent(alternate.date)}&page=0&size=50`,
    {},
    doctorSession,
  );
  const doctorView = doctorList.content.find((item) => item.bookingCode === bookingCode);
  expect(doctorView, "appointment must appear in the doctor portal list").toBeTruthy();
  // The doctor-side view must reflect the rescheduled slot, proving it reads
  // the live appointment row rather than a stale projection.
  expect(doctorView!.appointmentDate?.startsWith(alternate.date)).toBeTruthy();
  expect(doctorView!.startTime?.startsWith(alternate.slot.startTime.slice(0, 5))).toBeTruthy();

  // Patient-side cross-check: the same appointment must carry this doctor's
  // id on the patient's own list — scoping the work to the right physician.
  const patientList = await apiJson<PageEnvelope<AppointmentDetails>>(
    "/patient/appointments?page=0&size=50",
    {},
    patientSession,
  );
  const patientView = patientList.content.find((item) => item.bookingCode === bookingCode);
  expect(patientView, "appointment must appear in the patient portal list").toBeTruthy();
  expect(patientView!.doctorId).toBe(selection.doctor.id);

  // ── owner cancel → terminal CANCELLED via public lookup ─────────────
  const cancelled = await apiJson<AppointmentDetails>(
    `/appointments/${encodeURIComponent(bookingCode)}/cancel`,
    { method: "POST", body: JSON.stringify({ reason: "Live Compose lifecycle E2E cleanup." }) },
    patientSession,
  );
  expect(cancelled.status).toBe("CANCELLED");

  const lookup = await apiJson<AppointmentDetails>(
    `/appointments/${encodeURIComponent(bookingCode)}?phone=${encodeURIComponent(DEMO_PATIENT.phone)}`,
  );
  expect(lookup.status).toBe("CANCELLED");
});
