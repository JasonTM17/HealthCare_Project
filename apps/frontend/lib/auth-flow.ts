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

/** Only destinations belonging to the issued session's role are accepted. */
export function authSessionDestination(roles: readonly string[], next: string | null = null): string {
  const safeNext = safeAuthNextPath(next);
  const issued = new Set(roles.map((role) => role.replace(/^ROLE_/, "").toUpperCase()));
  const matched = ([
    ["PATIENT", "/patient", "/patient/dashboard"],
    ["DOCTOR", "/doctor", "/doctor/dashboard"],
    ["ADMIN", "/admin", "/admin"],
  ] as const).filter(([role]) => issued.has(role));
  if (matched.length === 0) return "/";
  if (safeNext) {
    const pathname = new URL(safeNext, "https://healthcare.test").pathname;
    if (matched.some(([, prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
      return safeNext;
    }
  }
  return matched[0][2];
}

export const REGISTRATION_PASSWORD_HELP = "Mật khẩu từ 8 đến 128 ký tự, gồm ít nhất một chữ cái và một chữ số.";

export function registrationPasswordError(password: string): string | null {
  const missing: string[] = [];
  if (password.length < 8 || password.length > 128) missing.push("từ 8 đến 128 ký tự");
  if (new TextEncoder().encode(password).length > 72) missing.push("tối đa 72 byte UTF-8");
  if (!/\p{L}/u.test(password)) missing.push("chữ cái");
  if (!/[0-9]/.test(password)) missing.push("chữ số");
  if (/[\r\n\u0085\u2028\u2029]/u.test(password)) missing.push("không chứa ký tự xuống dòng");
  return missing.length ? `Mật khẩu cần ${missing.join(", ")}.` : null;
}

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
  phone: "Số điện thoại chưa hợp lệ — dùng số bắt đầu bằng 0, gồm 8–15 chữ số (ví dụ 0901234567).",
  email: "Vui lòng kiểm tra lại địa chỉ email.",
  password: REGISTRATION_PASSWORD_HELP,
  confirmPassword: "Mật khẩu xác nhận chưa khớp.",
  code: "Mã xác minh chưa hợp lệ.",
  token: "Mã xác minh chưa hợp lệ hoặc đã hết hạn.",
};

// Error codes whose guidance must be shown on a specific input. Code-owned copy
// always wins over the generic per-field copy so the recovery instruction is
// never replaced by a bland "check this field" hint.
const EMAIL_TAKEN_COPY =
  "Email này đã có tài khoản. Hãy đăng nhập, hoặc dùng 'Quên mật khẩu' nếu bạn không nhớ mật khẩu.";

const CODE_FIELD_COPY: Record<string, { field: AuthFieldName; message: string }> = {
  EMAIL_ALREADY_REGISTERED: {
    field: "email",
    message: EMAIL_TAKEN_COPY,
  },
  PHONE_LINKED_TO_BOOKING_EMAIL: {
    field: "email",
    message: "Hãy đăng ký bằng đúng email bạn đã dùng khi đặt lịch (email đã nhận mã xác nhận).",
  },
  PHONE_OWNED_BY_ACCOUNT: {
    field: "phone",
    message: "Số điện thoại này đã thuộc một tài khoản. Vui lòng đăng nhập bằng tài khoản đó thay vì tạo tài khoản mới.",
  },
};

export function authFieldErrors(error: unknown): AuthFieldErrors {
  if (!(error instanceof ApiError)) return {};

  const fieldErrors = Object.fromEntries(
    Object.keys(error.fieldErrors).flatMap((key) => {
      const field = FIELD_ALIASES[key] ?? (key as AuthFieldName);
      return Object.hasOwn(FIELD_ERROR_COPY, field) ? [[field, FIELD_ERROR_COPY[field]]] : [];
    }),
  );

  const apiError = error as ApiError;
  const codeCopy = apiError.code ? CODE_FIELD_COPY[apiError.code] : undefined;
  return codeCopy ? { ...fieldErrors, [codeCopy.field]: codeCopy.message } : fieldErrors;
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
  if (apiError.code === "GOOGLE_SIGN_IN_UNAVAILABLE") return "Đăng nhập Google tạm thời không khả dụng. Vui lòng dùng email và mật khẩu.";
  if (apiError.status === 429) return "Bạn đang thao tác quá nhanh. Vui lòng chờ một lát rồi thử lại.";
  if (apiError.status >= 500) {
    return "Dịch vụ xác thực hiện chưa sẵn sàng hoặc máy chủ đang khởi động. Vui lòng thử lại sau ít phút.";
  }
  if (apiError.status === 401) {
    return fallback || "Email hoặc mật khẩu chưa chính xác. Vui lòng kiểm tra lại.";
  }
  if (apiError.code === "EMAIL_VERIFICATION_REQUIRED") {
    return "Email này chưa được xác minh. Hãy nhập mã xác minh đã gửi qua email, hoặc yêu cầu gửi lại mã.";
  }
  if (apiError.status === 403) {
    return "Tài khoản của bạn không có quyền truy cập hoặc đã bị tạm khóa.";
  }
  if (apiError.code === "EMAIL_ALREADY_REGISTERED") {
    return EMAIL_TAKEN_COPY;
  }
  if (apiError.code === "PHONE_LINKED_TO_BOOKING_EMAIL") {
    return "Hãy đăng ký bằng đúng email bạn đã dùng khi đặt lịch (email đã nhận mã xác nhận).";
  }
  if (apiError.code === "PHONE_OWNED_BY_ACCOUNT") {
    return "Số điện thoại này đã thuộc một tài khoản. Vui lòng đăng nhập bằng tài khoản đó thay vì tạo tài khoản mới.";
  }
  if (apiError.status === 400 && Object.keys(authFieldErrors(error)).length > 0) {
    return "Vui lòng kiểm tra lại các trường được đánh dấu.";
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
