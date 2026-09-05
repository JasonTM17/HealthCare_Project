import { expect, test, type BrowserContext } from "@playwright/test";
import type {
  AiChatExchange,
  AiChatMessage,
  AiChatMessagePage,
  AiConversation,
} from "../../types/hospital";
import {
  assertNoSensitiveBrowserStorage,
  browserSessionFixture,
  installMockPatientPortalSession,
} from "./helpers/browser-session";

const PATIENT_SESSION = browserSessionFixture("PATIENT", "patient-chat-e2e", "Nguyễn An");

const BASE_CONVERSATION: AiConversation = {
  id: "conversation-1",
  title: "Chuẩn bị khám tim mạch",
  status: "ACTIVE",
  inFlight: false,
  createdAt: "2026-08-20T08:00:00Z",
  updatedAt: "2026-08-23T03:10:00Z",
  lastMessageAt: "2026-08-23T03:10:00Z",
  expiresAt: "2026-11-21T03:10:00Z",
};

function message(
  id: string,
  role: AiChatMessage["role"],
  status: AiChatMessage["status"],
  content: string,
  sequence: number,
  citations: AiChatMessage["citations"] = [],
): AiChatMessage {
  return {
    id,
    role,
    status,
    content,
    sequence,
    disclaimer: role === "ASSISTANT" ? "Thông tin chỉ dùng để tham khảo và không thay thế bác sĩ." : null,
    provenance: role === "ASSISTANT" ? "local_provider" : null,
    citations,
    createdAt: `2026-08-23T03:${String(sequence).padStart(2, "0")}:00Z`,
    completedAt: status === "COMPLETED" ? `2026-08-23T03:${String(sequence).padStart(2, "0")}:10Z` : null,
  };
}

function persistedExchangeSse(exchange: AiChatExchange): string {
  const answer = exchange.assistantMessage.content ?? "";
  const delta = answer
    .split(/\r?\n/)
    .map((line) => `data: ${line}`)
    .join("\n");
  return `event: delta\n${delta}\n\nevent: done\ndata: ${JSON.stringify(exchange)}\n\n`;
}

interface PatientChatMockOptions {
  loseFirstResponseForContent?: string;
  terminallyFailFirstResponseForContent?: string;
}

async function installPatientChatMocks(
  context: BrowserContext,
  idempotencyKeys: string[],
  options: PatientChatMockOptions = {},
) {
  let conversation = { ...BASE_CONVERSATION };
  let conversations = [conversation];
  let history: AiChatMessage[] = [
    message("message-1", "USER", "COMPLETED", "Tôi nên nhịn ăn trước buổi khám không?", 1),
    message("message-2", "ASSISTANT", "COMPLETED", "Hãy kiểm tra hướng dẫn của gói khám và xác nhận với cơ sở trước khi nhịn ăn.", 2),
    message("message-3", "USER", "COMPLETED", "Tôi cần chuẩn bị gì cho buổi khám tim mạch?", 3),
    message(
      "message-4",
      "ASSISTANT",
      "COMPLETED",
      "Mang theo đơn thuốc đang dùng, kết quả cũ và danh sách triệu chứng bạn đã ghi nhận.",
      4,
      [{ source_type: "specialty", source_id: "specialty-heart", title: "Chuyên khoa Tim mạch" }],
    ),
    message("message-5", "USER", "FAILED", "Tôi có cần mang kết quả xét nghiệm cũ không?", 5),
  ];
  const exchangesByKey = new Map<string, { content: string; exchange: AiChatExchange }>();
  const terminalAttemptsByKey = new Map<string, string>();
  let responseLossInjected = false;
  let terminalFailureInjected = false;

  await context.route("**/api/v1/ai/chat-policy", async (route) => {
    expect(route.request().headers()["authorization"]).toBeUndefined();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        policyVersion: "2026-08-23",
        retentionDays: 90,
        consentText: "Tôi đồng ý dùng trợ lý sức khỏe.",
        limitationText: "Không thay thế bác sĩ.",
        remoteProviderEnabled: false,
      }),
    });
  });

  await context.route("**/api/v1/ai/conversations**", async (route) => {
    const request = route.request();
    expect(request.headers()["authorization"]).toBeUndefined();
    const url = new URL(request.url());
    const method = request.method();

    if (url.pathname === "/api/v1/ai/conversations" && method === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(conversations) });
      return;
    }

    if (url.pathname === "/api/v1/ai/conversations" && method === "POST") {
      conversation = {
        ...BASE_CONVERSATION,
        id: "conversation-2",
        title: "Cuộc trò chuyện mới",
        createdAt: "2026-08-23T04:00:00Z",
        updatedAt: "2026-08-23T04:00:00Z",
        lastMessageAt: null,
      };
      conversations = [conversation, ...conversations];
      history = [];
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(conversation) });
      return;
    }

    const match = url.pathname.match(/^\/api\/v1\/ai\/conversations\/([^/]+)(?:\/(messages)(?:\/(stream))?)?$/);
    if (!match) throw new Error(`Unexpected chat request: ${method} ${url.pathname}${url.search}`);
    const [, conversationId, resource, streamResource] = match;
    const isStreamingSend = streamResource === "stream";

    if (!resource && method === "GET") {
      const found = conversations.find((item) => item.id === conversationId);
      await route.fulfill({
        status: found ? 200 : 404,
        contentType: "application/json",
        body: JSON.stringify(found ?? { code: "AI_CONVERSATION_NOT_FOUND", message: "Missing" }),
      });
      return;
    }

    if (!resource && method === "DELETE") {
      conversations = conversations.filter((item) => item.id !== conversationId);
      history = [];
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    if (resource === "messages" && method === "GET") {
      const cursor = url.searchParams.get("cursor");
      const page: AiChatMessagePage = cursor
        ? { content: history.filter((item) => item.sequence < Number(cursor)), nextCursor: null, hasMore: false }
        : { content: history.filter((item) => item.sequence >= 3), nextCursor: history.some((item) => item.sequence < 3) ? "3" : null, hasMore: history.some((item) => item.sequence < 3) };
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(page) });
      return;
    }

    if (resource === "messages" && method === "POST") {
      if (isStreamingSend) expect(request.headers()["accept"]).toContain("text/event-stream");
      const idempotencyKey = request.headers()["idempotency-key"];
      if (!idempotencyKey) throw new Error("Patient chat POST omitted Idempotency-Key");
      idempotencyKeys.push(idempotencyKey);
      const payload = request.postDataJSON() as { content: string };
      const priorAttempt = exchangesByKey.get(idempotencyKey);
      if (priorAttempt) {
        if (priorAttempt.content !== payload.content) {
          await route.fulfill({
            status: 409,
            contentType: "application/json",
            body: JSON.stringify({ code: "CHAT_IDEMPOTENCY_CONFLICT", message: "Idempotency conflict" }),
          });
          return;
        }
        const replayedExchange = { ...priorAttempt.exchange, replayed: true };
        await route.fulfill(isStreamingSend
          ? { status: 200, contentType: "text/event-stream", body: persistedExchangeSse(replayedExchange) }
          : { status: 200, contentType: "application/json", body: JSON.stringify(replayedExchange) });
        return;
      }

      const terminalAttemptContent = terminalAttemptsByKey.get(idempotencyKey);
      if (terminalAttemptContent) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            code: "AI_UNAVAILABLE",
            message: "The previous attempt failed. Retry with a new Idempotency-Key.",
          }),
        });
        return;
      }

      const nextSequence = Math.max(0, ...history.map((item) => item.sequence)) + 1;
      if (!terminalFailureInjected && payload.content === options.terminallyFailFirstResponseForContent) {
        terminalFailureInjected = true;
        history = [...history, message(`message-${nextSequence}`, "USER", "FAILED", payload.content, nextSequence)];
        terminalAttemptsByKey.set(idempotencyKey, payload.content);
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            code: "AI_UNAVAILABLE",
            message: "The previous attempt failed. Retry with a new Idempotency-Key.",
          }),
        });
        return;
      }

      const userMessage = message(`message-${nextSequence}`, "USER", "COMPLETED", payload.content, nextSequence);
      const assistantMessage = message(
        `message-${nextSequence + 1}`,
        "ASSISTANT",
        "COMPLETED",
        "Hãy mang kết quả cũ để bác sĩ có thêm thông tin so sánh trong buổi khám.",
        nextSequence + 1,
        [{ source_type: "article", source_id: "article-preparation", title: "Chuẩn bị trước khi đi khám" }],
      );
      history = [...history, userMessage, assistantMessage];
      conversation = {
        ...conversation,
        title: payload.content.slice(0, 72),
        updatedAt: assistantMessage.createdAt,
        lastMessageAt: assistantMessage.createdAt,
      };
      conversations = [conversation, ...conversations.filter((item) => item.id !== conversation.id)];
      const exchange: AiChatExchange = { userMessage, assistantMessage, replayed: false };
      exchangesByKey.set(idempotencyKey, { content: payload.content, exchange });
      if (!responseLossInjected && payload.content === options.loseFirstResponseForContent) {
        responseLossInjected = true;
        await route.abort("connectionreset");
        return;
      }
      await route.fulfill(isStreamingSend
        ? { status: 200, contentType: "text/event-stream", body: persistedExchangeSse(exchange) }
        : { status: 200, contentType: "application/json", body: JSON.stringify(exchange) });
      return;
    }

    throw new Error(`Unexpected chat request: ${method} ${url.pathname}${url.search}`);
  });
  await installMockPatientPortalSession(context, PATIENT_SESSION);

  return {
    get history() {
      return [...history];
    },
  };
}

const VIEWPORTS = [
  { name: "phone", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 1000 },
] as const;

for (const viewport of VIEWPORTS) {
  test(`patient chat composes without horizontal overflow at ${viewport.width}px`, async ({ context, page }) => {
    const idempotencyKeys: string[] = [];
    await installPatientChatMocks(context, idempotencyKeys);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/patient/chat");

    await expect(page.getByRole("heading", { name: "Trao đổi có lưu lịch sử" })).toBeVisible();
    await expect(page.getByText("Tình huống khẩn cấp.")).toBeVisible();
    await expect(page.getByText("Trợ lý không thay thế bác sĩ, chẩn đoán, đơn thuốc hoặc hướng dẫn cấp cứu.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Chuẩn bị khám tim mạch" })).toBeVisible();

    const overflow = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      portalNavigation: (() => {
        const element = document.querySelector<HTMLElement>(".portal-nav");
        return element ? element.scrollWidth - element.clientWidth : 0;
      })(),
    }));
    expect(overflow.document).toBeLessThanOrEqual(1);
    expect(overflow.portalNavigation).toBeLessThanOrEqual(1);

    const undersizedTargets = await page.locator("a, button, textarea").evaluateAll((elements) => elements.flatMap((element) => {
      const htmlElement = element as HTMLElement;
      const rect = htmlElement.getBoundingClientRect();
      const visible = rect.width > 0 && rect.height > 0 && window.getComputedStyle(htmlElement).visibility !== "hidden";
      if (!visible || (rect.width >= 44 && rect.height >= 44)) return [];
      return [`${htmlElement.tagName.toLowerCase()}[${htmlElement.getAttribute("aria-label") ?? htmlElement.textContent?.trim() ?? ""}]:${Math.round(rect.width)}x${Math.round(rect.height)}`];
    }));
    expect(undersizedTargets).toEqual([]);

    await page.screenshot({
      path: `test-results/patient-chat-${viewport.width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    await assertNoSensitiveBrowserStorage(page, ["Tôi cần chuẩn bị gì cho buổi khám tim mạch?"]);
  });
}

test("patient chat gives a terminal failed message and a new composer message distinct keys", async ({ context, page }) => {
  const idempotencyKeys: string[] = [];
  await installPatientChatMocks(context, idempotencyKeys);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/patient/chat");

  await page.getByRole("button", { name: "Tải tin nhắn cũ hơn" }).click();
  await expect(page.getByText("Tôi nên nhịn ăn trước buổi khám không?")).toBeVisible();

  await page.getByRole("button", { name: "Thử gửi lại" }).click();
  await expect(page.getByText("Hãy mang kết quả cũ để bác sĩ có thêm thông tin so sánh trong buổi khám.").last()).toBeVisible();

  const composer = page.getByLabel("Tin nhắn của bạn");
  await composer.fill("Tôi nên mang theo danh sách thuốc đang dùng không?");
  await page.getByRole("button", { name: "Gửi tin nhắn" }).click();
  await expect(
    page.getByRole("log", { name: "Lịch sử tin nhắn" })
      .getByText("Tôi nên mang theo danh sách thuốc đang dùng không?", { exact: true }),
  ).toBeVisible();

  expect(idempotencyKeys).toHaveLength(2);
  expect(idempotencyKeys[0]).toMatch(/^chat-[0-9a-f-]{36}$/);
  expect(idempotencyKeys[1]).toMatch(/^chat-[0-9a-f-]{36}$/);
  expect(idempotencyKeys[0]).not.toBe(idempotencyKeys[1]);

  await page.getByRole("button", { name: /Xóa cuộc trò chuyện/ }).click();
  const dialog = page.getByRole("dialog", { name: "Xóa cuộc trò chuyện?" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("không thể khôi phục");
  await dialog.getByRole("button", { name: "Giữ lại" }).click();
  await expect(dialog).not.toBeVisible();
  await assertNoSensitiveBrowserStorage(page, ["Tôi nên mang theo danh sách thuốc đang dùng không?"]);
});

test("patient chat reuses the idempotency key after response loss without a duplicate exchange", async ({ context, page }) => {
  const content = "Tôi cần chuẩn bị giấy tờ gì cho lần khám này?";
  const idempotencyKeys: string[] = [];
  const chat = await installPatientChatMocks(context, idempotencyKeys, {
    loseFirstResponseForContent: content,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/patient/chat");

  const composer = page.getByLabel("Tin nhắn của bạn");
  await composer.fill(content);
  await page.getByRole("button", { name: "Gửi tin nhắn" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "Kết nối tới trợ lý đang bị gián đoạn" })).toBeVisible();
  await expect(page.getByRole("log", { name: "Lịch sử tin nhắn" }).getByText(content, { exact: true })).toHaveCount(1);
  await expect(page.getByText("Hãy mang kết quả cũ để bác sĩ có thêm thông tin so sánh trong buổi khám.").last()).toBeVisible();
  expect(idempotencyKeys).toHaveLength(1);

  await page.getByRole("button", { name: "Gửi tin nhắn" }).click();
  await expect(page.getByText("Trợ lý đã phản hồi. Lịch sử bên dưới được tải lại từ máy chủ.")).toBeVisible();

  expect(idempotencyKeys).toHaveLength(2);
  expect(idempotencyKeys[1]).toBe(idempotencyKeys[0]);
  expect(chat.history.filter((item) => item.role === "USER" && item.content === content)).toHaveLength(1);
  expect(chat.history.filter((item) => item.role === "ASSISTANT" && item.sequence > 5)).toHaveLength(1);
  await assertNoSensitiveBrowserStorage(page, [content]);
});

test("patient chat retires the key only after an explicit terminal backend failure", async ({ context, page }) => {
  const content = "Tôi có thể thử hỏi lại sau khi trợ lý lỗi không?";
  const idempotencyKeys: string[] = [];
  await installPatientChatMocks(context, idempotencyKeys, {
    terminallyFailFirstResponseForContent: content,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/patient/chat");

  const composer = page.getByLabel("Tin nhắn của bạn");
  await composer.fill(content);
  await page.getByRole("button", { name: "Gửi tin nhắn" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Trợ lý tạm thời chưa thể phản hồi" })).toBeVisible();
  expect(idempotencyKeys).toHaveLength(1);

  await page.getByRole("button", { name: "Gửi tin nhắn" }).click();
  await expect(page.getByText("Trợ lý đã phản hồi. Lịch sử bên dưới được tải lại từ máy chủ.")).toBeVisible();
  expect(idempotencyKeys).toHaveLength(2);
  expect(idempotencyKeys[1]).not.toBe(idempotencyKeys[0]);
  await assertNoSensitiveBrowserStorage(page, [content]);
});
