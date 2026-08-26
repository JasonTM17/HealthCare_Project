import { expect, test, type BrowserContext } from "@playwright/test";
import type {
  Branch,
  Doctor,
  DoctorPortalAppointment,
  Specialty,
} from "../../types/hospital";
import {
  assertNoSensitiveBrowserStorage,
  browserSessionFixture,
  installMockBrowserSession,
} from "./helpers/browser-session";

function session(role: "DOCTOR" | "ADMIN") {
  return browserSessionFixture(role, `primary-action-${role.toLowerCase()}`, `Primary Action ${role}`);
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

  await context.route("**/api/v1/**", async (route) => {
    const request = route.request();
    expect(request.headers()["authorization"]).toBeUndefined();
    const url = new URL(request.url());
    if (request.method() === "GET" && url.pathname === "/api/v1/doctor/appointments") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(pageEnvelope([appointment])) });
      return;
    }
    if (request.method() === "GET" && url.pathname === "/api/v1/doctor/profile") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(doctor) });
      return;
    }
    if (request.method() === "GET" && url.pathname === "/api/v1/hospital/branches") {
      const branch: Branch = {
        id: "branch-primary-action",
        name: "HealthCare Quận 1",
        slug: "healthcare-quan-1",
        address: "Quận 1, TP.HCM",
        active: true,
      };
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(pageEnvelope([branch])) });
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
  await installMockBrowserSession(context, doctorSession);

  await page.goto("/doctor/dashboard");
  await expect(page.getByText("HC-DOCTOR-0001", { exact: true })).toBeVisible();

  const requestPromise = page.waitForRequest((request) => (
    request.method() === "PATCH"
    && new URL(request.url()).pathname === `/api/v1/doctor/appointments/${appointment.id}/status`
  ));
  await page.getByRole("button", { name: "Tiếp nhận" }).click();
  const request = await requestPromise;

  expect(request.headers()["authorization"]).toBeUndefined();
  expect(request.postDataJSON()).toEqual({ status: "CHECKED_IN" });
  await expect(page.getByRole("status").filter({ hasText: "Đã cập nhật lịch HC-DOCTOR-0001." })).toBeVisible();
  await expect(
    page.getByLabel("Lịch hẹn trong ngày của bác sĩ").getByText("Đã tiếp nhận", { exact: true }),
  ).toBeVisible();
  expect(unexpectedRequests).toEqual([]);
  await assertNoSensitiveBrowserStorage(page);
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

  await context.route("**/api/v1/**", async (route) => {
    const request = route.request();
    expect(request.headers()["authorization"]).toBeUndefined();
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
  await installMockBrowserSession(context, adminSession);

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

  expect(request.headers()["authorization"]).toBeUndefined();
  expect(request.postDataJSON()).toEqual({
    name: "Y học giấc ngủ",
    slug: "y-hoc-giac-ngu",
    description: "Đánh giá và hỗ trợ các vấn đề về giấc ngủ.",
    active: true,
  });
  await expect(page.getByText("Đã tạo chuyên khoa", { exact: true })).toBeVisible();
  await expect(page.getByText("Y học giấc ngủ", { exact: true })).toBeVisible();
  expect(unexpectedRequests).toEqual([]);
  await assertNoSensitiveBrowserStorage(page);
});
