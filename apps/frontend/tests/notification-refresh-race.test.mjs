import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const requireFromTest = createRequire(import.meta.url);
const ts = requireFromTest("typescript");
const source = readFileSync(new URL("../components/PortalChrome.tsx", import.meta.url), "utf8");
const tree = ts.createSourceFile("PortalChrome.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const callbackNames = ["loadNotifications", "handleMarkAllRead", "handleOpenNotificationDetail"];
const declarations = new Map();
const refs = [];
const updateEffects = [];
const UPDATE_EVENT = "healthcare:notifications-updated";

function subscribesToUpdates(node) {
  let matches = false;
  function visit(child) {
    if (ts.isCallExpression(child) && ts.isPropertyAccessExpression(child.expression)
      && child.expression.name.text === "addEventListener"
      && ts.isStringLiteral(child.arguments[0]) && child.arguments[0].text === UPDATE_EVENT) matches = true;
    ts.forEachChild(child, visit);
  }
  visit(node);
  return matches;
}

function visit(node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
    if (callbackNames.includes(node.name.text)) declarations.set(node.name.text, node.getText(tree));
    if (ts.isCallExpression(node.initializer) && ts.isIdentifier(node.initializer.expression)
      && node.initializer.expression.text === "useRef") refs.push(node.getText(tree));
  }
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)
    && node.expression.text === "useEffect" && subscribesToUpdates(node.arguments[0])) updateEffects.push(node.getText(tree));
  ts.forEachChild(node, visit);
}
visit(tree);
assert.equal(declarations.size, callbackNames.length, "execute the actual notification callbacks");
assert.equal(updateEffects.length, 1, "execute the actual notification update subscription");
const javascript = ts.transpileModule([
  ...refs.map((ref) => `const ${ref};`),
  ...callbackNames.map((name) => `const ${declarations.get(name)};`),
  `${updateEffects[0]};`,
].join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const copyRows = (rows) => rows.map((row) => ({ ...row }));
const checkpoint = () => new Promise((resolve) => setImmediate(resolve));

function createHarness(role, manualMutations = false) {
  let serverRows = [{ id: "n1", read: false }, { id: "n2", read: false }];
  const state = { rows: [], count: 0, preview: "loading", error: null, selected: null, reading: null, marking: false };
  const history = [];
  const previews = [];
  const badges = [];
  const mutations = [];
  const listeners = new Map();
  let activePreviews = 0;
  let activeBadges = 0;
  let maxPreviews = 0;
  let maxBadges = 0;
  let updateEvents = 0;
  function setter(name) {
    return (value) => {
      state[name] = typeof value === "function" ? value(state[name]) : value;
      history.push({ ...state, rows: copyRows(state.rows) });
    };
  }
  function read(kind) {
    const gate = deferred();
    const collection = kind === "preview" ? previews : badges;
    const snapshot = kind === "preview" ? { content: copyRows(serverRows) }
      : { unreadNotificationCount: serverRows.filter((row) => !row.read).length };
    if (kind === "preview") maxPreviews = Math.max(maxPreviews, ++activePreviews);
    else maxBadges = Math.max(maxBadges, ++activeBadges);
    let settled = false;
    collection.push({
      resolve() { settle(); gate.resolve(snapshot); },
      reject() { settle(); gate.reject(new Error("Synthetic read failure")); },
    });
    function settle() {
      assert.equal(settled, false, "a controlled response settles once");
      settled = true;
      if (kind === "preview") activePreviews--;
      else activeBadges--;
    }
    return gate.promise;
  }
  async function mutate(kind, id) {
    const gate = deferred();
    mutations.push({ kind, id, resolve: gate.resolve, reject: () => gate.reject(new Error("Synthetic mutation failure")) });
    if (manualMutations) await gate.promise;
    serverRows = serverRows.map((row) => kind === "all" || row.id === id ? { ...row, read: true } : row);
  }
  const window = {
    addEventListener: (name, handler) => listeners.set(name, handler),
    removeEventListener: (name) => listeners.delete(name),
    dispatchEvent(event) {
      if (event.type === UPDATE_EVENT) updateEvents++;
      listeners.get(event.type)?.(event);
    },
  };
  const dependencies = {
    role,
    useCallback: (callback) => callback,
    useRef: (initial) => ({ current: initial }),
    useEffect: (effect) => effect(),
    setNotificationPreviewState: setter("preview"),
    setNotificationsList: setter("rows"),
    setUnreadCount: setter("count"),
    setMarkingAllRead: setter("marking"),
    setNotificationActionError: setter("error"),
    setSelectedNotification: setter("selected"),
    setIsPopoverOpen: () => {},
    setReadingNotificationId: setter("reading"),
    fetchNotifications: () => read("preview"),
    fetchPatientOverview: () => read("badge"),
    markAllNotificationsAsRead: () => mutate("all"),
    markNotificationAsRead: (id) => mutate("single", id),
    window,
    CustomEvent: class { constructor(type) { this.type = type; } },
  };
  const controls = new Function(...Object.keys(dependencies), `${javascript}\nreturn {${callbackNames.join(",")}};`)(...Object.values(dependencies));
  return {
    state, history, previews, badges, mutations, controls,
    emitUpdate: () => window.dispatchEvent({ type: UPDATE_EVENT }),
    setServerRows: (rows) => { serverRows = copyRows(rows); },
    get updateEvents() { return updateEvents; },
    get maxPreviews() { return maxPreviews; },
    get maxBadges() { return maxBadges; },
    release(index, fail = false) {
      previews[index][fail ? "reject" : "resolve"]();
      if (role === "PATIENT") badges[index][fail ? "reject" : "resolve"]();
    },
    async seed() {
      const task = controls.loadNotifications();
      this.release(0);
      await task;
      assert.equal(state.count, 2);
    },
  };
}

for (const role of ["PATIENT", "DOCTOR"]) {
  for (const kind of ["all", "single"]) {
    test(`${role}: acknowledged ${kind}-read survives an older GET and waits for one catch-up`, async () => {
      const harness = createHarness(role);
      const { controls, state } = harness;
      await harness.seed();
      const task = controls.loadNotifications();
      assert.equal(controls.loadNotifications(), task, "ordinary refreshes deduplicate");
      let settled = false;
      task.then(() => { settled = true; });
      await (kind === "all" ? controls.handleMarkAllRead() : controls.handleOpenNotificationDetail(state.rows[0]));
      const acknowledged = { count: state.count, reads: state.rows.map((row) => row.read) };
      assert.equal(acknowledged.count, kind === "all" ? 0 : 1);
      const afterMutation = harness.history.length;
      if (role === "PATIENT") {
        harness.badges[1].resolve();
        await checkpoint();
        assert.equal(state.count, acknowledged.count, "the old overview cannot undo the acknowledged count");
      }
      harness.previews[1].resolve();
      await checkpoint();
      assert.deepEqual(state.rows.map((row) => row.read), acknowledged.reads, "the old preview cannot restore unread rows");
      assert.equal(state.count, acknowledged.count);
      for (const snapshot of harness.history.slice(afterMutation)) {
        assert.equal(snapshot.count, acknowledged.count, "stale state never appears between callbacks");
        assert.deepEqual(snapshot.rows.map((row) => row.read), acknowledged.reads);
      }
      assert.equal(harness.previews.length, 3, "one post-mutation GET must be queued");
      assert.equal(settled, false, "the original settle promise includes its queued catch-up");
      harness.release(2);
      await task;
      assert.equal(settled, true);
      assert.equal(state.preview, "ready");
      assert.equal(state.count, acknowledged.count);
      assert.deepEqual(state.rows.map((row) => row.read), acknowledged.reads);
      assert.equal(harness.maxPreviews, 1);
      assert.equal(harness.maxBadges, role === "PATIENT" ? 1 : 0);
    });
  }

  test(`${role}: update bursts coalesce without stacking, including during the catch-up`, async () => {
    const harness = createHarness(role);
    const { controls, state } = harness;
    await harness.seed();
    const task = controls.loadNotifications();
    harness.setServerRows([{ id: "n1", read: true }, { id: "n2", read: true }]);
    for (let index = 0; index < 3; index++) harness.emitUpdate();
    assert.equal(harness.previews.length, 2, "events cannot stack another active read");
    harness.release(1);
    await checkpoint();
    assert.equal(harness.previews.length, 3, "a burst queues exactly one catch-up");
    const catchUp = controls.loadNotifications();
    assert.equal(controls.loadNotifications(), catchUp);
    harness.setServerRows([{ id: "n1", read: true }, { id: "n2", read: true }, { id: "new-server-notice", read: false }]);
    harness.emitUpdate();
    harness.emitUpdate();
    assert.equal(harness.previews.length, 3);
    harness.release(2);
    await checkpoint();
    assert.equal(harness.previews.length, 4, "an event during catch-up queues one subsequent read");
    harness.release(3);
    await task;
    assert.equal(harness.previews.length, 4, "ordinary deduplicated calls cannot queue extra reads");
    assert.equal(state.count, 1, "the final server snapshot remains authoritative");
    assert.equal(state.rows[2].id, "new-server-notice");
    assert.equal(state.preview, "ready");
    assert.equal(harness.maxPreviews, 1);
    assert.equal(harness.maxBadges, role === "PATIENT" ? 1 : 0);
  });

  test(`${role}: an invalidated failure is ignored; a current failure stays honest and retryable`, async () => {
    const harness = createHarness(role);
    const { controls, state } = harness;
    await harness.seed();
    const task = controls.loadNotifications();
    await controls.handleMarkAllRead();
    const afterMutation = harness.history.length;
    harness.release(1, true);
    await checkpoint();
    assert.ok(harness.history.slice(afterMutation).every((snapshot) => snapshot.preview !== "error"), "an obsolete failure must not overwrite the new preview state");
    assert.equal(harness.previews.length, 3);
    harness.release(2, true);
    await task;
    assert.equal(state.preview, "error", "a current failed refresh is visible");
    assert.equal(state.count, 0);
    assert.ok(state.rows.every((row) => row.read), "a failed refresh retains acknowledged rows");
    const retry = controls.loadNotifications();
    assert.equal(state.preview, "loading");
    harness.release(3);
    await retry;
    assert.equal(state.preview, "ready");
    assert.equal(harness.previews.length, 4);
  });

  for (const kind of ["all", "single"]) {
    test(`${role}: failed ${kind}-read preserves unread state and the existing duplicate-write guard`, async () => {
      const harness = createHarness(role, true);
      const { controls, state } = harness;
      await harness.seed();
      const invoke = () => kind === "all" ? controls.handleMarkAllRead() : controls.handleOpenNotificationDetail(state.rows[0]);
      const first = invoke();
      await invoke();
      assert.equal(harness.mutations.length, 1, "the pending mutation cannot duplicate");
      harness.mutations[0].reject();
      await first;
      assert.equal(state.count, 2);
      assert.ok(state.rows.every((row) => !row.read));
      assert.ok(state.error.includes("thử lại"));
      assert.equal(state.reading, null);
      assert.equal(state.marking, false);
      assert.equal(harness.updateEvents, 0, "failure cannot invalidate a current read");
      assert.equal(harness.previews.length, 1);
      const retry = invoke();
      assert.equal(state.error, null);
      assert.equal(harness.mutations.length, 2, "the failed write remains retryable");
      harness.mutations[1].resolve();
      await retry;
      assert.equal(harness.updateEvents, 1);
      const refresh = controls.loadNotifications();
      harness.release(1);
      await refresh;
      assert.equal(state.count, kind === "all" ? 0 : 1);
      assert.equal(state.rows[0].read, true);
      assert.equal(state.preview, "ready");
    });
  }
}
