// UI/UX remediation re-verification on the isolated audit stack (:3330).
// Checks: overflow offenders, <44px controls on key routes, duplicate landmark
// names, disabled clinical chat modes, CSP upgrade directive absence.
// Usage: node .devin/qa/probe-uiux-verify.mjs
import { chromium } from "../../apps/frontend/node_modules/playwright/index.mjs";
import AxeBuilder from "../../apps/frontend/node_modules/@axe-core/playwright/dist/index.mjs";

const BASE = "http://localhost:3330";
const email = process.env.QA_ADMIN_EMAIL ?? "admin@healthcare.local";
const password = process.env.QA_ADMIN_PASSWORD ?? "LocalDemo!2026";
const patientEmail = "patient@healthcare.local";

const results = { startedAt: new Date().toISOString(), checks: [] };
const record = (name, pass, detail) => {
  results.checks.push({ name, status: pass ? "PASS" : "FAIL", detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
};

const geometry = () => {
  const vw = document.documentElement.clientWidth;
  const visible = (e) => {
    const r = e.getBoundingClientRect();
    const s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden";
  };
  // Only count elements that either widen the page (bodyScrollWidth > vw)
  // or poke out of the viewport without a horizontally-scrollable ancestor —
  // intentional overflow-x-auto regions (data tables) are not defects.
  const hasScrollableAncestor = (e) => {
    for (let p = e.parentElement; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      if ((s.overflowX === "auto" || s.overflowX === "scroll") && p.scrollWidth > p.clientWidth + 1) return true;
    }
    return false;
  };
  const offenders = [...document.querySelectorAll("body *")]
    .filter(visible)
    .filter((e) => { const r = e.getBoundingClientRect(); return (r.right > vw + 1 || r.left < -1) && !hasScrollableAncestor(e); })
    .slice(0, 10)
    .map((e) => `${e.tagName.toLowerCase()}.${(e.className?.toString?.() ?? "").split(/\s+/)[0]}`.slice(0, 80));
  const small = [...document.querySelectorAll("button,[role=tab],select,input:not([type=hidden])")]
    .filter(visible)
    .map((e) => { const r = e.getBoundingClientRect(); return { sel: `${e.tagName.toLowerCase()}#${e.id || ""}`, w: Math.round(r.width), h: Math.round(r.height), label: (e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 40) }; })
    .filter((c) => c.h > 0 && c.h < 44);
  // axe landmark-unique semantics: violations need same effective role AND
  // same accessible name. Scoped elements (header/nav inside article/main/
  // section) are not page landmarks, so only count top-level landmarks.
  const landmarkScoping = "article,aside,main,nav,section,[role=article],[role=complementary],[role=main],[role=navigation],[role=region]";
  const landmarks = [...document.querySelectorAll("main,nav,aside,header,footer,section[aria-label],section[aria-labelledby],[role=region],[role=banner],[role=navigation],[role=main],[role=search],[role=contentinfo]")]
    .filter(visible)
    .filter((e) => {
      const p = e.parentElement?.closest(landmarkScoping);
      if (!p) return true; // top-level
      // header/footer are only landmarks when top-level; others nest freely
      const t = e.tagName.toLowerCase();
      return !(t === "header" || t === "footer");
    })
    .map((e) => {
      const t = e.tagName.toLowerCase();
      const role = e.getAttribute("role") ?? (t === "header" ? "banner" : t === "footer" ? "contentinfo" : t === "aside" ? "complementary" : t === "nav" ? "navigation" : t === "main" ? "main" : t === "section" ? "region" : t);
      const name = e.getAttribute("aria-label") || e.getAttribute("aria-labelledby") || "";
      return `${role}|${name}`;
    });
  const dupes = [...new Set(landmarks.filter((l, i) => landmarks.indexOf(l) !== i))];
  return { vw, bodySW: document.body.scrollWidth, offenders, smallCount: small.length, small: small.slice(0, 8), landmarkDupes: [...new Set(dupes)] };
};

const browser = await chromium.launch();

async function login(page, user, pass, next) {
  await page.goto(`${BASE}/auth/login?next=${encodeURIComponent(next)}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.getByLabel("Email", { exact: true }).fill(user);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(pass);
  await page.getByRole("button", { name: /đăng nhập|sign in/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth/"), { timeout: 30_000 });
}

// ── A. CSP check ──────────────────────────────────────────────────────────
{
  const res = await fetch(`${BASE}/`);
  const csp = res.headers.get("content-security-policy") ?? "";
  record("UI-05 CSP upgrade-insecure-requests absent on HTTP", !csp.includes("upgrade-insecure-requests"), csp.includes("upgrade-insecure-requests") ? "still emitted" : "not emitted");
}

// ── B. Public routes @320 + @375: overflow, small controls, landmarks ───────
for (const [name, path] of [
  ["home", "/"],
  ["article", "/articles/phong-ngua-dot-quy-o-nguoi-tre-va-trung-nien"],
  ["search", "/search?q=tim"],
  ["articles-list", "/articles"],
]) {
  const ctx = await browser.newContext({ viewport: { width: 320, height: 720 }, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForTimeout(1600);
  const g = await page.evaluate(geometry);
  record(`overflow @320 ${name}`, g.bodySW <= 321 && g.offenders.length === 0, `bodySW=${g.bodySW} offenders=${JSON.stringify(g.offenders)}`);
  record(`landmarks unique @320 ${name}`, g.landmarkDupes.length === 0, `dupes=${JSON.stringify(g.landmarkDupes)}`);
  await ctx.close();
  const ctx2 = await browser.newContext({ viewport: { width: 375, height: 720 }, hasTouch: true });
  const page2 = await ctx2.newPage();
  await page2.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page2.waitForTimeout(1600);
  const g2 = await page2.evaluate(geometry);
  record(`overflow @375 ${name}`, g2.bodySW <= 376 && g2.offenders.length === 0, `bodySW=${g2.bodySW} offenders=${JSON.stringify(g2.offenders)}`);
  await ctx2.close();
}

// ── C. Touch targets on article toolbar + search chips ────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/articles/phong-ngua-dot-quy-o-nguoi-tre-va-trung-nien`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForTimeout(1500);
  const toolbarBtns = await page.evaluate(() => {
    const btns = [...document.querySelectorAll(".reading-toolbar button, .reading-toolbar a")];
    return btns.map((b) => { const r = b.getBoundingClientRect(); return { label: (b.getAttribute("aria-label") || b.textContent || "").trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) }; });
  });
  const undersized = toolbarBtns.filter((b) => b.w < 44 || b.h < 44);
  record("UX-01 reading-toolbar controls ≥44px", undersized.length === 0, `checked=${toolbarBtns.length} undersized=${JSON.stringify(undersized)}`);

  await page.goto(`${BASE}/search?q=tim`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForTimeout(1500);
  const tabs = await page.evaluate(() => {
    return [...document.querySelectorAll("[role=tab]")].map((t) => { const r = t.getBoundingClientRect(); return { label: (t.textContent || "").trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) }; });
  });
  const smallTabs = tabs.filter((t) => t.h < 44);
  record("UX-01 search filter tabs ≥44px", smallTabs.length === 0, `checked=${tabs.length} undersized=${JSON.stringify(smallTabs)}`);
  await ctx.close();
}

// ── D. Admin pages @320 ────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 320, height: 720 }, hasTouch: true });
  const page = await ctx.newPage();
  await login(page, email, password, "/admin/consultations");
  for (const [name, path] of [["admin-consultations", "/admin/consultations"], ["admin-catalog", "/admin/catalog"], ["admin-payments", "/admin/payments"], ["admin-appointments", "/admin/appointments"]]) {
    await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(1800);
    const g = await page.evaluate(geometry);
    record(`overflow @320 ${name}`, g.bodySW <= 321 && g.offenders.length === 0, `bodySW=${g.bodySW} offenders=${JSON.stringify(g.offenders)}`);
  }
  await ctx.close();
}

// ── E. Patient chat disabled modes ─────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  await login(page, patientEmail, password, "/patient/chat");
  await page.goto(`${BASE}/patient/chat`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForTimeout(2200);
  const modes = await page.evaluate(() => {
    return [...document.querySelectorAll("button")]
      .filter((b) => b.closest("[role=group]"))
      .map((b) => ({ label: (b.textContent || "").trim().slice(0, 50), disabled: b.disabled }));
  });
  const triage = modes.find((m) => m.label.includes("triệu chứng"));
  const edu = modes.find((m) => m.label.includes("sức khỏe") && m.label.includes("Giải"));
  const support = modes.find((m) => m.label.includes("bệnh viện"));
  record("UI-03 triage mode disabled", Boolean(triage?.disabled), JSON.stringify(triage));
  record("UI-03 education mode disabled", Boolean(edu?.disabled), JSON.stringify(edu));
  record("UI-03 support mode enabled", Boolean(support && !support.disabled), JSON.stringify(support));
  await ctx.close();
}

// ── F. Axe on home (landmark-unique + region rules) ────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForTimeout(2500);
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "best-practice"])
    .analyze();
  const landmarkViolations = axe.violations.filter((v) =>
    ["landmark-unique", "region", "landmark-no-duplicate-contentinfo", "landmark-no-duplicate-banner", "landmark-one-main"].includes(v.id));
  record("A11Y landmark rules (axe)", landmarkViolations.length === 0, `violations=${JSON.stringify(landmarkViolations.map((v) => v.id))}`);
  const seriousPlus = axe.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""));
  record("A11Y no serious/critical (axe)", seriousPlus.length === 0, `count=${seriousPlus.length} ids=${JSON.stringify(seriousPlus.map((v) => v.id))}`);
  await ctx.close();
}

await browser.close();
const { writeFileSync, mkdirSync } = await import("node:fs");
mkdirSync("reports", { recursive: true });
writeFileSync("reports/local-audit-uiux-verify.json", JSON.stringify(results, null, 2));
const fails = results.checks.filter((c) => c.status === "FAIL");
console.log(`\n== SUMMARY: ${results.checks.length - fails.length}/${results.checks.length} PASS ==`);
process.exit(fails.length ? 1 : 0);
