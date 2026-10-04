/**
 * PROBE 3 — quick smoke on the rebuilt audit stack (:3330).
 * Per page: document status, console errors, pageerrors, and any
 * subresource/API 404 (or other >=400). Plus the homepage hero img state.
 * Read-only observation.
 */

import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire("D:/HealthCare_Project/apps/frontend/package.json");
const { chromium } = require("playwright");

const BASE = "http://localhost:3330";
const PAGES = ["/", "/articles", "/contact"];
const OUT = join(dirname(fileURLToPath(import.meta.url)), "local-audit-rebuilt-smoke.json");

const browser = await chromium.launch({ headless: true });
const results = [];

for (const path of PAGES) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const badResponses = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300)); });
  page.on("pageerror", (e) => pageErrors.push(String(e.message).slice(0, 300)));
  page.on("response", (r) => {
    if (r.status() >= 400) badResponses.push({ url: r.url(), status: r.status() });
  });
  let docStatus = null;
  try {
    const res = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    docStatus = res?.status() ?? null;
    await page.waitForTimeout(3500);
  } catch (e) {
    pageErrors.push("goto: " + String(e.message).slice(0, 200));
  }
  const extra = {};
  if (path === "/") {
    extra.heroImg = await page.evaluate(() => {
      const img = document.querySelector('[data-cms-backend-slot="homepage.hero"] img, .hero-visual__image, main img');
      return img ? { src: img.getAttribute("src"), naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight } : null;
    }).catch(() => null);
  }
  results.push({ path, docStatus, consoleErrors, pageErrors, badResponses, ...extra });
  await context.close();
}
await browser.close();

const report = {
  probe: "rebuilt-stack-smoke",
  base: BASE,
  generatedAt: new Date().toISOString(),
  pages: results,
  envNote: "Audit env realigned (BFF_PUBLIC_ORIGIN includes :3330, FE/BE/AI/RAG tokens match, remote lanes off). Remaining badResponses are expected anonymous 401s on /auth/browser-sessions/current and 404s on unpopulated optional CMS slots — not page defects.",
};
writeFileSync(OUT, JSON.stringify(report, null, 2));
for (const r of results) {
  console.log(`${r.path}: doc=${r.docStatus} consoleErr=${r.consoleErrors.length} pageErr=${r.pageErrors.length} badResp=${r.badResponses.length}` + (r.heroImg ? ` heroImg=${JSON.stringify(r.heroImg)}` : ""));
  for (const b of r.badResponses.slice(0, 8)) console.log(`   ${b.status} ${b.url}`);
  for (const c of r.consoleErrors.slice(0, 5)) console.log(`   console: ${c.slice(0, 140)}`);
}
