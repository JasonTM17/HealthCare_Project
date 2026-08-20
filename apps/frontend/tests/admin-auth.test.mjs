import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const apiClientPath = new URL("../lib/api-client.ts", import.meta.url);

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

test("role-protected admin helpers use the shared authenticated client", async () => {
  const source = await readFile(apiClientPath, "utf8");

  assert.match(source, /async function getAuthenticatedJson/);
  assert.match(source, /const headers = new Headers\(init\?\.headers\)/);
  assert.doesNotMatch(source, /headers:\s*\{\s*"Content-Type": "application\/json",\s*\.\.\.init\?\.headers\s*\}/);
  assert.match(source, /throw new ApiError\([\s\S]*?, 401, path\)/);
  assert.match(source, /return new ApiError\(message, res\.status, path\)/);

  for (const name of ADMIN_HELPERS) {
    const body = functionBody(source, name);
    assert.match(body, /getAuthenticatedJson/, `${name} must attach the session token`);
    assert.doesNotMatch(body, /\bgetJson\b|\bfetch\s*\(/, `${name} bypasses auth`);
  }
});

test("shared authenticated client refreshes expired sessions before replaying safe calls", async () => {
  const source = await readFile(apiClientPath, "utf8");
  const getAuthenticatedJson = source.slice(
    source.indexOf("async function getAuthenticatedJson"),
    source.indexOf("interface SpecialtyRecommendationResponse"),
  );
  const uploadDiagnosticFile = functionBody(source, "uploadDiagnosticFile");
  const downloadProtectedFile = functionBody(source, "downloadProtectedFile");

  assert.match(source, /let refreshAuthSessionPromise/);
  assert.match(source, /getJson<AuthSession>\("\/auth\/refresh"/);
  assert.match(source, /storeAuthSession\(session\)/);
  assert.match(source, /clearAuthSession\(\)/);
  assert.match(source, /error instanceof ApiError[\s\S]*error\.status !== 401/);
  assert.match(getAuthenticatedJson, /withAuthenticatedSession\(path/);
  assert.match(getAuthenticatedJson, /headers\.set\("Authorization", `\$\{session\.tokenType\} \$\{session\.accessToken\}`\)/);
  assert.match(uploadDiagnosticFile, /withAuthenticatedSession\(path/);
  assert.match(downloadProtectedFile, /withAuthenticatedSession\(normalizedPath/);
});
