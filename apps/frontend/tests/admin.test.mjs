import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const appRoot = new URL("../app/admin/", import.meta.url);

async function source(relativePath) {
  return readFile(new URL(relativePath, appRoot), "utf8");
}

test("admin routes expose the complete operations surface", async () => {
  await Promise.all([
    access(new URL("layout.tsx", appRoot)),
    access(new URL("page.tsx", appRoot)),
    access(new URL("doctors/page.tsx", appRoot)),
    access(new URL("specialties/page.tsx", appRoot)),
    access(new URL("branches/page.tsx", appRoot)),
    access(new URL("services/page.tsx", appRoot)),
    access(new URL("appointments/page.tsx", appRoot)),
    access(new URL("catalog/page.tsx", appRoot)),
    access(new URL("schedules/page.tsx", appRoot)),
    access(new URL("content/page.tsx", appRoot)),
    access(new URL("health-questions/page.tsx", appRoot)),
  ]);
});

test("admin FAQ editing keeps AI review governance visible", async () => {
  const catalog = await source("catalog/page.tsx");
  assert.match(catalog, /FAQ đang hiển thị công khai chưa đồng nghĩa/);
  assert.match(catalog, /\/admin\/ai-content-reviews/);
  assert.match(catalog, /bác sĩ độc lập review/);
});
test("admin layout gates access and exposes real account actions", async () => {
  const layout = await source("layout.tsx");

  assert.match(layout, /useAuthSessionStatus/);
  assert.match(layout, /hydrateAuthSession/);
  assert.match(layout, /AUTH_SESSION_INDETERMINATE_MESSAGE/);
  assert.match(layout, /ADMIN/);
  assert.match(layout, /unauthenticated/);
  assert.match(layout, /forbidden/);
  assert.match(layout, /aria-current/);
  assert.match(layout, /logoutCurrentUser/);
  assert.match(layout, /\/auth\/login\?next=%2Fadmin/);
  assert.match(layout, /href="#main-content"/);
  assert.match(layout, /id="main-content"/);
  assert.doesNotMatch(layout, /healthcare\.auth\.session|sessionStorage|localStorage/);
  assert.doesNotMatch(layout, /Backend kiểm tra quyền ADMIN|Bản demo local/);
});

test("dashboard uses live catalog snapshots instead of invented metrics", async () => {
  const page = await source("page.tsx");

  assert.match(page, /adminListDoctors/);
  assert.match(page, /adminListSpecialties/);
  assert.match(page, /adminListBranches/);
  assert.match(page, /adminListServices/);
  assert.match(page, /adminListPackages/);
  assert.match(page, /adminListFaqs/);
  assert.match(page, /adminListArticles/);
  assert.match(page, /adminListAppointments/);
  assert.doesNotMatch(page, /fetchDoctors/);
  assert.doesNotMatch(page, /fetchSpecialties/);
  assert.doesNotMatch(page, /fetchBranches/);
  assert.doesNotMatch(page, /endpoint công khai/);
  assert.match(page, /Promise\.allSettled/);
  assert.match(page, /Chưa có bản ghi/);
  // The caption was removed deliberately: a silent card reads cleaner than a
  // note repeated under every number, so the source must not re-add it.
  assert.doesNotMatch(page, /Bản ghi đang quản lý/);
  assert.match(page, /UiIcon/);
  assert.doesNotMatch(page, />500</);
  assert.doesNotMatch(page, />30</);
  assert.doesNotMatch(page, />1000</);
});

test("doctor and specialty screens cover loading, empty, error, and admin mutation states", async () => {
  const [doctors, specialties] = await Promise.all([
    source("doctors/page.tsx"),
    source("specialties/page.tsx"),
  ]);

  for (const page of [doctors, specialties]) {
    assert.match(page, /tone="loading"/);
    assert.match(page, /tone="empty"/);
    assert.match(page, /tone="error"/);
    assert.match(page, /adminCreate/);
    assert.match(page, /adminUpdate/);
    assert.match(page, /adminDelete/);
    assert.match(page, /aria-label/);
    // HC-08: deletions confirm through the shared accessible dialog.
    assert.match(page, /ConfirmActionDialog/);
    assert.doesNotMatch(page, /window\.confirm/);
    assert.match(page, /role="region"/);
    assert.match(page, /tabIndex=\{0\}/);
    assert.doesNotMatch(page, /ADMIN READ CONTRACT|ADMIN WRITE CONTRACT|Bản demo local|\bActive\b|\bInactive\b/);
  }

  assert.match(doctors, /adminListDoctors/);
  assert.match(specialties, /adminListSpecialties/);
  assert.doesNotMatch(doctors, /fetchDoctors/);
  assert.doesNotMatch(specialties, /fetchSpecialties/);
});

test("branch and service screens expose complete CRUD states without mock content", async () => {
  const [branches, services] = await Promise.all([
    source("branches/page.tsx"),
    source("services/page.tsx"),
  ]);

  assert.match(branches, /adminCreateBranch/);
  assert.match(branches, /adminUpdateBranch/);
  assert.match(branches, /adminDeleteBranch/);
  assert.match(branches, /adminListBranches/);
  assert.match(branches, /ConfirmActionDialog/);
  assert.doesNotMatch(branches, /window\.confirm/);
  assert.match(branches, /role="region"/);
  assert.match(branches, /tabIndex=\{0\}/);
  assert.doesNotMatch(branches, /fetchBranches/);
  assert.match(services, /adminCreateService/);
  assert.match(services, /adminUpdateService/);
  assert.match(services, /adminDeleteService/);
  assert.match(services, /adminListServices/);
  assert.match(services, /ConfirmActionDialog/);
  assert.doesNotMatch(services, /window\.confirm/);
  assert.match(services, /role="region"/);
  assert.match(services, /tabIndex=\{0\}/);
  assert.doesNotMatch(services, /fetchServices/);
  assert.doesNotMatch(branches, /SEED_|mock|fake/i);
  assert.doesNotMatch(services, /SEED_|mock|fake/i);
  assert.doesNotMatch(branches, /ADMIN READ CONTRACT|ADMIN WRITE CONTRACT|Bản demo local|\bActive\b|\bInactive\b/);
  assert.doesNotMatch(services, /ADMIN READ CONTRACT|ADMIN WRITE CONTRACT|Bản demo local|\bActive\b|\bInactive\b/);
});

test("remaining catalog screen preserves inactive records with guarded CRUD actions", async () => {
  const catalog = await source("catalog/page.tsx");

  assert.match(catalog, /adminListPackages/);
  assert.match(catalog, /adminListFaqs/);
  assert.match(catalog, /adminListArticles/);
  assert.match(catalog, /item\.active \?\? true/);
  assert.match(catalog, /item\.active \?\? Boolean\(item\.publishedAt\)/);
  assert.match(catalog, /Đang hiển thị/);
  assert.match(catalog, /Chưa xuất bản/);
  assert.match(catalog, /ConfirmActionDialog/);
  assert.doesNotMatch(catalog, /window\.confirm/);
  assert.match(catalog, /disabled=\{busy\}/);
  assert.match(catalog, /Chưa có gói khám/);
  assert.match(catalog, /Chưa có câu hỏi thường gặp/);
  assert.match(catalog, /Chưa có bài viết/);
  assert.doesNotMatch(catalog, /fetchPackages/);
  assert.doesNotMatch(catalog, /fetchFaqs/);
  assert.doesNotMatch(catalog, /fetchArticles/);
  assert.doesNotMatch(catalog, /SEED_|mock|fake/i);
  assert.doesNotMatch(catalog, /ADMIN READ CONTRACT|ADMIN WRITE CONTRACT|\bInactive\b|\bUnpublished\b/);
});

test("catalog reorder persists through versioned APIs and keeps keyboard parity", async () => {
  const catalog = await source("catalog/page.tsx");
  const api = await readFile(new URL("../lib/api-client.ts", import.meta.url), "utf8");

  assert.match(api, /adminReorderPackages[\s\S]*?\/admin\/packages\/order/);
  assert.match(api, /adminReorderFaqs[\s\S]*?\/admin\/faqs\/order/);
  assert.match(catalog, /orderPayload/);
  assert.match(catalog, /Đã lưu thứ tự gói khám/);
  assert.match(catalog, /Đã hoàn tác thứ tự FAQ/);
  assert.match(catalog, /Di chuyển \$\{item\.name\} lên/);
  assert.match(catalog, /Di chuyển \$\{item\.question\} xuống/);
  assert.doesNotMatch(catalog, /title: "Đã sắp xếp Gói khám"/);
  assert.doesNotMatch(catalog, /title: "Đã sắp xếp lại FAQ"/);
  assert.match(catalog, /reorderInFlightRef\.current/);
  // Both reorder handlers must short-circuit while a save is in flight. The
  // guard now explains itself with a toast before returning, so match the
  // shape (early return inside the guard) instead of a one-line spelling.
  const guardBodies = catalog
    .split("if (reorderInFlightRef.current) {")
    .slice(1)
    .map((rest) => rest.split(/\r?\n {4}\}/)[0]);
  assert.equal(guardBodies.length, 2, "persistFaqOrder and persistPackageOrder both guard the in-flight flag");
  for (const body of guardBodies) {
    assert.match(body, /return;/, "the in-flight guard must bail out before a second save starts");
  }
  // Stale-load generation guard: a load finishing after a newer load or a
  // reorder must never write its response into state (P1-C deep-scan 2026-09-11).
  assert.match(catalog, /loadGenerationRef\.current \+= 1/);
  assert.match(catalog, /const generation = \+\+loadGenerationRef\.current/);
  assert.match(catalog, /generation !== loadGenerationRef\.current/);
  // Reorder-epoch guard: a GET issued while a reorder is in flight (e.g. a
  // cross-tab broadcast) can be served from a pre-commit snapshot, so the load
  // must also be discarded when a reorder started or settled after it began
  // (Wukong F4, 2026-09-12).
  assert.match(catalog, /reorderEpochRef\.current \+= 1/);
  assert.match(catalog, /const reorderEpoch = reorderEpochRef\.current/);
  assert.match(catalog, /reorderEpoch !== reorderEpochRef\.current/);
  // The newest load owns the loading indicator, so a superseded load (or a
  // reorder that supersedes it) cannot leave the spinner stuck on.
  assert.match(catalog, /loadingOwnerRef\.current = generation/);
  assert.match(catalog, /generation === loadingOwnerRef\.current/);
});

test("appointment filters apply explicit draft state and keep the table keyboard-scrollable", async () => {
  const appointments = await source("appointments/page.tsx");

  assert.match(appointments, /draftFilters/);
  assert.match(appointments, /appliedFilters/);
  assert.match(appointments, /filtersChanged/);
  assert.match(appointments, /role="region"/);
  assert.match(appointments, /tabIndex=\{0\}/);
  assert.match(appointments, /aria-label="Phân trang lịch hẹn"/);
  assert.match(appointments, /Trạng thái lâm sàng/);
});

test("schedule operations separate load failures from mutation feedback", async () => {
  const schedules = await source("schedules/page.tsx");

  assert.match(schedules, /loadError/);
  assert.match(schedules, /setFeedback/);
  assert.match(schedules, /runMutation/);
  // HC-08: schedule deletions confirm through the shared accessible dialog.
  assert.match(schedules, /ConfirmActionDialog/);
  assert.doesNotMatch(schedules, /window\.confirm/);
  assert.match(schedules, /resetScheduleForm/);
  assert.match(schedules, /resetExceptionForm/);
  assert.match(schedules, /exceptionTypeLabels/);
  assert.match(schedules, /Đang mở lịch đặt khám/);
  assert.doesNotMatch(schedules, />SCHEDULING</);
});

test("the schedule create form previews the slot grid and refuses a window the server would reject", async () => {
  const schedules = await source("schedules/page.tsx");

  // Live summary derived from start/end/duration.
  assert.match(schedules, /function planSlots\(/);
  assert.match(schedules, /Sẽ tạo <strong>\{slotPlan\.slotCount\}<\/strong> khung giờ \(\{slotPlan\.windowLabel\} cho mỗi bác sĩ\)\./);
  assert.match(schedules, /bỏ trống \{slotPlan\.leftoverMinutes\} phút cuối/);
  assert.match(schedules, /leftoverMinutes: windowMinutes % duration/);
  assert.match(schedules, /slotCount: Math\.floor\(windowMinutes \/ duration\)/);

  // Client-side gate before the request; the server stays authoritative.
  assert.match(schedules, /Giờ bắt đầu phải trước giờ kết thúc\./);
  assert.match(schedules, /Số phút mỗi lượt phải là số nguyên lớn hơn 0\./);
  assert.match(schedules, /if \(slotPlan\.leftoverMinutes > 0\) \{/);
  assert.match(schedules, /không chia hết cho \$\{form\.slotDurationMinutes\} phút mỗi lượt/);
  assert.match(schedules, /setFormError\(slotPlan\.error\)/);
  assert.match(schedules, /disabled=\{busy \|\| slotPlan\.error !== null \|\| slotPlan\.leftoverMinutes > 0\}/);
});

test("an unassigned branch is surfaced with a link instead of an empty select", async () => {
  const schedules = await source("schedules/page.tsx");

  assert.match(schedules, /const branchesForDoctor = useCallback/);
  assert.match(schedules, /branchesForDoctor\(form\.doctorId\)\.map/);
  assert.match(schedules, /branchesForDoctor\(exceptionForm\.doctorId\)\.map/);
  assert.equal((schedules.match(/chưa được gán cơ sở nào/g) ?? []).length, 2, "both forms must explain the empty select");
  assert.match(schedules, /href="\/admin\/doctors"/);
  assert.match(schedules, /import Link from "next\/link"/);
  assert.equal(
    (schedules.match(/role="status"/g) ?? []).length >= 2,
    true,
    "both notices must announce themselves to assistive technology",
  );
});

test("the schedule list is sorted, counted and filtered on the client", async () => {
  const schedules = await source("schedules/page.tsx");

  assert.match(schedules, /const sortedSchedules = useMemo\(/);
  assert.match(schedules, /left\.doctorName\.localeCompare\(right\.doctorName, "vi"\)/);
  assert.match(schedules, /left\.dayOfWeek - right\.dayOfWeek/);
  assert.match(schedules, /sortedSchedules\.map\(\(item\) => \(/);
  assert.match(schedules, /Tổng cộng <strong>\{sortedSchedules\.length\}<\/strong> lịch/);
  assert.match(schedules, /type="search"/);
  assert.match(schedules, /function foldForFilter\(value: string\): string/);
  assert.match(schedules, /Không có lịch phù hợp/);
});

test("schedule forms rebuild their defaults from the current business day", async () => {
  const schedules = await source("schedules/page.tsx");

  assert.match(schedules, /const emptyScheduleForm = \(\) => \(\{/);
  assert.match(schedules, /const emptyExceptionForm = \(\) => \(\{/);
  assert.match(schedules, /effectiveFrom: businessDate\(\)/);
  assert.match(schedules, /exceptionDate: businessDate\(\)/);
  assert.match(schedules, /useState\(emptyScheduleForm\)/);
  assert.match(schedules, /useState\(emptyExceptionForm\)/);
  assert.match(schedules, /setForm\(emptyScheduleForm\(\)\)/);
  assert.match(schedules, /setExceptionForm\(emptyExceptionForm\(\)\)/);
  // The old module-level singletons froze the date at import time.
  assert.doesNotMatch(schedules, /const EMPTY = \{/);
  assert.doesNotMatch(schedules, /const EMPTY_EXCEPTION = \{/);
  assert.doesNotMatch(schedules, /const today = \(\) => businessDate\(\)/);
});

test("a live-booking 409 is shown verbatim and offers an explicit force retry", async () => {
  const schedules = await source("schedules/page.tsx");

  assert.match(schedules, /const FORCE_CONFLICT_CODE = "SCHEDULE_HAS_ACTIVE_BOOKINGS"/);
  assert.match(schedules, /error instanceof ApiError && error\.code === FORCE_CONFLICT_CODE/);
  // The server's own wording reaches the existing banner through the shared copy.
  const copy = await source("_lib/errors.ts");
  assert.match(copy, /getCode\(error\) === "SCHEDULE_HAS_ACTIVE_BOOKINGS"/);
  assert.match(copy, /description: withFieldDetails\(\s*serverMessage \|\| /);

  // The retry re-runs the same write with force=true, after a confirmation.
  assert.match(schedules, /\(force\) => editingId\s*\n\s*\? adminUpdateSchedule\(editingId, payload, force\)/);
  assert.match(schedules, /\(force\) => adminDeleteSchedule\(id, force\)/);
  assert.match(schedules, /adminCreateScheduleException\(exceptionForm\.doctorId, exceptionForm\.branchId, payload, force\)/);
  assert.match(schedules, /adminUpdateScheduleException\(editingExceptionId, payload, force\)/);
  assert.match(schedules, /Vẫn tiếp tục \(force\)/);
  assert.match(schedules, /open=\{forceConfirmOpen\}/);
  assert.match(schedules, /force=true/);
  // The retry reuses the original cleanup, so a forced create still resets.
  assert.match(schedules, /await runMutation\(candidate\.action, `Ghi đè: \$\{candidate\.title\}`, candidate\.options\)/);
  assert.match(schedules, /onSuccess: resetScheduleForm/);
  assert.match(schedules, /onSuccess: resetExceptionForm/);
  // Endpoints without a force flag never offer the retry.
  assert.match(schedules, /runMutation\(\(\) => adminDeleteScheduleException\(id\), "Đã xóa ngoại lệ"\)/);
});

test("admin error copy does not expose raw provider messages", async () => {
  const errors = await source("_lib/errors.ts");

  assert.match(errors, /error instanceof ApiError/);
  assert.match(errors, /status === 401/);
  assert.match(errors, /status === 403/);
  assert.match(errors, /status >= 500/);
  assert.doesNotMatch(errors, /description:\s*error\.message/);
});

test("admin error copy names the field the server rejected", async () => {
  class StubApiError extends Error {
    constructor(message, status, path, options = {}) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.path = path;
      this.code = options.code ?? null;
      this.fieldErrors = options.fieldErrors ?? {};
    }
  }

  const sourceText = await readFile(new URL("_lib/errors.ts", appRoot), "utf8");
  const compiled = ts.transpileModule(sourceText, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const compiledModule = { exports: {} };
  vm.runInNewContext(compiled, {
    module: compiledModule,
    exports: compiledModule.exports,
    // The mapped copy branches on `error instanceof Error`; without the outer
    // realm's constructor in scope, a plain Error raises a cross-realm
    // instanceof mismatch and silently takes the wrong branch.
    Error,
    require: (specifier) => {
      assert.match(specifier, /lib\/api-client$/);
      return { ApiError: StubApiError };
    },
  });
  const { describeAdminError } = compiledModule.exports;
  assert.equal(typeof describeAdminError, "function");

  const invalid = describeAdminError(new StubApiError("Yêu cầu không hợp lệ", 400, "/admin/schedules", {
    fieldErrors: { startTime: "Giờ bắt đầu không hợp lệ", unknownField: "Bắt buộc" },
  }));
  assert.equal(invalid.title, "Thông tin chưa hợp lệ");
  assert.match(invalid.description, /Giờ bắt đầu: Giờ bắt đầu không hợp lệ/);
  // An unmapped key is still named, never silently dropped.
  assert.match(invalid.description, /unknownField: Bắt buộc/);

  const guardMessage = "Còn 3 lịch hẹn đang hoạt động trong khung giờ này. Vui lòng xử lý các lịch hẹn trước, hoặc gửi lại yêu cầu với tham số force=true.";
  const guard = describeAdminError(new StubApiError(guardMessage, 409, "/admin/schedules/x", { code: "SCHEDULE_HAS_ACTIVE_BOOKINGS" }));
  assert.equal(guard.description, guardMessage, "the guard's own counts and remedy must reach the operator verbatim");
  assert.match(guard.title, /Khung giờ còn lịch hẹn đang hoạt động/);

  const stale = describeAdminError(new StubApiError("conflict", 409, "/admin/schedules/x"));
  assert.equal(stale.title, "Dữ liệu vừa được cập nhật");

  const outage = describeAdminError(new Error("API 500 boom"));
  assert.equal(outage.title, "Dịch vụ tạm thời không khả dụng");

  const opaque = describeAdminError(new StubApiError("boom-418", 418, "/admin/schedules/x"));
  assert.equal(opaque.title, "Không thể hoàn tất thao tác");
  assert.doesNotMatch(opaque.description, /boom-418/);

  // A call site that opts in gets the server's own refusal, because "check the
  // required fields" would hide the one sentence that tells an admin to stop
  // retrying — e.g. a credit grant the backend no longer supports at all.
  const refusal = "Hạn mức AI lâm sàng không còn được áp dụng cho tài khoản bác sĩ.";
  const opted = describeAdminError(
    new StubApiError(refusal, 400, "/admin/ai-credits/grant", { code: "VALIDATION_ERROR" }),
    { preferServerMessage: true },
  );
  assert.equal(opted.title, "Thông tin chưa hợp lệ");
  assert.equal(opted.description, refusal);
  // Opting in still names the rejected field, so it cannot swallow details.
  const optedWithFields = describeAdminError(
    new StubApiError(refusal, 400, "/admin/ai-credits/grant", {
      code: "VALIDATION_ERROR",
      fieldErrors: { amount: "Bắt buộc" },
    }),
    { preferServerMessage: true },
  );
  assert.match(optedWithFields.description, /amount: Bắt buộc/);
  // Without the opt-in, technical English validation text still never reaches
  // an operator, which is why the flag is per call site and not the default.
  assert.doesNotMatch(
    describeAdminError(new StubApiError("payload field must be a string: title", 400, "/admin/cms")).description,
    /payload field must be a string/,
  );
});
