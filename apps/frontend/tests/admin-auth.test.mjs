import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const apiClientPath = new URL("../lib/api-client.ts", import.meta.url);
const adminLayoutPath = new URL("../app/admin/layout.tsx", import.meta.url);

const ADMIN_HELPERS = [
  "adminListDoctors",
  "adminCreateDoctor",
  "adminUpdateDoctor",
  "adminDeleteDoctor",
  "adminListSpecialties",
  "adminCreateSpecialty",
  "adminUpdateSpecialty",
  "adminDeleteSpecialty",
];

function functionBody(source, name) {
  const start = source.indexOf(`export async function ${name}`);
  assert.notEqual(start, -1, `missing ${name}`);
  const next = source.indexOf("\nexport async function ", start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

test("role-protected admin helpers use the shared cookie-session client", async () => {
  const source = await readFile(apiClientPath, "utf8");

  assert.match(source, /async function getAuthenticatedJson/);
  assert.match(source, /const headers = new Headers\(init\?\.headers\)/);
  assert.doesNotMatch(source, /headers:\s*\{\s*"Content-Type": "application\/json",\s*\.\.\.init\?\.headers\s*\}/);
  assert.match(source, /throw new ApiError\([\s\S]*?, 401, path\)/);
  assert.match(source, /return new ApiError\(message, res\.status, path\)/);

  for (const name of ADMIN_HELPERS) {
    const body = functionBody(source, name);
    assert.match(body, /getAuthenticatedJson/, `${name} must use the shared session boundary`);
    assert.doesNotMatch(body, /\bgetJson\b|\bfetch\s*\(/, `${name} bypasses auth`);
  }
});

test("shared authenticated client hydrates and invalidates the HttpOnly browser session safely", async () => {
  const source = await readFile(apiClientPath, "utf8");
  const getAuthenticatedJson = source.slice(
    source.indexOf("async function getAuthenticatedJson"),
    source.indexOf("interface SpecialtyRecommendationResponse"),
  );
  const uploadDiagnosticFile = functionBody(source, "uploadDiagnosticFile");
  const downloadProtectedFile = functionBody(source, "downloadProtectedFile");

  assert.match(source, /interface AuthHydrationFlight/);
  assert.match(source, /let authHydrationFlight: AuthHydrationFlight \| null = null/);
  assert.match(source, /getJson<unknown>\("\/auth\/browser-sessions\/current"/);
  assert.match(source, /authSessionVersion === expectedVersion/);
  assert.match(source, /authHydrationFlight === flight/);
  assert.match(source, /error instanceof ApiError && error\.status === 401 && authSessionVersion === expectedVersion/);
  assert.match(getAuthenticatedJson, /withAuthenticatedSession\(path/);
  assert.doesNotMatch(source, /\/auth\/refresh|Authorization|Bearer|accessToken|refreshToken|tokenType/);
  assert.match(uploadDiagnosticFile, /withAuthenticatedSession\(path/);
  assert.match(uploadDiagnosticFile, /credentials: "same-origin"/);
  assert.match(downloadProtectedFile, /withAuthenticatedSession\(normalizedPath/);
  assert.match(downloadProtectedFile, /credentials: "same-origin"/);
});

test("admin logout redirects only after confirmed revocation and exposes a retryable safe failure", async () => {
  const [source, apiSource] = await Promise.all([
    readFile(adminLayoutPath, "utf8"),
    readFile(apiClientPath, "utf8"),
  ]);

  assert.match(apiSource, /SAFE_LOGOUT_ERROR_MESSAGE = "Không thể đăng xuất an toàn/);
  assert.match(source, /SAFE_LOGOUT_ERROR_MESSAGE/);
  assert.match(source, /role="status"/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /const outcome = await logoutCurrentUser\(\)/);
  assert.match(source, /outcome\.status === "LOGGED_OUT"[\s\S]*?router\.replace\("\/auth\/login/);
  assert.match(source, /else\s*\{\s*set(?:SwitchAccount|Logout)Error\(SAFE_LOGOUT_ERROR_MESSAGE\)/);
  assert.match(source, /setSwitchingAccount\(false\)/);
  assert.match(source, /setLoggingOut\(false\)/);
  assert.doesNotMatch(source, /Browser session is cleared even when remote sign-out is unavailable/);
  assert.doesNotMatch(source, /finally\s*\{[^}]*router\.replace\("\/auth\/login/);
});
