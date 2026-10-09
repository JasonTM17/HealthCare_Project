import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../", import.meta.url));
const cache = new Map();
const defaultRequests = [];
class ApiError extends Error {
  constructor(message, status, path) { super(message); this.status = status; this.path = path; this.fieldErrors = {}; }
}
const actorId = "00000000-0000-0000-0000-000000000001";
const targetId = "00000000-0000-0000-0000-000000000002";
const doctorId = "00000000-0000-0000-0000-000000000003";
const timestamp = "2026-10-09T00:34:12.123456Z";
function account(overrides = {}) {
  return { id: targetId, email: "patient@example.test", displayName: "Nguyễn An", status: "ACTIVE", roles: ["PATIENT"], emailVerified: false, emailVerifiedAt: null, demo: false, createdAt: "2026-10-08T11:00:00+07:00", updatedAt: timestamp, version: 3, doctorProfile: null, patientProfileId: null, googleLinked: false, ...overrides };
}
function load(relative) {
  let path = resolve(root, relative);
  if (!existsSync(path)) path += existsSync(`${path}.ts`) ? ".ts" : ".tsx";
  if (cache.has(path)) return cache.get(path);
  if (path.endsWith("api-client.ts")) return {
    ApiError, requestAdminJson: async (...args) => { defaultRequests.push(args); return account(); },
    adminListDoctors: async () => { throw new Error("SSR must not request doctors"); },
    readAuthSession: () => null, getServerAuthSessionSnapshot: () => null,
    subscribeToAuthSession: () => () => {}, hydrateAuthSession: async () => {},
  };
  if (path.endsWith(".css")) return {};
  const source = readFileSync(path, "utf8");
  const compiled = ts.transpileModule(source, { fileName: path, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } });
  const loadedModule = { exports: {} };
  cache.set(path, loadedModule.exports);
  new Function("require", "module", "exports", compiled.outputText)((name) => name.startsWith(".") ? load(resolve(dirname(path), name)) : require(name), loadedModule, loadedModule.exports);
  cache.set(path, loadedModule.exports);
  return loadedModule.exports;
}
const client = load("lib/admin-users-client.ts");
const state = load("app/admin/users/account-form-state.ts");
const { default: AccountPanel, AccountTime } = load("app/admin/users/account-panel.tsx");
const { default: AdminUsersPage, AdminUsersContent } = load("app/admin/users/page.tsx");

test("actual DTO parser preserves exact instant/epoch and retains only explicit safe fields", () => {
  const result = client.parseAdminAccount(account({ passwordHash: "must-never-reach-ui", googleSubject: "private", refreshToken: "private", lastLogin: "guessed" }));
  assert.equal(result.updatedAt, timestamp);
  assert.equal(result.version, 3);
  for (const forbidden of ["passwordHash", "googleSubject", "refreshToken", "lastLogin"]) assert.equal(Object.hasOwn(result, forbidden), false);
  assert.equal(result.emailVerifiedAt, null);
  assert.equal(result.doctorProfile, null);
});
test("malformed account facts, tokens and page shapes fail closed without invented defaults", () => {
  for (const patch of [{ roles: [] }, { roles: ["PATIENT", "PATIENT"] }, { roles: ["OWNER"] }, { status: "LOCKED" }, { demo: "false" }, { updatedAt: null }, { updatedAt: "today" }, { version: -1 }, { doctorProfile: {} }, { emailVerifiedAt: "yesterday" }]) assert.throws(() => client.parseAdminAccount(account(patch)), ApiError);
  assert.throws(() => client.parseAccountPage({ content: [account()], number: 0, size: 0, totalElements: 1, totalPages: 1 }), ApiError);
});
test("inventory query uses real filters, authoritative page totals and cancellation", async () => {
  const controller = new AbortController(); let captured;
  const api = new client.AdminUsersClient(async (path, init) => { captured = { path, init }; return { content: [account()], number: 2, size: 20, totalElements: 101, totalPages: 6 }; });
  const page = await api.list({ q: "An %_", role: "PATIENT", verified: false, demo: false, page: 2, size: 20 }, controller.signal);
  const url = new URL(captured.path, "https://example.test");
  assert.equal(url.pathname, "/admin/users"); assert.equal(url.searchParams.get("q"), "An %_");
  assert.equal(url.searchParams.get("verified"), "false"); assert.equal(url.searchParams.get("demo"), "false");
  assert.equal(url.searchParams.get("sort"), "createdAt"); assert.equal(url.searchParams.get("direction"), "desc");
  assert.equal(captured.init.signal, controller.signal);
  assert.equal(page.totalElements, 101); assert.equal(page.totalPages, 6); assert.equal(page.number, 2);
});
test("page metadata coherence, bounded number and unique identities reject malformed inventory", async () => {
  const valid = { content: [account()], number: 0, size: 20, totalElements: 1, totalPages: 1 };
  for (const patch of [{ totalPages: 2 }, { number: 10001 }, { content: [account(), account()], totalElements: 2 }, { size: 0 }]) assert.throws(() => client.parseAccountPage({ ...valid, ...patch }), ApiError);
  const outOfRange = client.parseAccountPage({ content: [], number: 3, size: 20, totalElements: 0, totalPages: 0 });
  assert.equal(outOfRange.number, 3);
  for (const patch of [{ number: 1 }, { size: 50 }]) {
    const api = new client.AdminUsersClient(async () => ({ ...valid, ...patch }));
    await assert.rejects(api.list({ page: 0, size: 20 }), ApiError);
  }
});
test("business-day filters use inclusive start and exclusive next-day +07 boundary", () => {
  assert.deepEqual(client.accountDateBounds("2026-10-08", "2026-10-09"), { createdFrom: "2026-10-07T17:00:00.000Z", createdTo: "2026-10-09T17:00:00.000Z" });
  assert.throws(() => client.accountDateBounds("2026-02-30", ""));
  assert.throws(() => client.accountDateBounds("2026-10-10", "2026-10-09"));
});
test("default transport delegates to the established requestAdminJson lane", async () => {
  await new client.AdminUsersClient().get(targetId);
  assert.equal(defaultRequests.at(-1)[0], `/admin/users/${targetId}`);
});
test("creation submits real password/roles/profile DTO and reports delivery unconfirmed", async () => {
  const sent = []; const api = new client.AdminUsersClient(async (path, init) => { sent.push({ path, init }); return { account: account(), action: "CREATED", deliveryState: "REQUESTED_UNCONFIRMED" }; });
  const initial = state.accountForm(null);
  assert.deepEqual(initial.roles, ["PATIENT"]);
  const result = await api.create({ email: " patient@example.test ", displayName: " Nguyễn An ", password: "Patient123", roles: initial.roles });
  assert.equal(result.account.emailVerified, false); assert.equal(result.deliveryState, "REQUESTED_UNCONFIRMED");
  assert.deepEqual(JSON.parse(sent[0].init.body), { email: "patient@example.test", displayName: "Nguyễn An", password: "Patient123", roles: ["PATIENT"] });
  assert.equal(sent[0].init.method, "POST");
  await assert.rejects(api.create({ email: "doctor@example.test", displayName: "Bác sĩ An", password: "Doctor123", roles: ["DOCTOR"] }), ApiError);
  await assert.rejects(api.create({ email: "patient@example.test", displayName: "Nguyễn An", password: "漢".repeat(24) + "A1", roles: ["PATIENT"] }), ApiError);
  assert.equal(sent.length, 1);
});
test("full update preserves microsecond expected token and never serializes password/demo/verification", async () => {
  let body; const api = new client.AdminUsersClient(async (_, init) => { body = JSON.parse(init.body); return account({ displayName: "Nguyễn Bình" }); });
  const baseline = client.parseAdminAccount(account());
  const buffer = { baseline, form: { ...state.accountForm(baseline), displayName: "Nguyễn Bình", password: "do-not-update" } };
  const result = await api.update(targetId, state.accountUpdatePayload(buffer));
  assert.equal(body.expectedUpdatedAt, timestamp); assert.equal(body.expectedVersion, 3); assert.equal(body.status, "ACTIVE");
  assert.deepEqual(body.roles, ["PATIENT"]); assert.equal(body.unlinkDoctorProfile, false); assert.equal(result.displayName, "Nguyễn Bình");
  for (const key of ["password", "demo", "emailVerified", "emailVerifiedAt", "doctorProfileId"]) assert.equal(Object.hasOwn(body, key), false);
});
test("profile preservation, replacement and explicit unlink serialize distinct truthful intents", () => {
  const baseline = client.parseAdminAccount(account({ roles: ["DOCTOR"], doctorProfile: { id: doctorId, slug: "bac-si-an", fullName: "Bác sĩ An", active: true }, displayName: "Bác sĩ An" }));
  const buffer = { baseline, form: state.accountForm(baseline) };
  assert.equal(Object.hasOwn(state.accountUpdatePayload(buffer), "doctorProfileId"), false);
  buffer.form = { ...buffer.form, roles: ["PATIENT"], unlinkDoctorProfile: true };
  assert.equal(state.accountUpdatePayload(buffer).unlinkDoctorProfile, true);
  buffer.form = { ...buffer.form, roles: ["DOCTOR"], doctorProfileId: targetId, unlinkDoctorProfile: false };
  assert.equal(state.accountUpdatePayload(buffer).doctorProfileId, targetId);
});
test("rejected/conflicting mutation neither changes the buffer nor retries automatically", async () => {
  const baseline = client.parseAdminAccount(account()); const form = { ...state.accountForm(baseline), email: "new@example.test", displayName: "Tên đang sửa" };
  const buffer = { baseline, form }; const before = JSON.stringify(buffer); let calls = 0;
  const api = new client.AdminUsersClient(async () => { ++calls; throw new ApiError("Account changed; reload its latest details before saving", 409, "/admin/users"); });
  await assert.rejects(api.update(targetId, state.accountUpdatePayload(buffer)), ApiError);
  assert.equal(calls, 1); assert.equal(JSON.stringify(buffer), before); assert.equal(state.accountFormDirty(buffer), true);
  const latest = client.parseAdminAccount(account({ updatedAt: "2026-10-09T00:35:00.987654Z", version: 4 }));
  const kept = state.reconcileAccountBuffer(buffer, latest, true);
  assert.equal(kept.form, form); assert.equal(state.accountUpdatePayload(kept).expectedUpdatedAt, latest.updatedAt);
  assert.equal(state.accountFormDirty(state.reconcileAccountBuffer(buffer, latest, false)), false);
  assert.throws(() => state.reconcileAccountBuffer(buffer, { ...latest, id: actorId }, true));
});
test("credential lifecycle uses actual POST endpoints and exact concurrency tokens", async () => {
  const sent = []; const api = new client.AdminUsersClient(async (path, init) => { const action = path.split("/").at(-1); sent.push({ path, init }); return { account: account(), action, deliveryState: action === "revoke-sessions" ? "NOT_APPLICABLE" : "REQUESTED_UNCONFIRMED" }; });
  for (const action of ["verification", "password-reset", "revoke-sessions"]) await api.action(targetId, action, client.expectedAccount(client.parseAdminAccount(account())));
  assert.deepEqual(sent.map((entry) => entry.path), ["verification", "password-reset", "revoke-sessions"].map((action) => `/admin/users/${targetId}/${action}`));
  for (const entry of sent) { assert.equal(entry.init.method, "POST"); assert.deepEqual(JSON.parse(entry.init.body), { expectedVersion: 3, expectedUpdatedAt: timestamp }); }
});
test("invented delivered/verified results and wrong target responses are rejected", async () => {
  const wrongDelivery = new client.AdminUsersClient(async () => ({ account: account(), action: "verification", deliveryState: "SENT" }));
  await assert.rejects(wrongDelivery.action(targetId, "verification", { expectedVersion: 3, expectedUpdatedAt: timestamp }), ApiError);
  const wrongTarget = new client.AdminUsersClient(async () => account({ id: actorId }));
  await assert.rejects(wrongTarget.get(targetId), ApiError);
  await assert.rejects(wrongTarget.get("../admin"), ApiError);
});
test("safe rejection copy identifies governance/profile refusals without provider internals", () => {
  assert.match(client.accountError(new ApiError("The final active verified administrator must remain available", 409, "")), /ít nhất một quản trị viên/);
  assert.match(client.accountError(new ApiError("Doctor profile is already linked to another account", 409, "")), /tài khoản khác/);
  assert.doesNotMatch(client.accountError(new ApiError("smtp-password-secret internal trace", 500, "")), /smtp|secret|trace/);
});
test("actual detail rendering includes source timestamps, multi-role labels and demo read-only controls", () => {
  const actor = client.parseAdminAccount(account({ id: actorId, roles: ["ADMIN"], emailVerified: true }));
  const target = client.parseAdminAccount(account({ roles: ["PATIENT", "ADMIN"], emailVerified: true, emailVerifiedAt: null, demo: true }));
  const html = renderToStaticMarkup(React.createElement(AccountPanel, { initial: target, actor, onClose() {}, onChanged() {} }));
  assert.match(html, /dateTime="2026-10-09T00:34:12.123456Z"/i);
  assert.match(html, /Đã xác minh; thời điểm chưa có dữ liệu/); assert.match(html, /chỉ có thể xem/);
  assert.match(html, /fieldset disabled/); assert.match(html, /Bệnh nhân/); assert.match(html, /Quản trị viên/);
  assert.doesNotMatch(html, /lastLogin|passwordHash|Chưa gửi thành công/);
  const missing = renderToStaticMarkup(React.createElement(AccountTime, { value: null })); assert.match(missing, /Chưa có dữ liệu/);
  const demotedActor = { ...actor, roles: ["PATIENT"] };
  const demoted = renderToStaticMarkup(React.createElement(AccountPanel, { initial: { ...target, demo: false }, actor: demotedActor, onClose() {}, onChanged() {} }));
  assert.match(demoted, /Chưa xác minh được quyền thay đổi/); assert.match(demoted, /fieldset disabled/);
});
test("actual inventory renders safely before actor/session metadata exists and disables creation", () => {
  // The page-level Suspense boundary renders the fallback while search params
  // resolve; the inventory SSR contract lives on the content component.
  const fallback = renderToStaticMarkup(React.createElement(AdminUsersPage));
  assert.match(fallback, /Đang tải bộ lọc tài khoản/);
  const html = renderToStaticMarkup(React.createElement(AdminUsersContent, { initialStatus: "" }));
  assert.match(html, /Tài khoản/); assert.match(html, /disabled=""[^>]*>Tạo tài khoản/); assert.match(html, /Đang cập nhật danh sách/);
});
