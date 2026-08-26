import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";

const requireFromTest = createRequire(import.meta.url);
const ts = requireFromTest("typescript");
const modalPath = new URL("../components/BookingModal.tsx", import.meta.url);
const apiPath = new URL("../lib/api.ts", import.meta.url);

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function transpileModule(source, fileName, stubs = {}, globals = {}) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName,
  }).outputText;
  const compiledModule = { exports: {} };
  const reactStub = {
    default: {},
    useCallback: (callback) => callback,
    useEffect: () => undefined,
    useMemo: (factory) => factory(),
    useRef: (value) => ({ current: value }),
    useState: (value) => [typeof value === "function" ? value() : value, () => undefined],
  };
  const requireStub = (specifier) => {
    if (specifier in stubs) return stubs[specifier];
    if (specifier === "react") return reactStub;
    if (specifier === "react/jsx-runtime") {
      return { Fragment: Symbol("Fragment"), jsx: () => null, jsxs: () => null };
    }
    if (specifier === "next/link") return () => null;
    if (specifier === "../lib/api") {
      return { confirmAppointment() {}, fetchDoctorSlots() {}, holdAppointmentSlot() {} };
    }
    if (specifier === "../lib/api-client") {
      return { fetchBranches() {}, fetchDoctors() {}, fetchSpecialties() {} };
    }
    if (specifier === "../lib/business-time") return { businessDate: () => "2026-08-26" };
    if (specifier === "../lib/present-api-error") return { presentApiError: () => "Chưa thể hoàn tất yêu cầu. Vui lòng thử lại." };
    if (specifier === "./UiIcon" || specifier === "./useDialogFocus") return () => null;
    if (specifier === "../types/hospital") return {};
    throw new Error(`Unexpected transpiled dependency: ${specifier}`);
  };

  vm.runInNewContext(output, {
    AbortController,
    DOMException,
    Promise,
    URLSearchParams,
    clearTimeout,
    console,
    exports: compiledModule.exports,
    fetch: globals.fetch,
    module: compiledModule,
    require: requireStub,
    setTimeout,
  }, { filename: fileName });
  return compiledModule.exports;
}

async function loadModalModule() {
  const source = await readFile(modalPath, "utf8");
  return { exports: transpileModule(source, "BookingModal.tsx"), source };
}

function recordRun(owner, identity, retryNonce, pending) {
  const events = [];
  let loadCalls = 0;
  let signal;
  const execution = owner.run({
    identity,
    retryNonce,
    load: (requestSignal) => {
      loadCalls += 1;
      signal = requestSignal;
      return pending.promise;
    },
    onStart: (attempt) => events.push(["start", attempt]),
    onIdle: (attempt) => events.push(["idle", attempt]),
    onSuccess: (slots, attempt) => events.push(["success", attempt, slots]),
    onError: (error, attempt) => events.push(["error", attempt, error]),
    onFinally: (attempt) => events.push(["finally", attempt]),
  });
  return {
    events,
    execution,
    get loadCalls() { return loadCalls; },
    get signal() { return signal; },
  };
}

function availableSlot(branchId, startTime) {
  return {
    available: true,
    branchId,
    endTime: "08:30:00",
    startTime,
    statusNote: "Còn trống",
  };
}

test("normalized slot identity and upstream reselects cannot clear a committed slot", async () => {
  const { exports, source } = await loadModalModule();
  const normalize = exports.normalizeBookingSlotQueryIdentity;

  assert.equal(typeof normalize, "function");
  assert.equal(
    normalize(" doctor-a ", " branch-a ", " 2026-08-27 ").key,
    normalize("doctor-a", "branch-a", "2026-08-27").key,
  );

  const handlerNames = [
    "handleSpecialtyChange",
    "handleBranchChange",
    "handleDoctorChange",
    "handleDateChange",
  ];
  for (let index = 0; index < handlerNames.length; index += 1) {
    const start = source.indexOf(`const ${handlerNames[index]} =`);
    const next = index + 1 < handlerNames.length
      ? source.indexOf(`const ${handlerNames[index + 1]} =`, start)
      : source.indexOf("const handleSlotChange =", start);
    assert.ok(start >= 0 && next > start, `missing ${handlerNames[index]}`);
    assert.doesNotMatch(
      source.slice(start, next),
      /setSlots|setSlotError|setSelectedSlot|setSlotQueryState/,
      `${handlerNames[index]} must leave slot-query state to the owner`,
    );
  }
  assert.match(source, /useMemo\(\s*\(\) => normalizeBookingSlotQueryIdentity/);
  assert.match(source, /\[active, slotQueryIdentity, slotRefreshNonce, slotQueryOwner\]/);
});

test("slow A, fast B, and a late A error/finally cannot overwrite B", async () => {
  const { exports } = await loadModalModule();
  const Owner = exports.BookingSlotQueryOwner;
  const normalize = exports.normalizeBookingSlotQueryIdentity;
  assert.equal(typeof Owner, "function");

  const owner = new Owner();
  const leaveLifecycle = owner.enterLifecycle(true);
  const identityA = normalize("doctor-a", "branch-a", "2026-08-27");
  const identityB = normalize("doctor-b", "branch-b", "2026-08-28");
  const pendingA = deferred();
  const pendingB = deferred();
  const runA = recordRun(owner, identityA, 0, pendingA);
  await Promise.resolve();
  const runB = recordRun(owner, identityB, 0, pendingB);
  await Promise.resolve();

  assert.equal(runA.signal.aborted, true);
  pendingB.resolve([availableSlot("branch-b", "09:00:00")]);
  await runB.execution.settled;
  pendingA.reject(new Error("late A failure"));
  await runA.execution.settled;

  assert.deepEqual(runA.events.map(([event]) => event), ["start"]);
  assert.deepEqual(runB.events.map(([event]) => event), ["start", "success", "finally"]);
  assert.equal(runB.events[1][2][0].startTime, "09:00:00");
  leaveLifecycle();
});

test("close/reopen and React Strict Mode lifecycles invalidate pending work", async () => {
  const { exports } = await loadModalModule();
  const Owner = exports.BookingSlotQueryOwner;
  const identity = exports.normalizeBookingSlotQueryIdentity("doctor-a", "branch-a", "2026-08-27");

  const owner = new Owner();
  const leaveOpen = owner.enterLifecycle(true);
  const pendingBeforeClose = deferred();
  const beforeClose = recordRun(owner, identity, 0, pendingBeforeClose);
  await Promise.resolve();
  leaveOpen();
  beforeClose.execution.cancel();

  const leaveClosed = owner.enterLifecycle(false);
  const idlePending = deferred();
  const whileClosed = recordRun(owner, identity, 0, idlePending);
  await whileClosed.execution.settled;
  assert.equal(whileClosed.loadCalls, 0);
  assert.deepEqual(whileClosed.events.map(([event]) => event), ["idle", "finally"]);
  leaveClosed();
  whileClosed.execution.cancel();

  const leaveReopened = owner.enterLifecycle(true);
  const pendingAfterReopen = deferred();
  const afterReopen = recordRun(owner, identity, 0, pendingAfterReopen);
  await Promise.resolve();
  pendingAfterReopen.resolve([availableSlot("branch-a", "10:00:00")]);
  await afterReopen.execution.settled;
  pendingBeforeClose.reject(new Error("late close failure"));
  await beforeClose.execution.settled;
  assert.deepEqual(beforeClose.events.map(([event]) => event), ["start"]);
  assert.deepEqual(afterReopen.events.map(([event]) => event), ["start", "success", "finally"]);
  leaveReopened();

  const strictOwner = new Owner();
  const leaveStrictFirst = strictOwner.enterLifecycle(true);
  const strictFirstPending = deferred();
  const strictFirst = recordRun(strictOwner, identity, 0, strictFirstPending);
  await Promise.resolve();
  leaveStrictFirst();
  strictFirst.execution.cancel();
  const leaveStrictSecond = strictOwner.enterLifecycle(true);
  const strictSecondPending = deferred();
  const strictSecond = recordRun(strictOwner, identity, 0, strictSecondPending);
  await Promise.resolve();
  strictSecondPending.resolve([availableSlot("branch-a", "11:00:00")]);
  await strictSecond.execution.settled;
  strictFirstPending.resolve([availableSlot("branch-a", "07:00:00")]);
  await strictFirst.execution.settled;
  assert.deepEqual(strictFirst.events.map(([event]) => event), ["start"]);
  assert.deepEqual(strictSecond.events.map(([event]) => event), ["start", "success", "finally"]);
  leaveStrictSecond();
});

test("retry, empty results, incomplete identity, and caller aborts are deterministic", async () => {
  const { exports } = await loadModalModule();
  const Owner = exports.BookingSlotQueryOwner;
  const identity = exports.normalizeBookingSlotQueryIdentity("doctor-a", "branch-a", "2026-08-27");
  const owner = new Owner();
  const leaveLifecycle = owner.enterLifecycle(true);

  const firstPending = deferred();
  const first = recordRun(owner, identity, 0, firstPending);
  await Promise.resolve();
  const retryPending = deferred();
  const retry = recordRun(owner, identity, 1, retryPending);
  await Promise.resolve();
  assert.equal(first.signal.aborted, true);
  retryPending.resolve([]);
  await retry.execution.settled;
  firstPending.reject(new DOMException("Aborted", "AbortError"));
  await first.execution.settled;
  assert.deepEqual(first.events.map(([event]) => event), ["start"]);
  assert.deepEqual(retry.events.map(([event]) => event), ["start", "success", "finally"]);
  assert.deepEqual(retry.events[1][2], []);

  const incompletePending = deferred();
  const incomplete = recordRun(
    owner,
    exports.normalizeBookingSlotQueryIdentity("", "branch-a", "2026-08-27"),
    1,
    incompletePending,
  );
  await incomplete.execution.settled;
  assert.equal(incomplete.loadCalls, 0);
  assert.deepEqual(incomplete.events.map(([event]) => event), ["idle", "finally"]);
  leaveLifecycle();

  const apiSource = await readFile(apiPath, "utf8");
  let forwardedSignal;
  const fetchPromise = deferred();
  const api = transpileModule(apiSource, "api.ts", {}, {
    fetch: (_url, init) => {
      forwardedSignal = init.signal;
      forwardedSignal.addEventListener("abort", () => {
        fetchPromise.reject(new DOMException("Aborted", "AbortError"));
      }, { once: true });
      return fetchPromise.promise;
    },
  });
  const caller = new AbortController();
  const request = api.fetchDoctorSlots("doctor-a", "branch-a", "2026-08-27", caller.signal);
  caller.abort();
  await assert.rejects(request, (error) => error?.name === "AbortError");
  assert.equal(forwardedSignal.aborted, true);
});

test("a current retry error preserves authoritative slots and selection until success says otherwise", async () => {
  const { exports } = await loadModalModule();
  const identity = exports.normalizeBookingSlotQueryIdentity("doctor-a", "branch-a", "2026-08-27");
  const attempt = {
    active: true,
    identityKey: identity.key,
    lifecycleEpoch: 1,
    attemptSequence: 2,
    retryNonce: 1,
  };
  const slots = [
    availableSlot("branch-a", "08:00:00"),
    availableSlot("branch-a", "09:00:00"),
  ];
  const queryBeforeError = {
    identityKey: identity.key,
    attemptSequence: 2,
    retryNonce: 1,
    loading: true,
    slots,
    error: "",
  };
  const selectedBeforeError = { identityKey: identity.key, startTime: "09:00:00" };

  const queryAfterError = exports.reduceBookingSlotQueryState(queryBeforeError, {
    type: "ERROR",
    attempt,
    message: "safe retry error",
  });
  const selectedAfterError = exports.reduceBookingSlotSelectionState(selectedBeforeError, {
    type: "ERROR",
    attempt,
  });
  assert.deepEqual(queryAfterError.slots, slots);
  assert.equal(queryAfterError.error, "safe retry error");
  assert.deepEqual(selectedAfterError, selectedBeforeError);

  const selectedAfterRecovery = exports.reduceBookingSlotSelectionState(selectedAfterError, {
    type: "SUCCESS",
    attempt,
    slots,
    branchId: "branch-a",
  });
  assert.equal(selectedAfterRecovery.startTime, "09:00:00");

  const selectedAfterAuthoritativeEmpty = exports.reduceBookingSlotSelectionState(selectedAfterRecovery, {
    type: "SUCCESS",
    attempt,
    slots: [],
    branchId: "branch-a",
  });
  assert.equal(selectedAfterAuthoritativeEmpty.startTime, "");
});
