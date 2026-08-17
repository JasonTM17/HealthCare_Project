import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("CMS client documents the typed live/admin boundary and concurrency operations", async () => {
  const source = await read("lib/cms-client.ts");

  for (const marker of [
    "CMS_PAGE_STATES",
    "CMS_SLOT_KEYS",
    "CMS_COMPONENT_KEYS",
    "getPublishedPage",
    "getDraftPage",
    "saveDraft",
    "publishPage",
    "rollbackPage",
    "subscribeToChanges",
    "baseVersion",
    "errorKindForStatus",
  ]) {
    assert.ok(source.includes(marker), `missing CMS client marker: ${marker}`);
  }

  assert.match(source, /status === 401.*auth/s);
  assert.match(source, /status === 403.*forbidden/s);
  assert.match(source, /status === 409.*conflict/s);
  assert.match(source, /EventSource/);
});

test("CMS renderer is allowlisted and does not interpret raw HTML", async () => {
  const source = await read("components/cms/CmsRenderer.tsx");

  for (const componentKey of ["heading", "paragraph", "callout", "link", "image"]) {
    assert.ok(source.includes(`case "${componentKey}"`), `missing renderer: ${componentKey}`);
  }
  assert.doesNotMatch(source, /dangerouslySetInnerHTML/);
  assert.match(source, /isSafeCmsUrl/);
  assert.match(source, /data-cms-slot/);
});

test("public live slot has SSE and polling fallback without a reload path", async () => {
  const source = await read("components/cms/CmsLiveSlot.tsx");

  assert.match(source, /subscribeToChanges/);
  assert.match(source, /setInterval/);
  assert.match(source, /data-cms-live-source="live-backend"/);
  assert.doesNotMatch(source, /window\.location\.reload/);
});

test("admin editor exposes protected API, validation, conflict, and rollback states", async () => {
  const source = await read("components/cms/CmsEditor.tsx");

  for (const marker of ["401", "403", "409", "400/422", "Tải version mới nhất", "rollbackPage", "Không có nội dung demo"]) {
    assert.ok(source.includes(marker), `missing editor state: ${marker}`);
  }
});
