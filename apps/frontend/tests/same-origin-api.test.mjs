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

test("route-param API clients encode slug path segments before hitting backend routes", async () => {
  const client = await read("lib/api-client.ts");

  for (const route of ["doctors", "specialties", "branches", "packages", "articles", "services"]) {
    assert.match(
      client,
      new RegExp(`/hospital/${route}/\\$\\{encodeURIComponent\\(slug\\)\\}`),
      `public ${route} detail API must encode the slug path segment`,
    );
  }

  for (const route of ["doctors", "specialties", "branches", "services", "packages", "articles"]) {
    assert.match(
      client,
      new RegExp(`/admin/${route}/\\$\\{encodeURIComponent\\(slug\\)\\}`),
      `admin ${route} mutation API must encode the slug path segment`,
    );
  }

  assert.doesNotMatch(client, /\/hospital\/(?:doctors|specialties|branches|packages|articles|services)\/\$\{slug\}/);
  assert.doesNotMatch(client, /\/admin\/(?:doctors|specialties|branches|services|packages|articles)\/\$\{slug\}/);
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
  assert.match(compose, /AI_SERVICE_URL:\s+http:\/\/ai-service:8000/);
  assert.doesNotMatch(compose, /container_name:/);
  assert.doesNotMatch(compose, /healthcare-ai-service:8000/);
  assert.doesNotMatch(compose, /NEXT_PUBLIC_API_BASE_URL:\s+http:\/\/localhost:8080/);
  assert.match(compose, /\$\{BACKEND_HOST_PORT:-8080\}:8080/);
  assert.match(compose, /\$\{FRONTEND_HOST_PORT:-3000\}:3000/);
  assert.match(compose, /127\.0\.0\.1:\$\{AI_SERVICE_HOST_PORT:-8000\}:8000/);
  assert.match(dockerfile, /ARG BACKEND_INTERNAL_URL=http:\/\/backend:8080/);
  assert.match(dockerfile, /ENV BACKEND_INTERNAL_URL=\$\{BACKEND_INTERNAL_URL\}/);
  assert.match(dockerignore, /^node_modules$/m);
  assert.match(dockerignore, /^\.next$/m);
  assert.match(nextConfig, /source:\s*"\/api\/v1\/:path\*"/);
  assert.match(nextConfig, /destination:\s*`\$\{backendOrigin\}\/api\/v1\/:path\*`/);
});

test("local MVP helper binds rebuilt application images to an immutable Git source revision", async () => {
  const [compose, backendDockerfile, frontendDockerfile, aiDockerfile, backendDockerignore, aiDockerignore, helper, verifier, provenance, runtimeWorkflow] = await Promise.all([
    read("../../infrastructure/docker-compose.yml"),
    read("../../apps/backend/Dockerfile"),
    read("Dockerfile"),
    read("../../apps/ai-service/Dockerfile"),
    read("../../apps/backend/.dockerignore"),
    read("../../apps/ai-service/.dockerignore"),
    read("../../scripts/start-and-verify-local-mvp.ps1"),
    read("../../scripts/verify-local-mvp.ps1"),
    read("../../scripts/local-mvp-provenance.ps1"),
    read("../../.github/workflows/runtime-compose.yml"),
  ]);

  assert.equal((compose.match(/VCS_REF:\s+\$\{BUILD_VCS_REF:-unknown\}/g) || []).length, 3);
  for (const dockerfile of [backendDockerfile, frontendDockerfile, aiDockerfile]) {
    assert.match(dockerfile, /ARG VCS_REF=unknown/);
    assert.match(dockerfile, /org\.opencontainers\.image\.revision=\$\{VCS_REF\}/);
  }
  assert.match(provenance, /function Assert-ExpectedRevision/);
  assert.match(provenance, /function Assert-CleanBuildContext/);
  assert.match(provenance, /function Get-SourceRevision/);
  assert.match(provenance, /function Assert-ContainerRevision/);
  assert.match(provenance, /function New-ImmutableBuildSnapshot/);
  assert.match(provenance, /function Remove-ImmutableBuildSnapshot/);
  assert.match(provenance, /function Assert-SourceRevisionMatches/);
  assert.match(provenance, /throw "Build context must be clean before building the image/);
  assert.match(helper, /Assert-CleanBuildContext -RepositoryRoot \$repositoryRoot/);
  assert.match(helper, /Assert-ExpectedRevision -Revision \$buildRevision/);
  assert.match(helper, /New-ImmutableBuildSnapshot -RepositoryRoot \$repositoryRoot -Revision \$buildRevision/);
  assert.match(helper, /Assert-SourceRevisionMatches -RepositoryRoot \$repositoryRoot -ExpectedRevision \$buildRevision/);
  assert.match(helper, /\$env:BUILD_VCS_REF = \$buildRevision/);
  assert.match(helper, /function Test-IsWindowsHost/);
  assert.match(helper, /\$DockerPath info --format/);
  assert.match(helper, /compose --env-file \$EnvFile -f \$composeFile ps --all -q local-seed/);
  assert.doesNotMatch(helper, /wait healthcare-local-seed/);
  assert.match(helper, /\}\s*finally\s*\{\s*try\s*\{[\s\S]*?Remove-ImmutableBuildSnapshot[\s\S]*?\}\s*finally\s*\{\s*if \(\$hadBuildRevision\)/);
  assert.match(helper, /\$verifierParameters = @\{ DockerPath = \$DockerPath; ExpectedRevision = \$buildRevision; ComposeFile = \$composeFile; EnvFile = \$EnvFile \}/);
  assert.match(verifier, /Assert-ExpectedRevision -Revision \$ExpectedRevision/);
  assert.match(verifier, /function Get-ComposeServiceContainerId/);
  assert.match(verifier, /Assert-ContainerRevision -ContainerName \$container -Revision \$ExpectedRevision -DockerExecutable \$DockerPath/);
  assert.match(verifier, /foreach \(\$service in @\("backend", "frontend", "ai-service"\)\)/);
  assert.doesNotMatch(verifier, /healthcare-backend", "healthcare-frontend", "healthcare-ai-service/);
  assert.match(runtimeWorkflow, /name: Runtime Compose MVP/);
  assert.match(runtimeWorkflow, /workflow_dispatch/);
  assert.match(runtimeWorkflow, /Start and verify full local MVP stack/);
  assert.match(runtimeWorkflow, /HEALTHCARE_RUNTIME_ENV: \$\{\{ runner\.temp \}\}\/healthcare-runtime\.env/);
  assert.match(runtimeWorkflow, /COMPOSE_PROJECT_NAME: healthcare-runtime-ci-\$\{\{ github\.run_id \}\}/);
  assert.match(runtimeWorkflow, /"down", "--remove-orphans"/);
  for (const dockerignore of [backendDockerignore, aiDockerignore]) {
    assert.match(dockerignore, /^\.git$/m);
    assert.match(dockerignore, /^\.env$/m);
    assert.match(dockerignore, /^\*\.key$/m);
    assert.match(dockerignore, /^\*\.pem$/m);
    assert.match(dockerignore, /^\*\*\/\*\.key$/m);
    assert.match(dockerignore, /^\*\*\/\*\.pem$/m);
  }
});

test("database package includes the CMS slot-component migration", async () => {
  const [databaseInit, migration] = await Promise.all([
    read("../../infrastructure/database/init/01-healthcare-database.sh"),
    read("../../apps/backend/src/main/resources/db/migration/V24__cms_slot_component_contract.sql"),
  ]);

  assert.match(databaseInit, /V24__cms_slot_component_contract\.sql/);
  assert.match(migration, /ck_cms_contents_slot_component_type/);
  assert.match(migration, /split_part\(slot_key, '\.', 2\) = 'hero' AND component_type = 'HERO'/);
});

test("database publish workflow binds packages to a verified exact source SHA", async () => {
  const [workflow, dockerfile] = await Promise.all([
    read("../../.github/workflows/publish-database.yml"),
    read("../../infrastructure/database/Dockerfile"),
  ]);

  assert.match(workflow, /actions: read/);
  assert.match(workflow, /artifact-metadata: write/);
  assert.match(workflow, /source_ref:[\s\S]*required: true/);
  assert.match(workflow, /git rev-parse HEAD/);
  assert.match(workflow, /git show -s --format=%cI "\$source_sha"/);
  assert.match(workflow, /\^\[0-9a-f\]\{40\}\$/);
  assert.match(workflow, /Checked out SHA \$source_sha does not match requested source_ref/);
  assert.match(workflow, /sha-\$\{source_sha\}/);
  assert.match(workflow, /manual_image_tag_normalized="\$\{MANUAL_IMAGE_TAG,,\}"/);
  assert.match(workflow, /SHA-like image_tag aliases must match the checked-out source SHA/);
  assert.match(workflow, /SHA image_tag aliases must use canonical lowercase sha-<source_sha>/);
  assert.match(workflow, /gh run list --workflow ci\.yml --commit "\$SOURCE_SHA"/);
  assert.match(workflow, /No successful ci\.yml run found for exact SHA \$SOURCE_SHA/);
  assert.match(workflow, /docker build[\s\S]*--file infrastructure\/database\/Dockerfile/);
  assert.match(workflow, /Initialize and verify database image/);
  assert.match(workflow, /ck_cms_contents_slot_component_type/);
  assert.match(workflow, /Invalid hero\/RICH_TEXT CMS row was accepted/);
  assert.match(workflow, /VERBOSITY=verbose/);
  assert.match(workflow, /grep -Eq '23514\|check_violation'/);
  assert.match(workflow, /Invalid hero\/RICH_TEXT CMS row failed for an unexpected reason/);
  assert.match(workflow, /anchore\/sbom-action@v0\.24\.0/);
  assert.match(workflow, /format: spdx-json/);
  assert.match(workflow, /docker push "\$tag"/);
  assert.match(workflow, /echo "digest=\$digest" >> "\$GITHUB_OUTPUT"/);
  assert.match(workflow, /subject-digest: \$\{\{ steps\.push\.outputs\.digest \}\}/);
  assert.match(workflow, /actions\/attest-build-provenance@v4/);
  assert.match(workflow, /actions\/attest@v4/);
  assert.match(workflow, /push-to-registry: true/);
  assert.doesNotMatch(workflow, /type=sha/);
  assert.doesNotMatch(workflow, /docker\/metadata-action/);
  assert.doesNotMatch(workflow, /docker\/build-push-action/);
  assert.doesNotMatch(workflow, /actions\/attest-sbom@v4/);
  assert.match(dockerfile, /^FROM postgres:16-alpine@sha256:[0-9a-f]{64}$/m);
  assert.doesNotMatch(dockerfile, /^FROM postgres:16-alpine$/m);
});

test("database publish workflow rejects SHA-looking manual aliases case-insensitively", () => {
  const sourceSha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const otherSha = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  const acceptsManualImageTag = (imageTag) => {
    const normalized = imageTag.toLowerCase();
    if (/^sha-[0-9a-f]{40}$/.test(normalized) && normalized !== `sha-${sourceSha}`) {
      return false;
    }
    if (/^sha-[0-9a-f]{40}$/.test(normalized) && imageTag !== `sha-${sourceSha}`) {
      return false;
    }
    return true;
  };

  assert.equal(acceptsManualImageTag(`sha-${sourceSha}`), true);
  assert.equal(acceptsManualImageTag(`sha-${otherSha}`), false);
  assert.equal(acceptsManualImageTag(`sha-${otherSha.toUpperCase()}`), false);
  assert.equal(acceptsManualImageTag(`SHA-${otherSha.toUpperCase()}`), false);
  assert.equal(acceptsManualImageTag(`sha-${sourceSha.toUpperCase()}`), false);
  assert.equal(acceptsManualImageTag("0.1.0-alpha.3"), true);
});
