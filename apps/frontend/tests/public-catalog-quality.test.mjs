import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";

const requireFromTest = createRequire(import.meta.url);
const ts = requireFromTest("typescript");
const sourcePath = new URL("../lib/public-catalog.ts", import.meta.url);

function loadModule(source) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: "public-catalog.ts",
  }).outputText;
  const runtimeModule = { exports: {} };
  vm.runInNewContext(output, {
    module: runtimeModule,
    exports: runtimeModule.exports,
    require: () => ({}),
  }, { filename: "public-catalog.ts" });
  return runtimeModule.exports;
}

test("catalog source contains no content-substitution machinery", async () => {
  const source = await readFile(sourcePath, "utf8");
  assert.doesNotMatch(
    source,
    /BIG_DATA_CLINICAL_ARTICLES|SERVICE_VARIANTS|PACKAGE_VARIANTS|presentPublicArticle|presentPublicService|presentPublicPackage|fixtureIndex|resolveCover/,
    "the catalog module must never rewrite backend content client-side",
  );
  assert.doesNotMatch(
    source,
    /Trần Quốc Huy/,
    "frontend-authored clinical copy and fixture authors must stay deleted",
  );
});

test("catalog records pass through unchanged and duplicate doctor cards collapse", async () => {
  const source = await readFile(sourcePath, "utf8");
  const { dedupePublicDoctors, presentPublicPage } = loadModule(source);

  const service = { id: "real", name: "Chụp cộng hưởng từ MRI sọ não", slug: "dv-1", description: "Nội dung thật từ backend" };
  const article = { id: "a1", title: "Phòng ngừa đột quỵ ở người trẻ", slug: "phong-ngua-dot-quy", summary: "Tóm tắt thật", body: "Nội dung thật" };
  const pkg = { id: "p1", name: "Gói khám Sức khỏe VIP Doanh nhân Toàn diện", slug: "goi-1", description: "Nội dung thật", price: 1 };

  assert.deepEqual(dedupePublicDoctors([]), []);
  assert.deepEqual(
    presentPublicPage({ content: [article], totalElements: 1 }, (value) => value).content,
    [article],
    "pages must pass through untouched",
  );
  assert.equal(service.slug, "dv-1");
  assert.equal(article.title, "Phòng ngừa đột quỵ ở người trẻ");
  assert.equal(pkg.name, "Gói khám Sức khỏe VIP Doanh nhân Toàn diện");

  const first = { id: "1", fullName: "Lê Văn Đức", slug: "bs-1", bio: "Bác sĩ chuyên khoa với 10 năm kinh nghiệm." };
  const duplicate = { ...first, id: "2", slug: "bs-2" };
  const distinct = { ...first, id: "3", slug: "bs-3", bio: "Bác sĩ chuyên khoa với 11 năm kinh nghiệm." };
  assert.deepEqual(dedupePublicDoctors([first, duplicate, distinct]), [first, distinct]);
});
