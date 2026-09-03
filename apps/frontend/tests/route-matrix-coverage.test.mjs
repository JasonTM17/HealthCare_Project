import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const frontendRoot = fileURLToPath(new URL("../", import.meta.url));
const appRoot = path.join(frontendRoot, "app");
const matrixPath = path.join(frontendRoot, "tests", "e2e", "route-matrix.spec.ts");
const auditUuid = "00000000-0000-0000-0000-000000000001";

async function collectPageFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const pages = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) pages.push(...await collectPageFiles(absolute));
    if (entry.isFile() && entry.name === "page.tsx") pages.push(absolute);
  }
  return pages;
}

function routeForPage(pageFile) {
  const relative = path.relative(appRoot, path.dirname(pageFile));
  if (!relative) return "/";
  return `/${relative.split(path.sep).map((segment) => {
    if (segment === "[slug]") return "route-audit";
    if (segment === "[id]") return auditUuid;
    return segment;
  }).join("/")}`;
}

function declaredRoutes(source) {
  const routes = [];
  const arrayPattern = /const\s+(?:PUBLIC|PATIENT|DOCTOR|ADMIN)_ROUTES\s*=\s*\[([\s\S]*?)\]\s*as const;/gu;
  for (const match of source.matchAll(arrayPattern)) {
    for (const routeMatch of match[1].matchAll(/"(\/[^"?]*)(?:\?[^\s"]*)?"/gu)) {
      routes.push(routeMatch[1]);
    }
  }
  return routes;
}

test("browser route matrix covers every App Router page exactly once", async () => {
  const [pages, matrixSource] = await Promise.all([
    collectPageFiles(appRoot),
    readFile(matrixPath, "utf8"),
  ]);
  const actual = pages.map(routeForPage).sort();
  const declared = declaredRoutes(matrixSource).sort();

  assert.equal(new Set(declared).size, declared.length, "route matrix must not contain duplicate routes");
  assert.deepEqual(declared, actual);
  assert.equal(actual.length, 74, "route additions must update this explicit site inventory checkpoint");
});
