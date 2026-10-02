import assert from "node:assert/strict";
import { after, before, test as nodeTest } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { chromium } from "@playwright/test";

const require = createRequire(import.meta.url);
const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Re-run the identical oracle against saved pre-repair sources for red/green proof.
const sourceRoot = process.env.CHAT_UI_SOURCE_ROOT ?? frontendRoot;
const sources = {};
for (const [name, file] of [
  ["react", "react/cjs/react.development.js"],
  ["react/jsx-runtime", "react/cjs/react-jsx-runtime.development.js"],
  ["react-dom", "react-dom/cjs/react-dom.development.js"],
  ["react-dom/client", "react-dom/cjs/react-dom-client.development.js"],
  ["scheduler", "scheduler/cjs/scheduler.development.js"],
]) {
  const packageName = file.split("/")[0];
  sources[name] = readFileSync(path.join(path.dirname(require.resolve(packageName)), file.slice(packageName.length + 1)), "utf8");
}

function addComponent(relative) {
  if (sources[relative]) return;
  const filename = path.join(sourceRoot, relative);
  let compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  compiled = compiled.replace(/require\("([^"]+)"\)/g, (original, specifier) => {
    if (!specifier.startsWith(".")) return original;
    if (specifier.endsWith(".css")) return 'require("fixture-css")';
    for (const [suffix, stub] of [
      ["api-client", "fixture-api"], ["secure-random", "fixture-random"],
      ["useAuthSession", "fixture-auth"], ["AssistantProvider", "fixture-provider"],
      ["UiIcon", "fixture-icon"], ["AssistantMark", "fixture-icon"],
      ["ChatMessageContent", "fixture-content"], ["PortalChrome", "fixture-chrome"],
      ["PortalStates", "fixture-states"],
    ]) if (specifier.endsWith(suffix)) return `require(${JSON.stringify(stub)})`;
    const target = path.resolve(path.dirname(filename), specifier);
    const resolved = [target + ".tsx", target + ".ts"].find(existsSync);
    assert.ok(resolved, `fixture dependency not mapped: ${specifier}`);
    const dependency = path.relative(sourceRoot, resolved).replaceAll("\\", "/");
    addComponent(dependency);
    return `require(${JSON.stringify(dependency)})`;
  });
  sources[relative] = compiled;
}
addComponent("components/FloatingHealthAssistant.tsx");
addComponent("app/patient/chat/page.tsx");

const fixture = `
globalThis.process = { env: { NODE_ENV: "development" } };
const sources = ${JSON.stringify(sources)};
const cache = {};
const stubs = {};
function require(name) {
  if (stubs[name]) return stubs[name];
  if (cache[name]) return cache[name].exports;
  if (!sources[name]) throw new Error("Unmapped fixture module: " + name);
  const mod = { exports: {} }; cache[name] = mod;
  new Function("require", "module", "exports", sources[name])(require, mod, mod.exports);
  return mod.exports;
}
const React = require("react");
const ReactDOM = require("react-dom");
const root = require("react-dom/client").createRoot(document.getElementById("root"));
const conversation = (id = "thread-1") => ({ id, title: id === "thread-1" ? "Chuẩn bị đi khám" : "Cuộc trò chuyện khác", mode: "HOSPITAL_SUPPORT", status: "ACTIVE", inFlight: false, consentRequired: false, createdAt: "2026-10-02T00:00:00Z", updatedAt: "2026-10-02T00:00:00Z", expiresAt: "2026-11-01T00:00:00Z" });
const message = (id, role, content, sequence) => ({ id, role, content, sequence, status: "COMPLETED", citations: [], provenance: role === "ASSISTANT" ? "local_provider" : null, createdAt: "2026-10-02T00:00:00Z" });
const control = window.chatFixture = {
  session: { user: { id: "patient-one", fullName: "Người kiểm thử", roles: ["PATIENT"] } },
  path: "/", policy: { policyVersion: "fixture-v1", retentionDays: 14, consentText: "Đồng ý", limitationText: "Không thay thế bác sĩ", remoteProviderEnabled: false },
  conversations: [conversation(), conversation("thread-2")],
  history: [message("existing-user", "USER", "Nội dung tài khoản trước", 1), message("existing-answer", "ASSISTANT", "Phản hồi trước", 2)],
  sends: [], reads: [], feedbackCalls: 0, feedbackOperations: [], holdFeedback: false, rejectFeedbackOnAbort: true, blockReads: false, holdPublic: false,
};
function read(kind, value, signal) {
  if (!control.blockReads) return Promise.resolve(value);
  return new Promise((resolve) => control.reads.push({ kind, value: structuredClone(value), resolve, signal }));
}
function send(id, content, options = {}) {
  return new Promise((resolve, reject) => control.sends.push({ id, content, signal: options.signal, onDelta: options.onDelta, resolve, reject }));
}
control.finishSend = (index) => {
  const pending = control.sends[index];
  const exchange = { userMessage: message("user-" + index, "USER", pending.content, index * 2 + 3), assistantMessage: message("answer-" + index, "ASSISTANT", "Kết quả đã xác thực " + index, index * 2 + 4) };
  control.history = [...control.history, exchange.userMessage, exchange.assistantMessage];
  pending.resolve(exchange);
};
control.resolveReads = (from = 0, to = control.reads.length) => { control.reads.slice(from, to).forEach((entry) => entry.resolve(entry.value)); };
const options = [{ value: "HOSPITAL_SUPPORT", label: "Thông tin bệnh viện", description: "Thông tin" }];
const errorCopy = (error) => ({ code: error?.code ?? null, status: error?.status, message: "Kết nối bị gián đoạn", kind: "unavailable", retryable: true });
const context = React.createContext(null);
function AssistantProvider({ children, initialMode = "HOSPITAL_SUPPORT" }) {
  const [mode, setMode] = React.useState(initialMode);
  const [selected, setConversation] = React.useState(null);
  const [policy, setPolicy] = React.useState(null);
  const refreshPolicy = React.useCallback(async () => control.policy, []);
  const invalidateRequests = React.useCallback(() => {}, []);
  const acceptConversationConsent = React.useCallback(async (id) => ({ ...conversation(id), consentRequired: false }), []);
  const sendMessage = React.useCallback(send, []);
  const resetSendAttempt = React.useCallback(() => {}, []);
  return React.createElement(context.Provider, { value: { mode, setMode, modeLocked: !!selected, setConversation, policy, setPolicy, refreshPolicy, invalidateRequests, acceptConversationConsent, sendMessage, resetSendAttempt } }, children);
}
stubs["fixture-provider"] = {
  AssistantProvider, useAssistant: () => React.useContext(context), ASSISTANT_MODE_OPTIONS: options, DEFAULT_CHAT_MODE: "HOSPITAL_SUPPORT",
  assistantFailureFromError: errorCopy, assistantErrorMessage: () => "Yêu cầu chưa hoàn tất", provenanceLabel: () => "Phản hồi tại HealthCare",
  isNearBottom: () => true, hasCurrentChatConsent: (item, policy) => !!item?.consentedAt && item.consentVersion === policy?.policyVersion,
  focusableAssistantElements: (panel) => [...(panel?.querySelectorAll('button:not(:disabled),textarea:not(:disabled),a[href]') ?? [])],
};
class ApiError extends Error { constructor(message, status, endpoint, payload) { super(message); this.status = status; this.code = payload?.code; } }
stubs["fixture-api"] = {
  ApiError, hasRole: (user, role) => user.roles.includes(role), isChatMode: () => true,
  clearAuthSession: () => { control.session = null; control.render(); },
  createAiConversation: async () => conversation(), fetchAiConversations: (options) => read("list", control.conversations, options?.signal),
  fetchAiConversation: (id, options) => read("conversation", control.conversations.find((item) => item.id === id), options?.signal),
  fetchAiConversationMessages: (id, cursor, limit, options) => read("history", { content: control.history, hasMore: false }, options?.signal),
  fetchPatientAiCreditStatus: () => read("credits", { credits: 20 - control.sends.length, maxCredits: 30, tier: "STANDARD" }),
  fetchAssistantAccountSettings: async () => ({ chatTone: "than_thien", chatDefaultMode: "HOSPITAL_SUPPORT", chatPersonalized: false }),
  patchAssistantAccountSettings: async (value) => value,
  updateAiMessageFeedback: (conversationId, messageId, rating, options) => {
    control.feedbackCalls++;
    if (!control.holdFeedback) return Promise.resolve({ rating });
    return new Promise((resolve, reject) => {
      control.feedbackOperations.push({ messageId, rating, signal: options?.signal, resolve, reject });
      if (control.rejectFeedbackOnAbort) {
        options?.signal?.addEventListener("abort", () => reject(new DOMException("Fixture feedback canceled", "AbortError")), { once: true });
      }
    });
  },
  deleteAiMessageFeedback: async () => {}, deleteAiConversation: async () => {},
  sendPublicAiChat: (content, turns, options) => control.holdPublic ? send(null, content, options) : Promise.resolve({ answer: "Câu trả lời khách", citations: [], provenance: "local_provider", safetyAction: "ALLOW" }),
};
stubs["fixture-auth"] = { useAuthSession: () => control.session };
stubs["fixture-random"] = { randomId: () => String(Math.random()) };
stubs["fixture-css"] = { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
stubs["fixture-icon"] = { __esModule: true, default: () => React.createElement("span", { "aria-hidden": true }) };
stubs["fixture-content"] = { __esModule: true, default: ({ content, className }) => React.createElement("p", { className }, content) };
stubs["fixture-chrome"] = { __esModule: true, default: ({ children }) => React.createElement("main", {}, children) };
stubs["fixture-states"] = { LoginRequiredState: () => React.createElement("a", {}, "Đăng nhập"), ForbiddenState: () => React.createElement("p", {}, "Không có quyền") };
stubs["next/link"] = { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) };
stubs["next/navigation"] = { usePathname: () => control.path };
control.mount = (surface) => { control.surface = surface; control.render(); };
control.render = () => {
  const Component = require(control.surface === "patient" ? "app/patient/chat/page.tsx" : "components/FloatingHealthAssistant.tsx").default;
  ReactDOM.flushSync(() => root.render(React.createElement(Component)));
};
control.waiting = (active) => {
  const { useChatWaitStage, CHAT_WAIT_STAGE_COPY } = require("components/useChatWaitStage.ts");
  function Waiting({ active }) {
    const stage = useChatWaitStage(active, 20, 40, 60);
    return React.createElement("p", { "data-stage": stage }, CHAT_WAIT_STAGE_COPY[stage]);
  }
  if (!control.Waiting) control.Waiting = Waiting;
  ReactDOM.flushSync(() => root.render(React.createElement(control.Waiting, { active })));
};
`;

const hasChromium = existsSync(chromium.executablePath());
let browser;
before(async () => {
  if (!hasChromium) return;
  browser = await chromium.launch({ headless: true });
});
after(async () => {
  if (browser) await browser.close();
});

const test = (name, fn) => nodeTest(name, { skip: !hasChromium ? "Playwright Chromium not installed" : false }, fn);

async function mount(surface, setup = {}) {
  const page = await browser.newPage();
  page.setDefaultTimeout(4000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) => route.abort());
  await page.setContent('<!doctype html><html lang="vi"><body><div id="root"></div></body></html>');
  await page.addScriptTag({ content: fixture });
  await page.evaluate(({ surface, setup }) => { Object.assign(chatFixture, setup); chatFixture.mount(surface); }, { surface, setup });
  if (surface === "floating") await page.getByRole("button", { name: "Mở trợ lý sức khỏe", exact: true }).click();
  const input = page.locator(surface === "patient" ? "#patient-chat-message" : "#floating-health-assistant-input");
  await input.waitFor();
  await page.waitForFunction((selector) => !document.querySelector(selector)?.disabled,
    surface === "patient" ? "#patient-chat-message" : "#floating-health-assistant-input");
  return { page, input, errors };
}

async function submit(page, input, text) {
  await input.fill(text);
  await input.press("Enter");
  await page.waitForFunction(() => chatFixture.sends.length > 0);
}

for (const surface of ["floating", "patient"]) {
  test(`${surface}: validated final unlocks composer while history/list/credits are unresolved`, async () => {
    const { page, input, errors } = await mount(surface);
    try {
      await page.evaluate(() => { chatFixture.blockReads = true; });
      await submit(page, input, "Tôi cần chuẩn bị gì?");
      await page.evaluate(() => chatFixture.finishSend(0));
      await page.getByText("Kết quả đã xác thực 0", { exact: true }).waitFor();
      assert.equal(await input.isDisabled(), false, "final result must end waiting before background reads resolve");
      assert.ok(await page.evaluate(() => chatFixture.reads.length > 0), "history remains pending at this fault point");
      assert.equal(errors.length, 0);
    } finally { await page.close(); }
  });

  test(`${surface}: late history from first answer cannot erase second answer`, async () => {
    const { page, input } = await mount(surface);
    try {
      await page.evaluate(() => { chatFixture.blockReads = true; });
      await submit(page, input, "Câu hỏi thứ nhất");
      await page.evaluate(() => chatFixture.finishSend(0));
      await page.getByText("Kết quả đã xác thực 0", { exact: true }).waitFor();
      assert.equal(await input.isDisabled(), false);
      const firstReadCount = await page.evaluate(() => chatFixture.reads.length);
      await submit(page, input, "Câu hỏi thứ hai");
      await page.waitForFunction(() => chatFixture.sends.length === 2);
      await page.evaluate(() => chatFixture.finishSend(1));
      await page.getByText("Kết quả đã xác thực 1", { exact: true }).waitFor();
      await page.evaluate((count) => chatFixture.resolveReads(0, count), firstReadCount);
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await page.getByText("Kết quả đã xác thực 1", { exact: true }).count(), 1);
    } finally { await page.close(); }
  });
}

test("patient: stop aborts request, preserves draft and discards late delta/final", async () => {
  const { page, input, errors } = await mount("patient");
  try {
    await submit(page, input, "Câu hỏi cần được giữ lại");
    const stop = page.getByRole("button", { name: "Dừng chờ phản hồi", exact: true });
    assert.equal(await stop.count(), 1, "patient needs a visible cancel action while sending");
    await stop.click();
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    assert.equal(await page.evaluate(() => chatFixture.sends[0].signal.aborted), true);
    assert.equal(await input.inputValue(), "Câu hỏi cần được giữ lại");
    assert.equal(await input.isDisabled(), false);
    assert.equal(await page.evaluate(() => chatFixture.sends.length), 1, "Stop must not submit the preserved draft again");
    await page.evaluate(() => { chatFixture.sends[0].onDelta?.("Phần đến muộn"); chatFixture.finishSend(0); });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    assert.equal(await page.getByText("Kết quả đã xác thực 0", { exact: true }).count(), 0);
    assert.equal(await page.getByText("Phần đến muộn", { exact: true }).count(), 0);
    assert.equal(errors.length, 0);
  } finally { await page.close(); }
});

test("patient: canceled request finally cannot unlock a newer in-flight request", async () => {
  const { page, input } = await mount("patient");
  try {
    await submit(page, input, "Câu hỏi cũ");
    const stop = page.getByRole("button", { name: "Dừng chờ phản hồi", exact: true });
    assert.equal(await stop.count(), 1);
    await stop.click();
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    await submit(page, input, "Câu hỏi mới");
    await page.waitForFunction(() => chatFixture.sends.length === 2);
    await page.evaluate(() => chatFixture.finishSend(0));
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    assert.equal(await input.isDisabled(), true);
    await page.evaluate(() => chatFixture.finishSend(1));
    await page.getByText("Kết quả đã xác thực 1", { exact: true }).waitFor();
    assert.equal(await input.isDisabled(), false);
  } finally { await page.close(); }
});

test("floating: synchronous duplicate submits create one send", async () => {
  const { page, input } = await mount("floating", { session: null, holdPublic: true });
  try {
    await input.fill("Câu hỏi không gửi trùng");
    await input.evaluate((node) => {
      node.form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      node.form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    assert.equal(await page.evaluate(() => chatFixture.sends.length), 1, "state batching must not allow a duplicate POST");
  } finally { await page.close(); }
});

test("floating: feedback cannot invalidate an in-flight send or strand composer", async () => {
  const { page, input } = await mount("floating");
  try {
    await submit(page, input, "Câu hỏi đang chờ");
    const feedback = page.getByRole("button", { name: "Hữu ích", exact: true }).first();
    assert.equal(await feedback.isDisabled(), true, "feedback must not replace the active send epoch");
    assert.equal(await page.evaluate(() => chatFixture.sends[0].signal.aborted), false);
    await page.evaluate(() => chatFixture.finishSend(0));
    await page.getByText("Kết quả đã xác thực 0", { exact: true }).waitFor();
    assert.equal(await input.isDisabled(), false);
    await feedback.click();
    assert.equal(await page.evaluate(() => chatFixture.feedbackCalls), 1, "saved feedback still works after the send");
  } finally { await page.close(); }
});

test("floating: send during pending feedback releases canceled feedback lock", async () => {
  const { page, input, errors } = await mount("floating", { holdFeedback: true });
  try {
    await page.getByRole("button", { name: "Hữu ích", exact: true }).first().click();
    await page.waitForFunction(() => chatFixture.feedbackOperations.length === 1);
    await submit(page, input, "Câu hỏi mới khi đánh giá đang chờ");
    assert.equal(await page.evaluate(() => chatFixture.feedbackOperations[0].signal.aborted), true);
    await page.evaluate(() => chatFixture.finishSend(0));
    await page.getByText("Kết quả đã xác thực 0", { exact: true }).waitFor();
    assert.equal(await input.isDisabled(), false);
    await page.getByRole("button", { name: "Hữu ích", exact: true }).last().click();
    assert.equal(await page.evaluate(() => chatFixture.feedbackCalls), 2, "new answer must remain rateable after feedback was superseded by a send");
    assert.equal(errors.length, 0);
  } finally { await page.close(); }
});

test("floating: stale feedback cleanup cannot release a newer feedback lock", async () => {
  const { page, input } = await mount("floating", { holdFeedback: true, rejectFeedbackOnAbort: false });
  try {
    await page.evaluate(() => {
      chatFixture.history.push({ ...chatFixture.history[1], id: "unrated-peer", sequence: 3, content: "Phản hồi khác chưa được đánh giá" });
    });
    // Re-open to read the added message through the actual component's history path.
    await page.getByRole("button", { name: "Đóng cửa sổ trợ lý", exact: true }).click();
    await page.evaluate(() => {
      chatFixture.session = { user: { ...chatFixture.session.user, id: "feedback-schedule-patient" } };
      chatFixture.render();
    });
    await page.getByRole("button", { name: "Mở trợ lý sức khỏe", exact: true }).click();
    await page.getByText("Phản hồi khác chưa được đánh giá", { exact: true }).waitFor();
    const peerFeedback = page.locator("article").filter({ hasText: "Phản hồi khác chưa được đánh giá" }).getByRole("button", { name: "Hữu ích", exact: true });
    await page.getByRole("button", { name: "Hữu ích", exact: true }).first().click();
    await page.waitForFunction(() => chatFixture.feedbackOperations.length === 1);
    await submit(page, input, "Gửi câu hỏi để thay thế yêu cầu đánh giá cũ");
    await page.evaluate(() => chatFixture.finishSend(0));
    await page.getByText("Kết quả đã xác thực 0", { exact: true }).waitFor();
    await page.locator("article").filter({ hasText: "Kết quả đã xác thực 0" }).getByRole("button", { name: "Hữu ích", exact: true }).click();
    assert.equal(await page.evaluate(() => chatFixture.feedbackCalls), 2);
    await page.evaluate(() => chatFixture.feedbackOperations[0].reject(new DOMException("Late fixture abort", "AbortError")));
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await peerFeedback.click();
    assert.equal(await page.evaluate(() => chatFixture.feedbackCalls), 2, "old finally must not clear the current feedback operation's lock");
    await page.evaluate(() => chatFixture.feedbackOperations[1].resolve({ rating: "HELPFUL" }));
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    await peerFeedback.click();
    assert.equal(await page.evaluate(() => chatFixture.feedbackCalls), 3, "current feedback completion must release its own lock");
  } finally { await page.close(); }
});

test("floating: close/reopen keeps draft and discards canceled reply", async () => {
  const { page, input } = await mount("floating");
  try {
    await submit(page, input, "Câu hỏi còn trong bản nháp");
    await page.getByRole("button", { name: "Đóng cửa sổ trợ lý", exact: true }).click();
    assert.equal(await page.evaluate(() => chatFixture.sends[0].signal.aborted), true);
    await page.evaluate(() => chatFixture.finishSend(0));
    await page.getByRole("button", { name: "Mở trợ lý sức khỏe", exact: true }).click();
    assert.equal(await input.inputValue(), "Câu hỏi còn trong bản nháp");
    assert.equal(await page.getByText("Kết quả đã xác thực 0", { exact: true }).count(), 0);
    assert.equal(await input.isDisabled(), false);
  } finally { await page.close(); }
});

test("floating: Stop does not become a submit and resend the preserved draft", async () => {
  const { page, input } = await mount("floating");
  try {
    await submit(page, input, "Câu hỏi giữ lại khi dừng chờ");
    await page.getByRole("button", { name: "Dừng chờ phản hồi", exact: true }).click();
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    assert.equal(await page.evaluate(() => chatFixture.sends[0].signal.aborted), true);
    assert.equal(await page.evaluate(() => chatFixture.sends.length), 1, "a stop click is not a new send attempt");
    assert.equal(await input.isDisabled(), false);
    assert.equal(await input.inputValue(), "Câu hỏi giữ lại khi dừng chờ");
    await page.evaluate(() => chatFixture.finishSend(0));
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    assert.equal(await page.getByText("Kết quả đã xác thực 0", { exact: true }).count(), 0);
  } finally { await page.close(); }
});

for (const surface of ["floating", "patient"]) {
  test(`${surface}: consent shows current server retention rather than hardcoded 90 days`, async () => {
    const page = await browser.newPage();
    try {
      await page.setContent('<html lang="vi"><body><div id="root"></div></body></html>');
      await page.addScriptTag({ content: fixture });
      await page.evaluate((surface) => {
        chatFixture.conversations[0].consentRequired = true;
        chatFixture.mount(surface);
      }, surface);
      if (surface === "floating") await page.getByRole("button", { name: "Mở trợ lý sức khỏe", exact: true }).click();
      const consent = page.locator(surface === "floating" ? "#floating-assistant-consent-copy" : "#patient-chat-consent-copy");
      await consent.waitFor();
      await page.waitForFunction(() => document.querySelector("#floating-assistant-consent-copy,#patient-chat-consent-copy")?.textContent.includes("14 ngày"), null, { timeout: 1000 });
      assert.doesNotMatch(await consent.innerText(), /90 ngày/);
    } finally { await page.close(); }
  });
}

test("patient: account switch cannot reveal old transcript while new account reads are delayed", async () => {
  const { page } = await mount("patient");
  try {
    await page.getByText("Nội dung tài khoản trước", { exact: true }).waitFor();
    await page.evaluate(() => { chatFixture.session = null; chatFixture.render(); });
    await page.getByText("Đăng nhập", { exact: true }).waitFor();
    await page.evaluate(() => {
      chatFixture.blockReads = true;
      chatFixture.session = { user: { id: "patient-two", fullName: "Người kiểm thử khác", roles: ["PATIENT"] } };
      chatFixture.render();
    });
    await page.waitForFunction(() => chatFixture.reads.some((entry) => entry.kind === "list"));
    assert.equal(await page.getByText("Nội dung tài khoản trước", { exact: true }).count(), 0);
  } finally { await page.close(); }
});

test("timed wait stages stay neutral and restart on each request", async () => {
  const page = await browser.newPage();
  try {
    await page.setContent('<html lang="vi"><body><div id="root"></div></body></html>');
    await page.addScriptTag({ content: fixture });
    await page.evaluate(() => chatFixture.waiting(true));
    await page.locator('[data-stage="preparing"]').waitFor();
    const copies = await page.evaluate(() => Object.values(require("components/useChatWaitStage.ts").CHAT_WAIT_STAGE_COPY));
    copies.forEach((copy) => assert.doesNotMatch(copy, /tra cứu|chuyên khoa|y tế đầy đủ|danh mục bác sĩ/, "elapsed time does not prove upstream work"));
    const stages = await page.evaluate(() => {
      chatFixture.waiting(false);
      const inactive = document.querySelector("[data-stage]").dataset.stage;
      chatFixture.waiting(true);
      return [inactive, document.querySelector("[data-stage]").dataset.stage];
    });
    assert.deepEqual(stages, ["received", "received"]);
  } finally { await page.close(); }
});
