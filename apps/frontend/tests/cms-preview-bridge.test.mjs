import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const loaded = new Map();
function load(name) {
  if (loaded.has(name)) return loaded.get(name);
  const source = readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", code)((id) => { assert.ok(id.startsWith("./")); return load(id.slice(2)); }, loadedModule, loadedModule.exports);
  loaded.set(name, loadedModule.exports);
  return loadedModule.exports;
}
const { resolveCmsPageIdentity } = load("cms-page-manifest");
const { createNativeCmsLayout } = load("cms-page-layout");
const bridge = load("cms-preview-bridge");
const identity = resolveCmsPageIdentity("/");
const source = {};
const channel = "00000000-0000-4000-8000-000000000011";
const base = { protocol: bridge.CMS_PREVIEW_PROTOCOL, channel, slotKey: identity.slotKey, path: identity.canonicalPath, revision: 1 };
const expected = { origin: "https://healthcare.example", source, channel, identity, lastRevision: 0, currentRevision: 1 };
const event = (data, overrides = {}) => ({ data, origin: expected.origin, source, ...overrides });
const render = () => ({ ...base, type: "render", mode: "draft", layout: createNativeCmsLayout(identity) });

test("preview URLs require one exact channel and flag", () => {
  assert.equal(bridge.cmsPreviewUrl(identity, channel), `/?cmsPreview=1&cmsChannel=${channel}`);
  assert.deepEqual(bridge.readCmsPreviewRequest(`?cmsPreview=1&cmsChannel=${channel}`), { channel });
  for (const query of ["", "?cmsPreview=1", `?cmsPreview=1&cmsPreview=1&cmsChannel=${channel}`, `?cmsPreview=0&cmsChannel=${channel}`, `?cmsPreview=1&cmsChannel=${channel}&cmsChannel=${channel}`, "?cmsPreview=1&cmsChannel=*"]) assert.equal(bridge.readCmsPreviewRequest(query), null);
});
test("host messages require exact origin, window, channel, route and increasing revision", () => {
  assert.equal(bridge.parseCmsPreviewHostMessage(event(render()), expected).type, "render");
  for (const overrides of [{ origin: "https://evil.example" }, { source: {} }, { source: null }]) assert.equal(bridge.parseCmsPreviewHostMessage(event(render(), overrides), expected), null);
  for (const change of [{ channel: "other" }, { slotKey: "doctors.layout" }, { path: "/about" }, { revision: 0 }, { revision: 1.5 }, { revision: Infinity }, { protocol: "other" }, { mode: "execute" }, { token: "must-never-travel" }]) assert.equal(bridge.parseCmsPreviewHostMessage(event({ ...render(), ...change }), expected), null);
  assert.equal(bridge.parseCmsPreviewHostMessage(event(render()), { ...expected, lastRevision: 1 }), null);
});
test("frame rendering validates native fields and rejects raw HTML and cross-entity facts", () => {
  for (const fields of [{ "hero.title": { kind: "text", value: "<script>alert(1)</script>" } }, { "profile.fullName": { kind: "text", value: "Injected doctor" } }, { "hero.image": { kind: "image", src: "javascript:alert(1)", alt: "x" } }]) assert.equal(bridge.parseCmsPreviewHostMessage(event({ ...render(), layout: { ...createNativeCmsLayout(identity), fields } }), expected), null);
  const doctor = resolveCmsPageIdentity("/doctors/test", "00000000-0000-4000-8000-000000000001");
  assert.equal(bridge.parseCmsPreviewHostMessage(event(render()), { ...expected, identity: doctor }), null);
});
test("field selection belongs to current rendered revision and validates its declared kind", () => {
  const selection = { ...base, type: "selected", fieldId: "hero.title", nativeValue: { kind: "text", value: "Đồng hành cùng gia đình" } };
  assert.equal(bridge.parseCmsPreviewFrameMessage(event(selection), expected).fieldId, "hero.title");
  for (const change of [{ revision: 0 }, { revision: 2 }, { fieldId: "doctor.fullName" }, { nativeValue: { kind: "image", src: "/media/x.jpg", alt: "x" } }, { nativeValue: { kind: "text", value: "<img>" } }, { command: "publish" }]) assert.equal(bridge.parseCmsPreviewFrameMessage(event({ ...selection, ...change }), expected), null);
});
test("ready is accepted once before render; stale readiness cannot reset an active bridge", () => {
  const ready = { ...base, type: "ready", revision: 0, expectedVersion: 4 };
  assert.equal(bridge.parseCmsPreviewFrameMessage(event(ready), { ...expected, currentRevision: 0 }).expectedVersion, 4);
  assert.equal(bridge.parseCmsPreviewFrameMessage(event(ready), expected), null);
  assert.equal(bridge.parseCmsPreviewFrameMessage(event({ ...ready, expectedVersion: -1 }), { ...expected, currentRevision: 0 }), null);
});
test("focus cannot carry selectors or executable commands", () => {
  const focus = { ...base, type: "focus", fieldId: "hero.title" };
  assert.equal(bridge.parseCmsPreviewHostMessage(event(focus), expected).fieldId, "hero.title");
  assert.equal(bridge.parseCmsPreviewHostMessage(event({ ...focus, fieldId: "body input" }), expected), null);
  assert.equal(bridge.parseCmsPreviewHostMessage(event({ ...focus, script: "publish()" }), expected), null);
});

function guardRuntime(search) {
  const calls = [];
  const listeners = new Map();
  class Xhr { open(...args) { calls.push(["xhr", ...args]); } }
  class Form { submit() { calls.push(["form"]); } requestSubmit() { calls.push(["form"]); } }
  class Element { constructor(field = false, control = true) { this.field = field; this.control = control; } closest(selector) { return selector.includes("data-cms-native-field") ? this.field : this.control; } }
  const window = { location: { search, href: `https://healthcare.example/${search}`, origin: "https://healthcare.example" }, fetch: async (...args) => { calls.push(["fetch", ...args]); return { ok: true }; }, dispatchEvent: (event) => calls.push(["event", event.type]) };
  const navigator = { sendBeacon: (...args) => { calls.push(["beacon", ...args]); return true; } };
  const document = { addEventListener: (name, listener) => listeners.set(name, listener) };
  vm.runInNewContext(readFileSync(new URL("../public/cms-preview-guard.js", import.meta.url), "utf8"), { window, navigator, document, XMLHttpRequest: Xhr, HTMLFormElement: Form, Element, URL, URLSearchParams, Request, DOMException, Event });
  return { window, navigator, Xhr, Form, Element, listeners, calls };
}
test("guard preserves normal visits but blocks programmatic preview mutations before hydration", async () => {
  const normal = guardRuntime("");
  await normal.window.fetch("/api/v1/appointments", { method: "POST" });
  assert.equal(normal.calls.length, 1);
  const preview = guardRuntime("?cmsPreview=invalid");
  for (const [url, method] of [["/api/v1/appointments", "POST"], ["/api/v1/feedback", "POST"], ["/api/v1/admin/cms/content/homepage.layout/draft", "PUT"], ["/api/v1/appointments/lookup", "GET"], ["https://evil.example", "GET"], ["/api/v1/auth/session", "POST"]]) await assert.rejects(preview.window.fetch(url, { method }), { name: "NotAllowedError" });
  assert.equal(preview.navigator.sendBeacon("/api/v1/feedback", "x"), false);
  assert.throws(() => new preview.Xhr().open("POST", "/api/v1/appointments"), { name: "NotAllowedError" });
  assert.throws(() => new preview.Form().submit(), { name: "NotAllowedError" });
  assert.throws(() => new preview.Form().requestSubmit(), { name: "NotAllowedError" });
  assert.equal(preview.calls.length, 0);
});
test("guard permits only required read lanes and cancels preview form/control defaults", async () => {
  const runtime = guardRuntime("?cmsPreview=1");
  for (const url of ["/api/v1/hospital/doctors?page=0", "/api/v1/hospital/health-questions", "/api/v1/careers/jobs", "/api/v1/cms/content/homepage.hero", "/api/v1/admin/cms/content/homepage.layout/draft", "/api/v1/auth/session", "/api/v1/auth/browser-sessions/current", "/_next/static/x.js"]) await runtime.window.fetch(url);
  assert.equal(runtime.calls.filter((call) => call[0] === "fetch").length, 8);
  await assert.rejects(runtime.window.fetch("/api/v1/auth/browser-sessions/current", { method: "DELETE" }), { name: "NotAllowedError" });
  for (const url of ["/api/v1/feedback/my", "/api/v1/admin/users", "/api/v1/careers/applications", "/api/v1/hospital/health-questions/private"]) await assert.rejects(runtime.window.fetch(url), { name: "NotAllowedError" });
  for (const name of ["submit", "click", "keydown"]) {
    let prevented = false; let stopped = false;
    runtime.listeners.get(name)({ key: "Enter", target: new runtime.Element(), preventDefault: () => { prevented = true; }, stopImmediatePropagation: () => { stopped = true; } });
    assert.equal(prevented, true); assert.equal(stopped, true);
  }
  let prevented = false;
  runtime.listeners.get("click")({ target: new runtime.Element(true), preventDefault: () => { prevented = true; }, stopImmediatePropagation: () => assert.fail("Native selection must remain reachable") });
  assert.equal(prevented, true);
});

test("history guard cancels a supported dirty traversal until an explicit decision, without replacing routing", async () => {
  const { installAdminHistoryGuard } = load("admin-history-guard");
  class Navigation extends EventTarget {
    calls = [];
    traverseTo(key) { this.calls.push(key); return { finished: Promise.resolve() }; }
  }
  const navigation = new Navigation();
  let blocked = true; let busy = false; let proceed;
  const guard = installAdminHistoryGuard({ target: { navigation }, isBlocked: () => blocked, isBusy: () => busy, onRequestLeave: (resume) => { proceed = resume; } });
  const dispatch = (overrides = {}) => {
    const { cancelable = true, ...properties } = overrides;
    const event = new Event("navigate", { cancelable });
    Object.assign(event, { navigationType: "traverse", destination: { key: "previous-entry", sameDocument: true }, ...properties });
    navigation.dispatchEvent(event); return event;
  };
  assert.equal(guard.supported, true);
  assert.equal(dispatch().defaultPrevented, true);
  assert.deepEqual(navigation.calls, []);
  assert.equal(dispatch({ navigationType: "push" }).defaultPrevented, false);
  assert.equal(dispatch({ destination: { key: "other", sameDocument: false } }).defaultPrevented, false);
  assert.equal(dispatch({ cancelable: false }).defaultPrevented, false);
  blocked = false;
  assert.equal(dispatch().defaultPrevented, false);
  blocked = true; busy = true; proceed = undefined;
  assert.equal(dispatch().defaultPrevented, true);
  assert.equal(proceed, undefined);
  busy = false; dispatch(); proceed();
  assert.deepEqual(navigation.calls, ["previous-entry"]);
  assert.equal(dispatch().defaultPrevented, false, "Explicit replay uses the same navigation, not a new URL");
  guard.dispose();
  assert.equal(installAdminHistoryGuard({ target: {}, isBlocked: () => true, isBusy: () => false, onRequestLeave: () => assert.fail() }).supported, false);
});
