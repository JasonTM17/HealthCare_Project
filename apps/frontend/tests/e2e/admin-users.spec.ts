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
};

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
    browserSessionFixture("ADMIN", "admin-users-e2e", "Quản trị tài khoản"),
  );
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
      const rows = url.searchParams.get("status") === "DISABLED" ? [ADMIN_USER] : [PATIENT_USER, ADMIN_USER];
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(pageEnvelope(rows)) });
      return;
    }
    if (request.method() === "PATCH" && url.pathname.endsWith("/status")) {
      const body = JSON.parse(request.postData() ?? "{}") as { status: string };
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

  await expect(page.getByRole("heading", { name: "Tài khoản người dùng" })).toBeVisible();
  await expect(page.getByText("Nguyễn Văn An")).toBeVisible();
  // The creation-date column the portal was missing.
  await expect(page.getByRole("columnheader", { name: "Ngày tạo" })).toBeVisible();
  const table = page.getByRole("table", { name: /Danh sách tài khoản/ });
  await expect(table.getByText("Đã khóa")).toBeVisible();
  await expect(table.getByText("Quản trị", { exact: true })).toBeVisible();

  // Filter wiring: status=DISABLED reaches the backend query.
  await page.getByLabel("Trạng thái").selectOption("DISABLED");
  await expect(page.getByText("Nguyễn Văn An")).toBeHidden();
  await expect(page.getByText("Quản trị viên Hai")).toBeVisible();
  await page.getByLabel("Trạng thái").selectOption("");

  // Disable flow is dialog-gated and single-submit.
  await page.getByRole("button", { name: "Khóa tài khoản" }).click();
  const dialog = page.getByRole("dialog", { name: "Khóa tài khoản này?" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("patient.a@example.test")).toBeVisible();
  await dialog.getByRole("button", { name: "Khóa tài khoản" }).click();
  await expect(dialog).toBeHidden();
  expect(patchedStatuses).toEqual(["DISABLED"]);
});

test("admin users page edits roles through checkbox dialog and rejects an empty set", async ({ context, page }) => {
  await installAdminSession(context);

  const patchedRoleSets: string[][] = [];
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
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(pageEnvelope([PATIENT_USER])) });
      return;
    }
    if (request.method() === "PATCH" && url.pathname.endsWith("/roles")) {
      const body = JSON.parse(request.postData() ?? "{}") as { roles: string[] };
      patchedRoleSets.push(body.roles);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...PATIENT_USER, roles: body.roles }),
      });
      return;
    }
    await route.fallback();
  });

  await page.goto("/admin/users");
  await expect(page.getByText("Nguyễn Văn An")).toBeVisible();

  await page.getByRole("button", { name: "Vai trò" }).click();
  const dialog = page.getByRole("dialog", { name: "Chỉnh sửa vai trò" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/Bác sĩ/).check();

  // Empty role set is blocked client-side before any request leaves.
  await dialog.getByLabel(/Bác sĩ/).uncheck();
  await dialog.getByLabel(/Bệnh nhân/).uncheck();
  await expect(dialog.getByRole("button", { name: "Lưu vai trò" })).toBeDisabled();
  await dialog.getByLabel(/Bệnh nhân/).check();
  await dialog.getByLabel(/Bác sĩ/).check();
  await dialog.getByRole("button", { name: "Lưu vai trò" }).click();
  await expect(dialog).toBeHidden();
  expect(patchedRoleSets).toEqual([["PATIENT", "DOCTOR"]]);
});
