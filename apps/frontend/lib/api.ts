import {
  TimeSlot,
  HoldSlotPayload,
  HoldSlotResult,
  ConfirmAppointmentPayload,
  AppointmentDetails,
} from "../types/hospital";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080/api/v1";

// ── API Fetchers ──────────────────────────────────────────────────────────────
export async function fetchDoctorSlots(
  doctorId: string,
  branchId: string,
  date: string
): Promise<TimeSlot[]> {
  const query = new URLSearchParams({ date, branchId });
  const res = await fetch(
    `${API_BASE_URL}/appointments/doctors/${encodeURIComponent(doctorId)}/slots?${query.toString()}`,
    { cache: "no-store" }
  );
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || "Không thể tải lịch khám cho cơ sở đã chọn. Vui lòng thử lại."
    );
  }

  const data: unknown = await res.json();
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
    throw new Error("API lịch khám chưa trả về branchId; không thể xác nhận đúng cơ sở.");
  }
  if (slots.some((slot) => slot.branchId !== branchId)) {
    throw new Error("Lịch khám trả về không thuộc cơ sở đang chọn. Vui lòng tải lại.");
  }
  return slots as TimeSlot[];
}

export async function holdAppointmentSlot(
  payload: HoldSlotPayload
): Promise<HoldSlotResult> {
  const res = await fetch(`${API_BASE_URL}/appointments/hold`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message ||
        "Khung giờ khám này vừa có người đặt hoặc đang được giữ chỗ. Vui lòng chọn khung giờ khác."
    );
  }

  return await res.json();
}

export async function confirmAppointment(
  payload: ConfirmAppointmentPayload
): Promise<AppointmentDetails> {
  const res = await fetch(`${API_BASE_URL}/appointments/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Mã OTP không chính xác hoặc đã hết hạn.");
  }

  return await res.json();
}
