import { once } from "node:events";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test } from "@playwright/test";

const BRANCH = {
  id: "branch-district-1",
  name: "HealthCare Quận 1",
  slug: "healthcare-quan-1",
  address: "01 Nguyễn Huệ, Quận 1",
  phone: "02812345678",
  workingHours: "Thứ 2 - Thứ 7, 07:00 - 17:00",
  active: true,
};

const SPECIALTY = {
  id: "spec-cardiology",
  name: "Tim mạch chuyên sâu",
  slug: "tim-mach",
  description: "Tầm soát và điều trị bệnh lý tim mạch với đội ngũ chuyên khoa.",
  active: true,
};

const DOCTOR = {
  id: "doctor-minh",
  fullName: "BS.CKII Nguyễn Minh",
  slug: "nguyen-minh",
  title: "Bác sĩ Tim mạch",
  specialtyName: SPECIALTY.name,
  specialtySlugs: [SPECIALTY.slug],
  branchId: BRANCH.id,
  branchIds: [BRANCH.id],
  branchNames: [BRANCH.name],
  bio: "Bác sĩ chuyên điều trị tăng huyết áp và bệnh mạch vành.",
  active: true,
};

const SLOT = {
  branchId: BRANCH.id,
  startTime: "08:00:00",
  endTime: "08:30:00",
  available: true,
  statusNote: "Còn trống",
};

function pageEnvelope<T>(content: T[] = []) {
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

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
  });
  response.end(JSON.stringify(body));
}

function readyEvent(): string {
  return [
    "event: ready",
    "data: {\"latestEventId\":0,\"replayLimit\":100,\"snapshotFallback\":\"GET /api/v1/cms/content/{slotKey}?afterEventId={eventId}\"}",
    "",
    "",
  ].join("\n");
}

async function startBookingMockBackend() {
  const unexpectedApiRequests: string[] = [];
  const sseClients = new Set<ServerResponse>();

  const server = createServer((request: IncomingMessage, response: ServerResponse) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    const method = request.method ?? "GET";
    const apiPath = requestUrl.pathname.replace(/^\/api\/v1/, "");

    if (method === "GET" && apiPath === "/cms/content/events") {
      response.writeHead(200, {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Content-Type": "text/event-stream",
      });
      sseClients.add(response);
      response.write(readyEvent());
      request.on("close", () => {
        sseClients.delete(response);
      });
      return;
    }

    if (method === "GET" && apiPath.startsWith("/cms/content/")) {
      sendJson(response, 404, { message: "Slot chưa được xuất bản." });
      return;
    }

    if (method === "GET" && apiPath === "/auth/browser-sessions/current") {
      sendJson(response, 401, { code: "BROWSER_SESSION_REQUIRED" });
      return;
    }

    if (method === "GET" && apiPath === "/hospital/branches") {
      sendJson(response, 200, pageEnvelope([BRANCH]));
      return;
    }

    if (method === "GET" && apiPath === "/hospital/specialties") {
      sendJson(response, 200, pageEnvelope([SPECIALTY]));
      return;
    }

    if (method === "GET" && apiPath === "/hospital/doctors") {
      sendJson(response, 200, pageEnvelope([DOCTOR]));
      return;
    }

    if (method === "GET" && apiPath === `/appointments/doctors/${DOCTOR.id}/slots`) {
      if (requestUrl.searchParams.get("branchId") !== BRANCH.id) {
        sendJson(response, 400, { message: "Unexpected branchId." });
        return;
      }
      sendJson(response, 200, [SLOT]);
      return;
    }

    if (method === "POST" && apiPath === "/appointments/hold") {
      sendJson(response, 200, {
        bookingCode: "HC-E2E-0001",
        holdExpiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
        otpExpiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
        message: "Đã giữ chỗ và gửi OTP.",
        otpRequired: true,
      });
      return;
    }

    if (method === "POST" && apiPath === "/appointments/confirm") {
      sendJson(response, 200, {
        id: "appointment-e2e-1",
        bookingCode: "HC-E2E-0001",
        patientName: "Nguyễn Văn An",
        patientPhone: "0901234567",
        patientEmail: "patient@example.com",
        doctorId: DOCTOR.id,
        doctorName: DOCTOR.fullName,
        doctorTitle: DOCTOR.title,
        specialtyName: SPECIALTY.name,
        branchName: BRANCH.name,
        branchAddress: BRANCH.address,
        appointmentDate: "2026-08-24",
        startTime: SLOT.startTime,
        endTime: SLOT.endTime,
        status: "CONFIRMED",
        paymentStatus: "UNPAID",
        reasonForVisit: "Tái khám tim mạch",
        hasInsurance: false,
        privacyConsentAt: "2026-08-23T05:00:00Z",
        privacyConsentVersion: "v1",
        createdAt: "2026-08-23T05:00:00Z",
      });
      return;
    }

    unexpectedApiRequests.push(`${method} ${apiPath}`);
    sendJson(response, 500, { message: `Unhandled booking e2e request: ${method} ${apiPath}` });
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address() as AddressInfo;
  return {
    origin: `http://127.0.0.1:${address.port}`,
    get unexpectedApiRequests() {
      return [...unexpectedApiRequests];
    },
    close: () => closeServer(server, sseClients),
  };
}

async function closeServer(server: Server, sseClients: Set<ServerResponse>): Promise<void> {
  for (const client of sseClients) {
    client.end();
  }
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

test("booking landing keeps the appointment flow inline without auto-opening a dialog", async ({ context }) => {
  const backend = await startBookingMockBackend();

  try {
    await context.route("**/api/v1/**", async (route) => {
      const requestUrl = new URL(route.request().url());
      await route.continue({ url: `${backend.origin}${requestUrl.pathname}${requestUrl.search}` });
    });

    const page = await context.newPage();
    await page.goto("/dat-lich");

    await expect(page.getByText("Các cơ sở khám nổi bật")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Chọn cơ sở thuận tiện nhất trước khi vào form" })).toBeVisible();
    await expect(page.locator(".booking-page__branch-card")).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Tìm hiểu thêm →" })).toBeVisible();

    const inlineRegion = page.locator(".booking-page__inline");
    await expect(inlineRegion).toBeVisible();
    await expect(page.getByRole("heading", { name: "Hoàn tất lịch khám trong cùng một trang" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Đặt lịch trực tuyến nhanh chóng" })).toBeVisible();
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
    await expect(page.locator('[aria-modal="true"]')).toHaveCount(0);
    await expect(page.getByLabel("Chuyên khoa")).toHaveValue(SPECIALTY.id);

    await page.getByRole("button", { name: "Đặt lịch hẹn" }).first().click();

    await expect(inlineRegion).toBeFocused();
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
    await expect(page.locator('[aria-modal="true"]')).toHaveCount(0);

    await page.getByRole("button", { name: /Tiếp tục: Chọn cơ sở/ }).click();
    await page.getByRole("button", { name: /Tiếp tục: Chọn bác sĩ/ }).click();
    await page.getByRole("button", { name: /Tiếp tục: Chọn ngày/ }).click();
    await page.getByRole("button", { name: /Xem khung giờ/ }).click();
    await expect(page.getByRole("button", { name: /08:00.*Còn trống/ })).toBeEnabled();
    await page.getByRole("button", { name: /Tiếp tục: Điền thông tin/ }).click();

    await page.getByLabel("Họ và tên bệnh nhân").fill("Nguyễn Văn An");
    await page.getByLabel("Số điện thoại liên hệ").fill("0901234567");
    await page.getByLabel("Email nhận mã OTP").fill("patient@example.com");
    await page.getByLabel("Triệu chứng hoặc lý do khám bệnh").fill("Tái khám tim mạch");
    await page.getByLabel(/Tôi đồng ý để HealthCare xử lý thông tin đặt lịch/).check();

    const holdRequestPromise = page.waitForRequest((request) => (
      request.method() === "POST" && new URL(request.url()).pathname === "/api/v1/appointments/hold"
    ));
    await page.getByRole("button", { name: "Giữ chỗ và nhận mã OTP" }).click();
    const holdRequest = await holdRequestPromise;
    expect(holdRequest.postDataJSON()).toMatchObject({
      doctorId: DOCTOR.id,
      specialtyId: SPECIALTY.id,
      branchId: BRANCH.id,
      startTime: SLOT.startTime,
      fullName: "Nguyễn Văn An",
      phone: "0901234567",
      email: "patient@example.com",
      privacyConsent: true,
    });

    await expect(page.getByRole("heading", { name: "Xác nhận lịch hẹn bằng OTP" })).toBeVisible();
    await page.getByLabel("Nhập mã OTP 6 số xác thực").fill("123456");
    const confirmRequestPromise = page.waitForRequest((request) => (
      request.method() === "POST" && new URL(request.url()).pathname === "/api/v1/appointments/confirm"
    ));
    await page.getByRole("button", { name: "Hoàn tất đặt lịch khám" }).click();
    const confirmRequest = await confirmRequestPromise;
    expect(confirmRequest.postDataJSON()).toEqual({ bookingCode: "HC-E2E-0001", otpCode: "123456" });
    await expect(page.getByRole("heading", { name: "Đặt lịch khám thành công!" })).toBeVisible();
    expect(backend.unexpectedApiRequests).toEqual([]);
  } finally {
    await backend.close();
  }
});

test("public booking modal settles catalog loading after its live catalog arrives", async ({ context }) => {
  await context.route("**/api/v1/auth/browser-sessions/current", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      headers: { "Cache-Control": "no-store" },
      body: JSON.stringify({ code: "BROWSER_SESSION_REQUIRED" }),
    });
  });
  await context.route("**/api/v1/hospital/branches?**", async (route) => {
    await route.fulfill({ json: pageEnvelope([BRANCH]) });
  });
  await context.route("**/api/v1/hospital/specialties?**", async (route) => {
    await route.fulfill({ json: pageEnvelope([SPECIALTY]) });
  });
  await context.route("**/api/v1/hospital/doctors?**", async (route) => {
    await route.fulfill({ json: pageEnvelope([DOCTOR]) });
  });
  await context.route("**/api/v1/hospital/packages?**", async (route) => {
    await route.fulfill({ json: pageEnvelope([]) });
  });
  await context.route("**/api/v1/hospital/articles?**", async (route) => {
    await route.fulfill({ json: pageEnvelope([]) });
  });

  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByText("1 cơ sở đang hiển thị", { exact: true })).toBeVisible();
  await page.locator("button.button--nav").first().click();

  const bookingDialog = page.getByRole("dialog", { name: "Đặt lịch trực tuyến nhanh chóng" });
  await expect(bookingDialog).toBeVisible();
  await expect(bookingDialog.getByText("Đang tải thông tin bác sĩ, chuyên khoa và cơ sở…")).toBeHidden();
  await expect(bookingDialog.getByLabel("Chuyên khoa")).toHaveValue(SPECIALTY.id);
  await expect(bookingDialog.getByRole("button", { name: /Tiếp tục: Chọn cơ sở/ })).toBeEnabled();
});
