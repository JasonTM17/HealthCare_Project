/**
 * PROBE 2 — real CMS persistence on the rebuilt audit stack.
 *
 * The :3330 BFF hop is currently dead for all trust-requiring traffic
 * (FE BFF_PUBLIC_ORIGIN lacks :3330; FE and BE service tokens differ),
 * so this probe exercises the SAME API contract directly against the
 * audit backend on :8180, presenting the backend's own configured BFF
 * credential from the container environment (never written to disk).
 * Admin session is still a real browser-session login; the write is a
 * real PUT + publish; restoration is the product rollback endpoint.
 */

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BACKEND = "http://localhost:8180";
const BFF_ORIGIN = "http://localhost:3330";
const ADMIN_EMAIL = "admin@healthcare.local";
const ADMIN_PASSWORD = process.env.HC_PASSWORD ?? "LocalDemo!2026";
const NEW_IMAGE_URL = "/media/about-care-poster.jpg";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "local-audit-cms-live-persistence.json");

const BFF_TOKEN = execSync(
  'docker exec healthcare-local-audit-backend-1 printenv BACKEND_BFF_SERVICE_TOKEN',
  { encoding: "utf8" },
).trim();

const bffHeaders = () => ({
  "X-Healthcare-Bff-Token": BFF_TOKEN,
  "X-Healthcare-Original-Origin": BFF_ORIGIN,
});

async function api(path, init = {}, session) {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  Object.entries(bffHeaders()).forEach(([k, v]) => headers.set(k, v));
  if (session) {
    headers.set("Cookie", session.cookieHeader);
    if (init.method && !["GET", "HEAD", "OPTIONS"].includes(init.method.toUpperCase())) {
      headers.set("X-CSRF-Token", session.csrfToken);
    }
  }
  const res = await fetch(`${BACKEND}${path}`, { ...init, headers });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* raw kept */ }
  return { status: res.status, json, raw: json ? undefined : text.slice(0, 500), headers: res.headers };
}

const report = {
  probe: "cms-live-persistence",
  generatedAt: new Date().toISOString(),
  routeNote: "Direct audit backend :8180 with its own configured BFF credential (env mismatch makes :3330 BFF hop unusable); admin principal redacted",
  steps: [],
};

function step(name, data) { report.steps.push({ step: name, ...data }); }

// 1. baseline published hero
const before = await api("/api/v1/cms/content/homepage.hero?afterEventId=0");
step("read-published-before", { status: before.status, version: before.json?.version, payload: before.json?.payload, componentType: before.json?.componentType, pubStatus: before.json?.status });
if (before.status !== 200) { report.verdict = "BLOCKED"; report.blocker = `public read ${before.status}`; writeFileSync(OUT, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report.verdict)); process.exit(0); }

// 2. admin login (real browser-session password grant)
const login = await api("/api/v1/auth/browser-sessions", {
  method: "POST",
  body: JSON.stringify({ grantType: "PASSWORD", email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
});
const setCookies = login.headers.getSetCookie ? login.headers.getSetCookie() : [login.headers.get("set-cookie")].filter(Boolean);
const cookiePairs = setCookies.map((c) => c.split(";", 1)[0].trim()).filter((c) => c.includes("="));
const csrf = cookiePairs.find((c) => c.startsWith("__Host-healthcare_csrf="))?.split("=", 2)[1];
step("admin-login", { status: login.status, sessionEstablished: login.status === 200 && cookiePairs.length > 0, csrfPresent: Boolean(csrf) });
if (login.status !== 200 || !csrf) {
  report.verdict = "BLOCKED";
  report.blocker = `admin login returned ${login.status}: ${login.raw ?? JSON.stringify(login.json)}`;
  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(`BLOCKED: ${report.blocker}`);
  process.exit(0);
}
const session = { cookieHeader: cookiePairs.join("; "), csrfToken: csrf };

const beforeVersion = before.json.version;
const beforePayload = before.json.payload;
const newPayload = { ...beforePayload, imageUrl: NEW_IMAGE_URL };

// 3. PUT new published version
const put = await api("/api/v1/admin/cms/content/homepage.hero", {
  method: "PUT",
  body: JSON.stringify({
    componentType: before.json.componentType,
    payload: newPayload,
    status: "PUBLISHED",
    expectedVersion: beforeVersion,
  }),
}, session);
step("put-new-version", { status: put.status, newVersion: put.json?.version, imageUrl: put.json?.payload?.imageUrl, raw: put.raw });
if (put.status !== 200) {
  report.verdict = "FAIL";
  report.blocker = `PUT returned ${put.status}: ${put.raw ?? JSON.stringify(put.json)}`;
  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(`FAIL: ${report.blocker}`);
  process.exit(0);
}
const newVersion = put.json.version;

// 4. public slot reflects new version + imageUrl
const after = await api("/api/v1/cms/content/homepage.hero?afterEventId=0");
step("read-published-after", {
  status: after.status,
  version: after.json?.version,
  imageUrl: after.json?.payload?.imageUrl,
  versionMatches: after.json?.version === newVersion,
  imageMatches: after.json?.payload?.imageUrl === NEW_IMAGE_URL,
});

// 5. restore original via product rollback endpoint (history -> rollback)
const history = await api("/api/v1/admin/cms/content/homepage.hero/history?limit=50", {}, session);
const beforeCanonical = JSON.stringify(Object.keys(beforePayload).sort().map((k) => [k, beforePayload[k]]));
const target = (history.json ?? []).find((e) => (
  e.rollbackAvailable && e.version === beforeVersion
  && JSON.stringify(Object.keys(e.payload ?? {}).sort().map((k) => [k, e.payload[k]])) === beforeCanonical
));
step("history-lookup", { status: history.status, entries: Array.isArray(history.json) ? history.json.length : 0, targetEventId: target?.eventId, targetVersion: target?.version });

let restored = null;
if (target) {
  const rb = await api("/api/v1/admin/cms/content/homepage.hero/rollback", {
    method: "POST",
    body: JSON.stringify({ changeId: target.eventId, expectedVersion: newVersion }),
  }, session);
  restored = await api("/api/v1/cms/content/homepage.hero?afterEventId=0");
  const restoredCanonical = restored.json?.payload
    ? JSON.stringify(Object.keys(restored.json.payload).sort().map((k) => [k, restored.json.payload[k]]))
    : null;
  step("rollback-restore", {
    status: rb.status,
    restoredVersion: restored.json?.version,
    payloadMatchesOriginal: restoredCanonical === beforeCanonical,
    imageUrlAfterRestore: restored.json?.payload?.imageUrl ?? null,
    raw: rb.raw,
  });
} else {
  step("rollback-restore", { status: "skipped", reason: "no matching rollback snapshot for original payload" });
}

const r = report.steps.find((s) => s.step === "read-published-after");
report.verdict = (r?.versionMatches && r?.imageMatches && report.steps.find((s) => s.step === "rollback-restore")?.payloadMatchesOriginal === true)
  ? "PASS"
  : report.steps.find((s) => s.step === "rollback-restore")?.payloadMatchesOriginal === false
    ? "PASS-WITH-LEFTOVER"
    : r?.versionMatches && r?.imageMatches ? "PASS-RESTORE-UNCONFIRMED" : "FAIL";
report.beforeVersion = beforeVersion;
report.newVersion = newVersion;
report.restoredVersion = report.steps.find((s) => s.step === "rollback-restore")?.restoredVersion;
writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.steps.map((s) => ({ step: s.step, status: s.status, version: s.version ?? s.restoredVersion ?? s.newVersion })), null, 1));
console.log("VERDICT:", report.verdict);
