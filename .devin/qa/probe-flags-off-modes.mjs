// Flags-OFF live check: with clinical modes disabled (prod parity), the UI must
// fail closed — triage/education buttons disabled in BOTH pickers, a persisted
// disabled-mode conversation locks composer + notice, and no send affordance
// (retry/suggestion) stays live. Requires backend started WITHOUT the clinical
// feature flags.
import { chromium } from "../../apps/frontend/node_modules/playwright/index.mjs";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3330";
const results = [];
const record = (id, ok, detail = "") => {
  results.push({ id, status: ok ? "PASS" : "FAIL", detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(`${BASE}/auth/login?next=/patient/chat`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.getByLabel("Email", { exact: true }).fill("patient@healthcare.local");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("LocalDemo!2026");
  await page.getByRole("button", { name: /đăng nhập|sign in/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth/"), { timeout: 30_000 });
  await page.goto(`${BASE}/patient/chat`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForTimeout(2500);
  record("nav patient chat", page.url().includes("/patient/chat"), page.url());

  // Policy contract: only HOSPITAL_SUPPORT enabled.
  const policy = await page.evaluate(async () => {
    const r = await fetch("/api/v1/ai/chat-policy", { credentials: "include" });
    return r.ok ? await r.json() : null;
  });
  record("policy lists only support mode",
    Array.isArray(policy?.enabledModes) && policy.enabledModes.length === 1 && policy.enabledModes[0] === "HOSPITAL_SUPPORT",
    JSON.stringify(policy?.enabledModes));

  // Mode picker (new-conversation state): clinical buttons must be disabled.
  const triageBtn = page.getByRole("button", { name: /triệu chứng/i }).first();
  const eduBtn = page.getByRole("button", { name: /giải thích sức khỏe/i }).first();
  const triageVisible = await triageBtn.isVisible().catch(() => false);
  const eduVisible = await eduBtn.isVisible().catch(() => false);
  record("triage button visible", triageVisible);
  record("education button visible", eduVisible);
  if (triageVisible) {
    record("triage disabled (fail-closed)", await triageBtn.isDisabled());
  }
  if (eduVisible) {
    record("education disabled (fail-closed)", await eduBtn.isDisabled());
  }

  // Persisted disabled-mode conversation: composer locked + honest notice.
  // Find the triage/education conversation via the API (titles are derived from
  // the first message, so text-matching is unreliable), then click its list
  // button by title — never a mode-picker button.
  const targetTitle = await page.evaluate(async () => {
    const r = await fetch("/api/v1/ai/conversations", { credentials: "include" });
    if (!r.ok) return null;
    const data = await r.json();
    const list = Array.isArray(data) ? data : (data.items ?? data.conversations ?? []);
    const hit = list.find((c) => c.mode === "SYMPTOM_TRIAGE" || c.mode === "HEALTH_EDUCATION");
    return hit?.title ?? null;
  });
  record("disabled-mode conversation exists", Boolean(targetTitle), targetTitle ?? "");
  const triageConv = targetTitle
    ? page.locator("button[class*=conversationSelect]").filter({ hasText: targetTitle.slice(0, 24) }).first()
    : page.locator("button[class*=conversationSelect]").first();
  const convVisible = await triageConv.isVisible().catch(() => false);
  record("triage conversation listed", convVisible);
  if (convVisible) {
    await triageConv.click();
    await page.waitForTimeout(1200);
    const composer = page.locator("textarea").last();
    const composerDisabled = await composer.isDisabled().catch(() => false);
    const noticeVisible = await page.getByText(/tạm chưa khả dụng|không khả dụng/i).first().isVisible().catch(() => false);
    record("disabled-mode composer locked", composerDisabled, `disabled=${composerDisabled}`);
    record("disabled-mode notice shown", noticeVisible);
    const ungated = await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button")].filter((b) => {
        if (b.disabled) return false;
        // Ignore inert UI: buttons inside a closed <dialog> are not actionable.
        if (b.closest("dialog:not([open])")) return false;
        return /thử|lại|gửi/i.test(b.textContent || "");
      });
      return btns.map((b) => (b.textContent || "").trim().slice(0, 40));
    });
    record("no live send affordance", ungated.length === 0, JSON.stringify(ungated.slice(0, 4)));
  }

  // Floating assistant: patient view must also fail closed on its picker.
  await page.goto(`${BASE}/patient`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(2000);
  const floatBtn = page.getByRole("button", { name: /trợ lý|assistant|chat/i }).last();
  if (await floatBtn.isVisible().catch(() => false)) {
    await floatBtn.click();
    await page.waitForTimeout(1500);
    const floatTriage = page.getByRole("button", { name: /triệu chứng/i }).first();
    if (await floatTriage.isVisible().catch(() => false)) {
      record("floating triage disabled (fail-closed)", await floatTriage.isDisabled());
    } else {
      record("floating triage disabled (fail-closed)", true, "triage mode not offered");
    }
  }

  record("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
} finally {
  await browser.close();
}
const fails = results.filter((r) => r.status === "FAIL");
const { writeFileSync, mkdirSync } = await import("node:fs");
mkdirSync("reports", { recursive: true });
writeFileSync("reports/local-audit-flags-off-modes.json",
  JSON.stringify({ finishedAt: new Date().toISOString(), checks: results }, null, 2));
console.log(`\n== SUMMARY: ${results.length - fails.length}/${results.length} PASS ==`);
process.exit(fails.length ? 1 : 0);
