import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

/**
 * Round-10 matrix finding: a title containing " - " produced a slug with a
 * run of hyphens (p2-matrix---quy-trinh) which the backend rejected on the
 * next edit, making the article permanently uneditable. Both editors carry a
 * copy of toSlug, so the behavior is exercised on the real sources rather
 * than asserted as text.
 */
const PAGES = [
  "../app/admin/catalog/page.tsx",
  "../app/doctor/articles/page.tsx",
];

function extractToSlug(source) {
  const start = source.indexOf("function toSlug(");
  assert.notEqual(start, -1, "toSlug must exist");
  const end = source.indexOf("\n}", start);
  assert.notEqual(end, -1, "toSlug must be terminated");
  const fn = source.slice(start, end + 2);
  const js = ts.transpileModule(`${fn}\nmodule.exports = { toSlug };`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = { exports: {} };
  new Function("module", "exports", js)(mod, mod.exports);
  return mod.exports.toSlug;
}

for (const page of PAGES) {
  test(`toSlug in ${page} collapses hyphen runs and trims edges`, async () => {
    const source = await readFile(new URL(page, import.meta.url), "utf8");
    const toSlug = extractToSlug(source);

    assert.equal(toSlug("P2 matrix - quy trình"), "p2-matrix-quy-trinh");
    assert.equal(toSlug("Nhịp tim chậm — khi nào?"), "nhip-tim-cham-khi-nao");
    assert.equal(toSlug("  --Dư--  thừa--  "), "du-thua");
    assert.equal(toSlug("Bình thường"), "binh-thuong");
    // The kebab contract the backend validates on the next edit.
    for (const title of ["P2 matrix - quy trình", "A - B - C", "Ung thư - dấu hiệu"]) {
      assert.match(toSlug(title), /^[a-z0-9]+(?:-+[a-z0-9]+)*$/);
      assert.doesNotMatch(toSlug(title), /--/);
    }
  });
}
