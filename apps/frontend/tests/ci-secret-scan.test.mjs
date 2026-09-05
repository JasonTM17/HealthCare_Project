import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../../..", import.meta.url));

function runGit(cwd, args) {
  return spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env },
  });
}

test("CI credential scan uses extended regex and catches synthetic secret-shaped fixtures", async () => {
  const workflow = await readFile(new URL("../../../.github/workflows/ci.yml", import.meta.url), "utf8");
  const patternMatch = workflow.match(/git grep -I -E -l -e '([^']+)' HEAD -- \./);
  assert.ok(patternMatch, "expected the CI workflow credential scan pattern to be present");
  assert.match(workflow, /git grep -I -E -l -e '.*' HEAD -- \./);
  assert.doesNotMatch(workflow, /credential_files=.*\|\|\s*true/);

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "healthcare-ci-secret-scan-"));
  try {
    await writeFile(path.join(tempRoot, "README.txt"), "synthetic fixture repo\n", "utf8");
    await writeFile(path.join(tempRoot, "safe.txt"), "plain note without secrets\n", "utf8");
    await writeFile(path.join(tempRoot, "secret.txt"), `token=${["AKIA", "0".repeat(16)].join("")}\n`, "utf8");

    const init = runGit(tempRoot, ["init", "-q"]);
    assert.equal(init.status, 0, init.stderr);
    const configUser = runGit(tempRoot, ["config", "user.email", "test@example.com"]);
    assert.equal(configUser.status, 0, configUser.stderr);
    const configName = runGit(tempRoot, ["config", "user.name", "Test User"]);
    assert.equal(configName.status, 0, configName.stderr);
    const add = runGit(tempRoot, ["add", "."]);
    assert.equal(add.status, 0, add.stderr);
    const commit = runGit(tempRoot, ["commit", "-q", "-m", "init"]);
    assert.equal(commit.status, 0, commit.stderr);

    const pattern = patternMatch[1];
    const extended = runGit(tempRoot, ["grep", "-I", "-E", "-l", "-e", pattern, "HEAD", "--", "."]);
    assert.equal(extended.status, 0, extended.stderr);
    assert.match(extended.stdout, /secret\.txt/);
    assert.doesNotMatch(extended.stdout, /safe\.txt/);

    const basic = runGit(tempRoot, ["grep", "-I", "-l", "-e", pattern, "HEAD", "--", "."]);
    assert.equal(basic.status, 1, basic.stderr);
    assert.equal(basic.stdout.trim(), "");
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
