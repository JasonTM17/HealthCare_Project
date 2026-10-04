import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

/**
 * Functional coverage for the fail-closed image-upload guard and the insert
 * dialog URL policy.
 *
 * A body still holding `blob:`/`data:` image URLs must never reach the store:
 * the blob dies with the tab and the renderer rejects `data:`, so the article
 * would publish a permanently dead image. The dialog policy is the other half
 * of the same boundary — it decides which URLs may be inserted at all.
 */

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

/** Index just past the closing brace of the function starting at `from`. */
function findFunctionEnd(text, from) {
  const open = text.indexOf("{", from);
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === "{") depth += 1;
    else if (text[i] === "}") {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return text.length;
}

/** Lift one top-level function out of a source file by name. */
function grabFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start > 0, `${name} not found`);
  return source.slice(start, findFunctionEnd(source, start));
}

function loadFunctions(source, names) {
  const code = names.map((name) => grabFunction(source, name)).join("\n\n");
  const { outputText } = ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const factory = new Function(
    "exports",
    "module",
    `${outputText}\nreturn { ${names.join(", ")} };`,
  );
  const moduleShim = { exports: {} };
  return factory(moduleShim.exports, moduleShim);
}

const renderer = await read("components/editor/RichContentRenderer.tsx");
const editor = await read("components/editor/RichTextEditor.tsx");

const { hasUnresolvedInlineUpload } = loadFunctions(renderer, [
  "htmlAttribute",
  "hasUnresolvedInlineUpload",
]);
const { normalizedInsertUrl } = loadFunctions(editor, ["normalizedInsertUrl"]);

test("hasUnresolvedInlineUpload flags blob: and data: image URLs in HTML drafts", () => {
  assert.equal(hasUnresolvedInlineUpload('<p><img src="blob:https://host/abc" /></p>'), true);
  assert.equal(hasUnresolvedInlineUpload('<p><img alt="a" src="data:image/png;base64,AA==" /></p>'), true);
  // Attribute order and quoting style must not matter.
  assert.equal(hasUnresolvedInlineUpload("<img alt='x' src='blob:https://host/abc'>"), true);
  assert.equal(hasUnresolvedInlineUpload('<img src=BLOB:https://host/abc>'), true);
});

test("hasUnresolvedInlineUpload flags blob: and data: image URLs in markdown drafts", () => {
  assert.equal(hasUnresolvedInlineUpload("![chart](blob:https://host/abc)"), true);
  assert.equal(hasUnresolvedInlineUpload("![chart](data:image/png;base64,AA==)"), true);
  assert.equal(hasUnresolvedInlineUpload("Trước\n\n![x](blob:https://h/y)\n\nSau"), true);
});

test("hasUnresolvedInlineUpload leaves stored URLs and non-image schemes alone", () => {
  assert.equal(hasUnresolvedInlineUpload('<p><img src="/media/a.png" /></p>'), false);
  assert.equal(hasUnresolvedInlineUpload('<p><img src="https://cdn.example/a.png" /></p>'), false);
  assert.equal(hasUnresolvedInlineUpload("![chart](/media/a.png)"), false);
  assert.equal(hasUnresolvedInlineUpload("![chart](https://cdn.example/a.png)"), false);
  // A data: URL inside a *link* is not an image; the renderer already guards
  // link targets separately, so this guard stays scoped to image emission.
  assert.equal(hasUnresolvedInlineUpload("[tài liệu](data:foo)"), false);
  assert.equal(hasUnresolvedInlineUpload(""), false);
  assert.equal(hasUnresolvedInlineUpload("plain text"), false);
});

test("normalizedInsertUrl accepts only http(s) or root-relative targets", () => {
  assert.equal(normalizedInsertUrl("https://benhvien.vn/a"), "https://benhvien.vn/a");
  assert.equal(normalizedInsertUrl("http://benhvien.vn/a"), "http://benhvien.vn/a");
  assert.equal(normalizedInsertUrl("/media/a.png"), "/media/a.png");
  assert.equal(normalizedInsertUrl("  /media/a.png  "), "/media/a.png");

  assert.equal(normalizedInsertUrl("javascript:alert(1)"), null);
  assert.equal(normalizedInsertUrl("data:image/png;base64,x"), null);
  assert.equal(normalizedInsertUrl("//evil.example/x"), null);
  assert.equal(normalizedInsertUrl(""), null);
  assert.equal(normalizedInsertUrl("   "), null);
  assert.equal(normalizedInsertUrl("ftp://example/x"), null);
  assert.equal(normalizedInsertUrl("relative/path.png"), null);
});
