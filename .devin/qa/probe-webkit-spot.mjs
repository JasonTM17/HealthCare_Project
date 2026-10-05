// WebKit spot pass on the plain-HTTP audit stack: CSP upgrade-insecure-requests
// used to break every asset for WebKit. Checks pages load (status 200, real
// content rendered) at a mobile viewport.
import { webkit } from "../../apps/frontend/node_modules/playwright/index.mjs";
const BASE = "http://127.0.0.1:3330";
const results = [];
const record = (id, ok, detail = "") => {
  results.push({ id, status: ok ? "PASS" : "FAIL", detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}${detail ? ` — ${detail}` : ""}`);
};
const browser = await webkit.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const failed = [];
  page.on("requestfailed", (r) => failed.push(`${r.url().slice(0, 80)} ${r.failure()?.errorText}`));
  for (const [name, path] of [["home", "/"], ["articles", "/articles"], ["search", "/search?q=tim"]]) {
    const resp = await page.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 30_000 });
    await page.waitForTimeout(1500);
    const bodyLen = await page.evaluate(() => document.body.innerText.length);
    const sw = await page.evaluate(() => document.body.scrollWidth);
    record(`webkit ${name} loads`, resp?.status() === 200 && bodyLen > 400, `status=${resp?.status()} bodyLen=${bodyLen} sw=${sw}`);
  }
  const assetFails = failed.filter((f) => /ERR_|SSL|upgraded/i.test(f));
  record("webkit no asset upgrade failures", assetFails.length === 0, assetFails.slice(0, 3).join(" | ") || `total=${failed.length}`);
  await ctx.close();
} finally { await browser.close(); }
const fails = results.filter((r) => r.status === "FAIL");
console.log(`\n== WEBKIT: ${results.length - fails.length}/${results.length} PASS ==`);
process.exit(fails.length ? 1 : 0);
