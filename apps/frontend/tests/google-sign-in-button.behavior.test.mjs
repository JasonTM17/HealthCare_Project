import assert from 'node:assert/strict';
import { before, after, test as nodeTest } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { chromium } from '@playwright/test';

const require = createRequire(import.meta.url);
const rootPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sources = {};
for (const [name, file] of [
  ['react', 'react/cjs/react.development.js'],
  ['react/jsx-runtime', 'react/cjs/react-jsx-runtime.development.js'],
  ['react-dom', 'react-dom/cjs/react-dom.development.js'],
  ['react-dom/client', 'react-dom/cjs/react-dom-client.development.js'],
  ['scheduler', 'scheduler/cjs/scheduler.development.js'],
]) {
  const pkg = file.split('/')[0];
  sources[name] = readFileSync(path.join(path.dirname(require.resolve(pkg)), file.slice(pkg.length + 1)), 'utf8');
}
sources.button = ts.transpileModule(readFileSync(path.join(rootPath, 'components/GoogleSignInButton.tsx'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText.replace(/require\(".*\.module\.css"\)/g, 'require("css")');

const hasChromium = existsSync(chromium.executablePath());
let browser;
before(async () => {
  if (!hasChromium) return;
  browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); });

const test = (name, fn) => nodeTest(name, { skip: !hasChromium ? 'Playwright Chromium not installed' : false }, fn);

async function mount({ sdk = true, clientId = 'fixture.apps.googleusercontent.com', busy = false, clock = false } = {}) {
  const page = await browser.newPage({ viewport: { width: 500, height: 500 } });
  page.setDefaultTimeout(2500);
  await page.route('**/*', route => route.request().url().includes('/gsi/client') ? undefined : route.abort());
  await page.setContent('<html lang="vi"><body><div id="root" style="width:440px"></div></body></html>');
  if (clock) await page.clock.install();
  await page.evaluate(({ sources, clientId, sdk, busy }) => {
    globalThis.process = { env: { NODE_ENV: 'development', NEXT_PUBLIC_GOOGLE_CLIENT_ID: clientId } };
    const cache = {};
    function require(name) {
      if (name === 'css') return { __esModule: true, default: new Proxy({}, { get: (_, prop) => prop }) };
      if (cache[name]) return cache[name].exports;
      const mod = { exports: {} }; cache[name] = mod;
      new Function('require', 'module', 'exports', sources[name])(require, mod, mod.exports);
      return mod.exports;
    }
    const React = require('react');
    const ReactDOM = require('react-dom');
    const root = require('react-dom/client').createRoot(document.getElementById('root'));
    const control = window.gisFixture = { renders: [], credentials: [], callback: null, busy };
    control.installSdk = () => {
      window.google = { accounts: { id: {
        initialize: config => { control.callback = config.callback; },
        renderButton: (parent, options) => {
          control.renders.push({ ...options, click_listener: undefined });
          const button = document.createElement('button');
          button.type = 'button'; button.textContent = 'Đăng nhập bằng Google';
          button.style.width = options.width + 'px';
          button.onclick = () => control.callback({ credential: 'fixture-token' });
          parent.append(button);
        },
      } } };
    };
    if (sdk) control.installSdk();
    control.render = () => ReactDOM.flushSync(() => root.render(React.createElement(require('button').default, {
      busy: control.busy, onCredential: credential => control.credentials.push(credential),
    })));
    control.unmount = () => ReactDOM.flushSync(() => root.unmount());
    control.render();
  }, { sources, clientId, sdk, busy });
  return page;
}

test('Google loader requests Vietnamese library and presents loading feedback', async () => {
  const page = await mount({ sdk: false });
  try {
    const src = await page.locator('script[src*="accounts.google.com/gsi/client"]').getAttribute('src');
    assert.equal(new URL(src).searchParams.get('hl'), 'vi');
    await page.getByRole('status').filter({ hasText: 'Đang tải' }).waitFor();
  } finally { await page.close(); }
});

test('Google button uses official rectangular options and responds to container resizing', async () => {
  const page = await mount();
  try {
    await page.getByRole('button', { name: 'Đăng nhập bằng Google' }).waitFor();
    assert.equal(await page.evaluate(() => gisFixture.renders[0].shape), 'rectangular');
    assert.equal(await page.evaluate(() => gisFixture.renders[0].locale), 'vi');
    assert.equal(await page.evaluate(() => gisFixture.renders[0].width), 400);
    await page.evaluate(() => { document.getElementById('root').style.width = '264px'; });
    await page.waitForFunction(() => gisFixture.renders.at(-1).width === 264);
    assert.equal(await page.locator('#root button').count(), 1);
  } finally { await page.close(); }
});

test('Google script errors offer retry which loads and renders a working button', async () => {
  const page = await mount({ sdk: false });
  try {
    await page.locator('script[src*="gsi/client"]').evaluate(script => script.dispatchEvent(new Event('error')));
    assert.equal(await page.getByText('Chọn tài khoản Google trong cửa sổ mở ra để tiếp tục.').count(), 0);
    await page.getByRole('button', { name: 'Thử tải lại Google' }).click();
    assert.equal(await page.locator('script[src*="gsi/client"]').count(), 1);
    await page.evaluate(() => {
      gisFixture.installSdk();
      document.querySelector('script[src*="gsi/client"]').dispatchEvent(new Event('load'));
    });
    await page.getByRole('button', { name: 'Đăng nhập bằng Google' }).click();
    assert.deepEqual(await page.evaluate(() => gisFixture.credentials), ['fixture-token']);
  } finally { await page.close(); }
});

test('Google loader timeout recovers even when no load or error event arrives', async () => {
  const page = await mount({ sdk: false, clock: true });
  try {
    await page.clock.fastForward(12_001);
    await page.getByRole('button', { name: 'Thử tải lại Google' }).waitFor();
    assert.match(await page.getByRole('status').innerText(), /email/);
  } finally { await page.close(); }
});

test('Google credential callback is ignored after unmount with an already loaded SDK', async () => {
  const page = await mount();
  try {
    await page.getByRole('button', { name: 'Đăng nhập bằng Google' }).waitFor();
    await page.evaluate(() => { gisFixture.unmount(); gisFixture.callback({ credential: 'late-token' }); });
    assert.deepEqual(await page.evaluate(() => gisFixture.credentials), []);
  } finally { await page.close(); }
});

test('Google busy state blocks keyboard focus and credentials, then restores operation', async () => {
  const page = await mount({ busy: true });
  try {
    await page.getByRole('button', { name: 'Đăng nhập bằng Google', includeHidden: true }).waitFor();
    assert.equal(await page.locator('#root [inert]').count(), 1);
    await page.evaluate(() => gisFixture.callback({ credential: 'busy-token' }));
    assert.deepEqual(await page.evaluate(() => gisFixture.credentials), []);
    await page.evaluate(() => { gisFixture.busy = false; gisFixture.render(); });
    await page.getByRole('button', { name: 'Đăng nhập bằng Google' }).click();
    assert.deepEqual(await page.evaluate(() => gisFixture.credentials), ['fixture-token']);
  } finally { await page.close(); }
});

test('Google sign-in remains absent without a configured client ID', async () => {
  const page = await mount({ sdk: false, clientId: '' });
  try {
    assert.equal(await page.locator('#root').innerHTML(), '');
    assert.equal(await page.locator('script[src*="gsi/client"]').count(), 0);
  } finally { await page.close(); }
});
