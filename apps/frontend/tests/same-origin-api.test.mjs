import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("public browser API clients use the same-origin proxy by default", async () => {
  const [client, booking, tracking, cms] = await Promise.all([
    read("lib/api-client.ts"),
    read("lib/api.ts"),
    read("app/tra-cuu/page.tsx"),
    read("lib/cms-client.ts"),
  ]);

  for (const source of [client, booking, tracking]) {
    assert.match(source, /process\.env\.NEXT_PUBLIC_API_BASE_URL \|\| "\/api\/v1"/);
  }
  assert.match(cms, /process\.env\.NEXT_PUBLIC_API_BASE_URL \|\|\s+"\/api\/v1"/);
});

test("Compose routes same-origin frontend traffic through the backend service", async () => {
  const [compose, dockerfile, dockerignore, nextConfig] = await Promise.all([
    read("../../infrastructure/docker-compose.yml"),
    read("Dockerfile"),
    read(".dockerignore"),
    read("next.config.ts"),
  ]);

  assert.match(compose, /args:\s+BACKEND_INTERNAL_URL:\s+http:\/\/backend:8080/);
  assert.match(compose, /BACKEND_INTERNAL_URL:\s+http:\/\/backend:8080/);
  assert.doesNotMatch(compose, /NEXT_PUBLIC_API_BASE_URL:\s+http:\/\/localhost:8080/);
  assert.match(dockerfile, /ARG BACKEND_INTERNAL_URL=http:\/\/backend:8080/);
  assert.match(dockerfile, /ENV BACKEND_INTERNAL_URL=\$\{BACKEND_INTERNAL_URL\}/);
  assert.match(dockerignore, /^node_modules$/m);
  assert.match(dockerignore, /^\.next$/m);
  assert.match(nextConfig, /source:\s*"\/api\/v1\/:path\*"/);
  assert.match(nextConfig, /destination:\s*`\$\{backendOrigin\}\/api\/v1\/:path\*`/);
});

test("local MVP helper binds rebuilt application images to the Git source revision", async () => {
  const [compose, backendDockerfile, frontendDockerfile, aiDockerfile, helper, verifier] = await Promise.all([
    read("../../infrastructure/docker-compose.yml"),
    read("../../apps/backend/Dockerfile"),
    read("Dockerfile"),
    read("../../apps/ai-service/Dockerfile"),
    read("../../scripts/start-and-verify-local-mvp.ps1"),
    read("../../scripts/verify-local-mvp.ps1"),
  ]);

  assert.equal((compose.match(/VCS_REF:\s+\$\{BUILD_VCS_REF:-unknown\}/g) || []).length, 3);
  for (const dockerfile of [backendDockerfile, frontendDockerfile, aiDockerfile]) {
    assert.match(dockerfile, /ARG VCS_REF=unknown/);
    assert.match(dockerfile, /org\.opencontainers\.image\.revision=\$\{VCS_REF\}/);
  }
  assert.match(helper, /function Get-SourceRevision/);
  assert.match(helper, /\$env:BUILD_VCS_REF = \$buildRevision/);
  assert.match(helper, /\$verifierParameters\.ExpectedRevision = \$buildRevision/);
  assert.match(verifier, /function Assert-ContainerRevision/);
  assert.match(verifier, /healthcare-backend", "healthcare-frontend", "healthcare-ai-service/);
});
