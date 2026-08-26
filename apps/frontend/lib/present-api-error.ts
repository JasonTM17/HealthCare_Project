const ERROR_COPY_BY_CODE = Object.freeze({
  AUTHENTICATION_FAILED: "Thông tin đăng nhập không hợp lệ. Vui lòng kiểm tra lại.",
  AUTHENTICATION_REQUIRED: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  FORBIDDEN_ROLE: "Bạn không có quyền thực hiện thao tác này.",
  RESOURCE_NOT_FOUND: "Nội dung này không còn tồn tại hoặc bạn không có quyền xem.",
  RATE_LIMIT_EXCEEDED: "Bạn đã gửi quá nhiều yêu cầu. Vui lòng chờ một lúc rồi thử lại.",
  OTP_RESEND_THROTTLED: "Mã OTP vừa được yêu cầu. Vui lòng chờ rồi thử lại.",
  OTP_EXPIRED: "Mã OTP đã hết hạn. Vui lòng gửi lại mã trong thời gian giữ chỗ.",
  EMAIL_DELIVERY_UNAVAILABLE: "Dịch vụ email đang tạm gián đoạn. Vui lòng thử lại sau.",
  VALIDATION_ERROR: "Thông tin chưa hợp lệ. Vui lòng kiểm tra lại các trường đã nhập.",

  AI_CONTENT_ALREADY_DECIDED: "Revision này đã được xử lý. Vui lòng tải lại hàng đợi.",
  AI_CONTENT_APPROVER_NOT_INDEPENDENT: "Nội dung phải được một bác sĩ độc lập duyệt.",
  AI_CONTENT_DECISION_INVALID: "Quyết định duyệt không hợp lệ. Vui lòng kiểm tra lại.",
  AI_CONTENT_HASH_INVALID: "Mã kiểm tra nội dung không hợp lệ. Vui lòng tải lại revision.",
  AI_CONTENT_NOT_SUBMITTED: "Nội dung chưa ở trạng thái chờ duyệt. Vui lòng tải lại.",
  AI_CONTENT_REASON_REQUIRED: "Vui lòng nhập lý do trước khi gửi quyết định.",
  AI_CONTENT_REVISION_NOT_FOUND: "Không tìm thấy revision này. Vui lòng tải lại hàng đợi.",
  AI_CONTENT_REVISION_INVALID: "Revision nội dung không hợp lệ. Vui lòng tải lại hàng đợi.",
  AI_CONTENT_REVISION_STALE: "Nội dung đã có phiên bản mới. Vui lòng tải lại trước khi tiếp tục.",
  AI_CONTENT_STATE_INVALID: "Trạng thái nội dung không còn phù hợp. Vui lòng tải lại.",
  AI_CONTENT_TYPE_INVALID: "Loại nội dung không được hỗ trợ.",

  CONSULTATION_ALREADY_EXISTS: "Lịch hẹn này đã có một kênh tư vấn.",
  CONSULTATION_APPOINTMENT_NOT_ELIGIBLE: "Lịch hẹn chưa đủ điều kiện mở kênh tư vấn.",
  CONSULTATION_ATTACHMENT_INVALID: "Tệp không đúng định dạng hoặc vượt quá giới hạn cho phép.",
  CONSULTATION_ATTACHMENT_STORAGE_UNAVAILABLE: "Kho tệp tư vấn đang tạm gián đoạn. Vui lòng thử lại sau.",
  CONSULTATION_CONSENT_REQUIRED: "Vui lòng đồng ý chính sách tư vấn hiện tại trước khi tiếp tục.",
  CONSULTATION_DOCTOR_UNAVAILABLE: "Bác sĩ được chọn hiện không thể nhận handoff.",
  CONSULTATION_IDEMPOTENCY_CONFLICT: "Yêu cầu gửi lại không còn khớp với thao tác ban đầu. Vui lòng tải lại kênh tư vấn.",
  CONSULTATION_NOT_FOUND: "Kênh tư vấn không còn tồn tại hoặc bạn không có quyền xem.",
  CONSULTATION_WINDOW_CLOSED: "Cửa sổ tư vấn đã kết thúc. Vui lòng liên hệ bệnh viện nếu cần hỗ trợ thêm.",

  HEALTH_QUESTION_ALREADY_DECIDED: "Câu trả lời này đã được xử lý. Vui lòng tải lại hàng đợi.",
  HEALTH_QUESTION_DECISION_INVALID: "Quyết định kiểm duyệt không hợp lệ.",
  HEALTH_QUESTION_NOT_FOUND: "Câu hỏi không còn tồn tại hoặc bạn không có quyền xem.",
  HEALTH_QUESTION_NOT_SUBMITTED: "Câu hỏi không còn ở trạng thái có thể xử lý. Vui lòng tải lại.",
  HEALTH_QUESTION_PII: "Nội dung hỏi đáp có thông tin nhận dạng. Vui lòng xóa email, số điện thoại hoặc CCCD rồi thử lại.",
  HEALTH_QUESTION_REASON_REQUIRED: "Vui lòng nhập lý do trước khi gửi quyết định.",
  HEALTH_QUESTION_REPORT_NOT_FOUND: "Báo cáo không còn tồn tại. Vui lòng tải lại.",
  HEALTH_QUESTION_REPORT_REASON_INVALID: "Lý do báo cáo không hợp lệ.",
  HEALTH_QUESTION_REPORT_RESOLUTION_INVALID: "Kết quả xử lý báo cáo không hợp lệ.",
  HEALTH_QUESTION_REPORT_RESOLUTION_REQUIRED: "Vui lòng chọn kết quả xử lý báo cáo.",
  HEALTH_QUESTION_REPORT_STATUS_INVALID: "Trạng thái báo cáo không hợp lệ.",
  HEALTH_QUESTION_SELF_APPROVAL: "Bác sĩ không thể tự duyệt câu trả lời của mình.",
  HEALTH_QUESTION_TOPIC_INVALID: "Chủ đề câu hỏi không hợp lệ. Chỉ dùng chữ thường, số và dấu gạch ngang.",
} as const);

const ERROR_COPY_BY_STATUS = Object.freeze({
  0: "Không thể kết nối đến hệ thống. Vui lòng kiểm tra mạng và thử lại.",
  400: "Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.",
  401: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  403: "Bạn không có quyền thực hiện thao tác này.",
  404: "Nội dung này không còn tồn tại hoặc bạn không có quyền xem.",
  408: "Yêu cầu mất quá nhiều thời gian. Vui lòng thử lại.",
  409: "Dữ liệu đã thay đổi. Vui lòng tải lại trước khi tiếp tục.",
  413: "Dữ liệu gửi lên vượt quá giới hạn cho phép.",
  415: "Định dạng dữ liệu không được hỗ trợ.",
  422: "Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.",
  428: "Vui lòng hoàn tất bước xác nhận bắt buộc trước khi tiếp tục.",
  429: "Bạn đã gửi quá nhiều yêu cầu. Vui lòng chờ một lúc rồi thử lại.",
  500: "Hệ thống đang tạm gián đoạn. Vui lòng thử lại sau.",
  502: "Hệ thống đang tạm gián đoạn. Vui lòng thử lại sau.",
  503: "Hệ thống đang tạm gián đoạn. Vui lòng thử lại sau.",
  504: "Hệ thống phản hồi quá chậm. Vui lòng thử lại sau.",
} as const);

const GENERIC_ERROR_COPY = "Chưa thể hoàn tất yêu cầu. Vui lòng thử lại.";

/**
 * Convert only a stable server code or HTTP status into code-owned Vietnamese
 * copy. Unknown input is never interpolated, so backend/provider messages,
 * internal URLs, stack traces and payload fragments cannot reach the UI.
 */
export function presentApiError(code?: unknown, status?: unknown): string {
  const normalizedCode = typeof code === "string" ? code.trim().toUpperCase() : "";
  if (normalizedCode && Object.hasOwn(ERROR_COPY_BY_CODE, normalizedCode)) {
    return ERROR_COPY_BY_CODE[normalizedCode as keyof typeof ERROR_COPY_BY_CODE];
  }

  if (typeof status === "number" && Number.isInteger(status)) {
    const statusKey = String(status);
    if (Object.hasOwn(ERROR_COPY_BY_STATUS, statusKey)) {
      return ERROR_COPY_BY_STATUS[status as keyof typeof ERROR_COPY_BY_STATUS];
    }
  }

  return GENERIC_ERROR_COPY;
}
