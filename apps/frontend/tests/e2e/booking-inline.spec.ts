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

    const inlineRegion = page.locator(".booking-page__inline");
    await expect(inlineRegion).toBeVisible();
    await expect(page.getByRole("heading", { name: "Hoàn tất lịch khám trong cùng một trang" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Đặt lịch trực tuyến nhanh chóng" })).toBeVisible();
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
    await expect(page.locator('[aria-modal="true"]')).toHaveCount(0);
    await expect(page.getByLabel("Chuyên khoa")).toHaveValue(SPECIALTY.id);

    await page.getByRole("button", { name: "Đi tới form đặt lịch" }).click();

    await expect(inlineRegion).toBeFocused();
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
    await expect(page.locator('[aria-modal="true"]')).toHaveCount(0);
    expect(backend.unexpectedApiRequests).toEqual([]);
  } finally {
    await backend.close();
  }
});
