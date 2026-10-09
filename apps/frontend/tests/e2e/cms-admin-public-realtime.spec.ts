import { once } from "node:events";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test } from "@playwright/test";
import { createNativeCmsLayout, type CmsPageLayout } from "../../lib/cms-page-layout";
import { resolveCmsPageIdentity } from "../../lib/cms-page-manifest";
import {
  assertNoSensitiveBrowserStorage,
  browserSessionFixture,
  installMockBrowserSession,
} from "./helpers/browser-session";

type CmsContent = {
  slotKey: string;
  componentType: "PAGE_LAYOUT";
  payload: CmsPageLayout;
  status: "PUBLISHED";
  version: number;
  updatedAt: string;
};

const SLOT_KEY = "homepage.layout";
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
    componentType: "PAGE_LAYOUT",
    payload: {
      ...createNativeCmsLayout(resolveCmsPageIdentity("/")!),
      fields: { "hero.title": { kind: "text", value: title }, "hero.body": { kind: "rich", format: "markdown", value: body } },
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
  let workingPayload = structuredClone(publishedContent.payload);
  let workingVersion = 1;
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

      if (method === "GET" && apiPath === "/health") {
        sendJson(response, 200, { status: "ok", service: "healthcare-backend", ai_ready: true });
        return;
      }

      if (method === "GET" && apiPath === "/auth/browser-sessions/current") {
        sendJson(response, 401, { code: "BROWSER_SESSION_REQUIRED" });
        return;
      }

      if (apiPath.startsWith("/hospital/")) {
        sendJson(response, 200, pageEnvelope());
        return;
      }

      // Ultra V4 WS-B mounted `AdminNotificationBell` in app/admin/layout.tsx,
      // so every admin page reads page 0 of its notification feed on mount.
      // This spec's oracle is "the CMS publish touches nothing else"; the bell
      // is shell chrome, not a CMS read, so the fixture serves it an empty page
      // and every other unmapped route still lands in unexpectedApiRequests.
      if (method === "GET" && apiPath === "/notifications") {
        sendJson(response, 200, pageEnvelope());
        return;
      }

      if (method === "GET" && apiPath === `/cms/content/${SLOT_KEY}`) {
        // Public slots no longer receive push events through the live feed;
        // the oracle is now "any authoritative re-read after the publish".
        if (publishRequested) publicReadAfterPublish = true;
        sendJson(response, 200, publishedContent);
        return;
      }

      if (method === "GET" && (
        apiPath === "/cms/content/homepage.hero"
        || apiPath === "/cms/content/homepage.body"
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

      if (apiPath.startsWith("/admin/cms/") && request.headers.authorization) {
        serverErrors.push(`Unexpected browser Authorization header for ${method} ${apiPath}.`);
      }

      if (method === "GET" && apiPath === "/admin/cms/content") {
        sendJson(response, 200, [publishedContent]);
        return;
      }

      if (method === "GET" && apiPath === `/admin/cms/content/${SLOT_KEY}/draft`) {
        sendJson(response, 200, { slotKey: SLOT_KEY, componentType: "PAGE_LAYOUT", expectedVersion: workingVersion, hasDraft: workingVersion !== publishedContent.version, payload: workingPayload, draftUpdatedAt: workingVersion > 1 ? publishedContent.updatedAt : null, publicContent: publishedContent });
        return;
      }

      if (method === "PUT" && apiPath === `/admin/cms/content/${SLOT_KEY}/draft`) {
        const body = await readJsonBody(request) as {
          componentType?: unknown;
          payload?: CmsPageLayout;
          expectedVersion?: unknown;
        };

        if (body.componentType !== "PAGE_LAYOUT") serverErrors.push("Unexpected componentType.");
        if (body.expectedVersion !== 1) serverErrors.push(`Unexpected expectedVersion: ${String(body.expectedVersion)}.`);
        if (body.payload?.fields["hero.title"]?.kind !== "text" || body.payload.fields["hero.title"].value !== UPDATED_TITLE) serverErrors.push("Unexpected title.");
        if (body.payload?.fields["hero.body"]?.kind !== "rich" || body.payload.fields["hero.body"].value !== UPDATED_BODY) serverErrors.push("Unexpected rich body.");
        workingPayload = body.payload!; workingVersion = 2;
        sendJson(response, 200, { slotKey: SLOT_KEY, componentType: "PAGE_LAYOUT", expectedVersion: workingVersion, hasDraft: true, payload: workingPayload, draftUpdatedAt: publishedContent.updatedAt, publicContent: publishedContent });
        return;
      }
      if (method === "POST" && apiPath === `/admin/cms/content/${SLOT_KEY}/publish`) {
        const body = await readJsonBody(request) as { expectedVersion?: unknown };
        if (body.expectedVersion !== 2) serverErrors.push("Publish must promote exactly the saved revision.");
        publishRequested = true;
        publishedContent = { ...cmsContent(3, UPDATED_TITLE, UPDATED_BODY), payload: structuredClone(workingPayload) }; workingVersion = 3;
        sendJson(response, 200, { slotKey: SLOT_KEY, componentType: "PAGE_LAYOUT", expectedVersion: workingVersion, hasDraft: false, payload: workingPayload, draftUpdatedAt: publishedContent.updatedAt, publicContent: publishedContent });
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

test("admin publish reaches the public homepage hero through the bounded poll while no live feed is held", async ({ context }) => {
  // The public slot converges on its next 60s poll instead of a live push, so
  // this test intentionally outlives the suite-wide 30s timeout.
  test.setTimeout(120_000);
  const backend = await startCmsMockBackend();

  try {
    await context.route("**/api/v1/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      await route.continue({ url: `${backend.origin}${url.pathname}${url.search}` });
    });

    const publicPage = await context.newPage();
    await publicPage.goto("/");

    const heroSlot = publicPage.locator('[data-cms-native-field="hero.title"]');
    await expect(heroSlot).toContainText(INITIAL_TITLE);

    let publicMainFrameNavigationsAfterLoad = 0;
    publicPage.on("framenavigated", (frame) => {
      if (frame === publicPage.mainFrame()) publicMainFrameNavigationsAfterLoad += 1;
    });

    const adminPage = await context.newPage();
    await installMockBrowserSession(
      adminPage,
      browserSessionFixture("ADMIN", "admin-cms-e2e", "E2E Admin"),
    );

    await adminPage.goto("/admin/content");
    await expect(adminPage.getByTestId("cms-workspace")).toBeVisible();
    await expect(adminPage.getByText("Chọn văn bản hoặc ảnh trong trang để chỉnh sửa.")).toBeVisible();
    const preview = adminPage.frameLocator('[data-testid="cms-preview-frame"]');
    await preview.locator('[data-cms-native-field="hero.title"]').click();
    await expect(adminPage.getByTestId("cms-field-inspector").getByRole("textbox")).toHaveValue(INITIAL_TITLE);
    await adminPage.getByTestId("cms-field-inspector").getByRole("textbox").fill(UPDATED_TITLE);
    await preview.locator('[data-cms-native-field="hero.body"]').click();
    const tinyBody = adminPage.frameLocator(".tox-edit-area__iframe").locator("body");
    await expect(tinyBody).toBeVisible(); await tinyBody.fill(UPDATED_BODY);
    await adminPage.getByTestId("cms-publish").click();
    await adminPage.getByRole("dialog").getByRole("button", { name: "Xác nhận xuất bản", exact: true }).click();
    await expect(adminPage.getByText("Đã xuất bản nội dung của trang này.")).toBeVisible();
    // The public tab holds no push feed — that invocation pinning was the Fluid
    // memory leak this branch fixes — so it converges on its next 60s poll.
    // 75s covers one full poll cycle from mount.
    await expect(heroSlot).toContainText(UPDATED_TITLE, { timeout: 75_000 });
    await expect(publicPage.locator('[data-cms-native-field="hero.body"]')).toContainText(UPDATED_BODY);
    await expect(heroSlot).not.toContainText(INITIAL_TITLE);

    expect(publicMainFrameNavigationsAfterLoad).toBe(0);
    expect(backend.publishRequested).toBe(true);
    expect(backend.publicReadAfterPublish).toBe(true);
    // Regression guard for the Fluid fix: the public tab must never open the
    // SSE change feed. The mock only marks feedReady when a client connects.
    expect(backend.feedReady).toBe(false);
    expect(backend.unexpectedApiRequests).toEqual([]);
    expect(backend.serverErrors).toEqual([]);
    await assertNoSensitiveBrowserStorage(adminPage);
  } finally {
    await backend.close();
  }
});
