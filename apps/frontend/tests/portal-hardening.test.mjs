import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const rootPath = fileURLToPath(root);
const appRoot = join(rootPath, "app");
const read = (relativePath) => readFile(new URL(relativePath, root), "utf8");

const AUDIT_UUID = "00000000-0000-0000-0000-000000000001";

async function collectPageFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const pages = [];
  for (const entry of entries) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) pages.push(...await collectPageFiles(absolute));
    if (entry.isFile() && entry.name === "page.tsx") pages.push(absolute);
  }
  return pages;
}

function routeForPage(pageFile) {
  const rel = relative(appRoot, join(pageFile, ".."));
  if (!rel) return "/";
  return `/${rel.split(/[\\/]/).map((segment) => {
    if (segment === "[slug]") return "route-audit";
    if (segment === "[id]") return AUDIT_UUID;
    return segment;
  }).join("/")}`;
}

async function collectSourceFiles(directory, files = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const resolved = join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectSourceFiles(resolved, files);
      continue;
    }
    if ([".ts", ".tsx"].includes(extname(entry.name))) {
      files.push(resolved);
    }
  }
  return files;
}

test("75 portal routes are partitioned across 4 functional portals without duplicates", async () => {
  const pageFiles = await collectPageFiles(appRoot);
  assert.equal(pageFiles.length, 75, "must contain exactly 75 App Router page.tsx files");

  const actualRoutes = pageFiles.map(routeForPage).sort();
  assert.equal(new Set(actualRoutes).size, 75, "must contain zero duplicate route paths");

  const isPatient = (r) => r === "/patient" || r.startsWith("/patient/");
  const isDoctor = (r) => r === "/doctor" || r.startsWith("/doctor/");
  const isAdmin = (r) => r === "/admin" || r.startsWith("/admin/");
  const isPublic = (r) => !isPatient(r) && !isDoctor(r) && !isAdmin(r);

  const publicRoutes = actualRoutes.filter(isPublic);
  const patientRoutes = actualRoutes.filter(isPatient);
  const doctorRoutes = actualRoutes.filter(isDoctor);
  const adminRoutes = actualRoutes.filter(isAdmin);

  assert.equal(publicRoutes.length, 33, "Public portal & auth must comprise exactly 33 routes");
  assert.equal(patientRoutes.length, 17, "Patient portal must comprise exactly 17 routes");
  assert.equal(doctorRoutes.length, 10, "Doctor portal must comprise exactly 10 routes");
  assert.equal(adminRoutes.length, 15, "Admin portal must comprise exactly 15 routes");
  assert.equal(
    publicRoutes.length + patientRoutes.length + doctorRoutes.length + adminRoutes.length,
    75,
    "all 75 routes must be fully partitioned across the 4 portals",
  );

  // Key routes verification across all portals
  const expectedKeyRoutes = [
    "/",
    "/about",
    "/branches",
    "/branches/route-audit",
    "/specialties",
    "/specialties/route-audit",
    "/doctors",
    "/doctors/route-audit",
    "/services",
    "/services/route-audit",
    "/packages",
    "/packages/route-audit",
    "/articles",
    "/articles/route-audit",
    "/benh-pho-bien",
    "/benh-pho-bien/route-audit",
    "/faq",
    "/huong-dan",
    "/careers",
    "/contact",
    "/chinh-sach-bao-mat",
    "/dat-lich",
    "/tra-cuu",
    "/search",
    "/auth/login",
    "/auth/register",
    "/auth/verify-email",
    "/auth/forgot-password",
    "/auth/reset-password",
    "/patient",
    "/patient/dashboard",
    "/patient/profile",
    "/patient/appointments",
    `/patient/appointments/${AUDIT_UUID}`,
    "/patient/medical-records",
    "/patient/prescriptions",
    "/patient/diagnostic-results",
    "/patient/documents",
    "/patient/notifications",
    "/patient/preferences",
    "/patient/chat",
    "/patient/care-plan",
    "/patient/consultations",
    `/patient/consultations/${AUDIT_UUID}`,
    "/patient/health-questions",
    "/patient/community",
    "/doctor",
    "/doctor/dashboard",
    "/doctor/profile",
    "/doctor/appointments",
    "/doctor/consultations",
    `/doctor/consultations/${AUDIT_UUID}`,
    "/doctor/care-plans",
    "/doctor/health-questions",
    "/doctor/articles",
    "/doctor/ai-content-reviews",
    "/admin",
    "/admin/appointments",
    "/admin/payments",
    "/admin/doctors",
    "/admin/specialties",
    "/admin/branches",
    "/admin/services",
    "/admin/catalog",
    "/admin/schedules",
    "/admin/content",
    "/admin/ai-content-reviews",
    "/admin/ai-credits",
    "/admin/health-questions",
    "/admin/consultations",
    "/admin/careers",
  ];

  for (const keyRoute of expectedKeyRoutes) {
    assert.ok(
      actualRoutes.includes(keyRoute),
      `key route ${keyRoute} must exist in the App Router route inventory`,
    );
  }
});

test("portal access control gates and navigation landmarks are strictly enforced", async () => {
  const [
    patientLayout,
    doctorLayout,
    adminLayout,
    portalGate,
    portalChrome,
    navbar,
  ] = await Promise.all([
    read("app/patient/layout.tsx"),
    read("app/doctor/layout.tsx"),
    read("app/admin/layout.tsx"),
    read("components/PortalAccessGate.tsx"),
    read("components/PortalChrome.tsx"),
    read("components/Navbar.tsx"),
  ]);

  // Gating in layouts
  assert.match(patientLayout, /<PortalAccessGate role="PATIENT">/);
  assert.match(doctorLayout, /<PortalAccessGate role="DOCTOR">/);

  // PortalAccessGate security & fallback contracts
  assert.match(portalGate, /if \(hydrationStatus === "indeterminate"\)/);
  assert.match(portalGate, /if \(hydrationStatus !== "settled"\)/);
  assert.match(portalGate, /if \(!session\)/);
  assert.match(portalGate, /hasRole\(session\.user, role\)/);
  assert.match(portalGate, /roleFallback = `\/\$\{role\.toLowerCase\(\)\}`/);
  assert.match(portalGate, /RETURN_PATH_CONTROL_PATTERN/);

  // Admin layout gate states
  assert.match(adminLayout, /if \(hydrationStatus === "indeterminate"\)/);
  assert.match(adminLayout, /if \(gate\.status === "checking"\)/);
  assert.match(adminLayout, /if \(gate\.status === "unauthenticated"\)/);
  assert.match(adminLayout, /if \(gate\.status === "forbidden"\)/);
  assert.match(adminLayout, /status: "ready"/);

  // Navigation landmarks and skip links
  assert.match(portalChrome, /<a className="skip-link" href="#portal-main-content">/);
  assert.match(portalChrome, /<nav aria-label="Điều hướng cổng thông tin"/);
  assert.match(portalChrome, /aria-current=\{isActive\(link\.href\) \? "page" : undefined\}/);
  assert.match(portalChrome, /<main className="portal-main" id="portal-main-content" tabIndex=\{-1\}>/);
  assert.match(portalChrome, /prefers-reduced-motion/);

  assert.match(adminLayout, /<a className="skip-link" href="#main-content">/);
  assert.match(adminLayout, /<nav aria-label="Điều hướng quản trị"/);
  assert.match(adminLayout, /aria-current=\{active \? "page" : undefined\}/);
  assert.match(adminLayout, /<main className="min-w-0[^>]*id="main-content" tabIndex=\{-1\}>/);

  assert.match(navbar, /<a className="skip-link" href="#main-content">/);
  assert.match(navbar, /<nav aria-label="Điều hướng chính"/);
  assert.match(navbar, /<nav aria-label="Điều hướng trên thiết bị nhỏ"/);
  assert.match(navbar, /<div aria-label="Menu điều hướng" aria-modal="true"[^>]*role="dialog"/);
  assert.match(navbar, /document\.body\.style\.overflow = "hidden"/);
  assert.match(navbar, /document\.body\.style\.overflow = previousOverflow/);
  assert.match(navbar, /if \(event\.key === "Escape"\)/);
});

test("typography rules globally enforce Be Vietnam Pro for Vietnamese UI", async () => {
  const [styles, typography, layout, tailwind] = await Promise.all([
    read("app/styles.css"),
    read("app/typography.css"),
    read("app/layout.tsx"),
    read("tailwind.config.ts"),
  ]);

  // CSS variables in styles.css
  assert.match(styles, /--font-be-vietnam-pro:\s*"Be Vietnam Pro"/);
  assert.match(styles, /--font-inter:\s*"Inter"/);
  assert.match(styles, /--font-display:\s*var\(--font-be-vietnam-pro\)/);
  assert.match(styles, /--font-body:\s*var\(--font-inter\)/);

  // Typography rules in typography.css
  assert.match(typography, /--font-vietnamese-ui:\s*var\(--font-be-vietnam-pro\)/);
  assert.match(typography, /--font-vietnamese-display:\s*var\(--font-be-vietnam-pro\)/);
  assert.match(
    typography,
    /html\[lang="vi"\] body,\s*html\[lang="vi"\] button,\s*html\[lang="vi"\] input,\s*html\[lang="vi"\] select,\s*html\[lang="vi"\] textarea\s*\{\s*font-family:\s*var\(--font-vietnamese-ui\);/,
  );
  assert.match(typography, /html\[lang="vi"\]\s*\{\s*font-synthesis:\s*none;\s*text-rendering:\s*optimizeLegibility;\s*\}/);

  // Root HTML layout attributes & font preloading
  assert.match(layout, /<html lang="vi"/);
  assert.match(layout, /fonts\.googleapis\.com\/css2\?family=Be\+Vietnam\+Pro/);
  assert.match(layout, /family=Plus\+Jakarta\+Sans/);

  // Tailwind configuration
  assert.match(tailwind, /display:\s*\["var\(--font-be-vietnam-pro\)"/);
});

test("clinical design system tokens, teal color palette and flat UI rules are unified", async () => {
  const [styles, tailwind, layout] = await Promise.all([
    read("app/styles.css"),
    read("tailwind.config.ts"),
    read("app/layout.tsx"),
  ]);

  // Clinical teal color palette
  assert.match(styles, /--color-primary:\s*#003336/);
  assert.match(styles, /--color-primary-container:\s*#004b50/);
  assert.match(styles, /--color-secondary:\s*#7c5800/);
  assert.match(styles, /--color-amber:\s*#feb700/);
  assert.match(styles, /--color-paper:\s*#f9f9fc/);
  assert.match(styles, /--color-mint:\s*#e0f2f1/);
  assert.match(layout, /themeColor:\s*"#003336"/);

  assert.match(tailwind, /DEFAULT:\s*"#003336"/);
  assert.match(tailwind, /container:\s*"#004b50"/);
  assert.match(tailwind, /DEFAULT:\s*"#7c5800"/);
  assert.match(tailwind, /container:\s*"#feb700"/);

  // Flat clinical tokens: restrained radius (<= 4px) and zero heavy drop shadows
  assert.match(styles, /--radius-xs:\s*0\.125rem/);
  assert.match(styles, /--radius-sm:\s*0\.25rem/);
  assert.match(styles, /--radius-md:\s*0\.25rem/);
  assert.match(styles, /--radius-lg:\s*0\.125rem/);
  assert.match(styles, /--radius-xl:\s*0\.125rem/);

  assert.match(styles, /--shadow-soft:\s*none/);
  assert.match(styles, /--shadow-lift:\s*none/);
  assert.match(styles, /--shadow-teal-sm:\s*none/);
  assert.match(styles, /--shadow-teal-md:\s*none/);
  assert.match(styles, /--shadow-amber-sm:\s*none/);
  assert.match(styles, /--shadow-ink-sm:\s*none/);

  assert.match(styles, /\.site-shell :is\(\.rounded-lg, \.rounded-xl, \.rounded-2xl, \.rounded-3xl\),/);
  assert.match(styles, /border-radius:\s*var\(--radius-lg\)\s*!important/);

  assert.match(tailwind, /lg:\s*"0\.125rem"/);
  assert.match(tailwind, /xl:\s*"0\.125rem"/);
  assert.match(tailwind, /"2xl":\s*"0\.125rem"/);
  assert.match(tailwind, /"3xl":\s*"0\.125rem"/);
  assert.match(tailwind, /xs:\s*"none"/);
  assert.match(tailwind, /sm:\s*"none"/);
  assert.match(tailwind, /md:\s*"none"/);
  assert.match(tailwind, /lg:\s*"none"/);
  assert.match(tailwind, /xl:\s*"none"/);
  assert.match(tailwind, /"2xl":\s*"none"/);
});

test("0 dead links (href=#, href='', javascript:) across all portal and public components", async () => {
  const sourceFiles = [
    ...await collectSourceFiles(join(rootPath, "app")),
    ...await collectSourceFiles(join(rootPath, "components")),
  ];

  const deadLinkPattern = /href\s*=\s*(?:["'](?:#|javascript:[^"']*)["']|\{\s*["'](?:#|javascript:[^"']*)["']\s*\})/i;
  const emptyHrefPattern = /href\s*=\s*(?:["']\s*["']|\{\s*["']\s*["']\s*\})/i;

  const violations = [];
  for (const file of sourceFiles) {
    const content = await readFile(file, "utf8");
    const lines = content.split(/\r?\n/);
    for (const [idx, line] of lines.entries()) {
      if (deadLinkPattern.test(line) || emptyHrefPattern.test(line)) {
        violations.push({
          file: relative(rootPath, file).replaceAll("\\", "/"),
          line: idx + 1,
          code: line.trim(),
        });
      }
    }
  }

  assert.equal(
    violations.length,
    0,
    `found ${violations.length} dead link(s):\n${JSON.stringify(violations, null, 2)}`,
  );

  // Verify zero "Lorem ipsum" placeholder text in production sources
  const placeholderViolations = [];
  for (const file of sourceFiles) {
    const content = await readFile(file, "utf8");
    if (/Lorem\s+ipsum/i.test(content)) {
      placeholderViolations.push(relative(rootPath, file).replaceAll("\\", "/"));
    }
  }
  assert.equal(
    placeholderViolations.length,
    0,
    `found placeholder text in: ${placeholderViolations.join(", ")}`,
  );
});

test("responsive layout constraints, horizontal overflow containment, and touch targets", async () => {
  const [styles, typography, footer, matrix] = await Promise.all([
    read("app/styles.css"),
    read("app/typography.css"),
    read("components/Footer.tsx"),
    read("tests/e2e/route-matrix.spec.ts"),
  ]);

  // Viewport spectrum coverage in route matrix test
  assert.match(matrix, /width:\s*320,\s*height:\s*720/);
  assert.match(matrix, /width:\s*375,\s*height:\s*812/);
  assert.match(matrix, /width:\s*414,\s*height:\s*896/);
  assert.match(matrix, /width:\s*768,\s*height:\s*1024/);
  assert.match(matrix, /width:\s*1024,\s*height:\s*900/);
  assert.match(matrix, /width:\s*1440,\s*height:\s*1000/);

  // Horizontal overflow containment rules
  assert.match(typography, /overflow-wrap:\s*break-word/);
  assert.match(styles, /\.portal-shell h1,[\s\S]*?overflow-wrap:\s*anywhere/);
  assert.match(styles, /\.portal-header__inner,[\s\S]*?\.portal-content\s*\{\s*width:\s*min\(100% - 2rem,\s*78rem\)/);
  assert.match(styles, /@media \(max-width:\s*900px\)[\s\S]*?\.portal-grid--main\s*\{\s*grid-template-columns:\s*1fr/);
  assert.match(styles, /@media \(max-width:\s*640px\)[\s\S]*?\.portal-clinical-form__context,[\s\S]*?\.portal-clinical-form__grid\s*\{\s*grid-template-columns:\s*1fr/);

  // Touch Target Minimums (>= 44px)
  assert.match(styles, /\.portal-nav__link\s*\{[\s\S]*?min-height:\s*44px/);
  assert.match(styles, /\.portal-context-link\s*\{[\s\S]*?min-height:\s*44px/);
  assert.match(styles, /\.admin-shell button\s*\{[\s\S]*?min-height:\s*44px/);
  assert.match(styles, /\.admin-nav__link\s*\{[\s\S]*?min-height:\s*44px/);
  assert.match(styles, /\.admin-shell input:not\(\[type="checkbox"\]\),[\s\S]*?\.admin-shell select\s*\{[\s\S]*?min-height:\s*44px/);
  assert.match(styles, /\.nav-link\s*\{[\s\S]*?min-height:\s*44px/);
  assert.match(styles, /\.nav-account-link,[\s\S]*?\.nav-menu-button\s*\{[\s\S]*?min-width:\s*44px[\s\S]*?min-height:\s*44px/);
  assert.match(styles, /\.mobile-menu__link\s*\{[\s\S]*?min-height:\s*48px/);

  // Mobile Bottom Care Rail
  assert.match(footer, /<nav aria-label="Lối tắt trên thiết bị nhỏ" className="mobile-care-rail">/);
  assert.match(footer, /href="\/specialties"/);
  assert.match(footer, /href="\/doctors"/);
  assert.match(footer, /href="\/dat-lich"/);
  assert.match(footer, /className="mobile-care-rail__primary"/);

  assert.match(styles, /\.mobile-care-rail\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?bottom:\s*0;[\s\S]*?z-index:\s*60;/);
  assert.match(styles, /\.mobile-care-rail a\s*\{[\s\S]*?min-height:\s*44px/);
  assert.match(styles, /\.site-shell \.mobile-care-rail \.mobile-care-rail__primary/);
  assert.match(styles, /body\.mobile-menu-open \.mobile-care-rail/);
});
