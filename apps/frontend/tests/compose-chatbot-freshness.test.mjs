import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../../../${relativePath}`, import.meta.url), "utf8");

test("Compose chatbot freshness smoke probes the stale-image failure boundary", async () => {
  const script = await read("scripts/verify-compose-chatbot-freshness.ps1");

  assert.match(script, /local-mvp-provenance\.ps1/);
  assert.match(script, /Get-SourceRevision -RepositoryRoot \$repoRoot/);
  assert.match(script, /status --porcelain --untracked-files=all/);
  assert.match(script, /\[switch\]\$StrictRevision/);
  assert.match(script, /foreach \(\$service in @\("backend", "frontend", "ai-service", "attachment-scanner"\)\)/);
  assert.match(script, /org\.opencontainers\.image\.revision/);
  assert.match(script, /public_support_chat/);
  assert.match(script, /ChatRequest\.model_fields/);
  assert.match(script, /X-AI-Service-Token/);
  assert.match(script, /http:\/\/ai-service:8000\/chat/);
  assert.match(script, /\/api\/v1\/public\/ai\/chat/);
  assert.match(script, /Origin = \$PublicOrigin/);
  assert.match(script, /HOSPITAL_SUPPORT/);
  assert.match(script, /safety_action/);
  assert.match(script, /provenance/);
  assert.match(script, /\$checkStatuses = @\(\$checks \| ForEach-Object \{ \$_.status \}\)/);
  assert.match(script, /elseif \(\$checkStatuses -contains "WARN"\)\s*\{\s*"DEGRADED"\s*\}/s);
  assert.match(script, /status = \$overallStatus/);
  assert.doesNotMatch(script, /Write-(?:Host|Output).*AI_SERVICE_TOKEN/);
});
