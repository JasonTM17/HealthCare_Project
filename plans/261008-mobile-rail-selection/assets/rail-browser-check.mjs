import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, "../../..");
const require = createRequire(path.join(root, "apps/frontend/package.json"));
const { chromium } = require("@playwright/test");
const target = process.env.RAIL_TARGET ?? "http://127.0.0.1:3000";
const label = target.includes("127.0.0.1") ? "local" : "public";
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [320, 375, 390, 430]) {
    const context = await browser.newContext({ viewport: { width, height: 812 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.name));
    try {
      await page.goto(`${target}/specialties`, { waitUntil: "domcontentloaded", timeout: 90000 });
      // Streaming can retain the outgoing shell in a hidden Suspense tree.
      // Assert one visible rail instead of selecting the hidden copy.
      await page.waitForFunction(() => Array.from(document.querySelectorAll(".mobile-care-rail"))
        .filter((rail) => rail.getBoundingClientRect().height > 0).length === 1, null, { timeout: 30000 });
      const rail = page.locator(".mobile-care-rail:visible");
      await rail.waitFor({ state: "visible", timeout: 30000 });
      const states = [];
      for (const href of ["/specialties", "/doctors", "/dat-lich", "/specialties"]) {
        await rail.locator(`a[href='${href}']`).tap();
        await page.waitForURL((url) => url.pathname === href, { timeout: 60000 });
        await page.waitForFunction((href) => {
          const rail = Array.from(document.querySelectorAll(".mobile-care-rail"))
            .find((rail) => rail.getBoundingClientRect().height > 0);
          if (!rail) return false;
          const selected = rail.querySelector(`a[href='${href}'][aria-current='page']`);
          return selected && getComputedStyle(selected).color === "rgb(255, 255, 255)"
            && !getComputedStyle(selected).backgroundColor.startsWith("rgba");
        }, href, { timeout: 10000 });
        const items = await rail.locator("a").evaluateAll((links) => links.map((link) => {
          const style = getComputedStyle(link);
          const box = link.getBoundingClientRect();
          return { href: link.getAttribute("href"), current: link.getAttribute("aria-current"), background: style.backgroundColor,
            color: style.color, width: box.width, height: box.height, left: box.left, right: box.right };
        }));
        assert.equal(items.filter((item) => item.current === "page").length, 1);
        for (const item of items) {
          assert.ok(item.width >= 44 && item.height >= 44 && item.left >= 0 && item.right <= width + 1);
          if (item.href !== href) assert.equal(item.background, "rgba(0, 0, 0, 0)", `${width}: idle ${item.href}`);
        }
        states.push({ href, items });
        if (href === "/doctors") await page.screenshot({
          path: path.join(dir, `${label}-doctors-${width}.png`),
          clip: { x: 0, y: 680, width, height: 132 },
        });
      }
      assert.deepEqual(errors, [], "navigation must not cause runtime errors");
      results.push({ width, pass: true, states, runtimeErrors: errors });
    } finally { await context.close(); }
  }
  writeFileSync(path.join(dir, `${label}-browser-results.json`), JSON.stringify({ target, results }, null, 2));
  console.log(JSON.stringify({ target, widths: results.map((item) => item.width), pass: true, runtimeErrors: 0 }));
} finally { await browser.close(); }
