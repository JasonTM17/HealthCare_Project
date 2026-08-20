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
