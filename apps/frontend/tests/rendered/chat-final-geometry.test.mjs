import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// Reuse the actual React/page renderer and deterministic transport from the
// lifecycle packet, without running that packet's unrelated lifecycle tests.
const renderer = readFileSync(path.join(frontendRoot, "tests/chat-ui-recovery.behavior.test.mjs"), "utf8");
const boundary = renderer.indexOf('for (const surface of ["floating", "patient"]) {');
assert.ok(boundary > 0, "shared React renderer must have an explicit test boundary");
let fixture = renderer.slice(0, boundary);
function replaceFixture(before, after) {
  assert.ok(fixture.includes(before), `shared renderer contract changed: ${before}`);
  fixture = fixture.replace(before, after);
}
replaceFixture(
  'const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");',
  "const frontendRoot = process.cwd();",
);
replaceFixture(
  'const sourceRoot = process.env.CHAT_UI_SOURCE_ROOT ?? frontendRoot;',
  'const sourceRoot = frontendRoot;',
);
replaceFixture('addComponent("components/FloatingHealthAssistant.tsx");', "");
replaceFixture(
  'default: new Proxy({}, { get: (_, key) => String(key) })',
  'default: new Proxy({}, { get: (_, key) => "responsiveChat_" + String(key) })',
);
replaceFixture(
  'React.createElement("main", {}, children)',
  'React.createElement("div", { className: "portal-shell" }, React.createElement("main", { className: "portal-main" }, children))',
);


// Main's shared lifecycle fixture skips when Chromium is absent. This dedicated
// rendered lane must fail that precondition rather than report an unrendered pass.
replaceFixture(
  'const test = (name, fn) => nodeTest(name, { skip: !hasChromium ? "Playwright Chromium not installed" : false }, fn);',
  'assert.ok(hasChromium, "rendered geometry requires installed Playwright Chromium"); const test = (name, fn) => nodeTest(name, fn);',
);

const cases = [
  [606, 764], [320, 568], [375, 667], [768, 764], [768, 1024], [1440, 764], [1440, 900],
];

const checks = `
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import selectorParser from "postcss-selector-parser";
const layout = readFileSync(path.join(frontendRoot, "app/layout.tsx"), "utf8");
const globalImports = [...layout.matchAll(/import\\s+["'](\\.\\/[^"']+\\.css)["'];/g)].map((match) => match[1]);
assert.ok(globalImports.length > 0, "load the actual root layout's CSS imports in their original order");
const configSource = ts.transpileModule(readFileSync(path.join(frontendRoot, "tailwind.config.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const configModule = { exports: {} };
new Function("module", "exports", configSource)(configModule, configModule.exports);
const cssFile = path.join(sourceRoot, "app/patient/chat/chat.module.css");
const scopedCss = postcss.parse(readFileSync(cssFile, "utf8"));
scopedCss.walkRules((rule) => {
  rule.selector = selectorParser((selectors) => {
    const globalClasses = new WeakSet();
    selectors.walkPseudos((pseudo) => {
      if (pseudo.value !== ":global") return;
      pseudo.walkClasses((node) => globalClasses.add(node));
      pseudo.replaceWith(...pseudo.nodes[0].nodes);
    });
    selectors.walkClasses((node) => { if (!globalClasses.has(node)) node.value = "responsiveChat_" + node.value; });
  }).processSync(rule.selector);
});
const globalCss = globalImports.map((file) => readFileSync(path.join(frontendRoot, "app", file), "utf8")).join("\\n");
const css = (await postcss([
  tailwindcss({ ...configModule.exports.default, content: [{ raw: readFileSync(path.join(sourceRoot, "app/patient/chat/page.tsx"), "utf8"), extension: "tsx" }] }),
  autoprefixer(),
]).process(globalCss + "\\n" + scopedCss.toString(), { from: undefined })).css;

for (const [width, height] of ${JSON.stringify(cases)}) {
  test("patient chat pointer geometry " + width + "x" + height, async (t) => {
    const { page, errors } = await mount("patient");
    try {
      await page.setViewportSize({ width, height });
      await page.addStyleTag({ content: css });
      const createButton = page.getByRole("button", { name: "Tạo mới", exact: true });
      await createButton.scrollIntoViewIfNeeded();
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const geometry = await createButton.evaluate((button) => {
        const rect = (element) => {
          const box = element.getBoundingClientRect();
          return { top: box.top, bottom: box.bottom, left: box.left, right: box.right, width: box.width, height: box.height };
        };
        const workspace = document.querySelector('[aria-label="Không gian trò chuyện sức khỏe"]');
        const rail = document.querySelector('[aria-label="Danh sách cuộc trò chuyện"]');
        const thread = document.querySelector('[aria-labelledby="chat-thread-title"]');
        const box = button.getBoundingClientRect();
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        const composer = document.querySelector(".responsiveChat_composer");
        const labelRow = document.querySelector(".responsiveChat_composerLabelRow");
        return {
          workspace: rect(workspace), rail: rect(rail), thread: rect(thread), button: rect(button), composer: rect(composer),
          labelChildren: [...labelRow.children].map(rect),
          gridRows: getComputedStyle(workspace).gridTemplateRows,
          gridColumns: getComputedStyle(workspace).gridTemplateColumns,
          hit: hit?.tagName + "." + hit?.className,
          receivesCenter: !!hit && button.contains(hit),
        };
      });
      t.diagnostic(JSON.stringify(geometry));
      assert.equal(geometry.receivesCenter, true, "enabled Tạo mới must receive its center pointer: " + geometry.hit);
      assert.ok(geometry.rail.height > geometry.button.height, "conversation rail must reserve space for its header");
      if (width <= 900) {
        assert.ok(geometry.thread.top >= geometry.rail.bottom - 1, "stacked rail and thread must not overlap");
        assert.ok(geometry.workspace.bottom >= geometry.thread.bottom - 1, "stacked workspace must contain the entire thread");
      } else {
        assert.ok(geometry.thread.left >= geometry.rail.right - 1, "desktop retains two separate columns");
        assert.ok(Math.abs(geometry.thread.top - geometry.rail.top) < 1, "desktop columns start at the same row");
        assert.ok(geometry.workspace.height <= height * 0.77 + 2, "desktop retains a viewport-bounded chat workspace");
      }
      for (const child of geometry.labelChildren) {
        assert.ok(child.left >= geometry.composer.left - 1 && child.right <= geometry.composer.right + 1,
          "composer label and cost explanation must remain inside the composer at narrow widths");
      }
      assert.ok(geometry.button.width >= 44 && geometry.button.height >= 44, "create retains its touch target");
      await createButton.click();
      await page.getByRole("status").filter({ hasText: "Đã tạo cuộc trò chuyện mới." }).waitFor();
      assert.deepEqual(errors, [], "actual React page must render and handle the unforced pointer click without errors");
    } finally { await page.close(); }
  });
}

test("patient composer explains paid and free responses truthfully", async () => {
  const { page, errors } = await mount("patient");
  try {
    assert.equal(await page.locator(".responsiveChat_composerLabelRow").getByText("Phản hồi tính phí: 1 lượt; hướng dẫn miễn phí: 0 lượt", { exact: true }).count(), 1,
      "render the server-aligned paid/free cost explanation");
    assert.equal(await page.getByText("-1 lượt / câu hỏi", { exact: true }).count(), 0, "remove the unconditional one-credit assertion");
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});
`;

test("actual React patient chat with production CSS preserves responsive pointer access and cost copy", { timeout: 60000 }, (t) => {
  // The parent test runner's binary IPC reporter is not a child CLI reporter.
  const childEnvironment = { ...process.env };
  delete childEnvironment.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ["--input-type=module"], {
    cwd: frontendRoot,
    input: fixture + checks,
    encoding: "utf8",
    timeout: 55000,
    maxBuffer: 4 * 1024 * 1024,
    env: childEnvironment,
  });
  for (const line of ((result.stdout ?? "") + (result.stderr ?? "")).trim().split(/\r?\n/)) t.diagnostic(line);
  assert.ifError(result.error);
  assert.equal(result.status, 0, "actual React/CSS pointer and copy regression must pass; see inner TAP diagnostics");
});
