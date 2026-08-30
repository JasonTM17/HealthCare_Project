import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

const BROWSER_SECRET_PATTERN = /sessionStorage|localStorage|document\.cookie|Authorization|Bearer|accessToken|refreshToken|tokenType/iu;
const RAW_ERROR_MESSAGE_PATTERN = /\b(?:error|reason|cause|exception)\.message\b/iu;

test("patient, doctor and admin shells keep role gates and keyboard landmarks explicit", async () => {
  const [portalChrome, portalGate, adminLayout, patientLayout, doctorLayout, portalStates] = await Promise.all([
    read("components/PortalChrome.tsx"),
    read("components/PortalAccessGate.tsx"),
    read("app/admin/layout.tsx"),
    read("app/patient/layout.tsx"),
    read("app/doctor/layout.tsx"),
    read("components/PortalStates.tsx"),
  ]);

  assert.match(portalChrome, /<a className="skip-link" href="#portal-main-content">/);
  assert.match(portalChrome, /<nav aria-label="Điều hướng cổng thông tin"/);
  assert.match(portalChrome, /aria-current=\{isActive\(link\.href\) \? "page" : undefined\}/);
  assert.match(portalChrome, /<main className="portal-main" id="portal-main-content" tabIndex=\{-1\}>/);
  assert.match(portalChrome, /href: "\/patient\/medical-records"/);
  assert.match(portalChrome, /href: "\/patient\/prescriptions"/);
  assert.match(portalChrome, /href: "\/patient\/diagnostic-results"/);
  assert.match(adminLayout, /href: "\/admin\/consultations"/);

  assert.match(adminLayout, /<a className="skip-link" href="#main-content">/);
  assert.match(adminLayout, /<nav aria-label="Điều hướng quản trị"/);
  assert.match(adminLayout, /aria-current=\{active \? "page" : undefined\}/);
  assert.match(adminLayout, /<main className="min-w-0[^>]*id="main-content" tabIndex=\{-1\}>/);

  assert.match(patientLayout, /<PortalAccessGate role="PATIENT">/);
  assert.match(doctorLayout, /<PortalAccessGate role="DOCTOR">/);
  assert.match(portalGate, /if \(hydrationStatus === "indeterminate"\)/);
  assert.match(portalGate, /if \(hydrationStatus !== "settled"\)/);
  assert.match(portalGate, /if \(!session\)/);
  assert.match(portalGate, /hasRole\(session\.user, role\)/);
  assert.ok(
    portalGate.indexOf('hydrationStatus === "indeterminate"') < portalGate.indexOf("return children"),
    "portal children must remain unreachable while session authority is unresolved",
  );

  assert.match(adminLayout, /if \(hydrationStatus === "indeterminate"\)/);
  assert.match(adminLayout, /if \(gate\.status === "checking"\)/);
  assert.match(adminLayout, /if \(gate\.status === "unauthenticated"\)/);
  assert.match(adminLayout, /if \(gate\.status === "forbidden"\)/);
  assert.ok(
    adminLayout.indexOf('hydrationStatus === "indeterminate"') < adminLayout.indexOf("return <AdminShell"),
    "admin content must remain unreachable while session authority is unresolved",
  );

  assert.match(portalStates, /aria-live="polite"[^>]*className="portal-state portal-state--loading" role="status"/);
  assert.match(portalStates, /aria-live="assertive"[^>]*className="portal-state portal-state--error" role="alert"/);
});

test("portal and admin controls expose 44px targets, visible focus and responsive reflow", async () => {
  const [styles, adminLayout, portalGate] = await Promise.all([
    read("app/styles.css"),
    read("app/admin/layout.tsx"),
    read("components/PortalAccessGate.tsx"),
  ]);

  assert.match(styles, /a:focus-visible,[\s\S]*?button:focus-visible,[\s\S]*?outline:\s*3px solid/);
  assert.match(styles, /\.portal-nav__link\s*\{[\s\S]*?min-height:\s*44px/);
  assert.match(styles, /\.portal-context-link\s*\{[\s\S]*?min-height:\s*44px/);
  assert.match(styles, /\.portal-shell > \.skip-link,[\s\S]*?\.admin-shell > \.skip-link\s*\{[\s\S]*?min-height:\s*44px/);
  assert.match(styles, /\.admin-shell button\s*\{[\s\S]*?min-height:\s*44px/);
  assert.match(styles, /\.admin-shell input:not\(\[type="checkbox"\]\),[\s\S]*?\.admin-shell select\s*\{[\s\S]*?min-height:\s*44px/);
  assert.match(styles, /\.admin-shell label:has\(input\[type="checkbox"\]\)\s*\{[\s\S]*?min-height:\s*44px/);

  // Tailwind's min-h-11 token is 44px; keep gate recovery actions touch-safe too.
  assert.match(adminLayout, /className="[^"\n]*min-h-11/);
  assert.match(portalGate, /className="[^"\n]*min-h-11/);

  assert.match(styles, /@media \(max-width:\s*900px\)[\s\S]*?\.portal-grid--main\s*\{\s*grid-template-columns:\s*1fr/);
  assert.match(styles, /@media \(max-width:\s*640px\)[\s\S]*?\.portal-clinical-form__context,[\s\S]*?\.portal-clinical-form__grid\s*\{\s*grid-template-columns:\s*1fr/);
  assert.match(styles, /\.portal-header__inner,[\s\S]*?\.portal-content\s*\{\s*width:\s*min\(100% - 2rem,\s*78rem\)/);
  assert.match(styles, /\.portal-shell h1,[\s\S]*?overflow-wrap:\s*anywhere/);
  assert.match(adminLayout, /className="min-w-0 /);
});

test("shell motion, safe-area and zoom contracts preserve user settings", async (t) => {
  const [styles, assistantStyles, typography, layout] = await Promise.all([
    read("app/styles.css"),
    read("components/FloatingHealthAssistant.module.css"),
    read("app/typography.css"),
    read("app/layout.tsx"),
  ]);

  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?scroll-behavior:\s*auto !important/);
  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.portal-shell \*/, "portal/admin reduced-motion override must stay scoped and explicit");
  assert.match(assistantStyles, /right:\s*max\(1rem,\s*env\(safe-area-inset-right\)\)/);
  assert.match(assistantStyles, /bottom:\s*calc\([^;]*max\(1rem,\s*env\(safe-area-inset-bottom\)\)\)/);
  assert.match(assistantStyles, /@media \(max-width:\s*640px\)[\s\S]*?env\(safe-area-inset-right\)[\s\S]*?env\(safe-area-inset-bottom\)/);
  assert.match(styles, /\.portal-shell\s*\{[\s\S]*?padding-inline:\s*max\(0px,\s*env\(safe-area-inset-left\)\)\s+max\(0px,\s*env\(safe-area-inset-right\)\)/);
  assert.match(styles, /\.admin-shell\s*\{[\s\S]*?padding-inline:\s*max\(0px,\s*env\(safe-area-inset-left\)\)\s+max\(0px,\s*env\(safe-area-inset-right\)\)/);
  assert.match(styles, /\.portal-footer\s*\{[\s\S]*?padding-bottom:\s*max\(var\(--sp-6\),\s*calc\(var\(--sp-6\)\s*\+\s*env\(safe-area-inset-bottom\)\)\)/);

  // Do not disable browser text resizing. The route/browser matrix is the live
  // proof for 200% layout width; these source contracts prevent common locks.
  assert.match(layout, /width:\s*"device-width"/);
  assert.match(layout, /initialScale:\s*1/);
  assert.doesNotMatch(layout, /maximumScale|userScalable/iu);
  assert.doesNotMatch(styles, /(?:^|\n)\s*zoom\s*:/iu);
  assert.match(styles, /\*\s*,\s*\n\s*\*::before[\s\S]*?box-sizing:\s*border-box/);
  assert.match(styles, /body\s*\{[\s\S]*?overflow-x:\s*hidden/);

  const allStyles = `${styles}\n${assistantStyles}\n${typography}`;
  assert.doesNotMatch(allStyles, /forced-color-adjust\s*:\s*none/iu);
  if (/@media\s*\(\s*forced-colors\s*:\s*active\s*\)/iu.test(allStyles)) {
    assert.match(allStyles, /@media\s*\(\s*forced-colors\s*:\s*active\s*\)[\s\S]*?color:\s*LinkText/iu);
    assert.match(allStyles, /@media\s*\(\s*forced-colors\s*:\s*active\s*\)[\s\S]*?background:\s*ButtonFace/iu);
    assert.match(allStyles, /@media\s*\(\s*forced-colors\s*:\s*active\s*\)[\s\S]*?outline:\s*3px solid Highlight/iu);
  } else {
    t.diagnostic("PRODUCTION GAP: no explicit @media (forced-colors: active) override is present; native forced-color adaptation is not disabled.");
  }
});

test("logout and browser-session boundaries fail closed without raw errors or bearer storage", async () => {
  const paths = [
    "lib/api-client.ts",
    "components/PortalChrome.tsx",
    "components/Navbar.tsx",
    "components/PortalAccessGate.tsx",
    "app/admin/layout.tsx",
    "app/patient/layout.tsx",
    "app/doctor/layout.tsx",
  ];
  const sources = await Promise.all(paths.map(async (path) => [path, await read(path)]));

  for (const [path, source] of sources) {
    assert.doesNotMatch(source, BROWSER_SECRET_PATTERN, `${path} must not expose browser-readable auth material`);
    assert.doesNotMatch(source, RAW_ERROR_MESSAGE_PATTERN, `${path} must not render a raw caught error message`);
  }

  const apiClient = Object.fromEntries(sources)["lib/api-client.ts"];
  assert.match(apiClient, /credentials:\s*"same-origin"/);
  assert.match(apiClient, /SAFE_LOGOUT_ERROR_MESSAGE/);
  assert.match(apiClient, /AUTH_SESSION_INDETERMINATE_MESSAGE/);

  for (const [path, source] of sources.filter(([name]) => ["components/PortalChrome.tsx", "app/admin/layout.tsx"].includes(name))) {
    assert.match(source, /const outcome = await logoutCurrentUser\(\)/, `${path} must inspect logout authority`);
    const authorityIndex = source.indexOf('outcome.status === "LOGGED_OUT"');
    const redirectIndex = source.indexOf("router.replace", authorityIndex);
    assert.ok(authorityIndex >= 0 && redirectIndex > authorityIndex, `${path} must redirect only after confirmed revocation`);
    const finallyIndex = source.indexOf("finally", authorityIndex);
    if (finallyIndex >= 0) assert.doesNotMatch(source.slice(finallyIndex, finallyIndex + 180), /router\.replace/);
    assert.match(source, /SAFE_LOGOUT_ERROR_MESSAGE/);
    assert.match(source, /aria-live="polite"/);
    assert.match(source, /role="status"/);
  }
});
