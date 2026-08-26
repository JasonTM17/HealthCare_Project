import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("REST auth routes and client actions are present", async () => {
  await Promise.all([
    access(new URL("../app/auth/verify-email/page.tsx", import.meta.url)),
    access(new URL("../app/auth/forgot-password/page.tsx", import.meta.url)),
    access(new URL("../app/auth/reset-password/page.tsx", import.meta.url)),
    access(new URL("../app/patient/preferences/page.tsx", import.meta.url)),
  ]);

  const api = await read("lib/api-client.ts");
  for (const path of [
    "/auth/browser-sessions",
    "/auth/browser-sessions/current",
    "/auth/email-verifications/resend",
    "/auth/password-reset-requests",
    "/auth/password-reset-requests/confirm",
    "/users/me/preferences",
    "/users/me/notification-preferences",
  ]) {
    assert.match(api, new RegExp(path.replaceAll("/", "\\/")));
  }
  assert.match(api, /UserPreferences/);
  assert.match(api, /NotificationPreference/);
  assert.match(api, /emailVerified/);
  assert.match(api, /readonly code: string \| null/);
  assert.match(api, /readonly fieldErrors/);
  assert.match(api, /grantType: "PASSWORD"/);
  assert.match(api, /grantType: "EMAIL_VERIFICATION"/);
  assert.match(api, /method: "DELETE"/);
  assert.doesNotMatch(api, /sessionStorage|localStorage|Authorization|Bearer|accessToken|refreshToken|tokenType/);

  const authFlow = await read("lib/auth-flow.ts");
  assert.match(authFlow, /safeAuthNextPath/);
  assert.match(authFlow, /decodeURIComponent/);
  assert.match(authFlow, /decoded\.startsWith\("\/\/"\)/);
  assert.match(authFlow, /\\u0000-\\u001f/);

  const registerStart = api.indexOf("export async function register");
  const loginStart = api.indexOf("export async function login");
  assert.ok(registerStart >= 0 && loginStart > registerStart);
  assert.doesNotMatch(api.slice(registerStart, loginStart), /beginAuthMutation|commitIssuedAuthSession/);
});

test("registration waits for email verification and exposes bounded resend", async () => {
  const registration = await read("app/auth/register/page.tsx");
  assert.match(registration, /pendingEmail/);
  assert.match(registration, /maskEmail/);
  assert.match(registration, /resendAfterSeconds/);
  assert.match(registration, /resendVerificationEmail/);
  assert.match(registration, /disabled=\{resending \|\| resendCooldown > 0\}/);
  assert.match(registration, /auth\/login\?next=\/patient\/dashboard/);
});

test("login and recovery surfaces map verification and reset states", async () => {
  const [login, verify, forgot, reset, preferences] = await Promise.all([
    read("app/auth/login/page.tsx"),
    read("app/auth/verify-email/page.tsx"),
    read("app/auth/forgot-password/page.tsx"),
    read("app/auth/reset-password/page.tsx"),
    read("app/patient/preferences/page.tsx"),
  ]);

  assert.match(login, /EMAIL_VERIFICATION_REQUIRED/);
  assert.match(login, /auth\/forgot-password/);
  assert.match(verify, /role="status"/);
  assert.match(verify, /role="alert"/);
  assert.match(verify, /resendVerificationEmail/);
  assert.match(forgot, /requestPasswordReset/);
  assert.match(forgot, /không tiết lộ email/);
  assert.match(reset, /resetPassword/);
  assert.match(reset, /reset-email/);
  assert.match(reset, /confirmPassword/);
  assert.match(preferences, /hasRole\(session\.user, "PATIENT"\)/);
  assert.match(preferences, /fetchNotificationPreferences/);
  assert.match(preferences, /updateNotificationPreference/);
  assert.match(preferences, /BẮT BUỘC/);
  assert.match(preferences, /Khóa/);
  assert.match(preferences, /Thử lại/);
});
