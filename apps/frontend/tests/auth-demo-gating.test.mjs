import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const loginPagePath = new URL("../app/auth/login/page.tsx", import.meta.url);

test("production login never renders demo credentials without the explicit demo flag", async () => {
  const source = await readFile(loginPagePath, "utf8");

  // The demo helper is opt-in at build time; hosted builds default to a plain form.
  assert.match(
    source,
    /const SHOW_DEMO_ACCOUNTS = process\.env\.NEXT_PUBLIC_ENABLE_DEMO_LOGIN === "true";/,
    "demo panel must be gated behind NEXT_PUBLIC_ENABLE_DEMO_LOGIN"
  );

  // The privileged admin demo entry needs a second opt-in flag.
  assert.match(
    source,
    /const SHOW_DEMO_ADMIN = process\.env\.NEXT_PUBLIC_ENABLE_DEMO_ADMIN === "true";/,
    "admin demo role must be gated behind NEXT_PUBLIC_ENABLE_DEMO_ADMIN"
  );
  assert.match(
    source,
    /const DEMO_ROLES: readonly DemoRoleInfo\[\] = ALL_DEMO_ROLES\.filter\(\s*\(item\) => item\.role !== "ADMIN" \|\| SHOW_DEMO_ADMIN\s*\);/,
    "demo role list must exclude ADMIN unless the admin flag is set"
  );

  // Both credential-bearing render blocks sit behind the gate.
  const demoSectionStart = source.indexOf("{SHOW_DEMO_ACCOUNTS ? (");
  assert.notEqual(demoSectionStart, -1, "demo section render must be wrapped in the gate");
  const demoSectionEnd = source.indexOf(") : null}", demoSectionStart);
  assert.notEqual(demoSectionEnd, -1);
  const demoBlock = source.slice(demoSectionStart, demoSectionEnd);
  assert.match(demoBlock, /Tài khoản demo/, "demo section block should contain the demo panel");

  const badgeStart = source.indexOf("{SHOW_DEMO_ACCOUNTS && selectedRoleInfo ? (");
  assert.notEqual(badgeStart, -1, "role password badge must require the demo flag too");
  const badgeEnd = source.indexOf(") : null}", badgeStart);
  assert.notEqual(badgeEnd, -1);
  const badgeBlock = source.slice(badgeStart, badgeEnd);
  assert.match(badgeBlock, /HealthCare@2026/, "password literal belongs inside the gated badge");

  // Typing a demo email must not reveal the role badge when the gate is off.
  const handleCustomInput = source.match(
    /const handleCustomInput = [\s\S]*?\n  \};/
  );
  assert.ok(handleCustomInput, "handleCustomInput must exist");
  assert.match(
    handleCustomInput[0],
    /if \(SHOW_DEMO_ACCOUNTS\) \{[\s\S]*DEMO_ROLES\.find/,
    "demo email autocomplete match must be gated"
  );

  // Selecting a demo role is a no-op without the gate.
  const handleRoleSelect = source.match(
    /const handleRoleSelect = \(item: DemoRoleInfo\) => \{[\s\S]*?\n  \};/
  );
  assert.ok(handleRoleSelect, "handleRoleSelect must exist");
  assert.match(
    handleRoleSelect[0],
    /if \(!SHOW_DEMO_ACCOUNTS\) return;/,
    "demo role selection must be a no-op when the gate is off"
  );
});

test("demo role buttons share the row evenly for any count", async () => {
  const css = await readFile(
    new URL("../app/auth/login/login.module.css", import.meta.url),
    "utf8"
  );
  const roleGroup = css.match(/\.roleGroup\s*\{[^}]*\}/);
  assert.ok(roleGroup, "roleGroup rule must exist");
  assert.match(
    roleGroup[0],
    /grid-auto-flow:\s*column;\s*grid-auto-columns:\s*1fr/,
    "role buttons must split the row into equal columns (2 buttons = 50/50, 3 = thirds)"
  );
  assert.doesNotMatch(
    roleGroup[0],
    /grid-template-columns:\s*repeat\(3/,
    "must not pin a fixed 3-column grid that leaves a gap when a role is hidden"
  );
});
