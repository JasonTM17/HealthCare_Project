import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("../lib/notification-polling.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const harnessModule = { exports: {} };
vm.runInNewContext(`(function(exports, module) {${compiled.outputText}\n})`, { Math, Date, Promise })(
  harnessModule.exports,
  harnessModule,
);
const {
  MAX_NOTIFICATION_POLL_INTERVAL_MS,
  MIN_NOTIFICATION_POLL_INTERVAL_MS,
  NOTIFICATION_POLL_INTERVAL_MS,
  startNotificationPoll,
} = harnessModule.exports;

/** Deterministic clock + timer queue so no test waits on wall time. */
function createHarness(startAt = 0) {
  let clock = startAt;
  let seq = 0;
  const pending = new Map();
  return {
    now: () => clock,
    timers: {
      schedule: (callback, delayMs) => {
        seq += 1;
        pending.set(seq, { at: clock + delayMs, callback });
        return seq;
      },
      cancel: (handle) => {
        pending.delete(handle);
      },
    },
    pendingCount: () => pending.size,
    nextDelayMs: () => (pending.size ? Math.min(...[...pending.values()].map((task) => task.at - clock)) : null),
    async advance(ms) {
      const target = clock + ms;
      // Re-arming inside the loop is the point of the guard below: a bounded
      // poll may schedule the next tick while we are still advancing.
      for (let guard = 0; guard < 100; guard += 1) {
        const due = [...pending.entries()]
          .filter(([, task]) => task.at <= target)
          .sort((left, right) => left[1].at - right[1].at)[0];
        if (!due) break;
        const [id, task] = due;
        pending.delete(id);
        clock = Math.max(clock, task.at);
        task.callback();
        for (let tick = 0; tick < 12; tick += 1) await Promise.resolve();
      }
      clock = target;
      for (let tick = 0; tick < 12; tick += 1) await Promise.resolve();
    },
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

test("the bell polls on a fixed cadence and re-arms exactly once per tick", async () => {
  const harness = createHarness(1_000);
  let calls = 0;
  const poll = startNotificationPoll({
    tick: () => { calls += 1; },
    timers: harness.timers,
    now: harness.now,
    intervalMs: 15_000,
  });

  poll.setPaused(false);
  assert.equal(calls, 0, "the mount read already counted as the first tick");
  assert.equal(harness.nextDelayMs(), 15_000);

  await harness.advance(14_999);
  assert.equal(calls, 0);

  await harness.advance(1);
  assert.equal(calls, 1);
  assert.equal(harness.nextDelayMs(), 15_000, "one pending timer, one interval ahead");

  await harness.advance(30_000);
  assert.equal(calls, 3);
  assert.equal(harness.pendingCount(), 1, "the chain never accumulates pending timers");

  poll.stop();
  await harness.advance(60_000);
  assert.equal(calls, 3, "stop() must end the chain");
});

test("a slow tick cannot stack a second request", async () => {
  const harness = createHarness(0);
  let calls = 0;
  const gate = deferred();
  const poll = startNotificationPoll({
    tick: () => {
      calls += 1;
      return gate.promise;
    },
    timers: harness.timers,
    now: harness.now,
    intervalMs: 10_000,
  });

  poll.setPaused(false);
  await harness.advance(120_000);
  assert.equal(calls, 1, "twelve overdue intervals must still mean one in-flight read");
  assert.equal(harness.pendingCount(), 0);

  gate.resolve();
  for (let tick = 0; tick < 12; tick += 1) await Promise.resolve();
  assert.equal(harness.pendingCount(), 1, "the chain re-arms only once the read settles");
  poll.stop();
});

test("a hidden tab holds no timer and only catches up once the interval elapsed", async () => {
  const harness = createHarness(0);
  let calls = 0;
  const poll = startNotificationPoll({
    tick: () => { calls += 1; },
    timers: harness.timers,
    now: harness.now,
    intervalMs: 15_000,
  });

  poll.setPaused(false);
  poll.setPaused(true);
  assert.equal(harness.pendingCount(), 0, "document.hidden must cancel the pending tick");

  await harness.advance(60_000);
  assert.equal(calls, 0, "a hidden bell fetches nothing");

  // Resuming long after the window is due: catch up now, then keep the cadence.
  poll.setPaused(false);
  assert.equal(harness.nextDelayMs(), 0);
  await harness.advance(0);
  assert.equal(calls, 1);
  assert.equal(harness.nextDelayMs(), 15_000);

  // Resuming inside the window must not fire early. The cooldown is measured
  // from the last successful read, so time spent hidden still ages the data.
  await harness.advance(5_000);
  poll.setPaused(true);
  await harness.advance(1_000);
  poll.setPaused(false);
  assert.equal(harness.nextDelayMs(), 9_000);
  await harness.advance(8_000);
  assert.equal(calls, 1);
  await harness.advance(1_000);
  assert.equal(calls, 2);
  poll.stop();
});

test("a rejected tick keeps the last known badge and the same bounded cadence", async () => {
  const harness = createHarness(0);
  let calls = 0;
  const poll = startNotificationPoll({
    tick: () => {
      calls += 1;
      throw new Error("private provider error");
    },
    timers: harness.timers,
    now: harness.now,
    intervalMs: 15_000,
  });

  poll.setPaused(false);
  await harness.advance(45_000);
  assert.equal(calls, 3, "one retry per interval, no error-driven burst");
  poll.stop();
});

test("the cadence stays inside the documented floor and ceiling", async () => {
  assert.equal(NOTIFICATION_POLL_INTERVAL_MS, 15_000, "matches the CMS live-slot polling default");
  const harness = createHarness(0);
  let calls = 0;
  const poll = startNotificationPoll({
    tick: () => { calls += 1; },
    timers: harness.timers,
    now: harness.now,
    intervalMs: 1,
  });
  poll.setPaused(false);
  assert.equal(harness.nextDelayMs(), MIN_NOTIFICATION_POLL_INTERVAL_MS);
  await harness.advance(MIN_NOTIFICATION_POLL_INTERVAL_MS);
  assert.equal(calls, 1);
  poll.stop();

  const capped = createHarness(0);
  const second = startNotificationPoll({
    tick: () => undefined,
    timers: capped.timers,
    now: capped.now,
    intervalMs: Number.MAX_SAFE_INTEGER,
  });
  second.setPaused(false);
  assert.equal(capped.nextDelayMs(), MAX_NOTIFICATION_POLL_INTERVAL_MS);
  second.stop();
});
