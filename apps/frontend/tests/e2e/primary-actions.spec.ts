import { expect, test, type BrowserContext } from "@playwright/test";
import type {
  AuthSession,
  Doctor,
  DoctorPortalAppointment,
  Specialty,
} from "../../types/hospital";

const AUTH_STORAGE_KEY = "healthcare.auth.session";

function session(role: "DOCTOR" | "ADMIN"): AuthSession {
  return {
    accessToken: `primary-action-${role.toLowerCase()}-token`,
    refreshToken: `primary-action-${role.toLowerCase()}-refresh`,
    tokenType: "Bearer",
    expiresIn: 3600,
    user: {
      id: `primary-action-${role.toLowerCase()}`,
      email: `${role.toLowerCase()}@primary-action.local`,
      displayName: `Primary Action ${role}`,
      roles: [`ROLE_${role}`],
    },
  };
}

function pageEnvelope<T>(content: T[]) {
  return {
    content,
    totalElements: content.length,
    totalPages: content.length > 0 ? 1 : 0,
    size: 100,
    number: 0,
    first: true,
    last: true,
    empty: content.length === 0,
  };
}

async function installSession(context: BrowserContext, value: AuthSession): Promise<void> {
  await context.addInitScript(({ key, authSession }) => {
    window.sessionStorage.setItem(key, JSON.stringify(authSession));
    window.sessionStorage.setItem("healthcare-brand-intro-v1", "1");
  }, { key: AUTH_STORAGE_KEY, authSession: value });
}

test("doctor primary appointment action sends the authorized status mutation", async ({ context, page }) => {
  const doctorSession = session("DOCTOR");
  const doctor: Doctor = {
    id: "doctor-primary-action",
    fullName: "BS.CKII Nguyễn Minh",
    slug: "nguyen-minh",
    bio: "Bác sĩ Tim mạch",
    title: "Bác sĩ Tim mạch",
    specialtyName: "Tim mạch",
    active: true,
  };
  let appointment: DoctorPortalAppointment = {
    id: "appointment-primary-action",
    bookingCode: "HC-DOCTOR-0001",
    patientId: "00000000-0000-0000-0000-000000000111",
    patientName: "Nguyễn Văn An",
    specialtyName: "Tim mạch",
    branchId: "branch-primary-action",
    branchName: "HealthCare Quận 1",
    appointmentDate: "2026-08-23",
    startTime: "08:00:00",
    endTime: "08:30:00",
    status: "CONFIRMED",
    reasonForVisit: "Tái khám",
    createdAt: "2026-08-22T10:00:00Z",
  };
  const unexpectedRequests: string[] = [];

  await installSession(context, doctorSession);
  await context.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "GET" && url.pathname === "/api/v1/doctor/appointments") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(pageEnvelope([appointment])) });
      return;
    }
    if (request.method() === "GET" && url.pathname === "/api/v1/doctor/profile") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(doctor) });
      return;
    }
    if (request.method() === "PATCH" && url.pathname === `/api/v1/doctor/appointments/${appointment.id}/status`) {
      const payload = request.postDataJSON() as { status: DoctorPortalAppointment["status"] };
      appointment = { ...appointment, status: payload.status };
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(appointment) });
      return;
    }

    unexpectedRequests.push(`${request.method()} ${url.pathname}`);
    await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Unhandled doctor action request" }) });
  });

  await page.goto("/doctor/dashboard");
  await expect(page.getByText("HC-DOCTOR-0001", { exact: true })).toBeVisible();

  const requestPromise = page.waitForRequest((request) => (
    request.method() === "PATCH"
    && new URL(request.url()).pathname === `/api/v1/doctor/appointments/${appointment.id}/status`
  ));
  await page.getByRole("button", { name: "Tiếp nhận" }).click();
  const request = await requestPromise;

  expect(request.headers()["authorization"]).toBe(`Bearer ${doctorSession.accessToken}`);
  expect(request.postDataJSON()).toEqual({ status: "CHECKED_IN" });
  await expect(page.getByRole("status").filter({ hasText: "Đã cập nhật lịch HC-DOCTOR-0001." })).toBeVisible();
  await expect(
    page.getByLabel("Lịch hẹn trong ngày của bác sĩ").getByText("Đã tiếp nhận", { exact: true }),
  ).toBeVisible();
  expect(unexpectedRequests).toEqual([]);
});

test("admin primary mutation creates a specialty with the authorized REST payload", async ({ context, page }) => {
  const adminSession = session("ADMIN");
  let specialties: Specialty[] = [{
    id: "specialty-existing",
    name: "Nội tổng quát",
    slug: "noi-tong-quat",
    description: "Chăm sóc nội khoa.",
    active: true,
  }];
  const unexpectedRequests: string[] = [];

  await installSession(context, adminSession);
  await context.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "GET" && url.pathname === "/api/v1/admin/specialties") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(pageEnvelope(specialties)) });
      return;
    }
    if (request.method() === "POST" && url.pathname === "/api/v1/admin/specialties") {
      const payload = request.postDataJSON() as Omit<Specialty, "id">;
      const created: Specialty = { id: "specialty-created", ...payload };
      specialties = [...specialties, created];
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(created) });
      return;
    }

    unexpectedRequests.push(`${request.method()} ${url.pathname}`);
    await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Unhandled admin action request" }) });
  });

  await page.goto("/admin/specialties");
  await expect(page.getByRole("heading", { name: "Quản lý chuyên khoa" })).toBeVisible();
  await page.getByLabel("Tên chuyên khoa").fill("Y học giấc ngủ");
  await page.getByLabel("Slug").fill("y-hoc-giac-ngu");
  await page.getByLabel("Mô tả").fill("Đánh giá và hỗ trợ các vấn đề về giấc ngủ.");

  const requestPromise = page.waitForRequest((request) => (
    request.method() === "POST"
    && new URL(request.url()).pathname === "/api/v1/admin/specialties"
  ));
  await page.getByRole("button", { name: "Tạo chuyên khoa" }).click();
  const request = await requestPromise;

  expect(request.headers()["authorization"]).toBe(`Bearer ${adminSession.accessToken}`);
  expect(request.postDataJSON()).toEqual({
    name: "Y học giấc ngủ",
    slug: "y-hoc-giac-ngu",
    description: "Đánh giá và hỗ trợ các vấn đề về giấc ngủ.",
    active: true,
  });
  await expect(page.getByText("Đã tạo chuyên khoa", { exact: true })).toBeVisible();
  await expect(page.getByText("Y học giấc ngủ", { exact: true })).toBeVisible();
  expect(unexpectedRequests).toEqual([]);
});
