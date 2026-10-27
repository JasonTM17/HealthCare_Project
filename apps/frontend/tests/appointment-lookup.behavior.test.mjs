import assert from "node:assert/strict";
import { after, before, test as nodeTest } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { chromium } from "@playwright/test";

// Rendered-component regression for the guest appointment lookup page
// (/tra-cuu), following the fixture-harness conventions of
// auth-autofill.behavior.test.mjs: the real transpiled page mounts in
// Playwright Chromium, relative imports are stubbed, global fetch is recorded
// and answered from canned rules, and form values reach React through the DOM.
//
// The public lookup response intentionally masks the guest phone and drops the
// email. The registration bridge must therefore reuse the contact phone the
// guest actually submitted for the successful lookup — not the masked ticket
// fields — and cancel must send that same proven phone even if the search form
// was edited after the ticket rendered.

const require = createRequire(import.meta.url);
const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = process.env.TRACUU_SOURCE_ROOT ?? frontendRoot;
const sources = {};
for (const [name, file] of [
  ["react", "react/cjs/react.development.js"],
  ["react/jsx-runtime", "react/cjs/react-jsx-runtime.development.js"],
  ["react-dom", "react-dom/cjs/react-dom.development.js"],
  ["react-dom/client", "react-dom/cjs/react-dom-client.development.js"],
  ["scheduler", "scheduler/cjs/scheduler.development.js"],
]) {
  const packageName = file.split("/")[0];
  sources[name] = readFileSync(path.join(path.dirname(require.resolve(packageName)), file.slice(packageName.length + 1)), "utf8");
}

function addComponent(relative) {
  if (sources[relative]) return;
  const filename = path.join(sourceRoot, relative);
  let compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  compiled = compiled.replace(/require\("([^"]+)"\)/g, (original, specifier) => {
    if (!specifier.startsWith(".")) return original;
    for (const [suffix, stub] of [
      ["UiIcon", "fixture-icon"],
      ["PublicPageShell", "fixture-shell"],
      ["useDialogFocus", "fixture-dialog-focus"],
      ["types/hospital", "fixture-types"],
      ["appointment-calendar", "fixture-calendar"],
      ["cms-preview-bridge", "fixture-cms-preview"],
      ["cms-page-layout-provider", "fixture-cms"],
    ]) {
      if (specifier.endsWith(suffix)) return `require(${JSON.stringify(stub)})`;
    }
    const target = path.resolve(path.dirname(filename), specifier);
    const resolved = [target + ".tsx", target + ".ts"].find(existsSync);
    assert.ok(resolved, `fixture dependency not mapped: ${specifier}`);
    const dependency = path.relative(sourceRoot, resolved).replaceAll("\\", "/");
    addComponent(dependency);
    return `require(${JSON.stringify(dependency)})`;
  });
  sources[relative] = compiled;
}
addComponent("app/tra-cuu/page.tsx");

const fixture = `
globalThis.process = { env: { NODE_ENV: "development" } };
const sources = ${JSON.stringify(sources)};
const cache = {};
const stubs = {};
function require(name) {
  if (stubs[name]) return stubs[name];
  if (cache[name]) return cache[name].exports;
  if (!sources[name]) throw new Error("Unmapped fixture module: " + name);
  const mod = { exports: {} }; cache[name] = mod;
  new Function("require", "module", "exports", sources[name])(require, mod, mod.exports);
  return mod.exports;
}
const React = require("react");
const ReactDOM = require("react-dom");
const root = require("react-dom/client").createRoot(document.getElementById("root"));
const control = window.lookupFixture = { fetches: [], rules: [] };
control.reset = (setup) => {
  control.fetches = [];
  control.rules = (setup && setup.rules) || [];
};
window.fetch = (url, init) => {
  const entry = { url: String(url), method: (init && init.method) || "GET" };
  if (init && init.body) { try { entry.body = JSON.parse(init.body); } catch { entry.body = init.body; } }
  control.fetches.push(entry);
  const rule = control.rules.find((r) => entry.url.includes(r.urlIncludes) && (!r.method || r.method === entry.method));
  if (!rule) return Promise.resolve({ ok: false, status: 599, json: async () => ({ message: "unstubbed fetch: " + entry.url }) });
  return Promise.resolve({ ok: rule.ok, status: rule.status, json: async () => JSON.parse(JSON.stringify(rule.body)) });
};
const passthrough = (tag) => ({ children, ...props }) => React.createElement(tag, props, children);
stubs["next/link"] = { __esModule: true, default: passthrough("a") };
stubs["fixture-icon"] = { __esModule: true, default: () => null };
stubs["fixture-shell"] = {
  __esModule: true,
  PublicPageShell: passthrough("div"),
  PublicAiButton: passthrough("button"),
  PublicBookingButton: passthrough("button"),
};
stubs["fixture-dialog-focus"] = { __esModule: true, default: () => {} };
stubs["fixture-types"] = {};
stubs["fixture-calendar"] = { buildGoogleCalendarUrl: () => "https://calendar.fixture/add", downloadIcsFile: () => {} };
stubs["fixture-cms-preview"] = { isCmsPreviewRequested: () => false };
stubs["fixture-cms"] = {
  __esModule: true,
  CmsNativeSections: passthrough("div"),
  CmsNativeSection: passthrough("div"),
  CmsNativeText: ({ as: Tag = "span", value, children, fieldId, ...rest }) => React.createElement(Tag, rest, value ?? children),
};
control.render = (module) => {
  const Component = require(module).default;
  ReactDOM.flushSync(() => root.render(React.createElement(Component)));
};
`;

const hasChromium = existsSync(chromium.executablePath());
let browser;
before(async () => {
  if (!hasChromium) return;
  browser = await chromium.launch({ headless: true });
});
after(async () => {
  if (browser) await browser.close();
});

const test = (name, fn) => nodeTest(name, { skip: !hasChromium ? "Playwright Chromium not installed" : false }, fn);

// The masked payload exactly as the public guest endpoint delivers it: the
// phone is starred out and the email is absent, so neither can feed a prefill.
const MASKED_APPOINTMENT = {
  id: "42",
  bookingCode: "APT-9F3A12",
  patientName: "Nguyen Van A",
  patientPhone: "090****001",
  patientEmail: null,
  doctorId: "d-7",
  doctorName: "BS. Tran Thi B",
  specialtyName: "Nội tổng quát",
  branchName: "Cơ sở Quận 1",
  branchAddress: "12 Đường ABC, Quận 1",
  appointmentDate: "2026-11-02",
  startTime: "09:00:00",
  endTime: "09:30:00",
  status: "CONFIRMED",
  paymentStatus: "UNPAID",
  reasonForVisit: "Đau đầu kéo dài",
  hasInsurance: false,
  createdAt: "2026-10-27T08:00:00Z",
};

const SECOND_APPOINTMENT = {
  ...MASKED_APPOINTMENT,
  id: "77",
  bookingCode: "APT-77BB22",
  patientPhone: "090****321",
};

const okRule = (body = MASKED_APPOINTMENT) => ({
  urlIncludes: "/api/v1/appointments/",
  method: "GET",
  ok: true,
  status: 200,
  body,
});
const failRule = {
  urlIncludes: "/api/v1/appointments/",
  method: "GET",
  ok: false,
  status: 404,
  body: { message: "Không tìm thấy lịch hẹn." },
};
const cancelOkRule = {
  urlIncludes: "/cancel",
  method: "POST",
  ok: true,
  status: 200,
  body: {},
};

const HERO_CTA = '[data-testid="tra-cuu-register-cta-hero"]';
const TICKET_CTA = '[data-testid="tra-cuu-register-cta-ticket"]';

async function mount(setup = {}) {
  const page = await browser.newPage();
  page.setDefaultTimeout(4000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) => route.abort());
  await page.setContent('<!doctype html><html lang="vi"><body><div id="root"></div></body></html>');
  await page.addScriptTag({ content: fixture });
  await page.evaluate((setup) => { lookupFixture.reset(setup); lookupFixture.render("app/tra-cuu/page.tsx"); }, setup);
  await page.locator("#appointment-booking-code").waitFor();
  return { page, errors };
}

async function domFill(page, values) {
  await page.evaluate((values) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    for (const [selector, value] of Object.entries(values)) {
      const element = document.querySelector(selector);
      setter.call(element, value);
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }, values);
}

async function submit(page) {
  await page.evaluate(() => document.querySelector("form").requestSubmit());
}

async function ctaParams(page, selector) {
  const href = await page.locator(selector).getAttribute("href");
  assert.ok(href, `${selector} must render an href`);
  return new URL(href, "https://fixture.local").searchParams;
}

test("before any lookup the hero CTA is a plain registration link", async () => {
  const { page, errors } = await mount();
  try {
    assert.equal(await page.locator(HERO_CTA).getAttribute("href"), "/auth/register");
    assert.equal(await page.locator(TICKET_CTA).count(), 0);
    assert.equal(errors.length, 0);
  } finally { await page.close(); }
});

test("a masked public ticket still bridges the submitted phone into both registration CTAs", async () => {
  const { page, errors } = await mount({ rules: [okRule()] });
  try {
    await domFill(page, { "#appointment-booking-code": " apt-9f3a12 ", "#appointment-phone": "+84 905 550 300" });
    await submit(page);
    await page.locator(TICKET_CTA).waitFor();

    // The lookup itself still submits the phone exactly as typed.
    const [lookupCall] = await page.evaluate(() => lookupFixture.fetches);
    assert.equal(lookupCall.method, "GET");
    assert.ok(lookupCall.url.startsWith("/api/v1/appointments/APT-9F3A12?"), `lookup url: ${lookupCall.url}`);
    assert.equal(new URL(lookupCall.url, "https://fixture.local").searchParams.get("phone"), "+84 905 550 300");

    for (const selector of [HERO_CTA, TICKET_CTA]) {
      const params = await ctaParams(page, selector);
      assert.equal(params.get("phone"), "+84 905 550 300", `${selector} must prefill the submitted phone`);
      assert.equal(params.get("email"), null, `${selector} must not manufacture or unmask an email`);
    }
    // The masked response value itself must never leak into the bridge.
    for (const selector of [HERO_CTA, TICKET_CTA]) {
      const href = await page.locator(selector).getAttribute("href");
      assert.ok(!href.includes("090"), `${selector} must not leak the masked response phone: ${href}`);
    }
    assert.equal(errors.length, 0);
  } finally { await page.close(); }
});

test("editing the search form after a successful lookup cannot retarget the CTAs or the cancel request", async () => {
  const { page, errors } = await mount({ rules: [okRule(), cancelOkRule] });
  try {
    await domFill(page, { "#appointment-booking-code": "APT-9F3A12", "#appointment-phone": "+84 905 550 300" });
    await submit(page);
    await page.locator(TICKET_CTA).waitFor();

    // The guest retypes the form while the found ticket stays on screen.
    await domFill(page, { "#appointment-booking-code": "APT-OTHER9", "#appointment-phone": "0919998877" });

    for (const selector of [HERO_CTA, TICKET_CTA]) {
      const params = await ctaParams(page, selector);
      assert.equal(params.get("phone"), "+84 905 550 300", `${selector} must keep the phone that was proven by the lookup`);
    }

    await page.getByRole("button", { name: "Hủy lịch hẹn này", exact: true }).click();
    await page.locator('[role="dialog"]').waitFor();
    await page.getByRole("button", { name: "Đồng ý hủy lịch", exact: true }).click();
    await page.waitForFunction(() => lookupFixture.fetches.some((f) => f.method === "POST"));
    const cancelCall = await page.evaluate(() => lookupFixture.fetches.find((f) => f.method === "POST"));
    assert.equal(cancelCall.url, "/api/v1/appointments/APT-9F3A12/cancel");
    assert.equal(cancelCall.body.phone, "+84 905 550 300", "cancel must send the phone that found the displayed ticket, not the edited input");
    assert.equal(errors.length, 0);
  } finally { await page.close(); }
});

test("a failed lookup clears the prefill and a new success carries only its own phone", async () => {
  const { page, errors } = await mount({ rules: [okRule()] });
  try {
    await domFill(page, { "#appointment-booking-code": "APT-9F3A12", "#appointment-phone": "+84 905 550 300" });
    await submit(page);
    await page.locator(TICKET_CTA).waitFor();
    assert.equal((await ctaParams(page, HERO_CTA)).get("phone"), "+84 905 550 300");

    // A subsequent failed lookup must not leave the first ticket's identity
    // attached to a different search.
    await page.evaluate(() => { lookupFixture.rules = [failRule]; });
    await domFill(page, { "#appointment-booking-code": "APT-NOT-REAL", "#appointment-phone": "0919998877" });
    await submit(page);
    await page.locator('div[role="alert"]').waitFor();
    assert.equal(await page.locator(HERO_CTA).getAttribute("href"), "/auth/register");
    assert.equal(await page.locator(TICKET_CTA).count(), 0);

    // A new successful lookup bridges only the phone that this lookup proved.
    await page.evaluate(() => { lookupFixture.rules = [okRule(SECOND_APPOINTMENT)]; });
    await domFill(page, { "#appointment-booking-code": "APT-77BB22", "#appointment-phone": "0907654321" });
    await submit(page);
    await page.locator(TICKET_CTA).waitFor();
    for (const selector of [HERO_CTA, TICKET_CTA]) {
      const params = await ctaParams(page, selector);
      assert.equal(params.get("phone"), "0907654321", `${selector} must carry only the newly proven phone`);
      assert.equal(params.get("email"), null, `${selector} must not carry an email`);
    }
    assert.equal(errors.length, 0);
  } finally { await page.close(); }
});

test("a malformed submitted phone is rejected locally without a lookup request", async () => {
  const { page, errors } = await mount({ rules: [okRule()] });
  try {
    await domFill(page, { "#appointment-booking-code": "APT-9F3A12", "#appointment-phone": "09--" });
    await submit(page);
    await page.getByText("Số điện thoại chưa đúng định dạng", { exact: false }).waitFor();
    assert.equal(await page.evaluate(() => lookupFixture.fetches.length), 0, "validation must block the fetch");
    assert.equal(await page.locator(HERO_CTA).getAttribute("href"), "/auth/register");
    assert.equal(errors.length, 0);
  } finally { await page.close(); }
});
