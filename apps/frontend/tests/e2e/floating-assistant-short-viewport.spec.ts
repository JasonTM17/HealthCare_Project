import { expect, test, type BrowserContext } from "@playwright/test";
import {
  browserSessionFixture,
  installMockPatientPortalSession,
} from "./helpers/browser-session";

// Regression for the clipped composer on short viewports: the thread kept a
// 10rem floor and the fixed chrome above the composer (mode picker,
// suggestions, credit line, footer link) exceeded the panel's max-height, so
// the composer overflowed the panel box and slid under the launcher — the
// input row was clipped and unreachable at e.g. 390x500 and 1000x420.

const PATIENT_SESSION = browserSessionFixture("PATIENT", "short-viewport-patient", "Nguyễn An");

async function installChatPolicy(context: BrowserContext) {
  await context.route("**/api/v1/ai/chat-policy", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        policyVersion: "2026-08-23",
        retentionDays: 90,
        consentText: "Tôi đồng ý dùng trợ lý sức khỏe.",
        limitationText: "Không thay thế bác sĩ.",
        remoteProviderEnabled: false,
        enabledModes: ["HOSPITAL_SUPPORT", "SYMPTOM_TRIAGE", "HEALTH_EDUCATION"],
      }),
    });
  });
  await context.route("**/api/v1/ai/conversations**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
}

type ComposerGeometry = {
  panel: { top: number; bottom: number };
  composer: { top: number; bottom: number };
  launcher: { top: number };
  viewport: { height: number };
};

async function measureComposerGeometry(page: import("@playwright/test").Page): Promise<ComposerGeometry> {
  return page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>("#floating-health-assistant-panel");
    const textarea = panel?.querySelector<HTMLElement>("textarea");
    const launcher = document.querySelector<HTMLElement>("button[aria-controls='floating-health-assistant-panel']");
    if (!panel || !textarea || !launcher) {
      throw new Error("Floating assistant panel, composer or launcher is missing");
    }
    const panelRect = panel.getBoundingClientRect();
    const composerRect = textarea.getBoundingClientRect();
    const launcherRect = launcher.getBoundingClientRect();
    return {
      panel: { top: panelRect.top, bottom: panelRect.bottom },
      composer: { top: composerRect.top, bottom: composerRect.bottom },
      launcher: { top: launcherRect.top },
      viewport: { height: window.innerHeight },
    };
  });
}

for (const viewport of [
  { width: 390, height: 500, label: "short mobile" },
  { width: 1000, height: 420, label: "short landscape" },
  { width: 390, height: 700, label: "normal mobile" },
]) {
  test(`composer stays inside the panel and above the launcher on a ${viewport.width}x${viewport.height} ${viewport.label} viewport`, async ({ context, page }) => {
    await installChatPolicy(context);
    await installMockPatientPortalSession(context, PATIENT_SESSION);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/faq", { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: "Mở trợ lý sức khỏe" }).click();
    const dialog = page.getByRole("dialog", { name: "Trợ lý sức khỏe HealthCare" });
    await expect(dialog).toBeVisible();

    const composer = dialog.getByLabel("Câu hỏi cho trợ lý sức khỏe");
    await expect(composer).toBeVisible();
    await expect(composer).toBeEnabled();

    // The three modes stay reachable even when the panel is height-starved.
    for (const mode of ["Thông tin bệnh viện", "Định hướng triệu chứng", "Giải thích sức khỏe"]) {
      await expect(dialog.getByRole("button", { name: mode })).toBeVisible();
    }

    const geometry = await measureComposerGeometry(page);
    // The composer must render inside the panel box — the reported bug had it
    // overflowing below panel.bottom where overflow:hidden clipped it.
    expect(geometry.composer.top).toBeGreaterThanOrEqual(geometry.panel.top);
    expect(geometry.composer.bottom).toBeLessThanOrEqual(geometry.panel.bottom);
    // And the launcher sits below the panel, never on top of the composer.
    expect(geometry.launcher.top).toBeGreaterThanOrEqual(geometry.composer.bottom);
    expect(geometry.composer.bottom).toBeLessThanOrEqual(geometry.viewport.height);
  });
}

for (const viewport of [
  { width: 390, height: 500, label: "short mobile" },
  { width: 1000, height: 420, label: "short landscape" },
]) {
  test(`consent CTA stays visible inside the panel on a ${viewport.width}x${viewport.height} ${viewport.label} viewport`, async ({ context, page }) => {
    // Consent-pending conversation: the policy copy is tall enough that the
    // action used to scroll below the panel's visible bottom on short
    // viewports, leaving patients with no obvious way to proceed.
    await installChatPolicy(context);
    const consentPendingConversation = {
      id: "conv-consent",
      title: "Tư vấn",
      mode: "HOSPITAL_SUPPORT",
      status: "ACTIVE",
      inFlight: false,
      consentRequired: true,
      consentVersion: null,
      consentedAt: null,
      createdAt: "2026-08-23T00:00:00Z",
      updatedAt: "2026-08-23T00:00:00Z",
      lastMessageAt: null,
      expiresAt: "2026-11-21T00:00:00Z",
    };
    await context.route("**/api/v1/ai/conversations**", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/messages")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ content: [], nextCursor: null }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([consentPendingConversation]),
      });
    });
    await installMockPatientPortalSession(context, PATIENT_SESSION);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/about", { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: "Mở trợ lý sức khỏe" }).click();
    const dialog = page.getByRole("dialog", { name: "Trợ lý sức khỏe HealthCare" });
    await expect(dialog).toBeVisible();

    const consentButton = dialog.getByRole("button", { name: /Tôi đồng ý/u });
    await expect(consentButton).toBeVisible();
    await expect(consentButton).toBeEnabled();

    const geometry = await page.evaluate(() => {
      const panel = document.querySelector<HTMLElement>("#floating-health-assistant-panel");
      const button = Array.from(
        panel?.querySelectorAll<HTMLElement>("button") ?? [],
      ).find((candidate) => /Tôi đồng ý/u.test(candidate.textContent ?? ""));
      if (!panel || !button) throw new Error("Consent button or panel is missing");
      const panelRect = panel.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      return {
        panel: { top: panelRect.top, bottom: panelRect.bottom },
        button: { top: buttonRect.top, bottom: buttonRect.bottom },
        viewport: { height: window.innerHeight },
      };
    });
    // The CTA must render inside the panel's visible box, not below the fold.
    expect(geometry.button.top).toBeGreaterThanOrEqual(geometry.panel.top);
    expect(geometry.button.bottom).toBeLessThanOrEqual(geometry.panel.bottom + 1);
    expect(geometry.button.bottom).toBeLessThanOrEqual(geometry.viewport.height);
  });
}
