import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(relativePath, import.meta.url), "utf8");

const BACKEND_NOTIFICATION = "../../backend/src/main/java/com/healthcare/notification/entity/Notification.java";
const V94_WHITELIST = "../../backend/src/main/resources/db/migration/V94__notification_role_matrix_event_types.sql";

function rule(styles, selector) {
  const match = styles.match(new RegExp(`^${selector}\\s*\\{([^}]*)\\}`, "m"));
  assert.ok(match, `expected a \`${selector} { ... }\` rule in app/styles.css`);
  return match[1];
}

test("the Stitch token layer reaches the admin shell without leaking to :root", async () => {
  const styles = await read("../app/styles.css");

  const shared = styles.match(/\.portal-shell,\s*\.admin-shell\s*\{([^}]*)\}/);
  assert.ok(
    shared,
    "app/styles.css must declare the Stitch tokens on both `.portal-shell` and `.admin-shell`",
  );
  for (const token of [
    "--stitch-primary: #0d9488",
    "--stitch-primary-hover: #0f766e",
    "--stitch-primary-surface: #f0fdfa",
    "--stitch-primary-tint: #ccfbf1",
    "--stitch-primary-line: #99f6e4",
    "--stitch-radius-panel:",
    "--portal-line: #e2e8f0",
    "--portal-shadow: none",
    "--color-teal-600: #0d9488",
  ]) {
    assert.ok(shared[1].includes(token), `the shared token block must define ${token}`);
  }

  // Carrying the palette must not carry the portal's layout: the admin shell
  // keeps its own flex/`lg:flex` rail structure.
  assert.doesNotMatch(shared[1], /display:|flex-direction:|min-height:|background:|padding-inline:/);

  // Public editorial pages must keep their own palette: the tokens stay off
  // the global scope.
  const rootStart = styles.indexOf(":root {");
  const rootBlock = styles.slice(rootStart, styles.indexOf("\n}", rootStart));
  assert.doesNotMatch(rootBlock, /--stitch-|--portal-shadow|--portal-line/);
  assert.match(styles, /\.portal-shell\s*\{[^}]*display:\s*flex/);
});

test("the notification popover is a flat 12px panel with a spec pill radius", async () => {
  const styles = await read("../app/styles.css");
  const popover = rule(styles, "\\.portal-notification-popover");

  assert.match(popover, /border-radius:\s*var\(--stitch-radius-panel\)/);
  assert.match(popover, /box-shadow:\s*none/);
  assert.match(popover, /border:\s*1px solid var\(--portal-line/);
  assert.doesNotMatch(popover, /var\(--radius-sm\)/, "the 4px control radius is not the panel radius");
  assert.doesNotMatch(popover, /box-shadow:\s*0/, "a flat panel must not restate a drop shadow");
  assert.match(styles, /--stitch-radius-panel:\s*0\.75rem/, "12px panel corner token");
  assert.match(styles, /--radius-pill:\s*9999px/, "pill token matches the Stitch spec and tailwind.config.ts");
});

test("an unread row uses the Stitch tint and a 3px inset accent from tokens", async () => {
  const styles = await read("../app/styles.css");
  const unread = rule(styles, "\\.portal-notification-popover__item--unread");

  assert.match(unread, /background:\s*var\(--stitch-primary-surface/);
  assert.match(unread, /box-shadow:\s*inset 3px 0 0 var\(--stitch-primary/);
  assert.doesNotMatch(unread, /#f8fafc/, "the slate canvas tint is not the Stitch unread surface");
  assert.doesNotMatch(unread, /border-left-color/, "the accent is an inset shadow, not a role-scoped legacy teal border");

  const inboxUnread = rule(styles, "\\.portal-notification-center__row--unread");
  assert.match(inboxUnread, /background:\s*var\(--stitch-primary-surface/);
  assert.match(inboxUnread, /box-shadow:\s*inset 3px 0 0 var\(--stitch-primary/);
});

test("the bell refreshes on a bounded, hidden-aware poll in both shells", async () => {
  const [chrome, adminLayout, helper] = await Promise.all([
    read("../components/PortalChrome.tsx"),
    read("../app/admin/layout.tsx"),
    read("../lib/notification-polling.ts"),
  ]);

  for (const [name, source] of [["components/PortalChrome.tsx", chrome], ["app/admin/layout.tsx", adminLayout]]) {
    assert.match(source, /startNotificationPoll/, `${name} must poll the bell instead of loading once`);
    assert.match(source, /NOTIFICATION_POLL_INTERVAL_MS/, `${name} must use the shared cadence`);
    assert.match(source, /document\.hidden/, `${name} must pause on a hidden tab`);
    assert.match(source, /visibilitychange/, `${name} must resume when the tab is shown again`);
    assert.match(source, /poll\.stop\(\)/, `${name} must cancel the chain on unmount`);
  }

  // Non-stacking requires the tick to report its own lifetime.
  assert.match(chrome, /const loadNotifications = useCallback\(\(\): Promise<unknown> =>/);
  assert.match(adminLayout, /const load = useCallback\(\(\): Promise<unknown> =>/);
  assert.match(helper, /Math\.max\(MIN_NOTIFICATION_POLL_INTERVAL_MS/);
  assert.match(helper, /if \(stopped \|\| inFlight\) return/);
  assert.match(helper, /paused \|\| isHidden\(\)/);

  // The same cadence as the CMS live-slot polling fallback, not a new number.
  const cmsSlot = await read("../components/cms/CmsLiveSlot.tsx");
  assert.match(cmsSlot, /pollIntervalMs = 15_000/);
  assert.match(helper, /NOTIFICATION_POLL_INTERVAL_MS = 15_000/);
  assert.match(chrome, /healthcare:notifications-updated/);
});

test("notification labels match the backend whitelist with no invented event types", async () => {
  const [chrome, entity, whitelist] = await Promise.all([
    read("../components/PortalChrome.tsx"),
    read(BACKEND_NOTIFICATION),
    read(V94_WHITELIST),
  ]);

  const labels = chrome.match(/const labels: Record<string, string> = \{([\s\S]*?)\n {2}\};/);
  assert.ok(labels, "formatNotificationType must keep an explicit label map");
  const keys = [...labels[1].matchAll(/^ {4}([A-Z][A-Z0-9_]+):/gm)].map((match) => match[1]);
  assert.ok(keys.length >= 15, `expected the full event vocabulary, got ${keys.length} labels`);

  const enumBody = entity.match(/public enum EventType \{([\s\S]*?)\n {4}\}/);
  assert.ok(enumBody, "backend Notification.EventType must be parseable");
  const enumValues = [...enumBody[1].matchAll(/^\s{8}([A-Z][A-Z0-9_]+),$/gm)].map((match) => match[1]);
  assert.deepEqual(
    [...keys].sort(),
    [...enumValues].sort(),
    "labels must cover Notification.EventType exactly — no dead branches, no gaps",
  );

  const check = whitelist.match(/CHECK \(event_type IN \(([\s\S]*?)\)\)/);
  assert.ok(check, "the V94 whitelist CHECK must stay parseable");
  const allowed = [...check[1].matchAll(/'([A-Z0-9_]+)'/g)].map((match) => match[1]);
  assert.deepEqual(
    [...allowed].sort(),
    [...enumValues].sort(),
    "the enum and the V94 whitelist must not drift apart",
  );

  // The two branches this contract removed must stay removed.
  assert.doesNotMatch(chrome, /PRESCRIPTION_ISSUED|SYSTEM_NOTIFICATION/);
  assert.doesNotMatch(allowed.join(","), /PRESCRIPTION_ISSUED|SYSTEM_NOTIFICATION/);
  assert.match(chrome, /\?\?\s*"Thông báo y tế"/, "an unknown server event needs a readable fallback");
});

test("the portal bell offers the inbox to every role instead of patients only", async () => {
  const chrome = await read("../components/PortalChrome.tsx");

  assert.doesNotMatch(chrome, /canViewAll/, "the full-screen inbox is not patient-only");
  assert.match(chrome, /const notificationsPath = role === "PATIENT" \? "\/patient\/notifications" : "\/doctor\/notifications"/);
  assert.match(chrome, /href=\{notificationsPath\}/);
  assert.match(chrome, /Xem tất cả thông báo/);
  assert.match(chrome, /Chưa có thông báo mới/, "the popover keeps the spec empty state copy");
  assert.match(chrome, /portal-notification-popover__count/, "the header shows the unread pill");
});

test("all three unread surfaces share one server-provided number", async () => {
  const [chrome, inbox, dashboard] = await Promise.all([
    read("../components/PortalChrome.tsx"),
    read("../components/NotificationCenter.tsx"),
    read("../app/patient/dashboard/page.tsx"),
  ]);

  // Badge: caps visually at "9+", while BOTH aria-label and title state the
  // true count — a patient with 41 unread must not be told "9+" by a
  // screen reader or hover.
  assert.match(chrome, /\{unreadCount > 9 \? "9\+" : unreadCount\}/);
  assert.match(chrome, /aria-label=\{unreadCount > 0 \? `Thông báo từ bệnh viện \(\$\{unreadCount\} tin mới\)` : "Thông báo từ bệnh viện"\}/);
  assert.match(chrome, /title=\{unreadCount > 0 \? `Thông báo từ bệnh viện \(\$\{unreadCount\} tin mới\)` : "Thông báo từ bệnh viện"\}/);

  // One source field: `PatientOverview.unreadNotificationCount`, read by the
  // bell/popover, the dashboard hero link and tab badge, and the full inbox.
  assert.match(chrome, /overview\?\.unreadNotificationCount === "number"/);
  assert.match(chrome, /setUnreadCount\(overview\.unreadNotificationCount\)/);
  assert.match(dashboard, /const unreadCount = overview\.status === "success" && typeof overview\.data\.unreadNotificationCount === "number"/);
  assert.match(inbox, /typeof overview\?\.unreadNotificationCount === "number"/);

  // The dashboard no longer invents its own number from the first
  // notifications page — that derivation was the 9+/41/20 divergence.
  assert.doesNotMatch(dashboard, /notifications\.data\.content\.filter\(\(notification\) => !notification\.read\)\.length/);

  // The inbox paginates at 20 rows; while the loaded rows do not cover every
  // unread, the header states "đang hiển thị X trong Y tin chưa đọc".
  assert.match(inbox, /const paginatedUnread = serverUnreadCount !== null && \(loadedUnreadCount < serverUnreadCount \|\| !lastPage\)/);
  assert.match(inbox, /`đang hiển thị \$\{loadedUnreadCount\} trong \$\{serverUnreadCount\} tin chưa đọc/);

  // The doctor portal has no overview endpoint: the inbox fetch is gated to
  // patients, and an unknown number falls back to the honest loaded count.
  assert.match(inbox, /if \(role !== "PATIENT"\) return;/);
  assert.match(inbox, /const displayedUnread = serverUnreadCount \?\? loadedUnreadCount/);
});

test("every path that marks a read keeps the shared unread number coherent", async () => {
  const [inbox, dashboard] = await Promise.all([
    read("../components/NotificationCenter.tsx"),
    read("../app/patient/dashboard/page.tsx"),
  ]);

  // Inbox local actions: one row is a step of -1, mark-all is 0.
  assert.match(inbox, /setServerUnreadCount\(\(current\) => \(current === null \? current : Math\.max\(0, current - 1\)\)\)/);
  assert.match(inbox, /setServerUnreadCount\(\(current\) => \(current === null \? current : 0\)\)/);

  // A read made from the bell popover on this page re-reads the shared
  // server number alongside the list.
  const updatedHandler = inbox.slice(
    inbox.indexOf("const handleUpdated"),
    inbox.indexOf('window.addEventListener("healthcare:notifications-updated", handleUpdated)'),
  );
  assert.match(updatedHandler, /void load\(0\);/);
  assert.match(updatedHandler, /void refreshServerUnread\(\);/);

  // Dashboard: marking read (one or all) re-reads the overview, so the tab
  // badge and hero line converge on the server number instead of a page slice.
  const markOne = dashboard.slice(dashboard.indexOf("const handleMarkAsRead"), dashboard.indexOf("const handleMarkAllAsRead"));
  const markAll = dashboard.slice(dashboard.indexOf("const handleMarkAllAsRead"), dashboard.indexOf("const handleSaveProfile"));
  assert.match(markOne, /refreshOverview\(\)/);
  assert.match(markAll, /refreshOverview\(\)/);
  assert.match(dashboard, /const handleNotificationsUpdate = \(\) => \{[\s\S]*?refreshOverview\(\);[\s\S]*?\};/);
});
