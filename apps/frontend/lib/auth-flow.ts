import { ApiError } from "./api-client";
import { presentApiError } from "./present-api-error";

export type AuthFieldName =
  | "displayName"
  | "phone"
  | "email"
  | "password"
  | "confirmPassword"
  | "code"
  | "token";

export type AuthFieldErrors = Partial<Record<AuthFieldName, string>>;

const FIELD_ALIASES: Record<string, AuthFieldName> = {
  display_name: "displayName",
  fullName: "displayName",
  phoneNumber: "phone",
  newPassword: "password",
  confirm_password: "confirmPassword",
  verificationCode: "code",
  resetToken: "token",
};

const FIELD_ERROR_COPY: Record<AuthFieldName, string> = {
  displayName: "Vui lòng kiểm tra lại họ tên.",
  phone: "Vui lòng kiểm tra lại số điện thoại.",
  email: "Vui lòng kiểm tra lại địa chỉ email.",
  password: "Mật khẩu chưa đáp ứng yêu cầu bảo mật.",
  confirmPassword: "Mật khẩu xác nhận chưa khớp.",
  code: "Mã xác minh chưa hợp lệ.",
  token: "Mã xác minh chưa hợp lệ hoặc đã hết hạn.",
};

export function authFieldErrors(error: unknown): AuthFieldErrors {
  if (!(error instanceof ApiError)) return {};

  return Object.fromEntries(
    Object.keys(error.fieldErrors).flatMap((key) => {
      const field = FIELD_ALIASES[key] ?? (key as AuthFieldName);
      return Object.hasOwn(FIELD_ERROR_COPY, field) ? [[field, FIELD_ERROR_COPY[field]]] : [];
    }),
  );
}

export function maskEmail(email: string): string {
  const [localPart, domain] = email.trim().split("@", 2);
  if (!localPart || !domain) return "email đã đăng ký";
  const maskedLocal = localPart.length <= 2
    ? `${localPart.slice(0, 1)}*`
    : `${localPart[0]}${"*".repeat(Math.max(2, localPart.length - 2))}${localPart.at(-1)}`;
  return `${maskedLocal}@${domain}`;
}

export function authErrorMessage(error: unknown, fallback: string): string {
  const isApi = error instanceof ApiError || (typeof error === "object" && error !== null && "status" in error && typeof (error as { status: unknown }).status === "number");
  if (!isApi) {
    if (typeof window !== "undefined" && typeof navigator !== "undefined" && !navigator.onLine) {
      return "Thiết bị đang ngoại tuyến. Vui lòng kiểm tra lại kết nối mạng của bạn.";
    }
    return "Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau ít phút.";
  }
  const apiError = error as ApiError;
  if (apiError.status === 0) {
    return "Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau ít phút.";
  }
  if (apiError.status === 408 || apiError.code === "REQUEST_TIMEOUT") {
    return "Máy chủ phản hồi chậm hoặc đang khởi động. Vui lòng thử lại sau ít giây.";
  }
  if (apiError.code === "OTP_RESEND_THROTTLED") return "Mã mới vừa được gửi. Vui lòng chờ một lát rồi thử lại.";
  if (apiError.code === "OTP_EXPIRED") return "Mã đã hết hạn. Hãy yêu cầu gửi lại mã mới.";
  if (apiError.code === "OTP_ATTEMPTS_EXCEEDED") return "Bạn đã nhập sai quá số lần cho phép. Hãy yêu cầu mã mới.";
  if (apiError.code === "EMAIL_DELIVERY_UNAVAILABLE") return "Email chưa thể được gửi lúc này. Vui lòng thử lại sau.";
  if (apiError.status === 429) return "Bạn đang thao tác quá nhanh. Vui lòng chờ một lát rồi thử lại.";
  if (apiError.status >= 500) {
    return "Dịch vụ xác thực hiện chưa sẵn sàng hoặc máy chủ đang khởi động. Vui lòng thử lại sau ít phút.";
  }
  if (apiError.status === 401) {
    return fallback || "Email hoặc mật khẩu chưa chính xác. Vui lòng kiểm tra lại.";
  }
  if (apiError.status === 403) {
    return "Tài khoản của bạn không có quyền truy cập hoặc đã bị tạm khóa.";
  }
  if (apiError.status === 400 || apiError.status === 409 || apiError.status === 422) {
    return "Thông tin chưa hợp lệ hoặc đã được sử dụng. Vui lòng kiểm tra và thử lại.";
  }
  return presentApiError(apiError.code, apiError.status);
}

export function safeAuthNextPath(value: string | null): string | null {
  if (!value || value.length > 2_048 || !value.startsWith("/") || value.startsWith("//")) return null;
  let decoded = value;
  try {
    for (let pass = 0; pass < 2 && decoded.includes("%"); pass += 1) {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
  } catch {
    return null;
  }
  if (!decoded.startsWith("/") || decoded.startsWith("//") || /[\\\u0000-\u001f\u007f]/u.test(decoded)) {
    return null;
  }
  return value;
}
