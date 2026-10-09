import { expect, test, type BrowserContext } from "@playwright/test";
import {
  browserSessionFixture,
  installMockBrowserSession,
} from "./helpers/browser-session";
import { fulfillBackendWarmup } from "./helpers/backend-warmup";
import { fulfillNotificationBell } from "./helpers/notification-bell";

type AdminUserRow = {
  id: string;
  email: string;
  displayName: string;
  status: string;
  roles: string[];
  emailVerified: boolean;
  demo: boolean;
  phone: string | null;
  patientProfileId: string | null;
  doctorProfileId: string | null;
  createdAt: string;
  updatedAt: string;
  emailVerifiedAt: string | null;
  version: number;
  googleLinked: boolean;
  doctorProfile: { id: string; slug: string; fullName: string; active: boolean } | null;
};

const PATIENT_USER: AdminUserRow = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "patient.a@example.test",
  displayName: "Nguyễn Văn An",
  status: "ACTIVE",
  roles: ["PATIENT"],
  emailVerified: true,
  demo: false,
  phone: "0901000111",
  patientProfileId: "22222222-2222-4222-8222-222222222222",
  doctorProfileId: null,
  createdAt: "2026-01-15T08:30:00Z",
  updatedAt: "2026-01-15T08:30:00Z",
  emailVerifiedAt: "2026-01-15T08:30:00Z", version: 0, googleLinked: false, doctorProfile: null,
};

const ADMIN_USER: AdminUserRow = {
  id: "33333333-3333-4333-8333-333333333333",
  email: "admin.peer@example.test",
  displayName: "Quản trị viên Hai",
  status: "DISABLED",
  roles: ["ADMIN"],
  emailVerified: true,
  demo: false,
  phone: null,
  patientProfileId: null,
  doctorProfileId: null,
  createdAt: "2025-11-02T10:00:00Z",
  updatedAt: "2026-02-01T09:00:00Z",
  emailVerifiedAt: "2025-11-02T10:00:00Z", version: 0, googleLinked: false, doctorProfile: null,
};

const ACTOR_ID = "44444444-4444-4444-8444-444444444444";
const ACTOR_USER = { ...ADMIN_USER, id: ACTOR_ID, status: "ACTIVE", displayName: "Quản trị tài khoản" };
const DOCTOR_ID = "55555555-5555-4555-8555-555555555555";

function pageEnvelope(content: AdminUserRow[]) {
  return {
    content,
    totalElements: content.length,
    totalPages: 1,
    size: 20,
    number: 0,
  };
}

async function installAdminSession(context: BrowserContext): Promise<void> {
  await installMockBrowserSession(
    context,
    browserSessionFixture("ADMIN", ACTOR_ID, "Quản trị tài khoản"),
  );
}

for (const width of [375, 1440]) {
  test(`admin dashboard stays usable with a real AI slice and missing payment total at ${width}`, async ({ context, page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installAdminSession(context);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await context.route("**/api/v1/**", async (route) => {
      if (await fulfillBackendWarmup(route)) return;
      if (await fulfillNotificationBell(route)) return;
      const path = new URL(route.request().url()).pathname;
      if (!path.startsWith("/api/v1/admin/")) { await route.fallback(); return; }
      expect(route.request().method()).toBe("GET");
      await route.fulfill({ json: path.endsWith("/ai-content")
        ? { content: [], page: 0, size: 1, hasMore: false }
        : path.endsWith("/health-questions") ? []
          : path.endsWith("/payments") ? { content: [] }
            : { ...pageEnvelope([]), totalElements: 12, totalPages: 1 } });
    });
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Điều hành bệnh viện" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Nội dung AI chờ duyệt/ })).toContainText("Không có việc chờ");
    await expect(page.getByRole("link", { name: /Thanh toán chờ đối soát/ })).toContainText("Chưa thể xác định số lượng");
    await expect(page.getByRole("heading", { name: "Chưa thể hiển thị trang này" })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test("admin users page lists accounts with creation date and locks an account via dialog", async ({ context, page }) => {
  await installAdminSession(context);

  const patchedStatuses: string[] = [];
  await context.route("**/api/v1/**", async (route) => {
    if (await fulfillBackendWarmup(route)) return;
    if (await fulfillNotificationBell(route)) return;
    const request = route.request();
    const url = new URL(request.url());
    if (!url.pathname.startsWith("/api/v1/admin/users")) {
      await route.fallback();
      return;
    }
    if (request.method() === "GET") {
      if (url.pathname === `/api/v1/admin/users/${ACTOR_ID}` || url.pathname === `/api/v1/admin/users/${PATIENT_USER.id}`) {
        await route.fulfill({ json: url.pathname.endsWith(ACTOR_ID) ? ACTOR_USER : PATIENT_USER }); return;
      }
      const rows = url.searchParams.get("status") === "DISABLED" ? [ADMIN_USER] : [PATIENT_USER, ADMIN_USER];
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(pageEnvelope(rows)) });
      return;
    }
    if (request.method() === "PUT" && url.pathname === `/api/v1/admin/users/${PATIENT_USER.id}`) {
      const body = request.postDataJSON();
      expect(body).toMatchObject({ expectedVersion: 0, expectedUpdatedAt: PATIENT_USER.updatedAt, roles: ["PATIENT"], email: PATIENT_USER.email });
      patchedStatuses.push(body.status);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...PATIENT_USER, status: body.status }),
      });
      return;
    }
    await route.fallback();
  });

  await page.goto("/admin/users");

  await expect(page.getByRole("heading", { name: "Tài khoản", exact: true })).toBeVisible();
  await expect(page.getByText("Nguyễn Văn An")).toBeVisible();
  // The creation-date column the portal was missing.
  await expect(page.getByRole("columnheader", { name: "Ngày tạo" })).toBeVisible();
  const table = page.getByRole("table", { name: /Danh sách tài khoản/ });
  await expect(table.getByText("Đã khóa")).toBeVisible();
  await expect(table.getByText("Quản trị viên", { exact: true })).toBeVisible();

  // Filter wiring: status=DISABLED reaches the backend query.
  await page.getByTestId("account-status-filter").selectOption("DISABLED");
  await expect(page.getByText("Nguyễn Văn An")).toBeHidden();
  await expect(page.getByText("Quản trị viên Hai")).toBeVisible();
  await page.getByTestId("account-status-filter").selectOption("");

  // Disable flow is dialog-gated and single-submit.
  await page.getByTestId(`account-row-${PATIENT_USER.id}`).getByRole("button", { name: "Xem chi tiết" }).click();
  await expect(page.getByTestId("account-detail").locator("time").first()).toHaveAttribute("datetime", PATIENT_USER.createdAt);
  await page.getByRole("button", { name: "Khóa tài khoản" }).click();
  const dialog = page.getByRole("dialog", { name: "Khóa tài khoản: Nguyễn Văn An?" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("patient.a@example.test")).toBeVisible();
  await dialog.getByRole("button", { name: "Khóa tài khoản" }).click();
  await expect(dialog).toBeHidden();
  expect(patchedStatuses).toEqual(["DISABLED"]);
});

test("admin users page edits roles with a real doctor profile through confirmation and rejects an empty set", async ({ context, page }) => {
  await installAdminSession(context);

  const patchedRoleSets: string[][] = [];
  await context.route("**/api/v1/**", async (route) => {
    if (await fulfillBackendWarmup(route)) return;
    if (await fulfillNotificationBell(route)) return;
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api/v1/admin/doctors") {
      await route.fulfill({ json: { ...pageEnvelope([]), content: [{ id: DOCTOR_ID, slug: "doctor-fixture", fullName: "Bác sĩ fixture", active: true }], totalElements: 1 } }); return;
    }
    if (!url.pathname.startsWith("/api/v1/admin/users")) {
      await route.fallback();
      return;
    }
    if (request.method() === "GET") {
      if (url.pathname === `/api/v1/admin/users/${ACTOR_ID}` || url.pathname === `/api/v1/admin/users/${PATIENT_USER.id}`) {
        await route.fulfill({ json: url.pathname.endsWith(ACTOR_ID) ? ACTOR_USER : PATIENT_USER }); return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(pageEnvelope([PATIENT_USER])) });
      return;
    }
    if (request.method() === "PUT" && url.pathname === `/api/v1/admin/users/${PATIENT_USER.id}`) {
      const body = request.postDataJSON();
      expect(body).toMatchObject({ expectedVersion: 0, expectedUpdatedAt: PATIENT_USER.updatedAt, doctorProfileId: DOCTOR_ID });
      patchedRoleSets.push(body.roles);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...PATIENT_USER, roles: body.roles, version: 1, doctorProfile: { id: DOCTOR_ID, slug: "doctor-fixture", fullName: "Bác sĩ fixture", active: true } }),
      });
      return;
    }
    await route.fallback();
  });

  await page.goto("/admin/users");
  await expect(page.getByText("Nguyễn Văn An")).toBeVisible();

  await page.getByTestId(`account-row-${PATIENT_USER.id}`).getByRole("button", { name: "Xem chi tiết" }).click();
  await page.getByRole("checkbox", { name: /Bác sĩ/ }).check();

  // Empty role set is blocked client-side before any request leaves.
  await page.getByRole("checkbox", { name: /Bác sĩ/ }).uncheck();
  await page.getByRole("checkbox", { name: /Bệnh nhân/ }).uncheck();
  await expect(page.getByTestId("account-save")).toBeDisabled();
  expect(patchedRoleSets).toEqual([]);
  await page.getByRole("checkbox", { name: /Bệnh nhân/ }).check();
  await page.getByRole("checkbox", { name: /Bác sĩ/ }).check();
  await page.getByLabel("Chọn hồ sơ đang hoạt động").selectOption(DOCTOR_ID);
  await page.getByTestId("account-save").click();
  const dialog = page.getByRole("dialog", { name: "Lưu thay đổi: Nguyễn Văn An?" });
  await expect(dialog).toBeVisible();
  expect(patchedRoleSets).toEqual([]);
  await dialog.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(patchedRoleSets).toEqual([["PATIENT", "DOCTOR"]]);
});

test("admin users honours the status deep link and only fetches matching rows", async ({ context, page }) => {
  await installAdminSession(context);
  const listStatuses: (string | null)[] = [];
  await context.route("**/api/v1/**", async (route) => {
    if (await fulfillBackendWarmup(route)) return;
    if (await fulfillNotificationBell(route)) return;
    const request = route.request();
    const url = new URL(request.url());
    if (!url.pathname.startsWith("/api/v1/admin/users") || request.method() !== "GET") {
      await route.fallback();
      return;
    }
    if (url.pathname !== "/api/v1/admin/users") {
      const id = url.pathname.split("/").pop();
      await route.fulfill({ json: id === ACTOR_ID ? ACTOR_USER : id === ADMIN_USER.id ? ADMIN_USER : PATIENT_USER });
      return;
    }
    const status = url.searchParams.get("status");
    listStatuses.push(status);
    const rows = status === "DISABLED" ? [ADMIN_USER] : status === "ACTIVE" ? [PATIENT_USER] : [PATIENT_USER, ADMIN_USER];
    await route.fulfill({ json: pageEnvelope(rows) });
  });
  const statusFilter = page.getByTestId("account-status-filter");

  await page.goto("/admin/users?status=DISABLED");
  await expect(statusFilter).toHaveValue("DISABLED");
  await expect(page.getByText("Quản trị viên Hai")).toBeVisible();
  await expect(page.getByText("Nguyễn Văn An")).toBeHidden();
  expect(listStatuses.at(-1)).toBe("DISABLED");

  await page.evaluate(() => window.history.pushState({}, "", "/admin/users?status=ACTIVE"));
  await expect(statusFilter).toHaveValue("ACTIVE");
  await expect(page.getByText("Nguyễn Văn An")).toBeVisible();
  await expect(page.getByText("Quản trị viên Hai")).toBeHidden();
  await expect.poll(() => listStatuses.at(-1)).toBe("ACTIVE");

  await page.goto("/admin/users?status=NO_SUCH");
  await expect(statusFilter).toHaveValue("");
  await expect(page.getByText("Nguyễn Văn An")).toBeVisible();
  await expect(page.getByText("Quản trị viên Hai")).toBeVisible();
  await expect.poll(() => listStatuses.at(-1)).toBeNull();

  await page.goto("/admin/users");
  await expect(statusFilter).toHaveValue("");
  await expect(page.getByRole("table", { name: /Danh sách tài khoản/ }).getByRole("row")).toHaveCount(3);
  await expect.poll(() => listStatuses.at(-1)).toBeNull();

  await page.goto("/admin/users?status=DISABLED");
  await expect(statusFilter).toHaveValue("DISABLED");
  await page.getByRole("button", { name: "Xóa bộ lọc" }).click();
  await expect(statusFilter).toHaveValue("");
  await expect(page.getByText("Nguyễn Văn An")).toBeVisible();
  await expect.poll(() => listStatuses.at(-1)).toBeNull();

  await page.getByTestId(`account-row-${ADMIN_USER.id}`).getByRole("button", { name: "Xem chi tiết" }).click();
  const nameInput = page.getByLabel("Họ tên hiển thị");
  await expect(nameInput).toHaveValue("Quản trị viên Hai");
  await nameInput.fill("Quản trị viên Hai đổi");
  await page.getByRole("button", { name: "Mở điều hướng quản trị" }).click();
  await page.getByRole("link", { name: "Tổng quan" }).click();
  const leaveDialog = page.getByRole("dialog", { name: "Bạn có thay đổi chưa lưu" });
  await expect(leaveDialog).toBeVisible();
  expect(page.url()).toContain("/admin/users?status=DISABLED");
  await leaveDialog.getByRole("button", { name: "Ở lại" }).click();
  await expect(leaveDialog).toBeHidden();
  await expect(nameInput).toHaveValue("Quản trị viên Hai đổi");
});
