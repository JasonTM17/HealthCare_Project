import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageJsonPath = new URL("../package.json", import.meta.url);

test("frontend typecheck bootstraps generated Next route types first", async () => {
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));

  assert.match(packageJson.scripts.typecheck, /next typegen/);
  assert.match(packageJson.scripts.typecheck, /tsc --noEmit/);
});
