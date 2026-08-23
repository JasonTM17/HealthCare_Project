import { expect, test, type BrowserContext } from "@playwright/test";
import type { AiChatExchange, AiChatMessage, AiConversation, AuthSession } from "../../types/hospital";

const AUTH_STORAGE_KEY = "healthcare.auth.session";

const PATIENT_SESSION: AuthSession = {
  accessToken: "floating-assistant-token",
  refreshToken: "floating-assistant-refresh",
  tokenType: "Bearer",
  expiresIn: 3600,
  user: {
    id: "floating-assistant-patient",
    email: "floating.patient@healthcare.local",
    displayName: "Nguyễn An",
    roles: ["ROLE_PATIENT"],
  },
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

async function installChatMocks(
  context: BrowserContext,
  observedKeys: string[],
  options: { failFirstSend?: boolean; assistantProvenance?: AiChatMessage["provenance"] } = {},
) {
  let history: AiChatMessage[] = [];
  let failedFirstSend = false;
  await context.addInitScript(({ key, value }) => {
    window.sessionStorage.setItem(key, value);
  }, { key: AUTH_STORAGE_KEY, value: JSON.stringify(PATIENT_SESSION) });

  await context.route("**/api/v1/ai/conversations**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api/v1/ai/conversations" && request.method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      return;
    }
    if (url.pathname === "/api/v1/ai/conversations" && request.method() === "POST") {
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(CONVERSATION) });
      return;
    }
    if (url.pathname.endsWith("/messages") && request.method() === "POST") {
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
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(exchange) });
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
}

test("guest launcher exposes a real login action", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/about");
  await page.getByRole("button", { name: "Mở trợ lý sức khỏe" }).click();

  const dialog = page.getByRole("dialog", { name: "Trợ lý sức khỏe HealthCare" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Đăng nhập để trò chuyện" })).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Đăng nhập" })).toHaveAttribute("href", "/auth/login?next=%2Fpatient%2Fchat");
  await expect(dialog.getByLabel("Câu hỏi cho trợ lý sức khỏe")).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Mở trợ lý sức khỏe" })).toBeFocused();
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

  await expect(dialog.getByText("Bạn nên mang giấy tờ tùy thân, kết quả cũ và danh sách thuốc đang dùng.")).toBeVisible();
  await expect(dialog.getByText("Nguồn HealthCare", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Thông tin chỉ dùng để tham khảo.", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Nguồn tham khảo: Chuẩn bị trước khi đi khám" })).toHaveAttribute("href", /source_type=faq/);
  await expect(dialog.getByRole("link", { name: /Mở trợ lý đầy đủ/ })).toHaveAttribute("href", "/patient/chat");
  expect(observedKeys).toHaveLength(1);
  expect(observedKeys[0]).toMatch(/^floating-chat-/);

  const launcherBox = await page.locator("button[aria-controls=\"floating-health-assistant-panel\"]").boundingBox();
  const careRailBox = await page.locator(".mobile-care-rail").boundingBox();
  expect(launcherBox).not.toBeNull();
  expect(careRailBox).not.toBeNull();
  expect(launcherBox!.y + launcherBox!.height).toBeLessThan(careRailBox!.y);

  const storedChatContent = await page.evaluate(() => (
    [...Object.values(localStorage), ...Object.values(sessionStorage)].join("\n")
  ));
  expect(storedChatContent).not.toContain("Tôi nên chuẩn bị gì trước khi đi khám?");
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
  await expect(dialog.getByText("Bạn nên mang giấy tờ tùy thân, kết quả cũ và danh sách thuốc đang dùng.")).toBeVisible();
  await expect(dialog.getByText("Chế độ dự phòng tại chỗ", { exact: true })).toBeVisible();
  expect(observedKeys).toHaveLength(2);
  expect(observedKeys[0]).not.toBe(observedKeys[1]);
});
