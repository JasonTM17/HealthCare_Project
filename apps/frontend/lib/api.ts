import type {
  TimeSlot,
  HoldSlotPayload,
  HoldSlotResult,
  ConfirmAppointmentPayload,
  AppointmentDetails,
} from "../types/hospital";
import { ILLUSTRATIVE_BOOKING_NOTICE, isIllustrativeSelection } from "./catalogue-illustration";

// Keep booking traffic on the same-origin Next.js rewrite.  A public runtime
// API-base override would bypass the Vercel proxy and create a second CORS
// and credential boundary.
const API_BASE_URL = "/api/v1";
// Raised to 28_000ms to align with API_REQUEST_TIMEOUT_MS (28s) and exceed BFF (25s) / Render cold starts.
const BOOKING_REQUEST_TIMEOUT_MS = 28_000;

const VIETNAMESE_TEXT = /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i;

async function fetchBookingApi(
  url: string,
  init: RequestInit,
  networkMessage: string,
): Promise<Response> {
  const timeoutController = new AbortController();
  const callerSignal = init.signal;
  const forwardCallerAbort = (): void => timeoutController.abort();

  if (callerSignal?.aborted) {
    forwardCallerAbort();
  } else {
    callerSignal?.addEventListener("abort", forwardCallerAbort, { once: true });
  }

  const timeoutId = setTimeout(
    () => timeoutController.abort(),
    BOOKING_REQUEST_TIMEOUT_MS,
  );

  try {
    return await fetch(url, { ...init, signal: timeoutController.signal });
  } catch (error) {
    if (callerSignal?.aborted) throw error;
    throw new Error(networkMessage);
  } finally {
    clearTimeout(timeoutId);
    callerSignal?.removeEventListener("abort", forwardCallerAbort);
  }
}

async function bookingErrorMessage(response: Response, fallback: string): Promise<string> {
  if (response.status >= 500) return fallback;

  const errorData: unknown = await response.json().catch(() => null);
  if (!errorData || typeof errorData !== "object" || !("message" in errorData)) return fallback;
  const message = (errorData as { message?: unknown }).message;
  if (typeof message !== "string") return fallback;

  const normalized = message.trim();
  return normalized.length > 0 && normalized.length <= 240 && VIETNAMESE_TEXT.test(normalized)
    ? normalized
    : fallback;
}

async function parseBookingResponse<T>(response: Response, fallback: string): Promise<T> {
  try {
    return await response.json() as T;
  } catch {
    throw new Error(fallback);
  }
}

// ── API Fetchers ──────────────────────────────────────────────────────────────
export async function fetchDoctorSlots(
  doctorId: string,
  branchId: string,
  date: string,
  signal?: AbortSignal,
): Promise<TimeSlot[]> {
  const query = new URLSearchParams({ date, branchId });
  const res = await fetchBookingApi(
    `${API_BASE_URL}/appointments/doctors/${encodeURIComponent(doctorId)}/slots?${query.toString()}`,
    { cache: "no-store", signal },
    "Không thể kết nối với hệ thống lịch khám. Vui lòng thử lại sau.",
  );
  if (!res.ok) {
    throw new Error(await bookingErrorMessage(
      res,
      "Chưa thể tải lịch khám cho cơ sở đã chọn. Vui lòng thử lại sau.",
    ));
  }

  const data = await parseBookingResponse<unknown>(
    res,
    "Dữ liệu lịch khám chưa đầy đủ. Vui lòng thử lại sau.",
  );
  if (!Array.isArray(data)) {
    throw new Error("Dữ liệu lịch khám không đúng định dạng.");
  }
  if (data.length === 0) return [];

  const slots = data as Partial<TimeSlot>[];
  if (slots.some((slot) => (
    typeof slot.branchId !== "string" ||
    typeof slot.startTime !== "string" ||
    typeof slot.endTime !== "string" ||
    typeof slot.available !== "boolean" ||
    typeof slot.statusNote !== "string"
  ))) {
    throw new Error("Dữ liệu khung giờ chưa đầy đủ. Vui lòng thử lại sau.");
  }
  if (slots.some((slot) => slot.branchId !== branchId)) {
    throw new Error("Lịch khám trả về không thuộc cơ sở đang chọn. Vui lòng tải lại.");
  }
  return slots as TimeSlot[];
}

/**
 * Thrown when the slot is already held or booked. Carrying the status lets the
 * wizard attribute the conflict to the patient's own previous hold instead of
 * blaming another patient unconditionally.
 */
export class HoldSlotConflictError extends Error {
  readonly status = 409;

  constructor(message: string) {
    super(message);
    this.name = "HoldSlotConflictError";
  }
}

/**
 * A hold intent is one patient attempting the identical hold again (same
 * doctor, branch, date, slot, package, and contact identity). The key must be
 * deterministic per intent: when an abandoned attempt left a live hold behind,
 * re-holding the same slot replays one key instead of minting a second live
 * hold. Two independent 32-bit hash lanes give 64 bits synchronously, so no
 * Web Crypto and no server round trip is needed to mint it.
 */
function holdIdempotencyKey(payload: HoldSlotPayload): string {
  const identity = [
    payload.doctorId,
    payload.branchId,
    payload.appointmentDate,
    payload.startTime,
    payload.specialtyId ?? "",
    payload.packageId ?? "",
    String(payload.phone ?? "").trim().toLowerCase(),
    String(payload.email ?? "").trim().toLowerCase(),
  ].join("\u0000");

  let laneA = 0x811c9dc5;
  let laneB = 0x811c9dc5;
  for (let index = 0; index < identity.length; index += 1) {
    const code = identity.charCodeAt(index);
    laneA = Math.imul(laneA ^ code, 0x01000193) >>> 0;
    laneB = Math.imul(laneB + code, 0x85ebca6b) >>> 0;
  }
  // The endpoint accepts 8–128 characters of `[A-Za-z0-9._:-]`; the guard keeps
  // that contract explicit. An empty key only drops replay protection.
  const key = `hold.${laneA.toString(16).padStart(8, "0")}${laneB.toString(16).padStart(8, "0")}`;
  return /^[A-Za-z0-9._:-]{8,128}$/.test(key) ? key : "";
}

export async function holdAppointmentSlot(
  payload: HoldSlotPayload
): Promise<HoldSlotResult> {
  if (isIllustrativeSelection(payload)) throw new Error(ILLUSTRATIVE_BOOKING_NOTICE);
  const requestUrl = `${API_BASE_URL}/appointments/hold`;
  // One key per hold intent (stable across calls for the same payload), reused
  // by the retry below: a lost 502/504 response must replay the original hold
  // instead of creating a second one, and a re-held abandoned attempt must not
  // mint a second live hold behind the same intent.
  const idempotencyKey = holdIdempotencyKey(payload);
  const requestInit: RequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify(payload),
  };
  const networkMessage = "Không thể kết nối với hệ thống đặt lịch. Khung giờ chưa được giữ; vui lòng thử lại.";

  let res: Response | undefined;
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      res = await fetchBookingApi(requestUrl, requestInit, networkMessage);
      // Retry once if upstream gateway timed out during Render Free cold start (502, 503, 504)
      if (attempt === 0 && (res.status === 502 || res.status === 503 || res.status === 504)) {
        continue;
      }
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
      // Do not retry caller-initiated aborts
      if (error instanceof Error && error.name === "AbortError") {
        throw error;
      }
      // Automatic 1-time retry on network abort / cold-start timeout
      if (attempt === 1) {
        throw error;
      }
    }
  }

  if (!res) {
    throw (lastError instanceof Error ? lastError : new Error(networkMessage));
  }

  if (!res.ok) {
    const message = await bookingErrorMessage(
      res,
      res.status === 409
        ? "Khung giờ này vừa được giữ hoặc đã có người đặt. Vui lòng chọn khung giờ khác."
        : "Chưa thể giữ khung giờ này. Vui lòng kiểm tra thông tin và thử lại.",
    );
    if (res.status === 409) throw new HoldSlotConflictError(message);
    throw new Error(message);
  }

  return parseBookingResponse<HoldSlotResult>(
    res,
    "Hệ thống chưa trả về mã giữ chỗ. Vui lòng thử lại.",
  );
}

export async function confirmAppointment(
  payload: ConfirmAppointmentPayload
): Promise<AppointmentDetails> {
  const res = await fetchBookingApi(
    `${API_BASE_URL}/appointments/confirm`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Không thể kết nối với hệ thống xác nhận. Lịch khám chưa được xác nhận; vui lòng thử lại.",
  );

  if (!res.ok) {
    throw new Error(await bookingErrorMessage(
      res,
      // A 5xx (Render Free cold starts included) is not a wrong-OTP answer;
      // telling the user their code failed makes them re-request OTP while
      // the real problem is a transient outage.
      res.status >= 500
        ? "Hệ thống xác nhận đang bận hoặc khởi động lại. Vui lòng thử lại sau ít phút; mã OTP vẫn còn hiệu lực theo thời gian giữ chỗ."
        : "Mã OTP không chính xác, đã hết hạn hoặc chưa thể xác nhận.",
    ));
  }

  return parseBookingResponse<AppointmentDetails>(
    res,
    "Hệ thống chưa trả về phiếu khám. Vui lòng thử tra cứu lại lịch hẹn.",
  );
}
