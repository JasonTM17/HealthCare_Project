import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../../..", import.meta.url));

function runGit(cwd, args, extraEnv = {}) {
  return spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...extraEnv },
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
    const flagged = {
      "secret.txt": `token=${["AKIA", "0".repeat(16)].join("")}\n`,
      "secret-asia.txt": `token=${["ASIA", "1".repeat(16)].join("")}\n`,
      "private-key.txt": ["-----BEGIN ", "PRIVATE KEY-----\nfixture\n"].join(""),
      "private-key-rsa.txt": ["-----BEGIN ", "RSA PRIVATE KEY-----\nfixture\n"].join(""),
      "private-key-ec.txt": ["-----BEGIN ", "EC PRIVATE KEY-----\nfixture\n"].join(""),
      "private-key-openssh.txt": ["-----BEGIN ", "OPENSSH PRIVATE KEY-----\nfixture\n"].join(""),
      "private-key-dsa.txt": ["-----BEGIN ", "DSA PRIVATE KEY-----\nfixture\n"].join(""),
      "private-key-pgp.txt": ["-----BEGIN ", "PGP PRIVATE KEY BLOCK-----\nfixture\n"].join(""),
      "gh-token.txt": `token=${["ghp_", "a".repeat(22)].join("")}\n`,
      "gh-pat.txt": `token=${["github_pat_", "b".repeat(22)].join("")}\n`,
      "slack-token.txt": `token=${["xoxb-", "1".repeat(22)].join("")}\n`,
      "google-api-key.txt": `key=${["AIza", "c".repeat(31)].join("")}\n`,
      "jwt.txt": ["eyJ", "a".repeat(15), ".", "b".repeat(15), ".", "c".repeat(15)].join(""),
    };
    await writeFile(path.join(tempRoot, "README.txt"), "synthetic fixture repo\n", "utf8");
    await writeFile(path.join(tempRoot, "safe.txt"), "plain note without secrets\n", "utf8");
    await writeFile(path.join(tempRoot, "workflow.yml"), workflow, "utf8");
    for (const [name, content] of Object.entries(flagged)) {
      await writeFile(path.join(tempRoot, name), content, "utf8");
    }

    const init = runGit(tempRoot, ["init", "-q"]);
    assert.equal(init.status, 0, init.stderr);
    const add = runGit(tempRoot, ["add", "."]);
    assert.equal(add.status, 0, add.stderr);
    const commit = runGit(tempRoot, ["commit", "-q", "-m", "init"], {
      GIT_AUTHOR_NAME: "Test User",
      GIT_AUTHOR_EMAIL: "test@example.com",
      GIT_COMMITTER_NAME: "Test User",
      GIT_COMMITTER_EMAIL: "test@example.com",
    });
    assert.equal(commit.status, 0, commit.stderr);

    const pattern = patternMatch[1];
    const extended = runGit(tempRoot, ["grep", "-I", "-E", "-l", "-e", pattern, "HEAD", "--", "."]);
    assert.equal(extended.status, 0, extended.stderr);
    for (const name of Object.keys(flagged)) {
      assert.match(extended.stdout, new RegExp(name.replaceAll(".", "\\.")), `scan must flag ${name}`);
    }
    assert.doesNotMatch(extended.stdout, /safe\.txt/);
    assert.doesNotMatch(extended.stdout, /workflow\.yml/);
    assert.doesNotMatch(extended.stdout, /README\.txt/);

    const basic = runGit(tempRoot, ["grep", "-I", "-l", "-e", pattern, "HEAD", "--", "."]);
    assert.equal(basic.status, 1, basic.stderr);
    assert.equal(basic.stdout.trim(), "");
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
