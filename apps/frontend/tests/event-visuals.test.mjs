import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");

test("HOSPITAL_EVENTS_CATALOG has 70 complete and valid event visuals", async () => {
  // Read event-visuals source file directly to test catalog without ts transpiler
  const filePath = path.join(ROOT, "lib", "event-visuals.ts");
  assert.ok(fs.existsSync(filePath), "lib/event-visuals.ts must exist");
  const content = fs.readFileSync(filePath, "utf-8");

  // Extract all imageSrc paths
  const matches = [...content.matchAll(/imageSrc:\s*"([^"]+)"/g)].map((m) => m[1]);
  assert.equal(matches.length, 70, "Must have exactly 70 event images defined");

  // Verify unique image sources
  const uniqueSrcs = new Set(matches);
  assert.equal(uniqueSrcs.size, 70, "All 70 imageSrc paths must be distinct");

  // Extract all IDs
  const idMatches = [...content.matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1]);
  assert.equal(idMatches.length, 70, "Must have exactly 70 event IDs defined");
  const uniqueIds = new Set(idMatches);
  assert.equal(uniqueIds.size, 70, "All 70 event IDs must be unique");

  // Verify that every single image file exists on disk and is high resolution (>50KB)
  for (const src of matches) {
    const fullPath = path.join(PUBLIC_DIR, src.replace(/^\//, ""));
    assert.ok(fs.existsSync(fullPath), `Image file must exist: ${src}`);
    const stats = fs.statSync(fullPath);
    assert.ok(stats.size > 50000, `Image file must be substantial (>50KB): ${src} (was ${stats.size} bytes)`);
  }
});

test("Event categories cover all required hospital activity themes", async () => {
  const filePath = path.join(ROOT, "lib", "event-visuals.ts");
  const content = fs.readFileSync(filePath, "utf-8");

  const requiredCategories = [
    "conference",
    "charity",
    "blood_donation",
    "anniversary",
    "public_health",
    "internal_life",
  ];

  for (const category of requiredCategories) {
    assert.ok(
      content.includes(`category: "${category}"`),
      `Catalog must include category: ${category}`
    );
  }
});
