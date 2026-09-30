import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Bridge contract: a guest who just found their appointment on /tra-cuu is
// holding the exact phone (+ email) a patient account must reuse for the old
// appointments to surface in the portal. The lookup page must offer the
// registration CTA with those values prefilled via the query string, and the
// register form must consume them.
const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

const CTA_LABEL = "Tạo tài khoản để lưu lịch vào cổng bệnh nhân";
const BRIDGE_COPY =
  "Dùng đúng SĐT VÀ email bạn đã dùng khi đặt lịch (kể cả đặt với tư cách khách) để lịch cũ tự xuất hiện trong cổng.";

test("register page prefills phone and email from the lookup bridge query", async () => {
  const registration = await read("app/auth/register/page.tsx");

  // Query-driven prefill follows the Suspense-boundary pattern already used by
  // the other auth routes (verify-email, reset-password).
  assert.match(registration, /useSearchParams/);
  assert.match(registration, /searchParams\.get\("phone"\)/);
  assert.match(registration, /searchParams\.get\("email"\)/);
  assert.match(registration, /<Suspense/);

  // The vague intro is replaced by the exact bridge copy.
  assert.match(registration, /Dùng đúng SĐT VÀ email bạn đã dùng khi đặt lịch \(kể cả đặt với tư cách khách\) để lịch cũ tự xuất hiện trong cổng\./);
  assert.doesNotMatch(registration, /Số điện thoại giúp liên kết đúng lịch hẹn với hồ sơ của bạn/);
});

test("lookup hero carries the register bridge CTA", async () => {
  const lookup = await read("app/tra-cuu/page.tsx");
  const heroStart = lookup.indexOf('className="resource-actions"');
  assert.ok(heroStart > 0, "hero actions row must exist");
  const heroEnd = lookup.indexOf("</div>", heroStart);
  const hero = lookup.slice(heroStart, heroEnd);

  assert.ok(hero.includes(CTA_LABEL), "hero actions must carry the register CTA");
  assert.match(hero, /href=\{registerHref\}/);
  assert.match(hero, /data-testid="tra-cuu-register-cta-hero"/);
});

test("found-ticket actions carry the register bridge CTA with prefilled identity", async () => {
  const lookup = await read("app/tra-cuu/page.tsx");
  const actionsStart = lookup.indexOf('className="pt-2 flex flex-wrap');
  assert.ok(actionsStart > 0, "found-ticket actions row must exist");
  const actionsEnd = lookup.indexOf("Hủy lịch hẹn này", actionsStart);
  const actions = lookup.slice(actionsStart, actionsEnd);

  assert.ok(actions.includes(CTA_LABEL), "found ticket must carry the register CTA");
  assert.match(actions, /data-testid="tra-cuu-register-cta-ticket"/);
  // The ticket bridges the identity that the lookup just verified.
  assert.match(actions, /buildRegisterHref\(appointment\.patientPhone, appointment\.patientEmail\)/);
});

test("register href builder validates and URL-encodes phone and email", async () => {
  const lookup = await read("app/tra-cuu/page.tsx");
  const builderStart = lookup.indexOf("const REGISTER_PATH");
  assert.ok(builderStart > 0, "REGISTER_PATH must exist");
  const componentStart = lookup.indexOf("export default function TraCuuPage");
  const builder = lookup.slice(builderStart, componentStart);

  assert.match(builder, /new URLSearchParams\(\)/);
  assert.match(builder, /PHONE_QUERY_PATTERN\.test\(/);
  assert.match(builder, /EMAIL_QUERY_PATTERN\.test\(/);
  assert.match(builder, /params\.set\("phone", /);
  assert.match(builder, /params\.set\("email", /);
  // URLSearchParams.toString() percent-encodes reserved characters (a leading
  // "+" in an international number must not decay into a space).
  assert.match(builder, /toString\(\)/);
  assert.match(builder, /\/auth\/register/);

  // The phone gate matches the lookup input's own validation and additionally
  // requires at least one digit.
  assert.match(lookup, /const PHONE_QUERY_PATTERN = \/\^\(\?=\.\*\[0-9\]\)\[\+0-9\(\) \.\-\]\{7,20\}\$\//);
});

test("hero CTA carries prefilled query only once an appointment was found", async () => {
  const lookup = await read("app/tra-cuu/page.tsx");
  const componentStart = lookup.indexOf("export default function TraCuuPage");

  assert.match(lookup.slice(componentStart), /const registerHref = appointment\s*\n\s*\? buildRegisterHref\(appointment\.patientPhone, appointment\.patientEmail\)\s*\n\s*: REGISTER_PATH/);
});
