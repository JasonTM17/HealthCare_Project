import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("feedback page gates the form behind an authenticated session", async () => {
  const page = await read("app/gop-y/page.tsx");

  assert.match(page, /useAuthSession\(\)/, "page must read the auth session");
  assert.match(page, /useAuthSessionStatus\(\)/, "page must observe hydration status");
  assert.match(page, /hydrateAuthSession\(true\)/, "indeterminate state must offer a re-verification action");
  // Logged-out visitors get a login link carrying a return path, not a bare redirect.
  assert.match(page, /\/auth\/login\?next=%2Fgop-y/, "login gate must return to /gop-y");
  assert.match(page, /!session\s*\?/, "form must only render for a settled session");
});

test("feedback page validates input and posts through the authenticated client", async () => {
  const page = await read("app/gop-y/page.tsx");
  const api = await read("lib/api-client.ts");

  assert.match(page, /submitUserFeedback\(\{/, "form must call submitUserFeedback");
  assert.match(page, /MESSAGE_MIN\s*=\s*10/, "message minimum mirrors the backend contract");
  assert.match(page, /MESSAGE_MAX\s*=\s*2000/, "message maximum mirrors the backend contract");
  assert.match(page, /listMyFeedback\(\)/, "page lists the caller's own submissions");
  assert.match(page, /disabled=\{!canSubmit\}/, "submit button stays disabled until input is valid");

  const submit = api.match(/export async function submitUserFeedback[\s\S]*?\n\}/);
  assert.ok(submit, "api-client must export submitUserFeedback");
  assert.match(submit[0], /getAuthenticatedJson<UserFeedbackItem>\("\/feedback"/);
  assert.match(submit[0], /method:\s*"POST"/);

  const list = api.match(/export async function listMyFeedback[\s\S]*?\n\}/);
  assert.ok(list, "api-client must export listMyFeedback");
  assert.match(list[0], /getAuthenticatedJson<UserFeedbackItem\[\]>\("\/feedback\/mine"/);
});

test("feedback entry points exist in public footer and portal navigation", async () => {
  const [footer, chrome, sitemap] = await Promise.all([
    read("components/Footer.tsx"),
    read("components/PortalChrome.tsx"),
    read("app/sitemap.ts"),
  ]);

  assert.match(footer, /<Link href="\/gop-y">Góp ý<\/Link>/, "public footer links to /gop-y");
  assert.match(chrome, /\{ href: "\/gop-y", label: "Góp ý" \}/, "portal nav links to /gop-y");
  assert.match(sitemap, /"\/gop-y"/, "sitemap includes /gop-y");
});

test("feedback backend stays behind authentication and owns user identity server-side", async () => {
  const [security, controller, service, migration] = await Promise.all([
    read("../backend/src/main/java/com/healthcare/security/SecurityConfig.java"),
    read("../backend/src/main/java/com/healthcare/feedback/controller/FeedbackController.java"),
    read("../backend/src/main/java/com/healthcare/feedback/service/FeedbackService.java"),
    read("../backend/src/main/resources/db/migration/V113__user_feedback.sql"),
  ]);

  // No permitAll matcher may cover /feedback; it must fall under
  // anyRequest().authenticated() at the end of the security chain.
  const permitAllBlock = security.match(/\.requestMatchers\(([\s\S]*?)\)\.permitAll\(\)/g) ?? [];
  for (const block of permitAllBlock) {
    assert.doesNotMatch(block, /feedback/, "/feedback must never be permitAll");
  }
  assert.match(security, /\.anyRequest\(\)\.authenticated\(\)/, "authenticated fallback must exist");

  assert.match(controller, /@RequestMapping\("\/api\/v1\/feedback"\)/);
  assert.match(controller, /@AuthenticationPrincipal UserDetails principal/, "identity comes from the principal");
  assert.doesNotMatch(controller + service, /request\.userId|userId\(\)/, "client must never supply the user id");

  assert.match(service, /DAILY_FEEDBACK_LIMIT/, "abuse guard: daily submission cap");
  assert.match(service, /countByUserIdAndCreatedAtAfter/, "daily cap counts the caller's rows only");

  assert.match(migration, /CREATE TABLE IF NOT EXISTS user_feedback/);
  assert.match(migration, /user_id\s+UUID NOT NULL REFERENCES users\(id\)/);
  assert.match(migration, /chk_user_feedback_message_len/);
});
