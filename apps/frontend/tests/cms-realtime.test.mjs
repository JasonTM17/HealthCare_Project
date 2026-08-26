import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { CmsReconciliationLedger } from "../lib/cms-reconciliation.mjs";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

async function loadCmsClientModule() {
  const source = await read("lib/cms-client.ts");
  const directory = await mkdtemp(join(tmpdir(), "healthcare-cms-client-"));
  const file = join(directory, "cms-client-runtime.ts");
  await writeFile(file, source, "utf8");
  try {
    return await import(`${pathToFileURL(file).href}?${Date.now()}`);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

class FakeEventSource {
  static instances = [];

  constructor(url) {
    this.url = url;
    this.listeners = new Map();
    this.closed = false;
    this.onopen = null;
    this.onerror = null;
    FakeEventSource.instances.push(this);
  }

  addEventListener(name, listener) {
    const listeners = this.listeners.get(name) ?? [];
    listeners.push(listener);
    this.listeners.set(name, listeners);
  }

  removeEventListener(name, listener) {
    this.listeners.set(name, (this.listeners.get(name) ?? []).filter((item) => item !== listener));
  }

  emit(name, payload) {
    const event = { data: JSON.stringify(payload) };
    for (const listener of this.listeners.get(name) ?? []) listener(event);
  }

  open() {
    this.onopen?.();
  }

  close() {
    this.closed = true;
  }
}

test("CMS client matches the integrated slot-scoped typed contract", async () => {
  const source = await read("lib/cms-client.ts");

  for (const marker of [
    "CMS_COMPONENT_TYPES",
    "CMS_SLOT_COMPONENT_TYPES",
    "cmsComponentTypesForSlot",
    "isCmsComponentAllowedForSlot",
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
  assert.match(source, /hero:\s+\["HERO"\]/);
  assert.match(source, /body:\s+\["RICH_TEXT", "CTA_BANNER", "NOTICE"\]/);
  assert.match(source, /footer:\s+\["RICH_TEXT", "CTA_BANNER", "NOTICE"\]/);
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
  assert.match(liveSlot, /safetyPollTimer/);
  assert.match(liveSlot, /startSafetyPolling/);
  assert.match(liveSlot, /refresh\(0\)\.then/);
  assert.match(liveSlot, /reconciliation\.hasPendingWork/);
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
  assert.match(liveSlot, /Treat unpublish events as wake-up hints too/);
  assert.match(liveSlot, /refresh\(0, event\.eventId\)/);
  assert.match(liveSlot, /result === "not-found"/);
  assert.match(liveSlot, /latestVersion\.current = Math\.max\(latestVersion\.current, event\.version\)/);
  assert.doesNotMatch(liveSlot, /unpublish event is authoritative immediately/);
  assert.doesNotMatch(liveSlot, /latestVersion\.current = event\.version;\s+setContent\(null\);/);
  assert.match(liveSlot, /void refresh\(0, reconciliation\.latestEventId\)/);
  assert.match(liveSlot, /if \(!finishReconciliation\(event\.latestEventId\)\)/);
  assert.match(liveSlot, /reconciliation\.pendingEventIds\.size === 0/);
  assert.match(liveSlot, /reconciliationCursor/);
  assert.match(liveSlot, /refresh\(minimumVersion, afterEventId\)/);
  assert.match(liveSlot, /reconciliation\.pendingEventIds\.size === 0\s+&& reconciliation\.reconciliationCursor === 0/);
  assert.match(liveSlot, /result !== "failed"/);
  assert.match(liveSlot, /data-cms-live-source="live-backend"/);
  assert.match(liveSlot, /PUBLIC_TECHNICAL_COPY_PATTERN/);
  assert.match(liveSlot, /const publicQuiet = quiet \|\| !showSourceLabel/);
  assert.match(liveSlot, /data-cms-suppressed="technical-copy"/);
  assert.doesNotMatch(liveSlot, /scheduleReconnect/);
  assert.doesNotMatch(liveSlot, /reconnectTimer/);
  assert.doesNotMatch(liveSlot, /reconnectAttempt/);
  assert.doesNotMatch(liveSlot, /window\.location\.reload/);
});

test("CMS client carries admin publish versions into the public change feed", async () => {
  FakeEventSource.instances = [];
  const { CmsClient } = await loadCmsClientModule();
  const requests = [];
  const savedContent = {
    slotKey: "homepage.hero",
    componentType: "HERO",
    payload: {
      title: "Realtime care journey",
      body: "Published by admin",
    },
    status: "PUBLISHED",
    version: 3,
    updatedAt: "2026-08-21T00:00:00Z",
  };

  const fetchImpl = async (url, init = {}) => {
    requests.push({
      url,
      method: init.method ?? "GET",
      headers: new Headers(init.headers),
      body: init.body ? JSON.parse(String(init.body)) : null,
      cache: init.cache,
      credentials: init.credentials,
    });
    return new Response(JSON.stringify(savedContent), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const changes = [];
  const readyEvents = [];
  const client = new CmsClient({
    baseUrl: "https://api.example.test/api/v1",
    fetchImpl,
    eventSourceFactory: (url) => new FakeEventSource(url),
  });

  const unsubscribe = client.subscribeToChanges({
    after: 40,
    onConnected: (event) => readyEvents.push(event),
    onChange: (event) => changes.push(event),
  });

  assert.equal(FakeEventSource.instances.length, 1);
  const source = FakeEventSource.instances[0];
  assert.equal(source.url, "https://api.example.test/api/v1/cms/content/events?after=40");
  source.open();
  source.emit("ready", {
    latestEventId: 42,
    replayLimit: 250,
    snapshotFallback: "/api/v1/cms/content/{slotKey}",
  });

  const saved = await client.upsertContent("homepage.hero", {
    componentType: "HERO",
    payload: {
      title: "Realtime care journey",
      body: "Published by admin",
    },
    status: "PUBLISHED",
    expectedVersion: 2,
  });

  assert.equal(saved.version, 3);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://api.example.test/api/v1/admin/cms/content/homepage.hero");
  assert.equal(requests[0].method, "PUT");
  assert.equal(requests[0].cache, "no-store");
  assert.equal(requests[0].credentials, "include");
  assert.equal(requests[0].headers.get("authorization"), null);
  assert.deepEqual(requests[0].body, {
    componentType: "HERO",
    payload: {
      title: "Realtime care journey",
      body: "Published by admin",
    },
    status: "PUBLISHED",
    expectedVersion: 2,
  });
  source.emit("cms-content-changed", {
    type: "cms-content-changed",
    eventId: 43,
    slotKey: "homepage.hero",
    version: 3,
    published: true,
    updatedAt: "2026-08-21T00:00:01Z",
  });

  assert.deepEqual(readyEvents.at(-1), {
    latestEventId: 42,
    replayLimit: 250,
    snapshotFallback: "/api/v1/cms/content/{slotKey}",
  });
  assert.deepEqual(changes, [{
    type: "cms-content-changed",
    eventId: 43,
    slotKey: "homepage.hero",
    version: 3,
    published: true,
    updatedAt: "2026-08-21T00:00:01Z",
  }]);

  unsubscribe();
  assert.equal(source.closed, true);
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
    "contentOperationRef",
    "inventoryGenerationRef",
    "isCurrentOperation",
    "isCurrentInventoryRequest",
  ]) {
    assert.ok(source.includes(marker), `missing editor state: ${marker}`);
  }
  assert.doesNotMatch(source, /rollbackPage/);
  assert.match(adminPage, /authenticatedCmsClient/);
  assert.match(adminPage, /<CmsEditor client=\{authenticatedCmsClient\}/);
  assert.match(client, /authenticatedCmsClient = new CmsClient\(\)/);
  assert.match(client, /credentials: init\.credentials \?\? "include"/);
  assert.doesNotMatch(client, /Authorization|Bearer|getAccessToken|accessToken/);
  assert.match(source, /setSelectedSlot\(requestedSlot\)/);
  assert.match(source, /loadedSelection\?\.slot/);
  assert.match(source, /disabled=\{isBusy\}/);
  assert.match(source, /PayloadFields disabled=\{isBusy\}/);
  assert.match(source, /invalidateInventory\(\);/);
  assert.match(source, /inventoryGenerationRef\.current \+= 1/);
  assert.match(source, /setHistoryLoading\(true\);[\s\S]*listHistory\(savedContent\.slotKey\)/);
  assert.match(source, /catch \(historyLoadError\)[\s\S]*setHistoryError\(apiErrorMessage/);
  assert.match(source, /setNotice\(`Đã rollback/);
  assert.match(source, /cmsComponentTypesForSlot\(editableSlot\)/);
  assert.match(source, /isCmsComponentAllowedForSlot\(editableSlot, componentType\)/);
  assert.doesNotMatch(source, /CMS_COMPONENT_TYPES\.map/);
});
