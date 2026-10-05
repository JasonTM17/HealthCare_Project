import { expect, test } from "@playwright/test";
import { businessDate } from "../../lib/business-time";
import type {
  AppointmentDetails,
  BankTransferPayment,
  Branch,
  Doctor,
  MedicalRecord,
  Specialty,
  TimeSlot,
} from "../../types/hospital";

/**
 * Live Compose clinical + payment-reject evidence — the two role journeys the
 * test-evidence audit flagged as uncovered:
 *
 *   A) same-day booking → doctor check-in → in-progress → medical record with
 *      prescription → appointment COMPLETED → patient sees the record →
 *      VISIT_SUMMARY PDF generates and streams real bytes.
 *   B) patient bank-transfer submit → PENDING_VERIFICATION → admin REJECT
 *      with reason → patient re-reads REJECTED + rejectionReason.
 *
 * Same env contract as live-compose-lifecycle.spec.ts — no mocks.
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
const DEMO_ADMIN_EMAIL = "admin@healthcare.local";

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

/**
 * Same-day slot — CHECKED_IN / IN_PROGRESS transitions are gated on the
 * appointment date being TODAY, so this journey cannot borrow a future slot.
 * Fails loudly with a BLOCKED marker when the demo doctor has no same-day
 * availability left, rather than silently skipping the oracle.
 */
async function findBookableSameDaySelection(doctorSession: BrowserSession): Promise<BookableDemoSlot> {
  const demoDoctor = await resolveDemoDoctor();
  const doctorProfile = await apiJson<Doctor>("/doctor/profile", {}, doctorSession);
  const allBranches = (await apiJson<PageEnvelope<Branch>>("/hospital/branches?size=100")).content;
  const doctorBranchIds = doctorProfile.branchIds?.length
    ? doctorProfile.branchIds
    : doctorProfile.branchId
      ? [doctorProfile.branchId]
      : [];
  const candidateBranches = allBranches.filter((item) => doctorBranchIds.includes(item.id));
  const date = businessDate(0);

  // The public slot list is per-branch; the hold layer denies any candidate
  // whose [start,end) interval OVERLAPS an active appointment at ANY branch
  // (PENDING_CONFIRMATION with live hold, CONFIRMED, CHECKED_IN, IN_PROGRESS).
  // Exclude overlapping intervals up-front so the selection survives the
  // transactional guard.
  const todaysAppointments = await apiJson<PageEnvelope<AppointmentDetails>>(
    `/doctor/appointments?date=${encodeURIComponent(date)}&page=0&size=100`,
    {},
    doctorSession,
  );
  const OCCUPYING_STATUSES = new Set(["PENDING_CONFIRMATION", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS"]);
  const occupiedIntervals = todaysAppointments.content
    .filter((item) => OCCUPYING_STATUSES.has(item.status) && item.startTime && item.endTime)
    .map((item) => ({ start: item.startTime!, end: item.endTime! }));

  for (const branch of candidateBranches.length ? candidateBranches : [demoDoctor.branch]) {
    const query = new URLSearchParams({ date, branchId: branch.id });
    const slots = await apiJson<TimeSlot[]>(
      `/appointments/doctors/${encodeURIComponent(demoDoctor.doctor.id)}/slots?${query.toString()}`,
    );
    const slot = slots.find(
      (item) => item.available
        && item.branchId === branch.id
        && !occupiedIntervals.some(
          (occupied) => item.startTime < occupied.end && item.endTime > occupied.start,
        ),
    );
    if (slot) {
      return { ...demoDoctor, branch, date, slot };
    }
  }
  throw new Error(
    `BLOCKED_SAME_DAY_CLINICAL_FIXTURE: no available slot for ${demoDoctor.doctor.fullName} `
    + `at any branch on ${date}.`,
  );
}

/**
 * Future-day bookable slot for the payment journeys. Same-day slots are a
 * scarce fixture reserved for the clinical test (its CHECKED_IN transition is
 * today-gated), so payment scans start at offset 1 — payment submission has
 * no same-day requirement.
 */
async function findBookableSelection(): Promise<BookableDemoSlot> {
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
  throw new Error(`No bookable slot found for ${demoDoctor.doctor.fullName} in the next 21 days.`);
}

async function holdSlot(
  selection: BookableDemoSlot,
  reasonForVisit: string,
  session?: BrowserSession,
): Promise<string> {
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
        reasonForVisit,
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

test(
  "live doctor journey: check-in → in-progress → medical record → COMPLETED → patient record + VISIT_SUMMARY PDF",
  async () => {
    test.setTimeout(180_000);
    const patientSession = await loginApi(DEMO_PATIENT.email);
    const doctorSession = await loginApi(DEMO_DOCTOR_EMAIL);
    const doctorProfile = await apiJson<Doctor>("/doctor/profile", {}, doctorSession);
    const patientProfile = await apiJson<{ id: string }>("/patient/profile", {}, patientSession);

    const selection = await findBookableSameDaySelection(doctorSession);

    // ── hold → real Mailpit OTP → confirm ───────────────────────────────
    const bookingCode = await holdSlot(
      selection,
      "Live Compose clinical E2E: khám và lập bệnh án trong ngày.",
      patientSession,
    );
    const confirmed = await confirmBooking(bookingCode);
    expect(confirmed.status).toBe("CONFIRMED");
    const appointmentId = confirmed.id;

    // ── doctor journey: CONFIRMED → CHECKED_IN → IN_PROGRESS ───────────
    const checkedIn = await apiJson<AppointmentDetails>(
      `/doctor/appointments/${encodeURIComponent(appointmentId)}/status`,
      { method: "PATCH", body: JSON.stringify({ status: "CHECKED_IN" }) },
      doctorSession,
    );
    expect(checkedIn.status).toBe("CHECKED_IN");

    const inProgress = await apiJson<AppointmentDetails>(
      `/doctor/appointments/${encodeURIComponent(appointmentId)}/status`,
      { method: "PATCH", body: JSON.stringify({ status: "IN_PROGRESS" }) },
      doctorSession,
    );
    expect(inProgress.status).toBe("IN_PROGRESS");

    // ── medical record with an immediate prescription → COMPLETED ──────
    const record = await apiJson<MedicalRecord & { id: string }>(
      "/clinical/records",
      {
        method: "POST",
        body: JSON.stringify({
          appointmentId,
          patientId: patientProfile.id,
          doctorId: doctorProfile.id,
          diagnosis: "Viêm họng cấp - Live Compose clinical E2E",
          symptomsSummary: "Đau họng, sốt nhẹ 2 ngày.",
          bloodPressureSystolic: 120,
          bloodPressureDiastolic: 80,
          heartRate: 78,
          temperature: 37.5,
          treatmentPlan: "Điều trị nội khoa, tái khám sau 3 ngày nếu không đỡ.",
          doctorNotes: "Bệnh nhân tỉnh, hợp tác.",
          prescriptionItems: [
            {
              medicationName: "Paracetamol",
              activeIngredient: "Paracetamol",
              dosage: "500mg",
              unit: "viên",
              frequency: "Sáng và tối, sau ăn",
              durationDays: 3,
              totalQuantity: 6,
              usageNote: "Không quá 4 viên/ngày.",
            },
          ],
          prescriptionAdvice: "Uống đủ liều, nghỉ ngơi nhiều.",
        }),
      },
      doctorSession,
    );
    expect(record.id).toBeTruthy();

    // Record creation is the terminal clinical act: the appointment must
    // flip to COMPLETED on BOTH portal views.
    const doctorList = await apiJson<PageEnvelope<AppointmentDetails>>(
      `/doctor/appointments?date=${encodeURIComponent(selection.date)}&page=0&size=50`,
      {},
      doctorSession,
    );
    const doctorView = doctorList.content.find((item) => item.bookingCode === bookingCode);
    expect(doctorView, "appointment must stay on the doctor list").toBeTruthy();
    expect(doctorView!.status).toBe("COMPLETED");

    const patientView = await apiJson<AppointmentDetails>(
      `/appointments/${encodeURIComponent(bookingCode)}?phone=${encodeURIComponent(DEMO_PATIENT.phone)}`,
      {},
      patientSession,
    );
    expect(patientView.status).toBe("COMPLETED");

    // ── patient sees the authored record ────────────────────────────────
    const records = await apiJson<MedicalRecord[]>("/patient/medical-records", {}, patientSession);
    const authored = records.find((item) => item.id === record.id);
    expect(authored, "patient must see the just-authored medical record").toBeTruthy();
    expect(authored!.diagnosis).toContain("Viêm họng cấp");

    // ── VISIT_SUMMARY PDF: generate + stream real bytes via the owner ──
    const document = await apiJson<{ id: string; sha256?: string }>(
      `/patients/${encodeURIComponent(patientProfile.id)}/documents`,
      {
        method: "POST",
        body: JSON.stringify({ sourceType: "VISIT_SUMMARY", sourceRecordId: record.id }),
      },
      patientSession,
    );
    expect(document.id).toBeTruthy();

    const pdfResponse = await fetch(
      apiUrl(`/patients/${encodeURIComponent(patientProfile.id)}/documents/${encodeURIComponent(document.id)}/download`),
      { headers: buildApiHeaders({}, patientSession) },
    );
    expect(pdfResponse.ok, "VISIT_SUMMARY download must succeed for the owner patient").toBeTruthy();
    const pdfBytes = Buffer.from(await pdfResponse.arrayBuffer());
    expect(pdfBytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdfBytes.length).toBeGreaterThan(1_000);
    expect(document.sha256, "backend must return the issued sha256").toBeTruthy();
    const { createHash } = await import("node:crypto");
    expect(createHash("sha256").update(pdfBytes).digest("hex")).toBe(document.sha256);
  },
);

test(
  "live payment reject journey: submit → PENDING_VERIFICATION → admin REJECT → patient sees REJECTED + reason",
  async () => {
    test.setTimeout(120_000);
    const patientSession = await loginApi(DEMO_PATIENT.email);
    const adminSession = await loginApi(DEMO_ADMIN_EMAIL);

    const selection = await findBookableSelection();

    // ── hold → OTP → confirm ────────────────────────────────────────────
    const bookingCode = await holdSlot(
      selection,
      "Live Compose payment-reject E2E: kiểm tra luồng từ chối chuyển khoản.",
      patientSession,
    );
    const confirmed = await confirmBooking(bookingCode);
    const appointmentId = confirmed.id;

    // ── patient submits a bank-transfer reference (stable idempotency) ──
    const reference = `LIVE-REJECT-${bookingCode}`;
    const idempotencyKey = `apt-${appointmentId}-${reference}`.slice(0, 100);
    const submitted = await apiJson<BankTransferPayment>(
      `/patient/appointments/${encodeURIComponent(appointmentId)}/payment/submit`,
      {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ transactionReference: reference }),
      },
      patientSession,
    );
    expect(submitted.status).toBe("PENDING_VERIFICATION");
    const paymentId = submitted.id;

    // ── admin rejects with a reason ─────────────────────────────────────
    const reviewed = await apiJson<BankTransferPayment>(
      `/admin/payments/${encodeURIComponent(paymentId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ decision: "REJECT", reason: "Nội dung CK không khớp - live E2E reject" }),
      },
      adminSession,
    );
    expect(reviewed.status).toBe("REJECTED");

    // ── patient re-reads: REJECTED + the exact reason must round-trip ──
    const reread = await apiJson<BankTransferPayment>(
      `/patient/appointments/${encodeURIComponent(appointmentId)}/payment`,
      {},
      patientSession,
    );
    expect(reread.status).toBe("REJECTED");
    expect(reread.rejectionReason).toContain("không khớp");
  },
);

test(
  "live payment refund journey: submit → admin APPROVE → owner cancel → REFUND_PENDING → admin refund → REFUNDED",
  async () => {
    test.setTimeout(120_000);
    const patientSession = await loginApi(DEMO_PATIENT.email);
    const adminSession = await loginApi(DEMO_ADMIN_EMAIL);

    const selection = await findBookableSelection();
    const bookingCode = await holdSlot(
      selection,
      "Live Compose payment-refund E2E: hoàn tiền sau hủy lịch.",
      patientSession,
    );
    const confirmed = await confirmBooking(bookingCode);
    const appointmentId = confirmed.id;

    // ── submit → admin approves → PAID ──────────────────────────────────
    const reference = `LIVE-REFUND-${bookingCode}`;
    const idempotencyKey = `apt-${appointmentId}-${reference}`.slice(0, 100);
    const submitted = await apiJson<BankTransferPayment>(
      `/patient/appointments/${encodeURIComponent(appointmentId)}/payment/submit`,
      {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ transactionReference: reference }),
      },
      patientSession,
    );
    expect(submitted.status).toBe("PENDING_VERIFICATION");
    const paymentId = submitted.id;
    const approved = await apiJson<BankTransferPayment>(
      `/admin/payments/${encodeURIComponent(paymentId)}`,
      { method: "PATCH", body: JSON.stringify({ decision: "VERIFY" }) },
      adminSession,
    );
    expect(approved.status).toBe("PAID");

    // ── owner cancels the PAID appointment → refund queue ───────────────
    const cancelled = await apiJson<AppointmentDetails>(
      `/appointments/${encodeURIComponent(bookingCode)}/cancel`,
      { method: "POST", body: JSON.stringify({ reason: "Live Compose refund E2E." }) },
      patientSession,
    );
    expect(cancelled.status).toBe("CANCELLED");

    const pendingRefund = await apiJson<BankTransferPayment>(
      `/patient/appointments/${encodeURIComponent(appointmentId)}/payment`,
      {},
      patientSession,
    );
    expect(
      pendingRefund.status,
      "cancelling a PAID appointment must queue REFUND_PENDING",
    ).toBe("REFUND_PENDING");

    // ── admin issues the refund → terminal REFUNDED ─────────────────────
    const refunded = await apiJson<BankTransferPayment>(
      `/admin/payments/${encodeURIComponent(paymentId)}/refund`,
      { method: "PATCH", body: JSON.stringify({ refundReference: `LIVE-RF-${bookingCode}` }) },
      adminSession,
    );
    expect(refunded.status).toBe("REFUNDED");

    const finalRead = await apiJson<BankTransferPayment>(
      `/patient/appointments/${encodeURIComponent(appointmentId)}/payment`,
      {},
      patientSession,
    );
    expect(finalRead.status).toBe("REFUNDED");
  },
);
