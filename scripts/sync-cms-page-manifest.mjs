import { readFile, writeFile } from "node:fs/promises";
import { CMS_PAGE_MANIFESTS } from "../apps/frontend/lib/cms-page-manifest.ts";

// The native-page declarations are canonical. The reviewed backend resource
// is derived so both validators enforce exactly the same stable field IDs.
const target = new URL("../apps/backend/src/main/resources/cms-page-manifest.json", import.meta.url);
const expected = `${JSON.stringify({ schemaVersion: 1, pages: CMS_PAGE_MANIFESTS }, null, 2)}\n`;
if (process.argv.slice(2).some((argument) => argument !== "--check")) {
  throw new Error("Usage: node scripts/sync-cms-page-manifest.mjs [--check]");
}
if (process.argv.includes("--check")) {
  const actual = await readFile(target, "utf8");
  if (actual !== expected) throw new Error("CMS page manifest differs from the canonical native declarations. Regenerate it.");
  process.stdout.write(`CMS manifest parity PASS (${CMS_PAGE_MANIFESTS.length} canonical pages).\n`);
} else {
  await writeFile(target, expected, "utf8");
  process.stdout.write(`CMS manifest synchronized (${CMS_PAGE_MANIFESTS.length} canonical pages).\n`);
}
