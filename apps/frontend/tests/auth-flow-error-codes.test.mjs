import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

// Copy contracted with the audit sweep for phone/booking-email binding errors.
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
