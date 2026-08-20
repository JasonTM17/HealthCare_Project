import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const helperPath = path.join(repoRoot, "scripts", "local-mvp-provenance.ps1");

function findPowerShell() {
  for (const candidate of ["pwsh", "powershell"]) {
    const probe = spawnSync(candidate, ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", "$PSVersionTable.PSVersion.ToString()"], {
      encoding: "utf8",
    });
    if (!probe.error && probe.status === 0) {
      return candidate;
    }
  }

  throw new Error("PowerShell was not found");
}

function runPowerShell(scriptPath) {
  const shell = findPowerShell();
  return spawnSync(shell, ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath], {
    encoding: "utf8",
    env: { ...process.env },
  });
}

test("local MVP provenance helpers fail closed on dirty, invalid, and mismatched inputs", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "healthcare-provenance-"));
  try {
    const helperBin = path.join(tempRoot, "bin");
    const repo = path.join(tempRoot, "repo");
    const runner = path.join(tempRoot, "runner.ps1");
    const fakeGit = path.join(helperBin, "git.ps1");
    const fakeDocker = path.join(helperBin, "docker.ps1");

    await mkdir(helperBin, { recursive: true });
    await mkdir(repo, { recursive: true });

    await writeFile(
      fakeGit,
      `
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$RemainingArgs)

if ($RemainingArgs.Count -lt 3 -or $RemainingArgs[0] -ne '-C') {
    exit 9
}

switch ($RemainingArgs[2]) {
    'rev-parse' {
        switch ($env:FAKE_GIT_MODE) {
            'invalid' { 'not-a-sha'; exit 0 }
            'fail' { exit 1 }
            default { '0123456789abcdef0123456789abcdef01234567'; exit 0 }
        }
    }
    'status' {
        switch ($env:FAKE_GIT_MODE) {
            'dirty' { ' M scripts/start-and-verify-local-mvp.ps1'; exit 0 }
            'fail' { exit 1 }
            default { exit 0 }
        }
    }
    default {
        exit 8
    }
}
`.trimStart(),
      "utf8",
    );

    await writeFile(
      fakeDocker,
      `
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$RemainingArgs)

if ($RemainingArgs.Count -lt 1 -or $RemainingArgs[0] -ne 'inspect') {
    exit 9
}

switch ($env:FAKE_DOCKER_MODE) {
    'mismatch' { 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef'; exit 0 }
    'empty' { exit 0 }
    'fail' { exit 1 }
    default { '0123456789abcdef0123456789abcdef01234567'; exit 0 }
}
`.trimStart(),
      "utf8",
    );

    await writeFile(
      runner,
      `
$ErrorActionPreference = 'Stop'
. '${helperPath.replace(/'/g, "''")}'

$repoRoot = '${repo.replace(/'/g, "''")}'
$gitExe = '${fakeGit.replace(/'/g, "''")}'
$dockerExe = '${fakeDocker.replace(/'/g, "''")}'

function Expect-Throws {
    param(
        [Parameter(Mandatory)] [scriptblock]$Action,
        [Parameter(Mandatory)] [string]$FailureMessage
    )

    $failed = $false
    try {
        & $Action | Out-Null
    } catch {
        $failed = $true
    }

    if (-not $failed) {
        throw $FailureMessage
    }
}

$env:FAKE_GIT_MODE = 'valid'
$revision = Get-SourceRevision -RepositoryRoot $repoRoot -GitExecutable $gitExe
if ($revision -ne '0123456789abcdef0123456789abcdef01234567') {
    throw "Unexpected revision: $revision"
}

$env:FAKE_GIT_MODE = 'invalid'
Expect-Throws -Action { Get-SourceRevision -RepositoryRoot $repoRoot -GitExecutable $gitExe } -FailureMessage 'Get-SourceRevision should fail on invalid output'

$env:FAKE_GIT_MODE = 'clean'
Assert-CleanBuildContext -RepositoryRoot $repoRoot -GitExecutable $gitExe

$env:FAKE_GIT_MODE = 'dirty'
Expect-Throws -Action { Assert-CleanBuildContext -RepositoryRoot $repoRoot -GitExecutable $gitExe } -FailureMessage 'Assert-CleanBuildContext should fail on dirty output'

Assert-ExpectedRevision -Revision $revision
Expect-Throws -Action { Assert-ExpectedRevision -Revision 'unknown' } -FailureMessage 'Assert-ExpectedRevision should fail on malformed revisions'

$env:FAKE_DOCKER_MODE = 'default'
Assert-ContainerRevision -ContainerName 'healthcare-backend' -Revision $revision -DockerExecutable $dockerExe

$env:FAKE_DOCKER_MODE = 'mismatch'
Expect-Throws -Action { Assert-ContainerRevision -ContainerName 'healthcare-backend' -Revision $revision -DockerExecutable $dockerExe } -FailureMessage 'Assert-ContainerRevision should fail on mismatched labels'

$env:FAKE_DOCKER_MODE = 'empty'
Expect-Throws -Action { Assert-ContainerRevision -ContainerName 'healthcare-backend' -Revision $revision -DockerExecutable $dockerExe } -FailureMessage 'Assert-ContainerRevision should fail on empty labels'
`.trimStart(),
      "utf8",
    );

    const result = runPowerShell(runner);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`.trim());
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
