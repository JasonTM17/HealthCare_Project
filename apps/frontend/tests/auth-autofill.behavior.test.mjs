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
const sourceRoot = process.env.AUTOFILL_SOURCE_ROOT ?? frontendRoot;
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
addComponent("app/auth/forgot-password/page.tsx");
addComponent("app/auth/verify-email/page.tsx");

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
const control = window.authFixture = {
  queryString: "", replacements: [], resets: [], verifies: [], resends: [],
};
class ApiError extends Error {
  constructor(message, status, endpoint, payload) {
    super(message); this.status = status; this.endpoint = endpoint; this.code = payload?.code; this.fieldErrors = payload?.fieldErrors ?? {};
  }
}
stubs["fixture-api"] = {
  ApiError,
  requestPasswordReset: async (payload) => { control.resets.push(structuredClone(payload)); return {}; },
  verifyEmail: async (payload) => { control.verifies.push(structuredClone(payload)); return { user: { id: "u-1", roles: ["PATIENT"] } }; },
  resendVerificationEmail: async (payload) => { control.resends.push(structuredClone(payload)); return {}; },
  hasRole: (user, role) => (user.roles ?? []).includes(role),
};
stubs["fixture-brand"] = { __esModule: true, default: ({ tagline }) => React.createElement("span", {}, tagline) };
stubs["next/link"] = { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) };
stubs["next/navigation"] = {
  useSearchParams: () => new URLSearchParams(control.queryString),
  useRouter: () => ({ replace: (href) => control.replacements.push(href), push: () => {} }),
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

async function mount(module, setup = {}) {
  const page = await browser.newPage();
  page.setDefaultTimeout(4000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) => route.abort());
  await page.setContent('<!doctype html><html lang="vi"><body><div id="root"></div></body></html>');
  await page.addScriptTag({ content: fixture });
  await page.evaluate(({ module, setup }) => { Object.assign(authFixture, setup); authFixture.render(module); }, { module, setup });
  await page.locator("form.auth-form").waitFor();
  return { page, errors };
}

async function domFill(page, values) {
  await page.evaluate((values) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    for (const [selector, value] of Object.entries(values)) setter.call(document.querySelector(selector), value);
  }, values);
}

async function submit(page) {
  await page.evaluate(() => document.querySelector("form").requestSubmit());
}

test("forgot-password: DOM-only email autofill submits the trimmed email once and shows success", async () => {
  const { page, errors } = await mount("app/auth/forgot-password/page.tsx");
  try {
    await domFill(page, { "#forgot-email": "  synthetic.user@example.test  " });
    await submit(page);
    await page.waitForFunction(() => authFixture.resets.length === 1);
    assert.deepEqual(await page.evaluate(() => authFixture.resets[0]), { email: "synthetic.user@example.test" });
    await page.getByText("Kiểm tra hộp thư", { exact: true }).waitFor();
    const resetHref = await page.locator('a[href*="/auth/reset-password?email="]').getAttribute("href");
    assert.equal(resetHref, `/auth/reset-password?email=${encodeURIComponent("synthetic.user@example.test")}`);
    assert.equal(errors.length, 0);
  } finally { await page.close(); }
});

test("verify-email: DOM-only email and code submit exact trimmed values and route to the patient portal", async () => {
  const { page, errors } = await mount("app/auth/verify-email/page.tsx");
  try {
    await domFill(page, { "#verify-email": " verify.user@example.test ", "#verify-code": " 654321 " });
    await submit(page);
    await page.waitForFunction(() => authFixture.verifies.length === 1);
    assert.deepEqual(await page.evaluate(() => authFixture.verifies[0]), { email: "verify.user@example.test", code: "654321" });
    await page.waitForFunction(() => authFixture.replacements.includes("/patient/dashboard"));
    assert.equal(errors.length, 0);
  } finally { await page.close(); }
});

test("verify-email resend: DOM-only email sends the current address and starts the cooldown", async () => {
  const { page } = await mount("app/auth/verify-email/page.tsx");
  try {
    await domFill(page, { "#verify-email": " resend.user@example.test " });
    await page.locator("button.auth-form__secondary").click();
    await page.waitForFunction(() => authFixture.resends.length === 1);
    assert.deepEqual(await page.evaluate(() => authFixture.resends[0]), { email: "resend.user@example.test" });
    await page.getByText("Mã xác minh mới đã được gửi.", { exact: true }).waitFor();
    await page.waitForFunction(() => document.querySelector("button.auth-form__secondary").disabled);
  } finally { await page.close(); }
});

test("verify-email resend: a seeded cooldown blocks the resend button even after DOM-only fill", async () => {
  const { page } = await mount("app/auth/verify-email/page.tsx", { queryString: "resendAfterSeconds=30" });
  try {
    await domFill(page, { "#verify-email": "cooldown.user@example.test" });
    await page.waitForFunction(() => document.querySelector("button.auth-form__secondary").disabled);
    await page.evaluate(() => document.querySelector("button.auth-form__secondary").click());
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => authFixture.resends.length), 0);
  } finally { await page.close(); }
});

test("verify-email resend: empty email rejects locally with field and banner errors and no API call", async () => {
  const { page } = await mount("app/auth/verify-email/page.tsx");
  try {
    await page.locator("button.auth-form__secondary").click();
    await page.locator("#verify-email-error").waitFor();
    assert.equal(await page.locator("#verify-email-error").innerText(), "Vui lòng nhập email đăng ký.");
    await page.locator(".auth-form__error[role='alert']").waitFor();
    assert.equal(await page.evaluate(() => authFixture.resends.length), 0);
  } finally { await page.close(); }
});
