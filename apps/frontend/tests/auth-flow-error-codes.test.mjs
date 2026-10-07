import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

// Copy contracted with the audit sweep for phone/booking-email binding errors.
const EMAIL_TAKEN_COPY =
  "Email này đã có tài khoản. Hãy đăng nhập, hoặc dùng 'Quên mật khẩu' nếu bạn không nhớ mật khẩu.";
const PHONE_LINKED_COPY =
  "Hãy đăng ký bằng đúng email bạn đã dùng khi đặt lịch (email đã nhận mã xác nhận).";
const PHONE_OWNED_COPY =
  "Số điện thoại này đã thuộc một tài khoản. Vui lòng đăng nhập bằng tài khoản đó thay vì tạo tài khoản mới.";

async function loadAuthFlow() {
  let source = await read("lib/auth-flow.ts");
  source = source
    .replace(
      'import { ApiError } from "./api-client";',
      'class ApiError extends Error { constructor(msg, status, path = "", extra = {}) { super(msg); this.name = "ApiError"; this.status = status; this.path = path; this.code = extra.code ?? null; this.fieldErrors = extra.fieldErrors ?? {}; } }\nexport { ApiError };',
    )
    .replace('import { presentApiError } from "./present-api-error";', 'function presentApiError(code, status) { return "Lỗi mặc định"; }');

  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

test("Google and password sessions route by issued roles and reject cross-role destinations", async () => {
  const { authSessionDestination } = await loadAuthFlow();
  assert.equal(authSessionDestination(["DOCTOR"]), "/doctor/dashboard");
  assert.equal(authSessionDestination(["ADMIN"]), "/admin");
  assert.equal(authSessionDestination(["PATIENT"], "/patient/appointments"), "/patient/appointments");
  assert.equal(authSessionDestination(["PATIENT"], "/patient-other"), "/patient/dashboard");
  assert.equal(authSessionDestination(["PATIENT"], "/admin"), "/patient/dashboard");
  assert.equal(authSessionDestination(["PATIENT"], "//example.test"), "/patient/dashboard");
});

test("PHONE_LINKED_TO_BOOKING_EMAIL surfaces the booking-email instruction instead of the generic conflict copy", async () => {
  const { authErrorMessage, authFieldErrors, ApiError } = await loadAuthFlow();

  const error = new ApiError("Conflict", 409, "/api/auth/register", {
    code: "PHONE_LINKED_TO_BOOKING_EMAIL",
  });

  assert.equal(authErrorMessage(error, "Chưa thể tạo tài khoản. Vui lòng thử lại."), PHONE_LINKED_COPY);

  // The instruction must be emphasized at the email input, not the phone one.
  const fields = authFieldErrors(error);
  assert.equal(fields.email, PHONE_LINKED_COPY);
  assert.equal(fields.phone, undefined);
});

test("PHONE_LINKED_TO_BOOKING_EMAIL field copy wins over the generic email field copy", async () => {
  const { authFieldErrors, ApiError } = await loadAuthFlow();

  const error = new ApiError("Conflict", 409, "/api/auth/register", {
    code: "PHONE_LINKED_TO_BOOKING_EMAIL",
    fieldErrors: { email: "Vui lòng kiểm tra lại địa chỉ email." },
  });

  assert.equal(authFieldErrors(error).email, PHONE_LINKED_COPY);
});

test("EMAIL_ALREADY_REGISTERED pins the failure on the email input with sign-in guidance", async () => {
  const { authErrorMessage, authFieldErrors, ApiError } = await loadAuthFlow();

  // The dominant "no password is ever accepted" report: a second register
  // attempt with an already-used email 409s on EVERY submit regardless of the
  // password — the banner and the email field must say so instead of leaving
  // the user guessing at the password box.
  const error = new ApiError("Conflict", 409, "/api/auth/register", {
    code: "EMAIL_ALREADY_REGISTERED",
  });

  assert.equal(authErrorMessage(error, "Chưa thể tạo tài khoản. Vui lòng thử lại."), EMAIL_TAKEN_COPY);
  assert.equal(authFieldErrors(error).email, EMAIL_TAKEN_COPY);
  assert.equal(authFieldErrors(error).password, undefined);
});

test("server-marked phone field errors show the canonical-format hint", async () => {
  const { authErrorMessage, authFieldErrors, ApiError } = await loadAuthFlow();

  // AuthService throws ValidationException with fieldErrors[phone] when the
  // contact phone fails the 0-prefixed canonical floor (e.g. "-----", "0912").
  const error = new ApiError("Bad Request", 400, "/api/auth/register", {
    code: "VALIDATION_ERROR",
    fieldErrors: { phone: "Số điện thoại không hợp lệ" },
  });

  assert.match(authFieldErrors(error).phone ?? "", /bắt đầu bằng 0.*8–15 chữ số/u);
  assert.equal(authErrorMessage(error, "fallback"), "Vui lòng kiểm tra lại các trường được đánh dấu.");
});

test("PHONE_OWNED_BY_ACCOUNT guides the user to sign in instead of registering", async () => {
  const { authErrorMessage, authFieldErrors, ApiError } = await loadAuthFlow();

  const error = new ApiError("Conflict", 409, "/api/auth/register", {
    code: "PHONE_OWNED_BY_ACCOUNT",
  });

  assert.equal(authErrorMessage(error, "Chưa thể tạo tài khoản. Vui lòng thử lại."), PHONE_OWNED_COPY);

  const fields = authFieldErrors(error);
  assert.equal(fields.phone, PHONE_OWNED_COPY);
  assert.equal(fields.email, undefined);
});

test("phone-billing codes never leak through the generic 400/409 banner for other codes", async () => {
  const { authErrorMessage, ApiError } = await loadAuthFlow();

  // A plain 409 conflict with no phone-binding code keeps the existing generic copy.
  const plainConflict = new ApiError("Conflict", 409, "/api/auth/register", { code: "CONFLICT" });
  assert.equal(
    authErrorMessage(plainConflict, "Chưa thể tạo tài khoản. Vui lòng thử lại."),
    "Thông tin chưa hợp lệ hoặc đã được sử dụng. Vui lòng kiểm tra và thử lại.",
  );
  // An unrecognised code on the same status also keeps the generic banner, proving
  // the two new branches are gated on the exact code, not on status 409.
  const unknownCode = new ApiError("Bad Request", 400, "/api/auth/register", { code: "SOMETHING_ELSE" });
  assert.equal(
    authErrorMessage(unknownCode, "Chưa thể tạo tài khoản. Vui lòng thử lại."),
    "Thông tin chưa hợp lệ hoặc đã được sử dụng. Vui lòng kiểm tra và thử lại.",
  );
});

test("password validation explains the missing requirements without suggesting an account conflict", async () => {
  const { authFieldErrors, authErrorMessage, ApiError } = await loadAuthFlow();
  const error = new ApiError("Validation failed", 400, "/api/auth/register", {
    code: "VALIDATION_ERROR", fieldErrors: { password: "unsafe backend detail" },
  });
  assert.match(authFieldErrors(error).password, /8.*128.*chữ hoa.*chữ thường.*số.*ký tự đặc biệt/u);
  assert.equal(authErrorMessage(error, "fallback"), "Vui lòng kiểm tra lại các trường được đánh dấu.");
});

test("registration password preflight identifies each unmet backend requirement", async () => {
  const { registrationPasswordError } = await loadAuthFlow();
  for (const [value, missing] of [
    ["Aa1!", /8.*128/u], ["lowercase1!", /chữ hoa/u],
    ["UPPERCASE1!", /chữ thường/u], ["NoDigits!", /số/u],
    ["NoSymbol123", /ký tự đặc biệt/u], ["Aa1!".repeat(33), /8.*128/u],
  ]) assert.match(registrationPasswordError(value), missing);
  assert.equal(registrationPasswordError("SyntheticValid1!"), null);
});
