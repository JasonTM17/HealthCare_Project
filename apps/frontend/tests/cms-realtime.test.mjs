import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("CMS client matches the integrated slot-scoped typed contract", async () => {
  const source = await read("lib/cms-client.ts");

  for (const marker of [
    "CMS_COMPONENT_TYPES",
    "CmsContentInput",
    "getPublishedContent",
    "getAdminContent",
    "listAdminContent",
    "upsertContent",
    "listHistory",
    "rollbackContent",
    "parseCmsContentHistoryEntry",
    "expectedVersion",
    "/cms/content/",
    "/admin/cms/content/",
    "/cms/content/events",
    "cms-content-changed",
    "parseReadyEvent",
    "parseResyncEvent",
  ]) {
    assert.ok(source.includes(marker), `missing CMS contract marker: ${marker}`);
  }

  assert.match(source, /status === 401.*auth/s);
  assert.match(source, /status === 403.*forbidden/s);
  assert.match(source, /status === 409.*conflict/s);
  assert.match(source, /expectedVersion: input\.expectedVersion/);
  assert.match(source, /homepage\.\$\{slotKey\}/);
});

test("CMS renderer is allowlisted and never interprets raw HTML", async () => {
  const source = await read("components/cms/CmsRenderer.tsx");

  for (const componentType of ["HERO", "RICH_TEXT", "CTA_BANNER", "NOTICE", "IMAGE_CARD"]) {
    assert.ok(source.includes(`case "${componentType}"`), `missing renderer: ${componentType}`);
  }
  assert.doesNotMatch(source, /dangerouslySetInnerHTML/);
  assert.match(source, /isSafeCmsUrl/);
});

test("public live slot listens to named SSE changes and has polling fallback", async () => {
  const client = await read("lib/cms-client.ts");
  const liveSlot = await read("components/cms/CmsLiveSlot.tsx");

  assert.match(client, /register\("cms-content-changed"/);
  assert.match(client, /register\("ready"/);
  assert.match(client, /register\("resync"/);
  assert.match(client, /parseReadyEvent\(JSON\.parse/);
  assert.match(client, /readSlotKey/);
  assert.match(client, /Number\.isSafeInteger/);
  assert.match(liveSlot, /resolveCmsSlotKey/);
  assert.match(liveSlot, /setInterval/);
  assert.match(liveSlot, /scheduleReconnect/);
  assert.match(liveSlot, /reconnectAttempt/);
  assert.match(liveSlot, /sseConnected/);
  assert.match(liveSlot, /pendingEventVersions/);
  assert.match(liveSlot, /refresh\(event\.version\)/);
  assert.match(liveSlot, /refresh\(pendingVersionFloor\(\)/);
  assert.match(liveSlot, /pendingEventIds\.current\.size === 0/);
  assert.match(liveSlot, /startPolling\(\)/);
  assert.match(liveSlot, /if \(!succeeded && !cancelled\) startPolling\(\)/);
  assert.match(liveSlot, /onResync/);
  assert.match(liveSlot, /data-cms-live-source="live-backend"/);
  assert.doesNotMatch(liveSlot, /window\.location\.reload/);
});

test("admin editor exposes typed status/version and protected API states", async () => {
  const source = await read("components/cms/CmsEditor.tsx");
  const adminPage = await read("app/admin/content/page.tsx");
  const client = await read("lib/cms-client.ts");

  for (const marker of [
    "expectedVersion",
    "401",
    "403",
    "409",
    "400/422",
    "Lưu bản nháp (ẩn công khai)",
    "Xuất bản",
    "Khôi phục bản đã tải",
    "Lịch sử & rollback server",
    "rollbackContent",
    "Các component CMS đã có trong backend",
    "loadAvailableContent",
  ]) {
    assert.ok(source.includes(marker), `missing editor state: ${marker}`);
  }
  assert.doesNotMatch(source, /rollbackPage/);
  assert.match(adminPage, /authenticatedCmsClient/);
  assert.match(adminPage, /<CmsEditor client=\{authenticatedCmsClient\}/);
  assert.match(client, /getAccessToken: \(\) => readAuthSession\(\)\?\.accessToken/);
  assert.match(source, /setSelectedSlot\(requestedSlot\)/);
  assert.match(source, /loadedSelection\?\.slot/);
});
