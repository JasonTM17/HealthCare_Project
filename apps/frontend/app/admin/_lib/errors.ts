import { ApiError } from "../../../lib/api-client";

export interface AdminErrorCopy {
  title: string;
  description: string;
}

export interface AdminErrorOptions {
  /**
   * Let the server's own sentence lead a 400/422 instead of the generic
   * "check the required fields" copy. Opt in only from a call site whose
   * endpoint answers with operator-facing Vietnamese; most services answer a
   * bad request with technical English (`payload field must be a string: …`),
   * and that must keep being replaced rather than shown. Field details are
   * appended either way, so this never hides a rejected input.
   */
  preferServerMessage?: boolean;
}

/**
 * Vietnamese labels for the field keys the admin API validates. A key outside
 * this map is shown verbatim rather than dropped: an unmapped field name still
 * tells the operator which input the server rejected.
 */
const FIELD_LABELS: Record<string, string> = {
  name: "Tên",
  slug: "Đường dẫn",
  address: "Địa chỉ",
  phone: "Số điện thoại",
  email: "Email",
  fullName: "Họ và tên",
  password: "Mật khẩu",
  status: "Trạng thái",
  reason: "Lý do",
  doctorId: "Bác sĩ",
  branchId: "Cơ sở",
  specialtyId: "Chuyên khoa",
  dayOfWeek: "Thứ",
  startTime: "Giờ bắt đầu",
  endTime: "Giờ kết thúc",
  slotDurationMinutes: "Phút mỗi lượt",
  effectiveFrom: "Hiệu lực từ",
  effectiveTo: "Hiệu lực đến",
  active: "Đang mở lịch",
  exceptionDate: "Ngày ngoại lệ",
  type: "Loại ngoại lệ",
  customStartTime: "Giờ bắt đầu (giờ đặc biệt)",
  customEndTime: "Giờ kết thúc (giờ đặc biệt)",
};

/**
 * One line per field the server rejected. Not exported: it is the internal
 * detail that `describeAdminError` appends, and a caller that needs only the
 * fields still reads them off the `ApiError` it already holds.
 */
function describeAdminFieldErrors(error: unknown): string {
  if (!(error instanceof ApiError)) return "";
  const entries = Object.entries(error.fieldErrors);
  if (entries.length === 0) return "";
  return entries
    .map(([field, message]) => `${FIELD_LABELS[field] ?? field}: ${message}`)
    .join(" · ");
}

function getStatus(error: unknown): number | undefined {
  if (error instanceof ApiError) return error.status;
  if (!(error instanceof Error)) return undefined;
  const match = error.message.match(/(?:API\s+|mã\s+)(\d{3})/i);
  return match ? Number(match[1]) : undefined;
}

function getCode(error: unknown): string | null {
  return error instanceof ApiError ? error.code : null;
}

/** Server-side message kept verbatim, used when it is more specific than any fallback. */
function getServerMessage(error: unknown): string {
  if (error instanceof ApiError && error.message.trim()) return error.message.trim();
  return "";
}

function withFieldDetails(description: string, error: unknown): string {
  const fields = describeAdminFieldErrors(error);
  return fields ? `${description} ${fields}` : description;
}

export function describeAdminError(
  error: unknown,
  options: AdminErrorOptions = {},
): AdminErrorCopy {
  const status = getStatus(error);

  if (status === 401) {
    return {
      title: "Phiên đăng nhập đã hết hạn",
      description: "Hãy đăng nhập lại bằng tài khoản quản trị rồi thực hiện thao tác một lần nữa.",
    };
  }

  if (status === 403) {
    return {
      title: "Tài khoản không có quyền quản trị",
      description: "Tài khoản hiện tại không được phép xem hoặc thay đổi nội dung này.",
    };
  }

  if (status === 404) {
    return { title: "Không tìm thấy dữ liệu", description: "Bản ghi có thể đã được thay đổi hoặc không còn tồn tại." };
  }

  if (status === 409) {
    // A guard rejection carries its own counts and remedy ("Còn N lịch hẹn…").
    // Replacing it with the generic stale-data copy would hide the number the
    // operator needs to decide whether to retry with force.
    if (getCode(error) === "SCHEDULE_HAS_ACTIVE_BOOKINGS") {
      const serverMessage = getServerMessage(error);
      return {
        title: "Khung giờ còn lịch hẹn đang hoạt động",
        description: withFieldDetails(
          serverMessage || "Khung giờ này còn lịch hẹn đang hoạt động. Vui lòng xử lý các lịch hẹn trước khi thay đổi.",
          error,
        ),
      };
    }
    return {
      title: "Dữ liệu vừa được cập nhật",
      description: withFieldDetails("Hãy tải lại danh sách trước khi lưu thay đổi mới.", error),
    };
  }

  if (status === 400 || status === 422) {
    // Same shape as the 409 guard above: an opted-in call site gets the
    // server's own reason verbatim, because a refusal such as "clinical AI is
    // no longer metered per doctor" is exactly the sentence the operator has
    // to read to stop retrying.
    const serverMessage = options.preferServerMessage ? getServerMessage(error) : "";
    return {
      title: "Thông tin chưa hợp lệ",
      description: withFieldDetails(
        serverMessage || "Hãy kiểm tra các trường bắt buộc và thử lại.",
        error,
      ),
    };
  }

  if (status === 429) {
    return {
      title: "Có quá nhiều yêu cầu",
      description: "Vui lòng chờ một lát trước khi thao tác lại.",
    };
  }

  if (status !== undefined && status >= 500) {
    return { title: "Dịch vụ tạm thời không khả dụng", description: "Kết nối đang gián đoạn. Vui lòng thử lại sau ít phút." };
  }

  return {
    title: "Không thể hoàn tất thao tác",
    description: withFieldDetails(
      "Dịch vụ chưa trả về thông tin lỗi có thể hiển thị. Vui lòng thử lại.",
      error,
    ),
  };
}
