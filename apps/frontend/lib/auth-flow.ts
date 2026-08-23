import { ApiError } from "./api-client";

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

export function authFieldErrors(error: unknown): AuthFieldErrors {
  if (!(error instanceof ApiError)) return {};

  return Object.fromEntries(
    Object.entries(error.fieldErrors).flatMap(([key, message]) => {
      const field = FIELD_ALIASES[key] ?? (key as AuthFieldName);
      return message.trim() ? [[field, message.trim()]] : [];
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
  if (!(error instanceof ApiError)) return fallback;
  if (error.status === 0) return "Không thể kết nối đến hệ thống. Vui lòng thử lại sau.";
  if (error.code === "OTP_RESEND_THROTTLED") return "Mã mới vừa được gửi. Vui lòng chờ một lát rồi thử lại.";
  if (error.code === "OTP_EXPIRED") return "Mã đã hết hạn. Hãy yêu cầu gửi lại mã mới.";
  if (error.code === "OTP_ATTEMPTS_EXCEEDED") return "Bạn đã nhập sai quá số lần cho phép. Hãy yêu cầu mã mới.";
  if (error.code === "EMAIL_DELIVERY_UNAVAILABLE") return "Email chưa thể được gửi lúc này. Vui lòng thử lại sau.";
  if (error.status === 429) return "Bạn đang thao tác quá nhanh. Vui lòng chờ một lát rồi thử lại.";
  if (error.status >= 500) return "Dịch vụ xác thực hiện chưa sẵn sàng. Vui lòng thử lại sau.";
  if (error.status === 401 || error.status === 403) return "Yêu cầu chưa được chấp nhận. Vui lòng kiểm tra thông tin và thử lại.";
  if (error.status === 400 || error.status === 409 || error.status === 422) {
    return "Thông tin chưa hợp lệ hoặc đã được sử dụng. Vui lòng kiểm tra và thử lại.";
  }
  return error.message.trim() || fallback;
}

export function safeAuthNextPath(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}
