import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = new URL("../", import.meta.url);
const rootPath = fileURLToPath(root);
const read = (relativePath) => readFile(new URL(relativePath, root), "utf8");

async function collectSourceFiles(directory, includePath = () => true, files = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.isDirectory()) {
      continue;
    }

    const resolved = join(directory, entry.name);
    const relativePath = relative(rootPath, resolved).replaceAll("\\", "/");
    if (!includePath(relativePath)) {
      continue;
    }

    if (entry.isDirectory()) {
      await collectSourceFiles(resolved, includePath, files);
      continue;
    }

    if ([".ts", ".tsx"].includes(extname(entry.name))) {
      files.push(resolved);
    }
  }

  return files;
}

test("public chrome and browser icon reuse the original shield-heart brand mark", async () => {
  const [mark, navbar, footer, icon] = await Promise.all([
    read("components/BrandMark.tsx"),
    read("components/Navbar.tsx"),
    read("components/Footer.tsx"),
    read("app/icon.svg"),
  ]);

  assert.match(mark, /viewBox="0 0 64 64"/);
  assert.match(mark, /brand-emblem__shield/);
  assert.match(mark, /brand-emblem__heart/);
  assert.match(mark, /brand-emblem__pulse/);
  assert.match(navbar, /<BrandMark \/>/);
  assert.match(footer, /<BrandMark tone="inverse" \/>/);
  assert.doesNotMatch(navbar, /name="plus"/);
  assert.doesNotMatch(footer, /name="plus"/);
  assert.match(icon, /viewBox="0 0 64 64"/);
  assert.match(icon, /stroke="#075f5e"/);
});

test("root layout renders content immediately without a blocking brand splash", async () => {
  const layout = await read("app/layout.tsx");

  assert.doesNotMatch(layout, /next\/font\/google/);
  assert.doesNotMatch(layout, /BrandSplash/);
  assert.doesNotMatch(layout, /healthcare-brand-intro-v1/);
  assert.match(layout, /type="application\/ld\+json"/);
  assert.match(layout, /JSON\.stringify\([\s\S]*\.replace\(\/<\/g, "\\\\u003c"\)/);
  assert.match(layout, /<body[^>]*>[\s\S]*\{children\}[\s\S]*<FloatingHealthAssistant \/>[\s\S]*<\/body>/);
});

test("live CSS uses one documented primary teal without dual live brand greens", async () => {
  const [styles, layout, brand] = await Promise.all([
    read("app/styles.css"),
    read("app/layout.tsx"),
    read("app/brand-experience.css"),
  ]);

  assert.match(styles, /--color-primary:\s*#003336/);
  assert.match(styles, /--color-paper:\s*#f9f9fc/);
  assert.match(styles, /--color-mint:\s*#e0f2f1/);
  assert.match(layout, /themeColor: "#003336"/);
  assert.doesNotMatch(styles, /--color-primary:\s*#001c1e/);
  assert.doesNotMatch(layout, /#087b78/);
  assert.doesNotMatch(brand, /#087b78/);
});

test("typography variables provide deterministic font fallbacks without build-time remote fetches", async () => {
  const styles = await read("app/styles.css");

  assert.match(styles, /--font-be-vietnam-pro:\s*"Be Vietnam Pro"/);
  assert.match(styles, /--font-inter:\s*"Inter"/);
  assert.match(styles, /--font-display:\s*var\(--font-be-vietnam-pro\)/);
  assert.match(styles, /--font-body:\s*var\(--font-inter\)/);
});

test("footer uses readable inverse identity, landmark navigation and responsive contact card", async () => {
  const [footer, styles] = await Promise.all([
    read("components/Footer.tsx"),
    read("app/brand-experience.css"),
  ]);

  assert.match(footer, /aria-label="Khám phá HealthCare"/);
  assert.match(footer, /aria-label="Hỗ trợ người bệnh"/);
  assert.match(footer, /className="footer-contact__eyebrow"/);
  assert.match(footer, /className="footer-assurances"/);
  assert.match(styles, /\.site-shell \.site-footer \{/);
  assert.match(styles, /background: #082f3c/);
  assert.match(styles, /\.brand-link--footer \.brand-copy strong/);
  assert.match(styles, /color: #ffffff/);
  assert.match(styles, /@media \(max-width: 640px\)/);
});

test("public frontend source only renders the reference hospital brand in the about attribution note", async () => {
  const [appFiles, componentFiles] = await Promise.all([
    collectSourceFiles(
      fileURLToPath(new URL("app", root)),
      (relativePath) => !/^app\/(admin|api|auth|doctor|patient)(\/|$)/.test(relativePath),
    ),
    collectSourceFiles(fileURLToPath(new URL("components", root))),
  ]);

  const offenders = [];
  for (const file of [...appFiles, ...componentFiles]) {
    const source = await readFile(file, "utf8");
    const normalized = relative(rootPath, file).replaceAll("\\", "/");
    const allowedAboutAttribution =
      normalized === "app/about/page.tsx"
      && source.includes("Tham khảo từ trang web Bệnh viện Hoàn Mỹ.")
      && (source.match(/Hoan My|Hoàn Mỹ|hoanmy/gi) ?? []).length === 1;
    if (/Hoan My|Hoàn Mỹ|hoanmy/i.test(source) && !allowedAboutAttribution) {
      offenders.push(relative(rootPath, file).replaceAll("\\", "/"));
    }
  }

  assert.deepEqual(offenders, []);
});
