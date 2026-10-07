import assert from "node:assert/strict";
import { after, before, test as nodeTest } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { chromium } from "@playwright/test";

const require = createRequire(import.meta.url);
const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = process.env.REGISTER_SOURCE_ROOT ?? frontendRoot;
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
    if (specifier.endsWith(".css")) return 'require("fixture-css")';
    for (const [suffix, stub] of [
      ["api-client", "fixture-api"], ["BrandMark", "fixture-brand"],
      ["GoogleSignInButton", "fixture-google-button"], ["google-sign-in-flow", "fixture-google-flow"],
    ]) if (specifier.endsWith(suffix)) return `require(${JSON.stringify(stub)})`;
    const target = path.resolve(path.dirname(filename), specifier);
    const resolved = [target + ".tsx", target + ".ts"].find(existsSync);
    assert.ok(resolved, `fixture dependency not mapped: ${specifier}`);
    const dependency = path.relative(sourceRoot, resolved).replaceAll("\\", "/");
    addComponent(dependency);
    return `require(${JSON.stringify(dependency)})`;
  });
  sources[relative] = compiled;
}
addComponent("app/auth/register/page.tsx");

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
const control = window.registerFixture = {
  queryString: "", googleEnabled: false, registrations: [], resends: [], failRegister: false,
};
class ApiError extends Error {
  constructor(message, status, endpoint, payload) {
    super(message); this.status = status; this.endpoint = endpoint; this.code = payload?.code; this.fieldErrors = payload?.fieldErrors ?? {};
  }
}
stubs["fixture-api"] = {
  ApiError,
  register: async (payload) => {
    control.registrations.push(structuredClone(payload));
    if (control.failRegister) {
      throw new ApiError("Email taken", 400, "/auth/register", { code: "EMAIL_ALREADY_REGISTERED", fieldErrors: {} });
    }
    return { email: payload.email, resendAfterSeconds: 60 };
  },
  resendVerificationEmail: async (payload) => { control.resends.push(payload); return {}; },
};
stubs["fixture-brand"] = { __esModule: true, default: ({ tagline }) => React.createElement("span", {}, tagline) };
stubs["fixture-google-button"] = { isGoogleSignInEnabled: () => control.googleEnabled };
stubs["fixture-google-flow"] = { __esModule: true, default: () => null };
stubs["next/link"] = { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) };
stubs["next/navigation"] = { useSearchParams: () => new URLSearchParams(control.queryString) };
control.render = () => {
  const Component = require("app/auth/register/page.tsx").default;
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

const SELECTORS = {
  displayName: "#register-name",
  phone: "#register-phone",
  email: "#register-email",
  password: "#register-password",
  confirmPassword: "#register-confirm",
};
const VALID = {
  displayName: "Synthetic Tester",
  phone: "0901234567",
  email: "synthetic.user@example.test",
  password: "Synthetic1!Pass",
  confirmPassword: "Synthetic1!Pass",
};

async function mount(setup = {}) {
  const page = await browser.newPage();
  page.setDefaultTimeout(4000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) => route.abort());
  await page.setContent('<!doctype html><html lang="vi"><body><div id="root"></div></body></html>');
  await page.addScriptTag({ content: fixture });
  await page.evaluate((setup) => { Object.assign(registerFixture, setup); registerFixture.render(); }, setup);
  await page.locator(SELECTORS.password).waitFor();
  return { page, errors };
}

async function typeFields(page, values) {
  for (const [key, value] of Object.entries(values)) await page.locator(SELECTORS[key]).fill(value);
}

async function domFill(page, values) {
  await page.evaluate(({ values, selectors }) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    for (const [key, value] of Object.entries(values)) setter.call(document.querySelector(selectors[key]), value);
  }, { values, selectors: SELECTORS });
}

async function submit(page) {
  await page.evaluate(() => document.querySelector("form").requestSubmit());
}

async function expectPendingVerification(page) {
  await page.getByText("Kiểm tra email để tiếp tục", { exact: true }).waitFor();
}

test("register: normal typing sends exact payload and shows pending verification", async () => {
  const { page, errors } = await mount();
  try {
    await typeFields(page, VALID);
    await submit(page);
    await page.waitForFunction(() => registerFixture.registrations.length === 1);
    assert.deepEqual(await page.evaluate(() => registerFixture.registrations[0]), {
      displayName: VALID.displayName, phone: VALID.phone, email: VALID.email, password: VALID.password,
    });
    await expectPendingVerification(page);
    assert.equal(errors.length, 0);
  } finally { await page.close(); }
});

test("register: native DOM setter autofill without events sends same payload and pending verification", async () => {
  const { page, errors } = await mount();
  try {
    await domFill(page, VALID);
    await submit(page);
    await page.waitForFunction(() => registerFixture.registrations.length === 1);
    assert.deepEqual(await page.evaluate(() => registerFixture.registrations[0]), {
      displayName: VALID.displayName, phone: VALID.phone, email: VALID.email, password: VALID.password,
    });
    await expectPendingVerification(page);
    assert.equal(errors.length, 0);
  } finally { await page.close(); }
});

test("register: DOM-only replacement after normal typing submits latest DOM values", async () => {
  const { page, errors } = await mount();
  try {
    await typeFields(page, {
      displayName: "Stale Name", phone: "0911111111", email: "stale@example.test",
      password: "Stale1!Pass", confirmPassword: "Stale1!Pass",
    });
    await domFill(page, VALID);
    await submit(page);
    await page.waitForFunction(() => registerFixture.registrations.length === 1);
    assert.deepEqual(await page.evaluate(() => registerFixture.registrations[0]), {
      displayName: VALID.displayName, phone: VALID.phone, email: VALID.email, password: VALID.password,
    });
    await expectPendingVerification(page);
    assert.equal(errors.length, 0);
  } finally { await page.close(); }
});

test("register: DOM-autofilled syntactically invalid password rejects locally with no API call", async () => {
  const { page } = await mount();
  try {
    await domFill(page, { ...VALID, password: "alllowercase1!", confirmPassword: "alllowercase1!" });
    await submit(page);
    await page.locator("#register-password-error").waitFor();
    assert.equal(await page.locator("#register-password-error").innerText(), "Mật khẩu cần chữ hoa.");
    assert.equal(await page.evaluate(() => registerFixture.registrations.length), 0);
  } finally { await page.close(); }
});

test("register: DOM-autofilled mismatched confirmation rejects locally with no API call", async () => {
  const { page } = await mount();
  try {
    await domFill(page, { ...VALID, confirmPassword: "Different1!Pass" });
    await submit(page);
    await page.locator("#register-confirm-error").waitFor();
    assert.equal(await page.locator("#register-confirm-error").innerText(), "Mật khẩu xác nhận chưa khớp.");
    assert.equal(await page.evaluate(() => registerFixture.registrations.length), 0);
  } finally { await page.close(); }
});

test("register: DOM-autofilled password over 72 UTF-8 bytes rejects locally with no API call", async () => {
  const { page } = await mount();
  try {
    const overlong = `Aa1!${"é".repeat(40)}`;
    await domFill(page, { ...VALID, password: overlong, confirmPassword: overlong });
    await submit(page);
    await page.locator("#register-password-error").waitFor();
    assert.match(await page.locator("#register-password-error").innerText(), /72 byte UTF-8/u);
    assert.equal(await page.evaluate(() => registerFixture.registrations.length), 0);
  } finally { await page.close(); }
});

test("register: rejected submit keeps DOM-autofilled fields and retry resends the same payload", async () => {
  const { page, errors } = await mount({ failRegister: true });
  try {
    await domFill(page, VALID);
    await submit(page);
    await page.waitForFunction(() => registerFixture.registrations.length === 1);
    await page.locator(".auth-form__error[role='alert']").waitFor();
    for (const [key, value] of Object.entries(VALID)) {
      assert.equal(await page.locator(SELECTORS[key]).inputValue(), value, `DOM field ${key} must survive the failed submit`);
    }
    await page.evaluate(() => { registerFixture.failRegister = false; });
    await submit(page);
    await page.waitForFunction(() => registerFixture.registrations.length === 2);
    const expected = {
      displayName: VALID.displayName, phone: VALID.phone, email: VALID.email, password: VALID.password,
    };
    assert.deepEqual(await page.evaluate(() => registerFixture.registrations[0]), expected);
    assert.deepEqual(await page.evaluate(() => registerFixture.registrations[1]), expected);
    await expectPendingVerification(page);
    assert.equal(errors.length, 0);
  } finally { await page.close(); }
});

test("register: password whitespace is preserved byte-for-byte while name/phone/email trim", async () => {
  const { page } = await mount();
  try {
    await domFill(page, {
      displayName: "  Synthetic Tester  ", phone: " 0901234567 ", email: " synthetic.user@example.test ",
      password: "  Synthetic1!Pass  ", confirmPassword: "  Synthetic1!Pass  ",
    });
    await submit(page);
    await page.waitForFunction(() => registerFixture.registrations.length === 1);
    assert.deepEqual(await page.evaluate(() => registerFixture.registrations[0]), {
      displayName: "Synthetic Tester", phone: "0901234567", email: "synthetic.user@example.test", password: "  Synthetic1!Pass  ",
    });
    await expectPendingVerification(page);
  } finally { await page.close(); }
});
