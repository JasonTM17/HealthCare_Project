import { expect, test, type BrowserContext } from "@playwright/test";
import type { AiChatExchange, AiChatMessage, AiConversation } from "../../types/hospital";
import {
  assertNoSensitiveBrowserStorage,
  browserSessionFixture,
  installMockBrowserSession,
  installMockPatientPortalSession,
} from "./helpers/browser-session";

const PATIENT_SESSION = browserSessionFixture("PATIENT", "floating-assistant-patient", "Nguyễn An");

type LauncherVisualMetrics = {
  width: number;
  height: number;
  background: number[];
  radius: number;
  shadow: string;
};

const CONVERSATION: AiConversation = {
  id: "floating-conversation-1",
  title: "Chuẩn bị đi khám",
  status: "ACTIVE",
  inFlight: false,
  createdAt: "2026-08-23T05:00:00Z",
  updatedAt: "2026-08-23T05:00:00Z",
  lastMessageAt: null,
  expiresAt: "2026-11-21T05:00:00Z",
};

function message(
  id: string,
  role: AiChatMessage["role"],
  content: string,
  sequence: number,
  provenance: AiChatMessage["provenance"] = role === "ASSISTANT" ? "local_provider" : null,
): AiChatMessage {
  return {
    id,
    role,
    status: "COMPLETED",
    content,
    sequence,
    disclaimer: role === "ASSISTANT" ? "Thông tin chỉ dùng để tham khảo." : null,
    provenance,
    citations: role === "ASSISTANT"
      ? [{ source_type: "faq", source_id: "faq-prepare", title: "Chuẩn bị trước khi đi khám" }]
      : [],
    createdAt: `2026-08-23T05:0${sequence}:00Z`,
    completedAt: `2026-08-23T05:0${sequence}:01Z`,
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

async function installChatMocks(
  context: BrowserContext,
  observedKeys: string[],
  options: { failFirstSend?: boolean; assistantProvenance?: AiChatMessage["provenance"] } = {},
) {
  let history: AiChatMessage[] = [];
  let failedFirstSend = false;

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
    if (url.pathname === "/api/v1/ai/conversations" && request.method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      return;
    }
    if (url.pathname === "/api/v1/ai/conversations" && request.method() === "POST") {
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(CONVERSATION) });
      return;
    }
    const isStreamingSend = url.pathname.endsWith("/messages/stream");
    if ((url.pathname.endsWith("/messages") || isStreamingSend) && request.method() === "POST") {
      if (isStreamingSend) expect(request.headers()["accept"]).toContain("text/event-stream");
      const key = request.headers()["idempotency-key"];
      if (!key) throw new Error("Floating assistant omitted Idempotency-Key");
      observedKeys.push(key);
      if (options.failFirstSend && !failedFirstSend) {
        failedFirstSend = true;
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ code: "AI_UNAVAILABLE", message: "provider unavailable" }),
        });
        return;
      }
      const payload = request.postDataJSON() as { content: string };
      const exchange: AiChatExchange = {
        userMessage: message("floating-user-1", "USER", payload.content, 1),
        assistantMessage: message(
          "floating-assistant-1",
          "ASSISTANT",
          "Bạn nên mang giấy tờ tùy thân, kết quả cũ và danh sách thuốc đang dùng.",
          2,
          options.assistantProvenance,
        ),
        replayed: false,
      };
      history = [exchange.userMessage, exchange.assistantMessage];
      await route.fulfill(isStreamingSend
        ? { status: 200, contentType: "text/event-stream", body: persistedExchangeSse(exchange) }
        : { status: 200, contentType: "application/json", body: JSON.stringify(exchange) });
      return;
    }
    if (url.pathname.endsWith("/messages") && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ content: history, nextCursor: null, hasMore: false }),
      });
      return;
    }
    throw new Error(`Unexpected floating assistant request: ${request.method()} ${url.pathname}`);
  });
  await installMockPatientPortalSession(context, PATIENT_SESSION);
}

async function unavailableApi(context: BrowserContext) {
  await context.route("**/api/v1/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (
      pathname === "/api/v1/auth/browser-sessions/current"
      || pathname === "/api/v1/patient/profile"
      || pathname === "/api/v1/patient/ai-credits/status"
    ) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ code: "SERVICE_UNAVAILABLE" }),
    });
  });
}

test("patient portal launcher stays compact and low-emphasis on dense dashboards", async ({ context, page }) => {
  await unavailableApi(context);
  await installMockPatientPortalSession(context, PATIENT_SESSION);
  await page.setViewportSize({ width: 789, height: 900 });
  await page.goto("/patient/dashboard", { waitUntil: "domcontentloaded" });

  const launcher = page.getByRole("button", { name: "Mở trợ lý sức khỏe" });
  await expect(launcher).toBeVisible();
  const metrics = await page.waitForFunction(() => {
    const element = document.querySelector<HTMLButtonElement>("button[aria-controls='floating-health-assistant-panel']");
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    if (style.visibility === "hidden" || style.display === "none" || rect.width < 44 || rect.height < 44) return null;
    return {
      width: rect.width,
      height: rect.height,
      background: style.backgroundColor.match(/[\d.]+/g)?.map(Number) ?? [],
      radius: Number.parseFloat(style.borderTopLeftRadius) || 0,
      shadow: style.boxShadow,
    };
  });
  const visual = await metrics.jsonValue() as LauncherVisualMetrics | null;
  expect(visual).not.toBeNull();
  const launcherVisual = visual!;
  expect(launcherVisual.width).toBeLessThanOrEqual(54);
  expect(launcherVisual.height).toBeLessThanOrEqual(54);
  expect(launcherVisual.background[0]).toBeGreaterThan(245);
  expect(launcherVisual.background[1]).toBeGreaterThan(245);
  expect(launcherVisual.background[2]).toBeGreaterThan(245);
  expect(launcherVisual.radius).toBeLessThanOrEqual(4.1);
  expect(launcherVisual.shadow).toBe("none");
});

test("guest launcher sends stateless hospital-support chat and offers login for history", async ({ context, page }) => {
  await installMockBrowserSession(context, null);
  await context.route("**/api/v1/public/ai/chat", async (route) => {
    const request = route.request();
    expect(request.headers()["authorization"]).toBeUndefined();
    const payload = request.postDataJSON() as { message: string; recent_turns: unknown[] };
    expect(payload.message).toBe("Bệnh viện có những chuyên khoa nào?");
    expect(payload.recent_turns).toEqual([]);
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        answer: "Bạn có thể xem danh sách chuyên khoa và chọn cơ sở phù hợp.",
        disclaimer: "Thông tin chỉ mang tính tham khảo.",
        citations: [{ source_type: "specialty", source_id: "tim-mach", title: "Tim mạch" }],
        provenance: "local_provider",
        mode: "HOSPITAL_SUPPORT",
        safety_action: "ANSWER",
      }),
    });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/about");
  await page.getByRole("button", { name: "Mở trợ lý sức khỏe" }).click();

  const dialog = page.getByRole("dialog", { name: "Trợ lý sức khỏe HealthCare" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Bạn đang dùng chế độ khách", { exact: false })).toBeVisible();
  await dialog.getByLabel("Câu hỏi cho trợ lý sức khỏe").fill("Bệnh viện có những chuyên khoa nào?");
  await dialog.getByRole("button", { name: "Gửi câu hỏi" }).click();
  await expect(dialog.getByTestId("floating-chat-pending-user").getByText("Bệnh viện có những chuyên khoa nào?", { exact: true })).toBeVisible();
  await expect(dialog.getByTestId("floating-chat-thinking")).toContainText("Đang suy nghĩ");
  await expect(dialog.getByText("Bạn có thể xem danh sách chuyên khoa và chọn cơ sở phù hợp.", { exact: true })).toBeVisible();
  await expect(dialog.getByTestId("floating-chat-thinking")).toBeHidden();
  await expect(dialog.getByText("Tim mạch", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Thông tin chỉ mang tính tham khảo.", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("link", { name: "đăng nhập" })).toHaveAttribute("href", "/auth/login?next=%2Fpatient%2Fchat");
  await expect(dialog.getByRole("button", { name: "Hữu ích" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Mở trợ lý sức khỏe" })).toBeFocused();
  await assertNoSensitiveBrowserStorage(page);
});

test("patient mobile widget creates and sends through the REST conversation API", async ({ context, page }) => {
  const observedKeys: string[] = [];
  await installChatMocks(context, observedKeys);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/faq");
  await page.getByRole("button", { name: "Mở trợ lý sức khỏe" }).click();

  const dialog = page.getByRole("dialog", { name: "Trợ lý sức khỏe HealthCare" });
  await dialog.getByLabel("Câu hỏi cho trợ lý sức khỏe").fill("Tôi nên chuẩn bị gì trước khi đi khám?");
  await dialog.getByRole("button", { name: "Gửi câu hỏi" }).click();

  await expect(dialog.getByTestId("floating-chat-streaming-reply")).toBeHidden();
  // The stream can briefly contain the same text as the completed exchange
  // while React commits the final SSE event. Scope the assertion to the
  // persisted assistant article so the check is deterministic under CI load.
  await expect(dialog.locator("article:not([data-testid='floating-chat-streaming-reply'])").getByText("Bạn nên mang giấy tờ tùy thân, kết quả cũ và danh sách thuốc đang dùng.", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Nguồn HealthCare", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Thông tin chỉ dùng để tham khảo.", { exact: true })).toBeVisible();
  // Citations are intentionally text-only; server-owned suggested actions are
  // the only clickable links in the shared assistant.
  await expect(dialog.getByText("Chuẩn bị trước khi đi khám", { exact: true })).toBeVisible();
  await expect(dialog.locator("a[href*='source_type=faq']")).toHaveCount(0);
  await expect(dialog.getByRole("link", { name: /Mở trợ lý đầy đủ/ })).toHaveAttribute("href", "/patient/chat");
  expect(observedKeys).toHaveLength(1);
  expect(observedKeys[0]).toMatch(/^chat-[0-9a-f-]{36}$/iu);

  const launcherBox = await page.locator("button[aria-controls=\"floating-health-assistant-panel\"]").boundingBox();
  const careRailBox = await page.locator(".mobile-care-rail").boundingBox();
  expect(launcherBox).not.toBeNull();
  expect(careRailBox).not.toBeNull();
  expect(launcherBox!.y + launcherBox!.height).toBeLessThan(careRailBox!.y);

  await assertNoSensitiveBrowserStorage(page, ["Tôi nên chuẩn bị gì trước khi đi khám?"]);
});

test("provider unavailable state offers a real retry without storing the draft", async ({ context, page }) => {
  const observedKeys: string[] = [];
  await installChatMocks(context, observedKeys, { failFirstSend: true, assistantProvenance: "local_fallback" });
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto("/faq");
  await page.getByRole("button", { name: "Mở trợ lý sức khỏe" }).click();

  const dialog = page.getByRole("dialog", { name: "Trợ lý sức khỏe HealthCare" });
  const question = "Tôi cần biết giấy tờ cần chuẩn bị trước khi khám.";
  await dialog.getByLabel("Câu hỏi cho trợ lý sức khỏe").fill(question);
  await dialog.getByRole("button", { name: "Gửi câu hỏi" }).click();
  await expect(dialog.getByText("Trợ lý tạm thời gián đoạn", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Thử lại" })).toBeVisible();
  await dialog.getByRole("button", { name: "Thử lại" }).click();
  await expect(dialog.getByTestId("floating-chat-streaming-reply")).toBeHidden();
  await expect(dialog.locator("article:not([data-testid='floating-chat-streaming-reply'])").getByText("Bạn nên mang giấy tờ tùy thân, kết quả cũ và danh sách thuốc đang dùng.", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Hỗ trợ tạm thời", { exact: true })).toBeVisible();
  expect(observedKeys).toHaveLength(2);
  expect(observedKeys[0]).not.toBe(observedKeys[1]);
  await assertNoSensitiveBrowserStorage(page, [question]);
});
