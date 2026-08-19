import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { CmsReconciliationLedger } from "../lib/cms-reconciliation.mjs";

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
    "parseHeartbeatEvent",
    "latestEventId",
    "afterEventId",
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
  assert.match(client, /register\("heartbeat"/);
  assert.match(client, /onHeartbeat/);
  assert.match(client, /parseReadyEvent\(JSON\.parse/);
  assert.match(client, /readSlotKey/);
  assert.match(client, /Number\.isSafeInteger/);
  assert.match(client, /changeSubscribers/);
  assert.match(client, /openSharedChangeFeed/);
  assert.match(client, /scheduleSharedReconnect/);
  assert.match(client, /Math\.random/);
  assert.match(client, /Math\.min\(30_000/);
  assert.match(client, /register\("unavailable"/);
  assert.match(client, /this\.changeSubscribers\.size === 0/);
  assert.match(liveSlot, /resolveCmsSlotKey/);
  assert.match(liveSlot, /setInterval/);
  assert.match(liveSlot, /client\.subscribeToChanges/);
  assert.match(liveSlot, /sseConnected/);
  assert.match(liveSlot, /pendingVersionFloor/);
  assert.match(liveSlot, /refresh\(event\.version, event\.eventId\)/);
  assert.match(liveSlot, /refresh\(pendingVersionFloor\(\), event\.latestEventId\)/);
  assert.match(liveSlot, /reconciliation\.pendingEventIds\.size === 0/);
  assert.match(liveSlot, /startPolling\(\)/);
  assert.match(liveSlot, /if \(result === "failed" && !cancelled\) startPolling\(\)/);
  assert.match(liveSlot, /onResync/);
  assert.match(liveSlot, /onHeartbeat/);
  assert.match(liveSlot, /heartbeat\.latestEventId/);
  assert.match(liveSlot, /refresh\(0, heartbeat\.latestEventId\)/);
  assert.match(liveSlot, /setError\(new CmsApiError\("not-found", 404/);
  assert.match(liveSlot, /CmsReconciliationLedger/);
  assert.match(liveSlot, /reconciliation\.observe\(event\.eventId\)/);
  assert.match(liveSlot, /acknowledgeThrough/);
  assert.match(liveSlot, /refreshGeneration/);
  assert.match(liveSlot, /setContent\(null\);\s+setError\(null\);\s+setLoading\(true\);/);
  assert.match(liveSlot, /readGeneration !== refreshGeneration/);
  assert.match(liveSlot, /readReconciliationCursor/);
  assert.match(liveSlot, /invalidateRefreshes\(\)/);
  assert.match(liveSlot, /unpublish event is authoritative immediately/);
  assert.match(liveSlot, /void refresh\(0, reconciliation\.latestEventId\)/);
  assert.match(liveSlot, /if \(!finishReconciliation\(event\.latestEventId\)\)/);
  assert.match(liveSlot, /reconciliation\.pendingEventIds\.size === 0/);
  assert.match(liveSlot, /reconciliationCursor/);
  assert.match(liveSlot, /refresh\(minimumVersion, afterEventId\)/);
  assert.match(liveSlot, /reconciliation\.pendingEventIds\.size === 0\s+&& reconciliation\.reconciliationCursor === 0/);
  assert.match(liveSlot, /result !== "failed"/);
  assert.match(liveSlot, /data-cms-live-source="live-backend"/);
  assert.doesNotMatch(liveSlot, /scheduleReconnect/);
  assert.doesNotMatch(liveSlot, /reconnectTimer/);
  assert.doesNotMatch(liveSlot, /reconnectAttempt/);
  assert.doesNotMatch(liveSlot, /window\.location\.reload/);
});

test("CMS reconciliation ledger preserves contiguous order across reordered events and requests", () => {
  const events = new CmsReconciliationLedger(10);

  // An unrelated event 12 may arrive before relevant event 11. The client
  // must not acknowledge the gap or discard event 11 as already handled.
  assert.equal(events.observe(12), true);
  events.advanceCursor();
  assert.equal(events.latestEventId, 10);
  assert.equal(events.observe(11), false);
  events.markPending(11, 7);
  events.advanceCursor();
  assert.equal(events.latestEventId, 10);
  events.resolvePending(11);
  assert.equal(events.latestEventId, 12);

  const gap = new CmsReconciliationLedger(10);
  gap.observe(12);
  gap.beginReconciliation(12);
  assert.equal(gap.pendingEventCursor(), 12);

  // A stale request must not clear a newer reconciliation target.
  events.beginReconciliation(12);
  events.beginReconciliation(13);
  assert.equal(events.acknowledgeThrough(12), false);
  assert.equal(events.reconciliationCursor, 13);
  assert.equal(events.acknowledgeThrough(13), true);
  assert.equal(events.latestEventId, 13);
  assert.equal(events.reconciliationCursor, 0);
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
    "loadGenerationRef",
    "isCurrentRequest",
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
