// Focused live check: patient chat SYMPTOM_TRIAGE end-to-end in real Chromium.
// Verifies: mode enabled by policy flag → conversation creates → streamed answer
// returns without 502/503. Requires backend started with triage flag enabled.
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

  // Mode buttons inside group(s): find the triage button and its disabled state
  const triageBtn = page.getByRole("button", { name: /triệu chứng/i }).first();
  const triageVisible = await triageBtn.isVisible().catch(() => false);
  record("triage button visible", triageVisible);
  if (triageVisible) {
    const disabled = await triageBtn.isDisabled();
    record("triage enabled by flag", !disabled, disabled ? "still disabled" : "enabled");
    if (!disabled) {
      await triageBtn.click();
      await page.waitForTimeout(800);
      // find composer textarea and send a short triage question
      const composer = page.locator("textarea").last();
      await composer.fill("tôi bị đau đầu và sốt nhẹ 2 ngày");
      const sendBtn = page.getByRole("button", { name: /gửi|send/i }).last();
      const sendDisabled = await sendBtn.isDisabled().catch(() => true);
      record("send enabled after draft", !sendDisabled);
      if (!sendDisabled) {
        const t0 = Date.now();
        await sendBtn.click();
        // Assistant bubbles carry the "Trợ lý HealthCare" meta label; wait for
        // one whose content exceeds the interim "Đang chờ…" placeholder.
        try {
          await page.waitForFunction(() => {
            const contents = [...document.querySelectorAll("[class*=messageContent]")];
            const last = contents.at(-1)?.textContent ?? "";
            return last.trim().length > 60;
          }, { timeout: 75_000 });
          const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
          const text = await page.evaluate(() => {
            const contents = [...document.querySelectorAll("[class*=messageContent]")];
            return (contents.at(-1)?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 260);
          });
          record("triage answer streamed", text.length > 80, `${elapsed}s len=${text.length}`);
          console.log("  answer snippet:", text.replace(/\n+/g, " | "));
        } catch {
          record("triage answer streamed", false, "no assistant answer within 75s");
          const errBanner = await page.locator("[role=alert],[class*=error]").last().innerText().catch(() => "");
          console.log("  errBanner:", errBanner.slice(0, 200));
          const dump = await page.evaluate(() => {
            const strongs = [...document.querySelectorAll("strong")].map((s) => s.textContent?.trim()).filter(Boolean);
            const articleTexts = [...document.querySelectorAll("article,li")]
              .map((a) => (a.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120))
              .filter(Boolean).slice(-6);
            return { strongs: strongs.slice(-6), articleTexts };
          });
          console.log("  dom dump:", JSON.stringify(dump).slice(0, 800));
        }
      }
    }
  }
  // ── Disabled-mode lock: with the feature flag OFF, an existing
  // SYMPTOM_TRIAGE conversation must show the honest unavailable state and
  // lock composer/send/retry rather than issuing a doomed request. ──
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page2 = await ctx2.newPage();
  await page2.goto(`${BASE}/auth/login?next=/patient/chat`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page2.getByLabel("Email", { exact: true }).fill("patient@healthcare.local");
  await page2.getByLabel("Mật khẩu", { exact: true }).fill("LocalDemo!2026");
  await page2.getByRole("button", { name: /đăng nhập|sign in/i }).click();
  await page2.waitForURL((u) => !u.pathname.startsWith("/auth/"), { timeout: 30_000 });
  await page2.goto(`${BASE}/patient/chat`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page2.waitForTimeout(2500);
  // Open the persisted triage conversation (created while the flag was on).
  const triageConv = page2.locator("button, [role=button], a, li").filter({ hasText: /Triage probe|triệu chứng/i }).first();
  const convVisible = await triageConv.isVisible().catch(() => false);
  record("triage conversation listed", convVisible);
  if (convVisible) {
    await triageConv.click();
    await page2.waitForTimeout(1200);
    const composer = page2.locator("textarea").last();
    const composerDisabled = await composer.isDisabled().catch(() => false);
    const noticeVisible = await page2.getByText(/tạm chưa khả dụng/i).first().isVisible().catch(() => false);
    record("disabled-mode composer locked", composerDisabled, `disabled=${composerDisabled}`);
    record("disabled-mode notice shown", noticeVisible);
    // Defense-in-depth: no send path (retry button / suggestion chip) may fire.
    const ungated = await page2.evaluate(() => {
      const btns = [...document.querySelectorAll("button")].filter((b) => !b.disabled && /thử|lại|gửi/i.test(b.textContent || ""));
      return btns.map((b) => (b.textContent || "").trim().slice(0, 40));
    });
    record("no live send affordance", ungated.length === 0, JSON.stringify(ungated.slice(0, 4)));
  }
  await ctx2.close();

  record("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
} finally {
  await browser.close();
}
const fails = results.filter((r) => r.status === "FAIL");
console.log(`\n== SUMMARY: ${results.length - fails.length}/${results.length} PASS ==`);
process.exit(fails.length ? 1 : 0);
