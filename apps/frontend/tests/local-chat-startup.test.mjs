import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const helperPath = process.env.LOCAL_AI_START_HELPER ?? path.join(repoRoot, "scripts/start-ai-local.ps1");
const quote = (value) => `'${value.replaceAll("'", "''")}'`;
const shell = ["pwsh", "powershell"].find((candidate) => spawnSync(candidate, ["-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"], { encoding: "utf8" }).status === 0);

async function launchFixture({ processEnv = {}, envLines = [], exitCode = 0 } = {}) {
  assert.ok(shell, "PowerShell must be available for the real launcher regression");
  const fixture = await mkdtemp(path.join(os.tmpdir(), "healthcare chat học ' & "));
  try {
    await mkdir(path.join(fixture, "scripts"));
    await mkdir(path.join(fixture, "apps/ai-service"), { recursive: true });
    const helper = path.join(fixture, "scripts/start-ai-local.ps1");
    await writeFile(helper, await readFile(helperPath));
    await writeFile(path.join(fixture, ".env"), [
      "AI_PROVIDER=local", "AI_CHAT_MODEL=", "EMBEDDING_PROVIDER=local", "RAG_STORAGE_BACKEND=memory",
      "AI_SERVICE_RUNTIME=local", "AI_SERVICE_TOKEN='fixture-service-token'",
      "DEEPSEEK_API_KEY=", "AI_API_KEY=", "AI_PUBLIC_HOSPITAL_SUPPORT_REMOTE_ENABLED=false",
      "AI_PATIENT_CHAT_REMOTE_ENABLED=false", "AI_CHAT_REMOTE_PROVIDER_ENABLED=false",
      "REMOTE_AI_RELEASE_HOLD=true", "REMOTE_AI_KILL_SWITCH=true", ...envLines,
    ].join("\n"));
    const runner = path.join(fixture, "runner.ps1");
    await writeFile(runner, `
$ErrorActionPreference = 'Stop'
function global:Test-Path {
  param([string]$Path, [string]$LiteralPath, [string]$PathType = 'Any')
  $probePath = if ($LiteralPath) { $LiteralPath } else { $Path }
  if ($probePath.Replace([char]92, [char]47).EndsWith('.venv/Scripts/python.exe')) { return $false }
  Microsoft.PowerShell.Management\\Test-Path -LiteralPath $probePath -PathType $PathType
}
function global:python {
  $capture = [ordered]@{
    Provider=$env:AI_PROVIDER; Model=$env:AI_CHAT_MODEL;
    PublicRemote=$env:AI_PUBLIC_HOSPITAL_SUPPORT_REMOTE_ENABLED;
    PatientRemote=$env:AI_PATIENT_CHAT_REMOTE_ENABLED;
    ReleaseHold=$env:REMOTE_AI_RELEASE_HOLD; KillSwitch=$env:REMOTE_AI_KILL_SWITCH;
    AuthMatchesFixture=($env:AI_SERVICE_TOKEN -ceq 'fixture-service-token');
    Cwd=(Get-Location).Path; Arguments=@($args | ForEach-Object { [string]$_ })
  }
  Write-Output ('LAUNCH_CAPTURE:' + ($capture | ConvertTo-Json -Depth 3 -Compress))
  $global:LASTEXITCODE = ${exitCode}
}
if (Test-Path ('.venv' + [char]92 + 'Scripts' + [char]92 + 'python.exe')) { throw 'Fixture must intercept the native Python path before executing the launcher' }
& ${quote(helper)}
exit $LASTEXITCODE
`);
    const env = { ...process.env };
    for (const name of ["AI_PROVIDER", "AI_CHAT_MODEL", "AI_API_KEY", "DEEPSEEK_API_KEY", "AI_SERVICE_TOKEN", "AI_SERVICE_RUNTIME", "EMBEDDING_PROVIDER", "RAG_STORAGE_BACKEND", "AI_PUBLIC_HOSPITAL_SUPPORT_REMOTE_ENABLED", "AI_PATIENT_CHAT_REMOTE_ENABLED", "AI_CHAT_REMOTE_PROVIDER_ENABLED", "REMOTE_AI_RELEASE_HOLD", "REMOTE_AI_KILL_SWITCH"]) delete env[name];
    const result = spawnSync(shell, ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", runner], { encoding: "utf8", cwd: fixture, env: { ...env, ...processEnv }, timeout: 15_000 });
    const captureLine = result.stdout?.split(/\r?\n/).find((line) => line.startsWith("LAUNCH_CAPTURE:"));
    return { ...result, capture: captureLine ? JSON.parse(captureLine.slice("LAUNCH_CAPTURE:".length)) : null, expectedCwd: path.join(fixture, "apps/ai-service") };
  } finally {
    // This directory was created by this test; no repository or developer data is removed.
    await rm(fixture, { recursive: true, force: true });
  }
}

test("local chat launcher honors process selection and explicit closed remote gates", async () => {
  const result = await launchFixture({ processEnv: { AI_PROVIDER: "local", AI_PUBLIC_HOSPITAL_SUPPORT_REMOTE_ENABLED: "false" } });
  assert.equal(result.status, 0, "offline local startup must not require a DeepSeek key");
  assert.ok(result.capture, "the selected Python command starts");
  assert.equal(result.capture.Provider, "local");
  assert.equal(result.capture.PublicRemote, "false");
  assert.equal(result.capture.PatientRemote, "false");
  assert.equal(result.capture.ReleaseHold, "true");
  assert.equal(result.capture.KillSwitch, "true");
});

test("local launcher resolves its own quoted Unicode repository and authenticated local defaults", async () => {
  const result = await launchFixture();
  assert.equal(result.status, 0);
  assert.ok(result.capture);
  assert.equal(path.resolve(result.capture.Cwd), path.resolve(result.expectedCwd));
  assert.equal(result.capture.AuthMatchesFixture, true, "dotenv quotes are removed without printing tokens");
  assert.equal(result.capture.Model, "local-deterministic");
  assert.deepEqual(result.capture.Arguments, ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000", "--no-access-log"]);
  assert.doesNotMatch(result.stdout, /fixture-service-token/);
});

test("remote selection with explicitly empty credentials fails before Python and keeps the key private", async () => {
  const result = await launchFixture({ processEnv: { AI_PROVIDER: "deepseek" } });
  assert.notEqual(result.status, 0, "selected remote provider without a key must fail clearly");
  assert.equal(result.capture, null, "no provider process starts on invalid configuration");
  assert.match(result.stderr, /DEEPSEEK_API_KEY|AI_API_KEY/);
  assert.doesNotMatch(result.stdout + result.stderr, /fixture-service-token/);
});

test("launcher propagates the Python failure status", async () => {
  const result = await launchFixture({ processEnv: { AI_PROVIDER: "local" }, exitCode: 23 });
  assert.equal(result.status, 23);
});

test("backend launcher resolves process trust credentials and the selected portable dotenv", async () => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), "healthcare backend học ' & "));
  try {
    const envFile = path.join(fixture, ".env");
    await writeFile(envFile, "JWT_SECRET='fixture-file-jwt'\n");
    const runner = path.join(fixture, "resolver.ps1");
    const backendHelper = process.env.LOCAL_BE_START_HELPER ?? path.join(repoRoot, "scripts/start-be-local.ps1");
    // Execute the actual credential resolver only. Maven never starts in this fixture.
    await writeFile(runner, `
$ErrorActionPreference = 'Stop'
$EnvFile = ${quote(envFile)}
$parseErrors = $null; $parseTokens = $null
$tree = [System.Management.Automation.Language.Parser]::ParseFile(${quote(backendHelper)}, [ref]$parseTokens, [ref]$parseErrors)
if ($parseErrors.Count) { throw 'Backend launcher has parser errors' }
$resolver = $tree.Find({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Resolve-LocalSecret' }, $true)
if (-not $resolver) { throw 'Backend launcher credential resolver is missing' }
Invoke-Expression $resolver.Extent.Text
$env:JWT_SECRET = 'fixture-process-jwt'
$processMatches = (Resolve-LocalSecret 'JWT_SECRET') -ceq 'fixture-process-jwt'
Remove-Item Env:JWT_SECRET
$fileMatches = (Resolve-LocalSecret 'JWT_SECRET') -ceq 'fixture-file-jwt'
@{ ProcessMatches=$processMatches; FileMatches=$fileMatches } | ConvertTo-Json -Compress
`);
    const result = spawnSync(shell, ["-NoProfile", "-NonInteractive", "-File", runner], { encoding: "utf8", cwd: fixture, timeout: 10_000 });
    assert.equal(result.status, 0, "credential resolution runs without launching a backend");
    assert.deepEqual(JSON.parse(result.stdout.trim()), { ProcessMatches: true, FileMatches: true });
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
