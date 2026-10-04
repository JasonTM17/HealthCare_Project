/**
 * /auth 404 initiator probe (read-only against the audit stack at :3330).
 *
 * Attaches a CDP session per journey and records every request with its
 * resourceType and initiator, joined to its response status. The goal is to
 * identify what issues `GET /auth` (a route that has no page) — no code is
 * patched, this only observes.
 *
 * Output: reports/local-audit-auth-404-probe.json
 * Credentials come from env (HC_PATIENT_EMAIL / HC_ADMIN_EMAIL / HC_PASSWORD)
 * and are never written to the artifact.
 */

import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire("D:/HealthCare_Project/apps/frontend/package.json");
const { chromium } = require("playwright");

const BASE = "http://localhost:3330";
const PATIENT_EMAIL = process.env.HC_PATIENT_EMAIL ?? "patient@healthcare.local";
const ADMIN_EMAIL = process.env.HC_ADMIN_EMAIL ?? "admin@healthcare.local";
const PASSWORD = process.env.HC_PASSWORD ?? "LocalDemo!2026";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "local-audit-auth-404-probe.json");

const SETTLE_MS = 3500;

async function collect(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Page.enable");
  const requests = new Map();
  const order = [];
  cdp.on("Network.requestWillBeSent", (e) => {
    requests.set(e.requestId + "|" + (e.request.url ?? ""), {
      url: e.request?.url,
      method: e.request?.method,
      resourceType: e.type,
      initiator: e.initiator ? {
        type: e.initiator.type,
        url: e.initiator.url,
        lineNumber: e.initiator.lineNumber,
        columnNumber: e.initiator.columnNumber,
        stack: e.initiator.stack?.callFrames?.slice(0, 6).map((f) => `${f.functionName || "(anon)"}@${f.url}:${f.lineNumber}`),
      } : undefined,
      documentURL: e.documentURL,
      frameId: e.frameId,
      requestId: e.requestId,
    });
    if (!order.includes(e.requestId)) order.push(e.requestId);
  });
  cdp.on("Network.responseReceived", (e) => {
    for (const [key, rec] of requests) {
      if (key.startsWith(e.requestId + "|")) {
        rec.status = e.response?.status;
        rec.responseUrl = e.response?.url;
        rec.mimeType = e.response?.mimeType;
      }
    }
  });
  return () => [...requests.values()];
}

async function newJourneyPage(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const drain = await collect(page);
  return { context, page, drain };
}

async function settle(page) {
  await page.waitForTimeout(SETTLE_MS).catch(() => {});
}

async function runJourney(browser, name, fn) {
  const { context, page, drain } = await newJourneyPage(browser);
  const errors = [];
  try {
    await fn(page);
  } catch (error) {
    errors.push(String(error?.message ?? error));
  }
  await settle(page);
  const observations = drain();
  await context.close();
  return { name, errors, observations, finalUrl: undefined };
}

function authPath(url) {
  try {
    const path = new URL(url).pathname;
    return path === "/auth" || path.startsWith("/auth");
  } catch {
    return false;
  }
}

const journeys = {};

const browser = await chromium.launch({ headless: true });
try {
  // (a1) Unauthenticated direct hit: /admin in a fresh context.
  journeys.unauth_admin = await runJourney(browser, "unauth_admin", async (page) => {
    await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  });
  journeys.unauth_admin.finalUrl = null;

  // (a2) Unauthenticated direct hit: /patient/dashboard in a fresh context.
  journeys.unauth_patient_dashboard = await runJourney(browser, "unauth_patient_dashboard", async (page) => {
    await page.goto(`${BASE}/patient/dashboard`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  });

  // (a3) Unauthenticated legacy /login hit (redirects to /auth/login).
  journeys.unauth_legacy_login = await runJourney(browser, "unauth_legacy_login", async (page) => {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  });

  // (b) Admin login -> admin journey -> logout.
  journeys.admin_login_journey_logout = await runJourney(browser, "admin_login_journey_logout", async (page) => {
    await page.goto(`${BASE}/auth/login`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForSelector("#login-email", { timeout: 15_000 });
    await page.fill("#login-email", ADMIN_EMAIL);
    await page.fill("#login-password", PASSWORD);
    await Promise.all([
      page.waitForURL("**/admin**", { timeout: 20_000 }).catch(() => {}),
      page.click("button[type='submit']"),
    ]);
    await settle(page);
    await page.click("button:has-text('Đăng xuất')").catch(() => {});
    await settle(page);
  });

  // (c) Patient login -> patient dashboard -> documents -> logout.
  journeys.patient_login_journey_logout = await runJourney(browser, "patient_login_journey_logout", async (page) => {
    await page.goto(`${BASE}/auth/login`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForSelector("#login-email", { timeout: 15_000 });
    await page.fill("#login-email", PATIENT_EMAIL);
    await page.fill("#login-password", PASSWORD);
    await Promise.all([
      page.waitForURL("**/patient/**", { timeout: 20_000 }).catch(() => {}),
      page.click("button[type='submit']"),
    ]);
    await settle(page);
    await page.goto(`${BASE}/patient/documents`, { waitUntil: "domcontentloaded", timeout: 20_000 }).catch(() => {});
    await settle(page);
    await page.click("button:has-text('Đăng xuất')").catch(() => {});
    await settle(page);
  });
} finally {
  await browser.close();
}

// Shape the artifact: every request observed, flagging 404s and /auth paths.
const report = {
  probe: "auth-404-initiator",
  base: BASE,
  generatedAt: new Date().toISOString(),
  credentials: "demo principals; password redacted (env HC_PASSWORD)",
  journeys: {},
  observations: [],
  verdict: "BOUNDED-NEGATIVE",
  details: "",
};

const authRequests = [];
const notFound = [];

for (const [name, journey] of Object.entries(journeys)) {
  report.journeys[name] = {
    errors: journey.errors,
    requestCount: journey.observations.length,
  };
  for (const obs of journey.observations) {
    const record = { journey: name, ...obs };
    if (obs.status === 404) notFound.push(record);
    if (authPath(obs.url)) authRequests.push(record);
  }
}

report.observations = authRequests;
report.notFoundResponses = notFound.map((r) => ({
  journey: r.journey,
  url: r.url,
  method: r.method,
  resourceType: r.resourceType,
  status: r.status,
  initiator: r.initiator,
}));

const exactAuth404 = notFound.filter((r) => {
  try { return new URL(r.url).pathname === "/auth"; } catch { return false; }
});

if (exactAuth404.length > 0) {
  report.verdict = "PRODUCER-FOUND";
  report.details = `Observed ${exactAuth404.length} request(s) for GET /auth returning 404 with initiator captured.`;
} else if (authRequests.length === 0 && notFound.length === 0) {
  report.verdict = "BOUNDED-NEGATIVE";
  report.details = "No /auth requests and no 404 responses observed across unauthenticated protected-route hits, admin login->logout, and patient login->logout journeys.";
} else {
  report.verdict = "BOUNDED-NEGATIVE";
  report.details = `No request for exact path /auth observed. ${authRequests.length} request(s) to /auth* paths (see observations), ${notFound.length} 404 response(s) total (see notFoundResponses).`;
}

writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(`wrote ${OUT}`);
console.log(`verdict=${report.verdict} authRequests=${authRequests.length} notFound=${notFound.length} exactAuth404=${exactAuth404.length}`);
for (const [name, j] of Object.entries(journeys)) {
  console.log(`journey ${name}: requests=${j.observations.length} errors=${j.errors.join(";") || "none"}`);
}
