// Quick overflow probe: login admin via BFF API, open a page at a viewport,
// print elements whose scrollWidth exceeds the viewport width.
// Usage: node .devin/qa/probe-overflow.mjs <path> <width> [height]
import { chromium } from "../../apps/frontend/node_modules/playwright/index.mjs";

const BASE = "http://localhost:3330";
const path = process.argv[2] ?? "/admin/consultations";
const width = Number(process.argv[3] ?? 320);
const height = Number(process.argv[4] ?? 720);
const email = process.env.QA_ADMIN_EMAIL ?? "admin@healthcare.local";
const password = process.env.QA_ADMIN_PASSWORD ?? "LocalDemo!2026";

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width, height } });
const page = await context.newPage();

// Real UI login — the BFF session cookies are __Host- prefixed and the page
// gate reads session state hydrated server-side, so inject the session the
// same way a user obtains it.
await page.goto(`${BASE}/auth/login?next=${encodeURIComponent(path)}`, {
  waitUntil: "networkidle",
  timeout: 30_000,
});
await page.getByLabel("Email", { exact: true }).fill(email);
await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
await page.getByRole("button", { name: /đăng nhập|sign in/i }).click();
await page.waitForURL((u) => !u.pathname.startsWith("/auth/"), { timeout: 30_000 });

await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 30_000 }).catch(() => {});
await page.waitForTimeout(2000);

const report = await page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const body = document.body?.scrollWidth ?? 0;
  const offenders = [];
  const all = document.querySelectorAll("*");
  for (const el of all) {
    const sw = el.scrollWidth;
    if (sw > vw + 4) {
      const rect = el.getBoundingClientRect();
      if (rect.width > vw + 4 || sw > vw + 4) {
        const id = el.id ? `#${el.id}` : "";
        const cls = (el.className?.toString?.() ?? "").split(/\s+/).filter(Boolean).slice(0, 4).join(".");
        offenders.push({
          tag: el.tagName.toLowerCase(),
          sel: `${el.tagName.toLowerCase()}${id}${cls ? "." + cls : ""}`,
          scrollWidth: sw,
          clientWidth: el.clientWidth,
          text: (el.textContent ?? "").trim().slice(0, 60),
        });
      }
    }
  }
  // keep only the outermost offenders (drop children of listed parents)
  return { viewport: vw, bodyScrollWidth: body, offenders: offenders.slice(0, 25) };
});
console.log(JSON.stringify(report, null, 2));
await browser.close();
