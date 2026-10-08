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
      ["BrandMark", "fixture-brand"], ["UiIcon", "fixture-icon"],
      ["CmsLiveSlot", "fixture-cms-live"], ["CmsRenderer", "fixture-cms-renderer"],
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
addComponent("components/Footer.tsx");

const stylesheet = [
  "app/styles.css",
  "app/effects.css",
  "app/typography.css",
  "app/branches/maps.css",
  "app/brand-experience.css",
  "app/catalog-directory.css",
].map((file) => readFileSync(path.join(sourceRoot, file), "utf8")).join("\n");

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
const control = window.footerFixture = { pathname: "/", siteShell: false, branches: [] };
stubs["fixture-brand"] = { __esModule: true, default: () => React.createElement("span") };
stubs["fixture-icon"] = { __esModule: true, default: (props) => React.createElement("span", { "data-icon": props.name }) };
stubs["fixture-cms-live"] = { __esModule: true, default: () => null };
stubs["fixture-cms-renderer"] = { CmsContentRenderer: () => null };
stubs["next/link"] = { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) };
stubs["next/navigation"] = { usePathname: () => control.pathname };
control.render = () => {
  const Footer = require("components/Footer.tsx").default;
  ReactDOM.flushSync(() => root.render(React.createElement(
    "div", { className: control.siteShell ? "site-shell" : "" },
    React.createElement(Footer, { branches: control.branches }),
  )));
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

async function mount(setup = {}, width = 375) {
  const page = await browser.newPage();
  page.setDefaultTimeout(4000);
  await page.setViewportSize({ width, height: 800 });
  await page.route("**/*", (route) => route.abort());
  // Reduced motion collapses the rail's real color/background transitions to
  // 1ms so computed styles reflect the settled state, not an in-flight
  // interpolation between the dark and site-shell palettes.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setContent('<!doctype html><html lang="vi"><body><div id="root"></div></body></html>');
  await page.addStyleTag({ content: stylesheet });
  await page.addScriptTag({ content: fixture });
  await page.evaluate((setup) => { Object.assign(footerFixture, setup); footerFixture.render(); }, setup);
  await page.locator(".mobile-care-rail").waitFor({ state: "attached" });
  return page;
}

function railCurrents(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll(".mobile-care-rail a")).map((a) => ({
      href: a.getAttribute("href"), current: a.getAttribute("aria-current"),
    })));
}

function railStyles(page, href) {
  return page.evaluate((href) => {
    const a = document.querySelector(`.mobile-care-rail a[href='${href}']`);
    const cs = getComputedStyle(a);
    return {
      display: cs.display, backgroundColor: cs.backgroundColor, boxShadow: cs.boxShadow, color: cs.color,
      borderBottomWidth: cs.borderBottomWidth, borderBottomStyle: cs.borderBottomStyle,
      borderBottomColor: cs.borderBottomColor,
    };
  }, href);
}

function expectedColor(page, cssValue) {
  return page.evaluate((cssValue) => {
    const probe = document.createElement("div");
    probe.style.borderBottom = `1px solid ${cssValue}`;
    // Resolve the variable inside .site-shell when present: palette tokens such
    // as --hospital-teal are scoped to the shell, so a body-level probe falls
    // back to currentcolor instead of the real token value.
    (document.querySelector(".site-shell") ?? document.body).append(probe);
    const color = getComputedStyle(probe).borderBottomColor;
    probe.remove();
    return color;
  }, cssValue);
}

const FLAT_SHADOW = "none";
const TRANSPARENT = "rgba(0, 0, 0, 0)";

const RAIL_HREFS = ["/specialties", "/doctors", "/dat-lich"];

async function expectOnlyCurrent(page, activeHref) {
  const currents = await railCurrents(page);
  for (const item of currents) {
    if (item.href === activeHref) assert.equal(item.current, "page", `${activeHref} must be aria-current`);
    else assert.equal(item.current, null, `${item.href} must not be aria-current`);
  }
}

test("rail: /specialties and /chuyen-khoa detail mark only the specialties item current", async () => {
  for (const pathname of ["/specialties", "/specialties/tim-mach", "/chuyen-khoa/tim-mach"]) {
    const page = await mount({ pathname });
    try { await expectOnlyCurrent(page, "/specialties"); } finally { await page.close(); }
  }
});

test("rail: /doctors and /bac-si detail mark only the doctors item current", async () => {
  for (const pathname of ["/doctors", "/doctors/chuyen-khoa/tim-mach", "/bac-si/nguyen-van-a"]) {
    const page = await mount({ pathname });
    try { await expectOnlyCurrent(page, "/doctors"); } finally { await page.close(); }
  }
});

test("rail: booking and contact subpaths mark their items; prefix collisions mark nothing", async () => {
  for (const [pathname, activeHref] of [["/dat-lich", "/dat-lich"], ["/dat-lich/bac-si", "/dat-lich"], ["/contact", "/contact"], ["/contact/ho-tro", "/contact"], ["/doctors-other", null], ["/specialties-other", null]]) {
    const page = await mount({ pathname });
    try {
      const currents = await railCurrents(page);
      for (const item of currents) {
        assert.equal(item.current, item.href === activeHref ? "page" : null, `${pathname}: ${item.href}`);
      }
    } finally { await page.close(); }
  }
});

test("rail: a telephone contact action is never marked as the current page", async () => {
  const page = await mount({ pathname: "/contact", branches: [{ name: "Cơ sở 1", phone: "19001234" }] });
  try {
    const currents = await railCurrents(page);
    const tel = currents.find((item) => item.href.startsWith("tel:"));
    assert.ok(tel, "rail must render the tel fallback");
    assert.equal(tel.current, null);
    for (const item of currents) assert.equal(item.current, null);
  } finally { await page.close(); }
});

test("rail: the active item shows a persistent background and underline on the dark rail (375px)", async () => {
  const page = await mount({ pathname: "/doctors" });
  try {
    const amber = await expectedColor(page, "var(--color-amber)");
    const active = await railStyles(page, "/doctors");
    assert.equal(active.display, "flex");
    assert.match(active.backgroundColor, /rgba\(255, 255, 255, 0\.1\)/);
    // The flat-UI contract forces box-shadow:none !important — the underline
    // must be a bottom border, never a shadow.
    assert.equal(active.boxShadow, FLAT_SHADOW);
    assert.equal(active.borderBottomWidth, "3px");
    assert.equal(active.borderBottomStyle, "solid");
    assert.equal(active.borderBottomColor, amber);
    const idle = await railStyles(page, "/specialties");
    assert.equal(idle.boxShadow, FLAT_SHADOW);
    assert.equal(idle.borderBottomColor, TRANSPARENT);
    const booking = await railStyles(page, "/dat-lich");
    assert.equal(booking.boxShadow, FLAT_SHADOW);
    assert.equal(booking.borderBottomColor, TRANSPARENT);
  } finally { await page.close(); }
});

test("rail: the active booking item keeps dark-teal contrast on the dark rail (390px)", async () => {
  const page = await mount({ pathname: "/dat-lich" }, 390);
  try {
    const paperBright = await expectedColor(page, "var(--color-paper-bright)");
    const active = await railStyles(page, "/dat-lich");
    assert.equal(active.boxShadow, FLAT_SHADOW);
    assert.equal(active.borderBottomWidth, "3px");
    assert.equal(active.borderBottomStyle, "solid");
    assert.equal(active.borderBottomColor, paperBright);
    assert.equal(active.color, "rgb(255, 255, 255)");
  } finally { await page.close(); }
});

test("rail: site-shell white variant keeps teal selected styling at 375px and 390px", async () => {
  for (const width of [375, 390]) {
    const page = await mount({ pathname: "/doctors", siteShell: true }, width);
    try {
      const hospitalTeal = await expectedColor(page, "var(--hospital-teal)");
      const active = await railStyles(page, "/doctors");
      assert.match(active.backgroundColor, /rgba\(13, 148, 136, 0\.1\)/);
      assert.equal(active.boxShadow, FLAT_SHADOW, "the flat-UI !important cascade must win over any shadow");
      assert.equal(active.borderBottomWidth, "3px");
      assert.equal(active.borderBottomStyle, "solid");
      assert.equal(active.borderBottomColor, hospitalTeal);
    } finally { await page.close(); }
  }
});

test("rail: site-shell booking selection stays dark teal with white text", async () => {
  const page = await mount({ pathname: "/dat-lich", siteShell: true });
  try {
    const active = await railStyles(page, "/dat-lich");
    assert.equal(active.color, "rgb(255, 255, 255)");
    assert.equal(active.boxShadow, FLAT_SHADOW);
    assert.equal(active.borderBottomWidth, "3px");
    assert.equal(active.borderBottomStyle, "solid");
    assert.equal(active.borderBottomColor, "rgb(255, 255, 255)");
  } finally { await page.close(); }
});

test("rail: press feedback and keyboard focus stay visible under the real cascade", async () => {
  const page = await mount({ pathname: "/" });
  try {
    const pressRule = await page.evaluate(() => {
      const found = { dark: null, shell: null };
      for (const sheet of document.styleSheets) {
        for (const rule of sheet.cssRules) {
          const rules = rule instanceof CSSMediaRule ? rule.cssRules : [rule];
          for (const inner of rules) {
            if (inner.selectorText === ".mobile-care-rail a:active") found.dark = inner.style.backgroundColor;
            if (inner.selectorText === ".site-shell .mobile-care-rail a:active") found.shell = inner.style.backgroundColor;
          }
        }
      }
      return found;
    });
    assert.ok(pressRule.dark, "the dark rail must keep a visible :active press tint");
    assert.ok(pressRule.shell, "the site-shell rail must keep a visible :active press tint");

    for (let index = 0; index < 80; index += 1) {
      await page.keyboard.press("Tab");
      if (await page.evaluate(() => document.activeElement?.matches?.(".mobile-care-rail a"))) break;
    }
    const focused = await page.evaluate(() => {
      const cs = getComputedStyle(document.activeElement);
      return { outlineStyle: cs.outlineStyle, outlineWidth: cs.outlineWidth };
    });
    assert.equal(focused.outlineStyle, "solid", "keyboard focus must draw a visible outline");
    assert.notEqual(focused.outlineWidth, "0px");

    await page.evaluate(() => { footerFixture.siteShell = true; footerFixture.render(); });
    // Let one animation frame run so the rail's 1ms reduced-motion transition
    // settles; measuring immediately catches the interpolated start color.
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)))));
    const cta = await railStyles(page, "/dat-lich");
    assert.equal(cta.color, "rgb(255, 255, 255)", "the site-shell primary CTA keeps white text");
  } finally { await page.close(); }
});

test("rail: the rail stays hidden at 768px, 1024px and 1440px regardless of the current item", async () => {
  for (const width of [768, 1024, 1440]) {
    const page = await mount({ pathname: "/doctors" }, width);
    try {
      const display = await page.evaluate(() => getComputedStyle(document.querySelector(".mobile-care-rail")).display);
      assert.equal(display, "none", `rail must be hidden at ${width}px`);
    } finally { await page.close(); }
  }
});
