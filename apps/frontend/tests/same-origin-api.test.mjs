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

  for (const source of [client, booking, tracking, cms]) {
    assert.match(source, /(?:const|let)\s+(?:API_BASE_URL|DEFAULT_BASE_URL)\s*=\s+"\/api\/v1"/);
    assert.doesNotMatch(source, /NEXT_PUBLIC_(?:CMS_)?API_BASE_URL/);
  }
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

test("Compose keeps browser traffic same-origin through the server-only BFF", async () => {
  const [compose, dockerfile, dockerignore, nextConfig, routeHandler, bff, render, envExample] = await Promise.all([
    read("../../infrastructure/docker-compose.yml"),
    read("Dockerfile"),
    read(".dockerignore"),
    read("next.config.ts"),
    read("app/api/v1/[...path]/route.ts"),
    read("lib/server/healthcare-bff.ts"),
    read("../../render.yaml"),
    read("../../.env.example"),
  ]);

  assert.match(compose, /BACKEND_INTERNAL_URL:\s+http:\/\/backend:8080/);
  assert.match(compose, /BACKEND_BFF_SERVICE_TOKEN:\s+\$\{BACKEND_BFF_SERVICE_TOKEN:\?BACKEND_BFF_SERVICE_TOKEN is required\}/);
  assert.match(compose, /BFF_PUBLIC_ORIGIN:\s+\$\{BFF_PUBLIC_ORIGIN:-http:\/\/localhost:3000\}/);
  assert.match(compose, /BACKEND_BFF_REQUIRED:\s+"true"/);
  assert.match(compose, /BFF_ALLOWED_ORIGINS:\s+\$\{BFF_ALLOWED_ORIGINS:-http:\/\/localhost:3000,http:\/\/127\.0\.0\.1:3000\}/);
  assert.match(compose, /AI_SERVICE_URL:\s+http:\/\/ai-service:8000/);
  assert.match(compose, /REDIS_URL:\s+redis:\/\/redis:6379/);
  assert.match(compose, /CORS_ALLOWED_ORIGINS:\s+\$\{CORS_ALLOWED_ORIGINS:-\}/);
  assert.doesNotMatch(compose, /container_name:/);
  assert.doesNotMatch(compose, /healthcare-ai-service:8000/);
  assert.doesNotMatch(compose, /NEXT_PUBLIC_API_BASE_URL:\s+http:\/\/localhost:8080/);
  assert.match(compose, /\$\{BACKEND_HOST_PORT:-8080\}:8080/);
  assert.match(compose, /\$\{FRONTEND_HOST_PORT:-3000\}:3000/);
  assert.match(compose, /127\.0\.0\.1:\$\{AI_SERVICE_HOST_PORT:-8000\}:8000/);
  assert.doesNotMatch(dockerfile, /ARG BACKEND_INTERNAL_URL/);
  assert.match(dockerfile, /ENV BACKEND_INTERNAL_URL=http:\/\/backend:8080/);
  assert.doesNotMatch(dockerfile, /BACKEND_BFF_SERVICE_TOKEN/);
  assert.match(dockerignore, /^node_modules$/m);
  assert.match(dockerignore, /^\.next$/m);
  assert.doesNotMatch(nextConfig, /async rewrites\(\)/);
  assert.match(routeHandler, /proxyHealthcareRequest\(request, path\)/);
  assert.match(routeHandler, /export const runtime = "nodejs"/);
  assert.match(bff, /process\.env\.BACKEND_INTERNAL_URL/);
  assert.match(bff, /process\.env\.BACKEND_BFF_SERVICE_TOKEN/);
  assert.match(bff, /process\.env\.BFF_PUBLIC_ORIGIN/);
  assert.match(bff, /BFF_CONFIGURATION_UNAVAILABLE/);
  assert.match(bff, /X-Healthcare-Bff-Token/);
  assert.match(bff, /X-Healthcare-Original-Origin/);
  assert.match(bff, /redirect: "manual"/);
  assert.doesNotMatch(routeHandler, /NEXT_PUBLIC_|BACKEND_INTERNAL_URL|BACKEND_BFF_SERVICE_TOKEN/);
  assert.doesNotMatch(nextConfig, /NEXT_PUBLIC_(?:CMS_)?API_BASE_URL/);
  assert.match(render, /- key: BACKEND_BFF_SERVICE_TOKEN\s+sync: false/);
  assert.match(render, /- key: BACKEND_BFF_REQUIRED\s+value: "true"/);
  assert.match(render, /- key: BFF_ALLOWED_ORIGINS\s+sync: false/);
  assert.doesNotMatch(render, /- key: CORS_ALLOWED_ORIGINS/);
  assert.doesNotMatch(envExample, /NEXT_PUBLIC_(?:CMS_)?API_BASE_URL/);
  assert.match(envExample, /^BACKEND_BFF_SERVICE_TOKEN=$/m);
  assert.match(envExample, /^BACKEND_BFF_REQUIRED=true$/m);
  assert.match(envExample, /^BFF_PUBLIC_ORIGIN=http:\/\/localhost:3000$/m);
  assert.match(envExample, /^BFF_ALLOWED_ORIGINS=http:\/\/localhost:3000,http:\/\/127\.0\.0\.1:3000$/m);
  assert.match(envExample, /^CORS_ALLOWED_ORIGINS=$/m);
});

test("local MVP helper binds rebuilt application images to an immutable Git source revision", async () => {
  const [compose, backendDockerfile, frontendDockerfile, aiDockerfile, scannerDockerfile, backendDockerignore, aiDockerignore, helper, verifier, provenance, runtimeWorkflow] = await Promise.all([
    read("../../infrastructure/docker-compose.yml"),
    read("../../apps/backend/Dockerfile"),
    read("Dockerfile"),
    read("../../apps/ai-service/Dockerfile"),
    read("../../infrastructure/av-scanner/Dockerfile"),
    read("../../apps/backend/.dockerignore"),
    read("../../apps/ai-service/.dockerignore"),
    read("../../scripts/start-and-verify-local-mvp.ps1"),
    read("../../scripts/verify-local-mvp.ps1"),
    read("../../scripts/local-mvp-provenance.ps1"),
    read("../../.github/workflows/runtime-compose.yml"),
  ]);

  assert.equal((compose.match(/VCS_REF:\s+\$\{BUILD_VCS_REF:-unknown\}/g) || []).length, 4);
  for (const dockerfile of [backendDockerfile, frontendDockerfile, aiDockerfile, scannerDockerfile]) {
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

test("application publish workflow emits canonical digest-bound GHCR packages", async () => {
  const workflow = await read("../../.github/workflows/publish-images.yml");

  assert.match(workflow, /workflow_dispatch/);
  assert.match(workflow, /push:[\s\S]*branches: \["release\/\*\*"\]/);
  assert.match(workflow, /source_ref:[\s\S]*required: true/);
  assert.match(workflow, /source_ref must be a lowercase 40-character commit SHA/);
  assert.match(workflow, /Checked out SHA \$source_sha does not match requested source_ref/);
  assert.match(workflow, /gh run list --workflow ci\.yml --commit \"\$source_sha\"/);
  assert.match(workflow, /No successful ci\.yml run found for exact SHA \$source_sha/);
  for (const image of [
    "healthcare-project-backend",
    "healthcare-project-frontend",
    "healthcare-project-ai-service",
    "healthcare-project-attachment-scanner",
  ]) {
    assert.match(workflow, new RegExp(image));
  }
  assert.match(workflow, /docker\/build-push-action@v6/);
  assert.match(workflow, /docker\/setup-buildx-action@v3/);
  assert.match(workflow, /sbom: true/);
  assert.match(workflow, /provenance: mode=max/);
  assert.match(workflow, /VCS_REF=\$\{\{ needs\.resolve\.outputs\.source_sha \}\}/);
  assert.match(workflow, /image_owner=\$\{GITHUB_REPOSITORY_OWNER,,\}/);
  assert.match(workflow, /ghcr\.io\/\$\{\{ needs\.resolve\.outputs\.image_owner \}\}/);
  assert.match(workflow, /packages: write/);
  assert.match(workflow, /attestations: write/);
  assert.doesNotMatch(workflow, /:[ ]*latest\b/);
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
