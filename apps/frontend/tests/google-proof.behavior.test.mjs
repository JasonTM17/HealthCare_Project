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
      ["api-client", "fixture-api"], ["GoogleSignInButton", "fixture-google-button"],
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
addComponent("components/google-sign-in-flow.tsx");

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
const control = window.googleFixture = {
  logins: [], proofRequests: [], sessions: [], outerSubmits: 0,
  initialError: "GOOGLE_REAUTH_REQUIRED", loginImpl: null,
};
class ApiError extends Error {
  constructor(message, status, endpoint, payload) {
    super(message); this.status = status; this.endpoint = endpoint; this.code = payload?.code; this.fieldErrors = payload?.fieldErrors ?? {};
  }
}
control.ApiError = ApiError;
stubs["fixture-api"] = {
  ApiError,
  loginWithGoogle: async (credential, proof = {}) => {
    control.logins.push({ credential, proof: structuredClone(proof) });
    if (control.loginImpl) return control.loginImpl(credential, proof);
    if (Object.keys(proof).length === 0) {
      throw new ApiError("Proof required", 401, "/auth/browser-sessions", { code: control.initialError });
    }
    return { user: { id: "u-1", roles: ["PATIENT"] } };
  },
  requestGoogleEmailProof: async (credential) => {
    control.proofRequests.push(credential);
    return { email: "user@gmail.example.test", expiresInSeconds: 300 };
  },
};
stubs["fixture-google-button"] = { __esModule: true, default: ({ onCredential }) => {
  control.onCredential = onCredential;
  return React.createElement("button", { type: "button", id: "google-credential-btn", onClick: () => onCredential("google-credential-1") }, "Google");
} };
control.render = () => {
  const Flow = require("components/google-sign-in-flow.tsx").default;
  ReactDOM.flushSync(() => root.render(React.createElement("form", {
    onSubmit: (event) => { event.preventDefault(); control.outerSubmits += 1; },
  }, React.createElement(Flow, { onAuthenticated: (session) => control.sessions.push(session) }))));
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

const PROOF_INPUT = ".auth-form__field input";
const CONFIRM_BUTTON = ".auth-form__field button.button--primary";

async function mount(setup = {}) {
  const page = await browser.newPage();
  page.setDefaultTimeout(4000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) => route.abort());
  await page.setContent('<!doctype html><html lang="vi"><body><div id="root"></div></body></html>');
  await page.addScriptTag({ content: fixture });
  await page.evaluate((setup) => { Object.assign(googleFixture, setup); googleFixture.render(); }, setup);
  await page.locator("#google-credential-btn").waitFor();
  return { page, errors };
}

async function issueCredential(page) {
  await page.locator("#google-credential-btn").click();
  await page.locator(PROOF_INPUT).waitFor();
}

async function domFillProof(page, value) {
  await page.evaluate(({ selector, value }) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(document.querySelector(selector), value);
  }, { selector: PROOF_INPUT, value });
}

test("google proof: password reauth completes with DOM-only password submitted by button", async () => {
  const { page, errors } = await mount();
  try {
    await issueCredential(page);
    await page.getByText("Nhập mật khẩu HealthCare hiện tại", { exact: false }).waitFor();
    await domFillProof(page, " Exact1! Pass ");
    await page.locator(CONFIRM_BUTTON).click();
    await page.waitForFunction(() => googleFixture.logins.length === 2);
    const second = await page.evaluate(() => googleFixture.logins[1]);
    assert.equal(second.credential, "google-credential-1");
    assert.deepEqual(second.proof, { password: " Exact1! Pass " });
    await page.waitForFunction(() => googleFixture.sessions.length === 1);
    assert.equal(await page.evaluate(() => googleFixture.outerSubmits), 0);
    assert.equal(errors.length, 0);
  } finally { await page.close(); }
});

test("google proof: DOM-only password submitted by Enter sends exact bytes without an outer form submit", async () => {
  const { page, errors } = await mount();
  try {
    await issueCredential(page);
    await domFillProof(page, "K3y! Enter  ");
    await page.locator(PROOF_INPUT).press("Enter");
    await page.waitForFunction(() => googleFixture.logins.length === 2);
    assert.deepEqual(await page.evaluate(() => googleFixture.logins[1].proof), { password: "K3y! Enter  " });
    assert.equal(await page.evaluate(() => googleFixture.outerSubmits), 0);
    assert.equal(errors.length, 0);
  } finally { await page.close(); }
});

test("google proof: email code mode rejects a non-six-digit DOM code locally then accepts the trimmed code", async () => {
  const { page } = await mount({ initialError: "GOOGLE_EMAIL_PROOF_REQUIRED" });
  try {
    await issueCredential(page);
    await page.waitForFunction(() => googleFixture.proofRequests.length === 1);
    await domFillProof(page, "12345");
    await page.evaluate(() => document.querySelector(".auth-form__field button.button--primary").click());
    await page.locator(".auth-form__error[role='alert']").waitFor();
    assert.equal(await page.evaluate(() => googleFixture.logins.length), 1);
    await domFillProof(page, " 654321 ");
    await page.evaluate(() => document.querySelector(".auth-form__field button.button--primary").click());
    await page.waitForFunction(() => googleFixture.logins.length === 2);
    assert.deepEqual(await page.evaluate(() => googleFixture.logins[1].proof), { code: "654321" });
  } finally { await page.close(); }
});

test("google proof: a duplicate confirm click during an in-flight attempt produces one API call", async () => {
  const { page } = await mount();
  try {
    await page.evaluate(() => {
      googleFixture.loginImpl = async (credential, proof) => {
        if (Object.keys(proof).length === 0) {
          throw new googleFixture.ApiError("Proof required", 401, "/auth/browser-sessions", { code: "GOOGLE_REAUTH_REQUIRED" });
        }
        await new Promise((resolve) => { googleFixture.releaseLogin = resolve; });
        return { user: { id: "u-1", roles: ["PATIENT"] } };
      };
    });
    await issueCredential(page);
    await domFillProof(page, "Inflight1!Pass");
    await page.evaluate(() => {
      const button = document.querySelector(".auth-form__field button.button--primary");
      button.click();
      button.click();
    });
    await page.waitForFunction(() => googleFixture.logins.length === 2);
    await page.evaluate(() => googleFixture.releaseLogin());
    await page.waitForFunction(() => googleFixture.sessions.length === 1);
    assert.equal(await page.evaluate(() => googleFixture.logins.length), 2);
  } finally { await page.close(); }
});
