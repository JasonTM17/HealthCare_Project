/**
 * Homepage console probe (read-only) — loads http://localhost:3330/ in a real
 * Chromium session and records console errors/warnings plus pageerrors and
 * failed network responses. Primary target: whether `cms_live_slot_error`
 * appears. No code is patched; this only observes.
 *
 * Output: reports/local-audit-home-console-probe.json
 */

import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire("D:/HealthCare_Project/apps/frontend/package.json");
const { chromium } = require("playwright");

const BASE = "http://localhost:3330";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "local-audit-home-console-probe.json");
const SETTLE_MS = 6000;

const consoleMessages = [];
const pageErrors = [];
const failedResponses = [];

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  page.on("console", (msg) => {
    const entry = { type: msg.type(), text: msg.text(), location: msg.location()?.url ?? null };
    consoleMessages.push(entry);
  });
  page.on("pageerror", (err) => {
    pageErrors.push(String(err?.message ?? err));
  });
  page.on("response", (res) => {
    if (res.status() >= 400) {
      failedResponses.push({ url: res.url(), status: res.status() });
    }
  });

  const resp = await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(SETTLE_MS);
  // trigger any lazy below-the-fold slots
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
  await page.waitForTimeout(2500);

  const allText = [
    ...consoleMessages.map((m) => `${m.type}: ${m.text}`),
    ...pageErrors,
    ...failedResponses.map((f) => `${f.status} ${f.url}`),
  ].join("\n");

  const artifact = {
    generatedAt: new Date().toISOString(),
    target: BASE + "/",
    pageStatus: resp?.status() ?? null,
    cms_live_slot_error_present: allText.includes("cms_live_slot_error"),
    consoleErrors: consoleMessages.filter((m) => m.type === "error"),
    consoleWarnings: consoleMessages.filter((m) => m.type === "warning"),
    otherConsoleMessages: consoleMessages.filter((m) => m.type !== "error" && m.type !== "warning"),
    pageErrors,
    failedResponses,
  };
  writeFileSync(OUT, JSON.stringify(artifact, null, 2));
  console.log("pageStatus:", artifact.pageStatus);
  console.log("cms_live_slot_error_present:", artifact.cms_live_slot_error_present);
  console.log("consoleErrors:", JSON.stringify(artifact.consoleErrors, null, 2));
  console.log("consoleWarnings:", JSON.stringify(artifact.consoleWarnings, null, 2));
  console.log("pageErrors:", JSON.stringify(artifact.pageErrors, null, 2));
  console.log("failedResponses:", JSON.stringify(artifact.failedResponses, null, 2));
} finally {
  await browser.close();
}
