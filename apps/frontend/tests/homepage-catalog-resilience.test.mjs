import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

async function loadAuthFlow() {
  let source = await read("lib/auth-flow.ts");
  // Replace relative imports so data: URI can load self-contained
  source = source
    .replace('import { ApiError } from "./api-client";', 'class ApiError extends Error { constructor(msg, status, path = "", extra = {}) { super(msg); this.name = "ApiError"; this.status = status; this.path = path; this.code = extra.code ?? null; } }')
    .replace('import { presentApiError } from "./present-api-error";', 'function presentApiError(code, status) { return "Lỗi mặc định"; }');

  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

test("authErrorMessage accurately identifies connectivity, timeout, and credential failures", async () => {
  const { authErrorMessage } = await loadAuthFlow();

  class MockApiError extends Error {
    constructor(message, status, path = "/test", extra = {}) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.path = path;
      this.code = extra.code ?? null;
    }
  }

  // Raw TypeError (e.g. backend offline / fetch failed)
  const networkError = new TypeError("Failed to fetch");
  assert.equal(
    authErrorMessage(networkError, "Email hoặc mật khẩu chưa chính xác."),
    "Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau ít phút.",
  );

  // Status 0: Connection refused / backend down
  const offlineApiError = new MockApiError("Failed", 0);
  assert.equal(
    authErrorMessage(offlineApiError, "Email hoặc mật khẩu chưa chính xác."),
    "Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau ít phút.",
  );

  // Status 408: Timeout / cold start
  const timeoutApiError = new MockApiError("Timeout", 408, "/auth", { code: "REQUEST_TIMEOUT" });
  assert.equal(
    authErrorMessage(timeoutApiError, "Email hoặc mật khẩu chưa chính xác."),
    "Máy chủ phản hồi chậm hoặc đang khởi động. Vui lòng thử lại sau ít giây.",
  );

  // Status 502 / 503 / 500: Server unavailable
  const serverError = new MockApiError("Internal Error", 503);
  assert.equal(
    authErrorMessage(serverError, "Email hoặc mật khẩu chưa chính xác."),
    "Dịch vụ xác thực hiện chưa sẵn sàng hoặc máy chủ đang khởi động. Vui lòng thử lại sau ít phút.",
  );

  // Status 401: Invalid credentials
  const badCreds = new MockApiError("Unauthorized", 401, "/auth", { code: "AUTHENTICATION_FAILED" });
  assert.equal(
    authErrorMessage(badCreds, "Email hoặc mật khẩu chưa chính xác."),
    "Email hoặc mật khẩu chưa chính xác.",
  );
});

test("homepage catalog handles cold starts and backend outages gracefully", async () => {
  const [home, styles] = await Promise.all([
    read("app/page.tsx"),
    read("app/styles.css"),
  ]);

  // CatalogStatus uses calm unavailable state with retry and shield-check icon
  assert.match(home, /catalog-status--unavailable/);
  assert.match(home, /Thử tải lại/);
  assert.doesNotMatch(home, /catalog-status--error/);

  // Skeleton cards for smooth loading without CLS
  assert.match(home, /PackageSkeletonCard/);
  assert.match(home, /SpecialtySkeletonCard/);
  assert.match(home, /DoctorSkeletonCard/);

  // Fallback data present for graceful degradation
  assert.match(home, /FALLBACK_PACKAGES/);
  assert.match(home, /FALLBACK_SPECIALTIES/);
  assert.match(home, /FALLBACK_DOCTORS/);

  // Verbatim contract checks preserved
  assert.match(home, /packages\.slice\(0, 4\)/);
  assert.match(home, /filteredSpecialties\.slice\(0, 8\)/);
  assert.match(home, /error\.status >= 500/);
  assert.match(home, /setCatalog\(null\)/);

  // Styles are calm medical-grade
  assert.match(styles, /\.catalog-status--unavailable\s*\{/);
  assert.match(styles, /\.catalog-status__message/);
  assert.match(styles, /\.catalog-status__icon/);
});

test("patient male avatar asset is present and documented", async () => {
  await access(new URL("../public/media/patient-male-avatar.jpg", import.meta.url));
  const attributions = await read("public/media/ATTRIBUTIONS.md");
  assert.match(attributions, /patient-male-avatar\.jpg/);
});
