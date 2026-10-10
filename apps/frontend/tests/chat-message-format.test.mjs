import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const source = readFileSync(file, "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true,
  }}).outputText;
  const loadedModule = { exports: {} };
  cache.set(file, loadedModule.exports);
  function scopedRequire(name) {
    if (!name.startsWith(".")) return require(name);
    const base = path.resolve(path.dirname(file), name);
    for (const extension of [".ts", ".tsx"]) {
      try { return load(base + extension); } catch (error) { if (error.code !== "ENOENT") throw error; }
    }
    throw new Error(`Missing source module ${name}`);
  }
  new Function("require", "module", "exports", compiled)(scopedRequire, loadedModule, loadedModule.exports);
  cache.set(file, loadedModule.exports);
  return loadedModule.exports;
}
const Content = load(path.resolve("components/ChatMessageContent.tsx")).default;
const render = (content) => renderToStaticMarkup(React.createElement(Content, { content }));
const screenshotText = "Kiểm tra sức khỏe sinh sản, xét nghiệm bệnh truyền nhiễm. Giá: 3600000 VND • Đối tượng: Các cặp đôi chuẩn bị kết hôn muốn xây dựng gia đình. • Số ngày: 2. Xét nghiệm và chẩn đoán: Dịch vụ: Xét nghiệm và chẩn đoán.";

test("screenshot package fields and inline bullets are separate readable blocks without changing values", () => {
  const html = render(screenshotText);
  assert.match(html, /<strong>Giá:<\/strong>/);
  assert.match(html, /<li[^>]*><strong>Đối tượng:<\/strong>/);
  assert.match(html, /<strong>Số ngày:<\/strong>/);
  assert.match(html, /<strong>Xét nghiệm và chẩn đoán:<\/strong>/);
  assert.ok(!html.includes("VND • Đối tượng"));
  assert.ok(html.includes("3600000 VND"));
  assert.ok(html.includes("Các cặp đôi chuẩn bị kết hôn muốn xây dựng gia đình."));
});

test("streaming partial field stays readable and complete/reloaded rendering is deterministic", () => {
  const partial = render("Thông tin gói. Giá: 3600000 VND • Đối tượng:");
  assert.match(partial, /<strong>Giá:<\/strong>/);
  assert.match(partial, /<strong>Đối tượng:<\/strong>/);
  assert.equal(render(screenshotText), render(screenshotText));
});

test("ordinary prose, source links, code and literal HTML remain intact and safe", () => {
  const html = render("Giá trị xét nghiệm phải do bác sĩ đánh giá.\n`Giá: 10 • Đối tượng: mẫu`\n[Nguồn](https://example.test/?q=a•b)\n<script>alert(1)</script>");
  assert.ok(html.includes("Giá trị xét nghiệm phải do bác sĩ đánh giá."));
  assert.ok(html.includes("Giá: 10 • Đối tượng: mẫu"));
  assert.ok(html.includes("https://example.test/?q=a•b"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<script>"));
});

test("existing markdown headings and ordered/unordered lists retain their semantics", () => {
  const html = render("## Gói kiểm tra\n- **Lưu ý:** Hỏi bác sĩ.\n- Đọc nguồn.\n\n1. Đặt lịch\n2. Xác nhận");
  assert.match(html, /<ul[^>]*>/);
  assert.match(html, /<ol[^>]*>/);
  assert.match(html, /<strong[^>]*>Lưu ý:<\/strong>/);
});

test("fenced examples keep literal labels and bullets, including incomplete streamed fences", () => {
  const text = "Giá: 10 • Đối tượng: mẫu";
  const complete = render("```text\n" + text + "\n```");
  const partial = render("```text\n" + text);
  assert.match(complete, /<code>Giá: 10 • Đối tượng: mẫu<\/code>/);
  assert.match(partial, /<code>Giá: 10 • Đối tượng: mẫu<\/code>/);
});
