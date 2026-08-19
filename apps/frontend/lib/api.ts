import {
  TimeSlot,
  HoldSlotPayload,
  HoldSlotResult,
  ConfirmAppointmentPayload,
  AppointmentDetails,
} from "../types/hospital";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080/api/v1";
const BOOKING_REQUEST_TIMEOUT_MS = 12_000;

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
  } catch {
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
  date: string
): Promise<TimeSlot[]> {
  const query = new URLSearchParams({ date, branchId });
  const res = await fetchBookingApi(
    `${API_BASE_URL}/appointments/doctors/${encodeURIComponent(doctorId)}/slots?${query.toString()}`,
    { cache: "no-store" },
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

export async function holdAppointmentSlot(
  payload: HoldSlotPayload
): Promise<HoldSlotResult> {
  const res = await fetchBookingApi(
    `${API_BASE_URL}/appointments/hold`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Không thể kết nối với hệ thống đặt lịch. Khung giờ chưa được giữ; vui lòng thử lại.",
  );

  if (!res.ok) {
    throw new Error(await bookingErrorMessage(
      res,
      res.status === 409
        ? "Khung giờ này vừa được người khác chọn. Vui lòng chọn khung giờ khác."
        : "Chưa thể giữ khung giờ này. Vui lòng kiểm tra thông tin và thử lại.",
    ));
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
      "Mã OTP không chính xác, đã hết hạn hoặc chưa thể xác nhận.",
    ));
  }

  return parseBookingResponse<AppointmentDetails>(
    res,
    "Hệ thống chưa trả về phiếu khám. Vui lòng thử tra cứu lại lịch hẹn.",
  );
}
