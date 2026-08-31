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

test("known synthetic catalog placeholders become distinct patient-facing labels", async () => {
  const source = await readFile(sourcePath, "utf8");
  const { presentPublicService, presentPublicPackage, presentPublicArticle } = loadModule(source);

  const service = presentPublicService({ id: "1", name: "Dịch vụ y tế 1", slug: "dv-1", description: "placeholder" });
  const service2 = presentPublicService({ id: "2", name: "Dịch vụ y tế 2", slug: "dv-2", description: "placeholder" });
  assert.equal(service.name, "Khám tổng quát");
  assert.notEqual(service.name, service2.name);
  assert.doesNotMatch(service.description, /Dịch vụ khám, tư vấn/);

  const item = presentPublicPackage({ id: "1", name: "Gói khám sức khỏe cấp B #1", slug: "goi-1", description: "placeholder", price: 1 });
  assert.equal(item.name, "Gói kiểm tra sức khỏe cơ bản");
  assert.match(item.description, /Khám tổng quát/);

  const article = presentPublicArticle({ id: "1", title: "Bài viết y khoa số 1", slug: "bv-1", summary: "placeholder", body: "placeholder", publishedAt: "2026-01-01" });
  assert.match(article.title, /Sức khỏe chủ động:/);
  assert.doesNotMatch(article.title, /Bài viết y khoa số/);
});

test("editorial records pass through and duplicate doctor cards collapse", async () => {
  const source = await readFile(sourcePath, "utf8");
  const { presentPublicService, dedupePublicDoctors } = loadModule(source);

  const editorial = { id: "real", name: "Khám chuyên sâu", slug: "kham-chuyen-sau", description: "Nội dung thật" };
  assert.deepEqual(presentPublicService(editorial), editorial);

  const first = { id: "1", fullName: "Lê Văn Đức", slug: "bs-1", bio: "Bác sĩ chuyên khoa với 10 năm kinh nghiệm." };
  const duplicate = { ...first, id: "2", slug: "bs-2" };
  const distinct = { ...first, id: "3", slug: "bs-3", bio: "Bác sĩ chuyên khoa với 11 năm kinh nghiệm." };
  assert.deepEqual(dedupePublicDoctors([first, duplicate, distinct]), [first, distinct]);
});
