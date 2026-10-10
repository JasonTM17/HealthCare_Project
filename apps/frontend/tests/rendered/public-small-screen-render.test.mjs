import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test, { after, before } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "@playwright/test";
import ts from "typescript";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import selectorParser from "postcss-selector-parser";

// Isolated rendered layout proof, not a hydrated application/business-flow test.
// SSR the real components; substitute only Next primitives and external stores.
// No server, HTTP navigation, external fonts, auth or API calls are needed.
const root = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(import.meta.url);
const read = (relative) => readFileSync(path.join(root, relative), "utf8");
const classes = {};
const moduleCss = postcss.parse(read("components/PackageVisuals.module.css"));
moduleCss.walkRules((rule) => {
  rule.selector = selectorParser((selectors) => {
    selectors.walkClasses((node) => {
      if (node.parent?.parent?.value === ":global") return;
      classes[node.value] = `package-fixture-${node.value}`;
      node.value = classes[node.value];
    });
    selectors.walkPseudos((node) => {
      if (node.value === ":global") node.replaceWith(...node.nodes[0].nodes);
    });
  }).processSync(rule.selector);
});

function loadComponent(relative, { openMenu = false } = {}) {
  const cache = new Map();
  let firstState = true;
  const react = {
    ...React,
    useState(initial) {
      const value = firstState && openMenu ? true : initial;
      firstState = false;
      return [value, () => {}];
    },
  };
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    if (filename.endsWith(".json")) {
      loadedModule.exports = JSON.parse(readFileSync(filename, "utf8"));
      return loadedModule.exports;
    }
    const source = ts.transpileModule(readFileSync(filename, "utf8"), {
      fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    const localRequire = (specifier) => {
      if (specifier === "react") return react;
      if (specifier === "next/navigation") return { usePathname: () => "/" };
      if (specifier === "next/link") return { __esModule: true, default: (props) => React.createElement("a", props) };
      if (specifier === "next/image") return {
        __esModule: true,
        default: ({ src, fill, priority, ...props }) => React.createElement("img", {
          ...props,
          src: `data:image/jpeg;base64,${readFileSync(path.join(root, "public", src)).toString("base64")}`,
          style: fill ? { position: "absolute", height: "100%", width: "100%", inset: 0, color: "transparent" } : undefined,
        }),
      };
      if (specifier.endsWith("PackageVisuals.module.css")) return { __esModule: true, default: classes };
      if (specifier.endsWith("useAuthSession")) return { useAuthSession: () => null };
      if (specifier.endsWith("api-client")) return { hasRole: () => false };
      if (specifier.startsWith(".")) {
        const target = path.resolve(path.dirname(filename), specifier);
        return load([`${target}.tsx`, `${target}.ts`].find((candidate) => {
          try { readFileSync(candidate); return true; } catch { return false; }
        }) ?? target);
      }
      return require(specifier);
    };
    vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename })(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return load(path.join(root, relative));
}

const Navbar = loadComponent("components/Navbar.tsx").default;
const OpenNavbar = loadComponent("components/Navbar.tsx", { openMenu: true }).default;
const PackageCard = loadComponent("components/PackageVisualCard.tsx").default;
const item = {
  id: "fixture-package", slug: "goi-kham-tong-quat", price: 2000000, active: true,
  name: "Gói khám sức khỏe tổng quát toàn diện dành cho người trưởng thành",
  description: "Khám sức khỏe định kỳ, đánh giá các chỉ số và tư vấn chăm sóc sức khỏe phù hợp.",
  targetAudience: "Người trưởng thành có nhu cầu kiểm tra sức khỏe định kỳ", durationDays: 1,
  checklist: ["Khám nội tổng quát và tư vấn", "Xét nghiệm các chỉ số sức khỏe"],
};
const navbarMarkup = renderToStaticMarkup(React.createElement(Navbar, { onOpenBooking() {} }));
const openNavbarMarkup = renderToStaticMarkup(React.createElement(OpenNavbar, { onOpenBooking() {} }));
const cards = Array.from({ length: 4 }, (_, index) => renderToStaticMarkup(React.createElement(PackageCard, {
  packageItem: { ...item, id: `${item.id}-${index}` }, variant: "home",
  bookingAction: React.createElement("button", { className: classes.bookButton, type: "button" }, "Đặt lịch"),
}))).join("");
let browser;
let css;
const proofDir = process.env.PUBLIC_SMALL_SCREEN_PROOF_DIR;
before(async () => {
  // Include the actual global import order and Tailwind's real preflight.
  const layout = read("app/layout.tsx");
  const stylesheets = [...layout.matchAll(/import "\.\/(.+\.css)";/g)].map((match) => read(`app/${match[1]}`));
  css = (await postcss([tailwindcss({ content: [{ raw: navbarMarkup + openNavbarMarkup + cards, extension: "html" }] })])
    .process(stylesheets.join("\n"), { from: undefined })).css + moduleCss.toString();
  browser = await chromium.launch({ headless: true, ignoreDefaultArgs: ["--hide-scrollbars"] });
  if (proofDir) mkdirSync(proofDir, { recursive: true });
});
after(async () => browser?.close());

for (const width of [320, 375, 768, 1440]) {
  test(`rendered public header and package containment at ${width}px with classic scrollbar`, async (t) => {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    const errors = [];
    const networkRequests = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", (route) => { networkRequests.push(route.request().url()); return route.abort(); });
    try {
      await page.setContent(`<!doctype html><html lang="vi"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body><div class="site-shell">${navbarMarkup}<main id="main-content"><section class="section section--packages"><div class="section-inner"><h1>Gói khám sức khỏe</h1><div class="${classes.homeRail}">${cards}</div></div></section></main></div></body></html>`);
      await page.locator("img").evaluateAll((images) => Promise.all(images.map((img) => img.decode())));
      const measure = () => page.evaluate(({ classes }) => {
        const bounds = (node) => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
        return {
          innerWidth, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
          header: bounds(document.querySelector(".site-nav__inner")),
          brand: bounds(document.querySelector(".brand-link")),
          controls: [...document.querySelectorAll(".site-nav__actions > *")].filter((node) => node.getBoundingClientRect().width > 0).map(bounds),
          cards: [...document.querySelectorAll(`.${classes.card}`)].map((node) => ({
            card: bounds(node), link: bounds(node.querySelector(`.${classes.mediaLink}`)),
            figure: bounds(node.querySelector("figure")), image: bounds(node.querySelector("img")),
            loaded: node.querySelector("img").naturalWidth > 0,
            aspectRatio: getComputedStyle(node.querySelector("figure")).aspectRatio,
            minHeight: getComputedStyle(node.querySelector("figure")).minHeight,
            objectFit: getComputedStyle(node.querySelector("img")).objectFit,
          })),
        };
      }, { classes });
      const metrics = await measure();
      t.diagnostic(JSON.stringify(metrics));
      if (proofDir) {
        writeFileSync(path.join(proofDir, `${width}-metrics.json`), JSON.stringify(metrics, null, 2));
        await page.screenshot({ path: path.join(proofDir, `${width}-render.png`), fullPage: true });
      }
      assert.ok(metrics.clientWidth < width, "fixture must have a real classic vertical scrollbar");
      assert.equal(errors.length, 0, "no renderer errors");
      assert.equal(networkRequests.length, 0, "fixture must be entirely offline");
      const contained = (child, parent, label) => {
        assert.ok(child.left >= parent.left - 0.5 && child.right <= parent.right + 0.5,
          `${label}: ${child.left}..${child.right} exceeds ${parent.left}..${parent.right}`);
      };
      await t.test("header controls remain visible, contained and touch-safe", () => {
        assert.equal(metrics.controls.length, width <= 480 ? 2 : width <= 900 ? 3 : 2);
        for (const control of metrics.controls) {
          contained(control, metrics.header, "nav control");
          assert.ok(control.width >= 44 && control.height >= 44, "nav target must remain at least 44x44");
        }
        contained(metrics.brand, metrics.header, "brand");
        assert.ok(metrics.brand.right + 8 <= metrics.controls[0].left, "brand and actions must not overlap");
      });
      await t.test("loaded package image, figure and link remain within the card", () => {
        for (const entry of metrics.cards) {
          contained(entry.card, { left: 0, right: metrics.clientWidth }, "package card");
          contained(entry.link, entry.card, "media link");
          contained(entry.figure, entry.link, "media figure");
          contained(entry.image, entry.figure, "package image");
          assert.ok(entry.loaded, "package photograph must actually decode");
          assert.equal(entry.aspectRatio, "16 / 10.5");
          assert.equal(entry.minHeight, width <= 480 ? "192px" : "224px");
          assert.equal(entry.objectFit, "cover");
        }
      });
      if (width <= 900) {
        await t.test("mobile menu retains account access and long Vietnamese copy", async () => {
          const menu = await page.evaluate((markup) => {
            const template = document.createElement("template"); template.innerHTML = markup;
            document.querySelector(".site-nav").append(template.content.querySelector(".mobile-menu"));
            return document.querySelector(".mobile-menu").textContent;
          }, openNavbarMarkup);
          assert.match(menu, /Đăng nhập/);
          await page.locator(".brand-copy small").evaluate((node) => { node.textContent = "Bệnh viện đa khoa chăm sóc sức khỏe toàn diện"; });
          const longMetrics = await measure();
          contained(longMetrics.brand, longMetrics.header, "long Vietnamese brand");
          assert.ok(longMetrics.brand.right + 8 <= longMetrics.controls[0].left, "long copy must not overlap controls");
          const account = await page.locator('.mobile-menu__actions a[href^="/auth/login"]').boundingBox();
          assert.ok(account && account.width >= 44 && account.height >= 44);
          assert.ok(account.x >= 0 && account.x + account.width <= longMetrics.clientWidth);
          if (proofDir) await page.screenshot({ path: path.join(proofDir, `${width}-long-copy-menu.png`), fullPage: true });
        });
      }
    } finally { await page.close(); }
  });
}
