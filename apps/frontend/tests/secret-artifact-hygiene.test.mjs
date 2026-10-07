import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../../..", import.meta.url));

test("browser authentication state stays outside Git while E2E source stays visible", () => {
  for (const artifact of [
    "apps/frontend/tests/e2e/.auth/admin.json",
    "apps/frontend/tests/e2e/.auth/patient.json",
    "playwright/.auth/session.json",
  ]) {
    const result = spawnSync("git", ["check-ignore", "--no-index", artifact], {
      cwd: root, encoding: "utf8",
    });
    assert.equal(result.status, 0, `${artifact} must be ignored`);
  }
  const source = spawnSync("git", ["check-ignore", "--no-index",
    "apps/frontend/tests/e2e/patient-chat.spec.ts"], { cwd: root });
  assert.equal(source.status, 1, "E2E source must remain trackable");
});
