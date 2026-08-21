import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
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

test("local MVP provenance helpers fail closed on dirty, identity drift, invalid, and mismatched inputs", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "healthcare-provenance-"));
  try {
    const helperBin = path.join(tempRoot, "bin");
    const repo = path.join(tempRoot, "repo");
    const runner = path.join(tempRoot, "runner.ps1");
    const fakeGit = path.join(helperBin, "git.ps1");
    const fakeDocker = path.join(helperBin, "docker.ps1");
    const archiveSource = path.join(helperBin, "archive-source");

    await mkdir(helperBin, { recursive: true });
    await mkdir(repo, { recursive: true });
    await mkdir(path.join(archiveSource, "infrastructure"), { recursive: true });
    await writeFile(path.join(archiveSource, "infrastructure", "docker-compose.yml"), "services: {}\n", "utf8");

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
            'switched' { 'fedcba9876543210fedcba9876543210fedcba98'; exit 0 }
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
    'archive' {
        $outputOption = $RemainingArgs | Where-Object { $_ -like '--output=*' } | Select-Object -First 1
        if ([string]::IsNullOrWhiteSpace($outputOption)) { exit 7 }
        if ($RemainingArgs[-1] -ne $env:FAKE_EXPECTED_REVISION) { exit 6 }
        $archivePath = $outputOption.Substring('--output='.Length)
        $archiveSource = Join-Path $PSScriptRoot 'archive-source'
        Compress-Archive -Path (Join-Path $archiveSource '*') -DestinationPath $archivePath -Force
        exit 0
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

$env:FAKE_GIT_MODE = 'valid'
$env:FAKE_EXPECTED_REVISION = $revision
$snapshotRoot = New-ImmutableBuildSnapshot -RepositoryRoot $repoRoot -Revision $revision -GitExecutable $gitExe
if (-not (Test-Path -LiteralPath (Join-Path $snapshotRoot 'infrastructure/docker-compose.yml') -PathType Leaf)) {
    throw 'New-ImmutableBuildSnapshot should materialize the archived source tree'
}
Remove-ImmutableBuildSnapshot -RepositoryRoot $repoRoot -SnapshotRoot $snapshotRoot
if (Test-Path -LiteralPath $snapshotRoot) {
    throw 'Remove-ImmutableBuildSnapshot should remove only its generated snapshot'
}
Expect-Throws -Action { Remove-ImmutableBuildSnapshot -RepositoryRoot $repoRoot -SnapshotRoot $repoRoot } -FailureMessage 'Remove-ImmutableBuildSnapshot should reject an arbitrary repository path'

$env:FAKE_GIT_MODE = 'switched'
Expect-Throws -Action { Assert-SourceRevisionMatches -RepositoryRoot $repoRoot -ExpectedRevision $revision -GitExecutable $gitExe } -FailureMessage 'Assert-SourceRevisionMatches should fail when clean HEAD changes'

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

test("local MVP launcher restores BUILD_VCS_REF when snapshot cleanup fails", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "healthcare-launcher-cleanup-"));
  try {
    const launcherRoot = path.join(tempRoot, "repo");
    const scriptsRoot = path.join(launcherRoot, "scripts");
    const helperBin = path.join(tempRoot, "bin");
    const archiveSource = path.join(helperBin, "archive-source");
    const helperPath = path.join(scriptsRoot, "local-mvp-provenance.ps1");
    const launcherPath = path.join(scriptsRoot, "start-and-verify-local-mvp.ps1");
    const verifierPath = path.join(scriptsRoot, "verify-local-mvp.ps1");
    const fakeGit = path.join(helperBin, "git.ps1");
    const fakeDocker = path.join(helperBin, "docker.ps1");
    const runner = path.join(tempRoot, "runner.ps1");
    const [helperSource, launcherSource] = await Promise.all([
      readFile(path.join(repoRoot, "scripts", "local-mvp-provenance.ps1"), "utf8"),
      readFile(path.join(repoRoot, "scripts", "start-and-verify-local-mvp.ps1"), "utf8"),
    ]);

    await mkdir(scriptsRoot, { recursive: true });
    await mkdir(path.join(archiveSource, "infrastructure"), { recursive: true });
    await writeFile(path.join(archiveSource, "infrastructure", "docker-compose.yml"), "services: {}\n", "utf8");
    await writeFile(path.join(launcherRoot, ".env"), "RAG_INGEST_ENABLED=true\nRAG_INGEST_TOKEN=unit-test-token\n", "utf8");

    await writeFile(
      fakeGit,
      `
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$RemainingArgs)

if ($RemainingArgs.Count -lt 3 -or $RemainingArgs[0] -ne '-C') { exit 9 }

switch ($RemainingArgs[2]) {
    'rev-parse' { '0123456789abcdef0123456789abcdef01234567'; exit 0 }
    'status' { exit 0 }
    'archive' {
        $outputOption = $RemainingArgs | Where-Object { $_ -like '--output=*' } | Select-Object -First 1
        if ([string]::IsNullOrWhiteSpace($outputOption)) { exit 7 }
        $archivePath = $outputOption.Substring('--output='.Length)
        Compress-Archive -Path (Join-Path $PSScriptRoot 'archive-source/*') -DestinationPath $archivePath -Force
        exit 0
    }
    default { exit 8 }
}
`.trimStart(),
      "utf8",
    );

    await writeFile(
      fakeDocker,
      `
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$RemainingArgs)

switch ($RemainingArgs[0]) {
    'desktop' { 'running'; exit 0 }
    'compose' {
        if ($RemainingArgs -contains 'ps' -and $RemainingArgs -contains 'local-seed') {
            'fake-local-seed-container'; exit 0
        }
        exit 0
    }
    'wait' { '0'; exit 0 }
    default { exit 0 }
}
`.trimStart(),
      "utf8",
    );

    const escapedGit = fakeGit.replace(/'/g, "''");
    const escapedDocker = fakeDocker.replace(/'/g, "''");
    await writeFile(
      helperPath,
      `${helperSource}\nfunction Resolve-ExecutablePath {\n    param([string]$CommandName, [string]$ConfiguredPath)\n    if ($CommandName -eq 'git') { return '${escapedGit}' }\n    if ($CommandName -eq 'docker') { return '${escapedDocker}' }\n    throw \"Unexpected executable: $CommandName\"\n}\nfunction Remove-ImmutableBuildSnapshot {\n    param([string]$RepositoryRoot, [string]$SnapshotRoot)\n    throw 'simulated snapshot cleanup failure'\n}\n`,
      "utf8",
    );
    await writeFile(launcherPath, launcherSource, "utf8");
    await writeFile(verifierPath, "param([string]$DockerPath, [string]$ExpectedRevision)\nexit 0\n", "utf8");

    await writeFile(
      runner,
      `
$ErrorActionPreference = 'Stop'
$env:BUILD_VCS_REF = 'caller-value'
$launcher = '${launcherPath.replace(/'/g, "''")}'
$envFile = '${path.join(launcherRoot, ".env").replace(/'/g, "''")}'
$docker = '${escapedDocker}'
$caught = $false
try {
    & $launcher -EnvFile $envFile -DockerPath $docker
} catch {
    $caught = $true
}

if (-not $caught) { throw 'The simulated cleanup failure should reach the caller' }
if ($env:BUILD_VCS_REF -ne 'caller-value') {
    throw "BUILD_VCS_REF was not restored after cleanup failure: $env:BUILD_VCS_REF"
}
`.trimStart(),
      "utf8",
    );

    const result = runPowerShell(runner);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`.trim());
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
