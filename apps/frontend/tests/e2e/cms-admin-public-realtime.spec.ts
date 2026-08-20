import { once } from "node:events";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test } from "@playwright/test";

type CmsContent = {
  slotKey: string;
  componentType: "HERO";
  payload: {
    eyebrow: string;
    title: string;
    body: string;
    ctaLabel: string;
    ctaHref: string;
    imageUrl: string;
  };
  status: "PUBLISHED";
  version: number;
  updatedAt: string;
};

const AUTH_STORAGE_KEY = "healthcare.auth.session";
const SLOT_KEY = "homepage.hero";
const INITIAL_TITLE = "Trung tâm chăm sóc chủ động";
const UPDATED_TITLE = "Trung tâm chăm sóc realtime";
const UPDATED_BODY = "Nội dung hero này được admin xuất bản và đồng bộ sang tab người dùng.";

function pageEnvelope<T>(content: T[] = []) {
  return {
    content,
    totalElements: content.length,
    totalPages: content.length > 0 ? 1 : 0,
    size: 50,
    number: 0,
    first: true,
    last: true,
    empty: content.length === 0,
  };
}

function cmsContent(version: number, title: string, body: string): CmsContent {
  return {
    slotKey: SLOT_KEY,
    componentType: "HERO",
    payload: {
      eyebrow: "HealthCare CMS",
      title,
      body,
      ctaLabel: "Đặt lịch khám",
      ctaHref: "/dat-lich",
      imageUrl: "/icon.svg",
    },
    status: "PUBLISHED",
    version,
    updatedAt: `2026-08-21T10:00:0${version}Z`,
  };
}

function historyEntry(content: CmsContent, eventId: number) {
  return {
    eventId,
    slotKey: content.slotKey,
    componentType: content.componentType,
    status: content.status,
    payload: content.payload,
    version: content.version,
    actorEmail: "admin@healthcare.local",
    changedAt: content.updatedAt,
    rollbackAvailable: false,
  };
}

function eventChunk(eventName: string, data: unknown, eventId?: number): string {
  const lines = [
    `event: ${eventName}`,
    eventId === undefined ? undefined : `id: ${eventId}`,
    `data: ${JSON.stringify(data)}`,
    "",
    "",
  ];
  return lines.filter((line) => line !== undefined).join("\n");
}

function feedReadyEvent(): string {
  const ready = {
    latestEventId: 1,
    replayLimit: 100,
    snapshotFallback: "GET /api/v1/cms/content/{slotKey}?afterEventId={eventId}",
  };
  return eventChunk("ready", ready);
}

function contentChangedEvent(content: CmsContent, eventId: number): string {
  const changed = {
    eventId,
    slotKey: content.slotKey,
    version: content.version,
    published: true,
    updatedAt: content.updatedAt,
  };
  return eventChunk("cms-content-changed", changed, eventId);
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const body = Buffer.concat(chunks).toString("utf8");
  return body ? JSON.parse(body) as unknown : undefined;
}

async function startCmsMockBackend() {
  let publishedContent = cmsContent(1, INITIAL_TITLE, "Nội dung ban đầu từ backend CMS.");
  let publishRequested = false;
  let publicReadAfterPublish = false;
  let feedReady = false;
  const unexpectedApiRequests: string[] = [];
  const serverErrors: string[] = [];
  const sseClients = new Set<ServerResponse>();
  let resolveFeedReady: () => void = () => undefined;
  const feedReadyPromise = new Promise<void>((resolve) => {
    resolveFeedReady = resolve;
  });

  const server = createServer((request, response) => {
    void (async (): Promise<void> => {
      const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
      const method = request.method ?? "GET";
      const apiPath = requestUrl.pathname.replace(/^\/api\/v1/, "");

      if (apiPath.startsWith("/hospital/")) {
        sendJson(response, 200, pageEnvelope());
        return;
      }

      if (method === "GET" && apiPath === `/cms/content/${SLOT_KEY}`) {
        if (requestUrl.searchParams.get("afterEventId") === "2") publicReadAfterPublish = true;
        sendJson(response, 200, publishedContent);
        return;
      }

      if (method === "GET" && (
        apiPath === "/cms/content/homepage.body"
        || apiPath === "/cms/content/homepage.sidebar"
        || apiPath === "/cms/content/homepage.footer"
      )) {
        sendJson(response, 404, { message: "Slot chưa được xuất bản." });
        return;
      }

      if (method === "GET" && apiPath === "/cms/content/events") {
        response.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        });
        sseClients.add(response);
        response.write(feedReadyEvent());
        feedReady = true;
        resolveFeedReady();
        request.on("close", () => {
          sseClients.delete(response);
        });
        return;
      }

      if (apiPath.startsWith("/admin/cms/")
        && request.headers.authorization !== "Bearer e2e-admin-token") {
        serverErrors.push(`Missing admin bearer token for ${method} ${apiPath}.`);
        sendJson(response, 401, { message: "Missing bearer token." });
        return;
      }

      if (method === "GET" && apiPath === "/admin/cms/content") {
        sendJson(response, 200, [publishedContent]);
        return;
      }

      if (method === "GET" && apiPath === `/admin/cms/content/${SLOT_KEY}`) {
        sendJson(response, 200, publishedContent);
        return;
      }

      if (method === "PUT" && apiPath === `/admin/cms/content/${SLOT_KEY}`) {
        const body = await readJsonBody(request) as {
          componentType?: unknown;
          payload?: { title?: unknown; body?: unknown };
          status?: unknown;
          expectedVersion?: unknown;
        };

        if (body.componentType !== "HERO") serverErrors.push(`Unexpected componentType: ${String(body.componentType)}.`);
        if (body.status !== "PUBLISHED") serverErrors.push(`Unexpected status: ${String(body.status)}.`);
        if (body.expectedVersion !== 1) serverErrors.push(`Unexpected expectedVersion: ${String(body.expectedVersion)}.`);
        if (body.payload?.title !== UPDATED_TITLE) serverErrors.push(`Unexpected title: ${String(body.payload?.title)}.`);

        publishRequested = true;
        publishedContent = cmsContent(2, UPDATED_TITLE, String(body.payload?.body ?? UPDATED_BODY));
        sendJson(response, 200, publishedContent);
        for (const client of sseClients) {
          client.write(contentChangedEvent(publishedContent, 2));
        }
        return;
      }

      if (method === "GET" && apiPath === `/admin/cms/content/${SLOT_KEY}/history`) {
        sendJson(response, 200, [historyEntry(publishedContent, publishedContent.version)]);
        return;
      }

      unexpectedApiRequests.push(`${method} ${apiPath}`);
      sendJson(response, 500, { message: `Unhandled test API request: ${method} ${apiPath}` });
    })().catch((error: unknown) => {
      serverErrors.push(error instanceof Error ? error.message : "Unhandled mock backend error.");
      if (!response.headersSent) {
        sendJson(response, 500, { message: "Mock backend failed." });
      } else {
        response.end();
      }
    });
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address() as AddressInfo;
  const origin = `http://127.0.0.1:${address.port}`;
  return {
    origin,
    get feedReady() {
      return feedReady;
    },
    get publishRequested() {
      return publishRequested;
    },
    get publicReadAfterPublish() {
      return publicReadAfterPublish;
    },
    get unexpectedApiRequests() {
      return [...unexpectedApiRequests];
    },
    get serverErrors() {
      return [...serverErrors];
    },
    waitForFeedReady: () => feedReadyPromise,
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

test("admin publish updates the public homepage hero through the live CMS feed", async ({ context }) => {
  const backend = await startCmsMockBackend();

  try {
    await context.route("**/api/v1/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      await route.continue({ url: `${backend.origin}${url.pathname}${url.search}` });
    });

    const publicPage = await context.newPage();
    await publicPage.goto("/");

    const heroSlot = publicPage.locator('[data-cms-live-slot="hero"]');
    await expect(heroSlot).toContainText(INITIAL_TITLE);
    await expect(heroSlot).toHaveAttribute("data-cms-version", "1");
    await backend.waitForFeedReady();
    expect(backend.feedReady).toBe(true);

    let publicMainFrameNavigationsAfterLoad = 0;
    publicPage.on("framenavigated", (frame) => {
      if (frame === publicPage.mainFrame()) publicMainFrameNavigationsAfterLoad += 1;
    });

    const adminPage = await context.newPage();
    await adminPage.addInitScript(({ key }) => {
      window.sessionStorage.setItem(key, JSON.stringify({
        accessToken: "e2e-admin-token",
        refreshToken: "e2e-refresh-token",
        tokenType: "Bearer",
        expiresIn: 3600,
        user: {
          id: "admin-1",
          email: "admin@healthcare.local",
          displayName: "E2E Admin",
          roles: ["ROLE_ADMIN"],
        },
      }));
    }, { key: AUTH_STORAGE_KEY });

    await adminPage.goto("/admin/content");
    await expect(adminPage.getByRole("heading", { name: "Chỉnh sửa một component theo slot" })).toBeVisible();
    await expect(adminPage.locator("#cms-payload-title")).toHaveValue(INITIAL_TITLE);

    await adminPage.locator("#cms-payload-title").fill(UPDATED_TITLE);
    await adminPage.locator("#cms-payload-body").fill(UPDATED_BODY);
    await adminPage.getByRole("button", { name: "Xuất bản" }).click();

    await expect(adminPage.getByText("Đã xuất bản homepage.hero, version 2.")).toBeVisible();
    await expect(heroSlot).toContainText(UPDATED_TITLE);
    await expect(heroSlot).toContainText(UPDATED_BODY);
    await expect(heroSlot).toHaveAttribute("data-cms-version", "2");
    await expect(heroSlot).not.toContainText(INITIAL_TITLE);

    expect(publicMainFrameNavigationsAfterLoad).toBe(0);
    expect(backend.publishRequested).toBe(true);
    expect(backend.publicReadAfterPublish).toBe(true);
    expect(backend.unexpectedApiRequests).toEqual([]);
    expect(backend.serverErrors).toEqual([]);
  } finally {
    await backend.close();
  }
});
