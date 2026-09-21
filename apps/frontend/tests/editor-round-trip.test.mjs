import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

/**
 * Round-trip regression coverage for the editor's HTML <-> markdown pipeline.
 *
 * Each case pins a defect that silently changed or lost content the author had
 * written. They are behavioural rather than source-shaped: the converter is
 * extracted from the module between two markers and transpiled, because the
 * functions under test are pure and the JSX component that follows them is not.
 */

const source = await readFile(
  new URL("../components/editor/RichContentRenderer.tsx", import.meta.url),
  "utf8",
);

/**
 * Slice the JSX-free region and run it.
 *
 * It runs from the entity table (the first thing the converters need) to the end
 * of `markdownToHtml`; `RichContentRenderer` and the block-list component below
 * that point contain JSX, which cannot be evaluated as plain script. TypeScript
 * does the stripping rather than a pattern, so an annotation this test has not
 * seen before cannot break it.
 */
/**
 * Copy one top-level function out of the module by name.
 *
 * `markdownToHtml` calls the table-detection helpers, which live in the block
 * parser above the entity table and sit next to JSX that cannot be evaluated.
 * They are pure, so they are lifted in individually rather than pulling the
 * whole region.
 */
function grabFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start > 0, `${name} not found`);
  return source.slice(start, findFunctionEnd(source, start));
}

function extractConverters() {
  const start = source.indexOf("const HTML_NAMED_ENTITY_MAP");
  const componentStart = source.indexOf("export function RichContentRenderer(");
  assert.ok(start > 0, "entity table not found");
  assert.ok(componentStart > start, "component boundary not found");

  const slice = source.slice(start, componentStart);
  const lastConverter = slice.lastIndexOf("export function markdownToHtml(");
  const end = findFunctionEnd(slice, lastConverter);

  const preamble = ["isTableSeparator", "isTableStart"].map(grabFunction).join("\n\n");

  const { outputText } = ts.transpileModule(`${preamble}\n\n${slice.slice(0, end)}`, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });

  // The transpiler emits a CommonJS preamble, so the shim supplies `exports`;
  // the functions themselves are declared at the top level and returned here.
  const factory = new Function("exports", "module", `${outputText}
    return { htmlToMarkdown, markdownToHtml, toStoredArticleBody };`);
  const moduleShim = { exports: {} };
  return factory(moduleShim.exports, moduleShim);
}

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

const { htmlToMarkdown, markdownToHtml, toStoredArticleBody } = extractConverters();

// -- C4: underline ---------------------------------------------------------------

test("C4 underline survives the HTML to markdown round trip", () => {
  const markdown = htmlToMarkdown("<p>Dùng <u>đúng liều</u> mỗi ngày.</p>");

  assert.ok(markdown.includes("<u>đúng liều</u>"), `underline lost: ${markdown}`);
  assert.ok(markdown.includes("Dùng"), "surrounding text lost");
  // The sentinel must not survive into stored content.
  assert.doesNotMatch(markdown, /[\u0001]/, "internal sentinel leaked into the output");
});

test("C4 underline is not left as a dangling tag", () => {
  const markdown = htmlToMarkdown("<p><u>cả câu được gạch chân</u></p>");

  assert.equal((markdown.match(/<u>/g) ?? []).length, 1);
  assert.equal((markdown.match(/<\/u>/g) ?? []).length, 1);
});

// -- C5: callouts with nested blocks ---------------------------------------------

test("C5 a callout containing a nested div is not truncated", () => {
  const html =
    '<div class="clinical-warning" data-title="Chống chỉ định">'
    + "<p>Không dùng cho bệnh nhân suy thận.</p>"
    + '<div style="text-align: center;"><p>Liều tối đa 2 g/ngày</p></div>'
    + "<p>Kiểm tra chức năng thận trước khi dùng.</p>"
    + "</div>";

  const markdown = htmlToMarkdown(html);

  assert.ok(markdown.includes(":::clinical-warning"), `callout not emitted: ${markdown}`);
  assert.ok(markdown.includes("Chống chỉ định"), "callout title lost");
  assert.ok(markdown.includes("Không dùng cho bệnh nhân suy thận."), "leading paragraph lost");
  assert.ok(markdown.includes("Liều tối đa 2 g/ngày"), "nested block truncated away");
  assert.ok(markdown.includes("Kiểm tra chức năng thận trước khi dùng."), "trailing paragraph lost");
  assert.ok(markdown.trimEnd().endsWith(":::"), "closing fence missing");
});

test("C5 two sibling callouts are both converted", () => {
  const html =
    '<div class="doctor-note" data-title="Lời khuyên"><p>Uống đủ nước.</p></div>'
    + '<div class="emergency-box" data-title="Cấp cứu"><p>Gọi 115.</p></div>';

  const markdown = htmlToMarkdown(html);

  assert.ok(markdown.includes(":::doctor-note"), "first callout lost");
  assert.ok(markdown.includes(":::emergency-box"), "second callout lost");
  assert.ok(markdown.includes("Uống đủ nước."));
  assert.ok(markdown.includes("Gọi 115."));
});

// -- C6: tables ------------------------------------------------------------------

test("C6 a literal pipe inside a cell does not split the row", () => {
  const html =
    "<table><tr><th>Thuốc</th><th>Liều</th></tr>"
    + "<tr><td>Amlodipine</td><td>5 mg | 3 lần/ngày</td></tr></table>";

  const markdown = htmlToMarkdown(html);
  const row = markdown.split("\n").find((line) => line.includes("Amlodipine"));

  assert.ok(row, `drug row missing: ${markdown}`);
  // The escaped pipe keeps the row at two cells: header + separator + this row.
  assert.ok(row.includes("5 mg \\| 3 lần/ngày"), `pipe not escaped: ${row}`);
});

test("C6 table cells keep inline emphasis", () => {
  const html =
    "<table><tr><th>Chỉ số</th></tr>"
    + "<tr><td><strong>Huyết áp</strong> mục tiêu &lt; 140/90</td></tr></table>";

  const markdown = htmlToMarkdown(html);

  assert.ok(markdown.includes("**Huyết áp**"), `inline markup stripped: ${markdown}`);
  assert.ok(markdown.includes("140/90"), "cell value lost");
});

// -- C7: image attributes --------------------------------------------------------

test("C7 alt text survives regardless of attribute order", () => {
  const srcFirst = htmlToMarkdown('<p><img src="/media/a.jpg" alt="Phác đồ điều trị" /></p>');
  const altFirst = htmlToMarkdown('<p><img alt="Phác đồ điều trị" src="/media/a.jpg" /></p>');

  assert.ok(srcFirst.includes("![Phác đồ điều trị](/media/a.jpg)"), srcFirst);
  assert.ok(altFirst.includes("![Phác đồ điều trị](/media/a.jpg)"), altFirst);
  assert.equal(srcFirst.trim(), altFirst.trim(), "attribute order changed the output");
});

test("C7 an image with no alt still converts", () => {
  const markdown = htmlToMarkdown('<p><img src="/media/b.jpg" /></p>');

  assert.ok(markdown.includes("![](/media/b.jpg)"), markdown);
});

test("C7 an image with no src is dropped rather than emitted empty", () => {
  const markdown = htmlToMarkdown('<p>Trước<img alt="mồ côi" />Sau</p>');

  assert.doesNotMatch(markdown, /!\[/);
  assert.ok(markdown.includes("Trước"));
  assert.ok(markdown.includes("Sau"));
});

// -- C8: escaping ----------------------------------------------------------------

test("C8 a literal angle bracket cannot become a tag", () => {
  const html = markdownToHtml("Huyết áp < 140/90 và > 90/60 là bình thường.");

  assert.doesNotMatch(html, /<140/, "raw comparison emitted as a tag");
  assert.ok(html.includes("&lt; 140/90"), `not escaped: ${html}`);
  assert.ok(html.includes("&gt; 90/60"), `not escaped: ${html}`);
});

test("C8 a quote inside a link target cannot close the attribute", () => {
  const html = markdownToHtml('[Bấm vào đây](/dat-lich"onmouseover="alert(1))');

  assert.doesNotMatch(html, /onmouseover="alert\(1\)"/, `attribute breakout: ${html}`);
  assert.ok(html.includes("&quot;"), "quote was not escaped");
});

test("C8 ampersands are escaped once, not twice", () => {
  const html = markdownToHtml("Vitamin C &amp; kẽm");

  assert.ok(html.includes("&amp;amp;") || html.includes("&amp;"), html);
  assert.doesNotMatch(html, /&&/, "raw ampersand emitted");
});

// -- C9: fenced code -------------------------------------------------------------

test("C9 a fenced code block becomes a pre/code block", () => {
  const html = markdownToHtml("Trước\n\n```\nPA > 140/90\n```\n\nSau");

  assert.ok(html.includes("<pre><code"), `fence not converted: ${html}`);
  assert.doesNotMatch(html, /<p>```/, "fence rendered as literal paragraph text");
  assert.ok(html.includes("PA &gt; 140/90"), "code content not escaped");
});

test("C9 a language tag on the fence is preserved", () => {
  const html = markdownToHtml("```json\n{\"la\": 120}\n```");

  assert.ok(html.includes('class="language-json"'), html);
});

// -- C10: nested lists -----------------------------------------------------------
//
// The list conversion used a non-greedy `/<ul[^>]*>([\s\S]*?)<\/ul>/`, which
// stopped at the first inner `</ul>` and captured a truncated fragment. Its two
// text runs then had their tags stripped and were joined, so a nested list
// published as one corrupted word ("Cha" + "Con" -> "ChaCon"). These cases pin
// the depth-aware replacement.

test("C10 a nested list keeps both items instead of concatenating them", () => {
  const markdown = htmlToMarkdown("<ul><li>Cha<ul><li>Con</li></ul></li></ul>");

  assert.doesNotMatch(markdown, /ChaCon/, `parent and child words merged: ${markdown}`);
  assert.equal(markdown, "- Cha\n  - Con", markdown);
});

test("C10 three nesting levels keep their order, depth and words", () => {
  const html = "<ul><li>Ông<ul><li>Cha<ul><li>Cháu</li></ul></li></ul></li></ul>";

  assert.equal(htmlToMarkdown(html), "- Ông\n  - Cha\n    - Cháu");
});

test("C10 an ordered list nests under the parent step and keeps numbering", () => {
  const html = "<ol><li>Bước một<ol><li>Bước con</li></ol></li><li>Bước hai</li></ol>";

  assert.equal(htmlToMarkdown(html), "1. Bước một\n  1. Bước con\n2. Bước hai");
});

test("C10 sibling items of a nested list stay siblings", () => {
  const html = "<ul><li>Triệu chứng<ul><li>Đau đầu</li><li>Chóng mặt</li></ul></li></ul>";

  assert.equal(htmlToMarkdown(html), "- Triệu chứng\n  - Đau đầu\n  - Chóng mặt");
});

test("C10 a nested list under an emphasised parent item keeps both halves", () => {
  const html = "<ul><li>Liều <strong>5 mg</strong><ul><li>Buổi sáng</li></ul></li></ul>";

  assert.equal(htmlToMarkdown(html), "- Liều **5 mg**\n  - Buổi sáng");
});

test("C10 a flat list still converts byte for byte as before", () => {
  // The nesting fix must not have moved the top-level output the rest of the
  // pipeline (and the stored format) already depends on.
  assert.equal(htmlToMarkdown("<ul><li>a</li><li>b</li></ul>"), "- a\n- b");
  assert.equal(htmlToMarkdown("<ol><li>a</li><li>b</li></ol>"), "1. a\n2. b");
});

test("C10 indented markdown re-opens as a nested list, not a flat one", () => {
  const html = markdownToHtml("- Cha\n  - Con\n    - Cháu");

  assert.equal(html, "<ul><li>Cha<ul><li>Con<ul><li>Cháu</li></ul></li></ul></li></ul>");
});

test("C10 the nested list survives a full round trip", () => {
  const html = "<ul><li>Ông<ul><li>Cha<ul><li>Cháu</li></ul></li></ul></li></ul>";

  assert.equal(markdownToHtml(htmlToMarkdown(html)), html, "round trip changed the list");
});

// -- stored-format contract ------------------------------------------------------

test("toStoredArticleBody converts editor HTML and leaves markdown alone", () => {
  const fromHtml = toStoredArticleBody("<p>Nội dung <strong>quan trọng</strong></p>");
  assert.ok(fromHtml.includes("**quan trọng**"), fromHtml);
  assert.doesNotMatch(fromHtml, /<p>/, "HTML block survived conversion");

  const markdown = "## Phác đồ\n\n- Bước một";
  assert.equal(toStoredArticleBody(markdown), markdown);
});

// -- C11: merged table cells stay on their columns --------------------------------

test("C11 a colspan cell no longer shifts the columns under it", () => {
  const html = "<table><thead><tr><th>Chỉ số</th><th>Kết quả</th><th>Đơn vị</th></tr></thead>"
    + '<tbody><tr><td colspan="2">Huyết áp 120/80</td><td>mmHg</td></tr>'
    + "<tr><td>Glucose</td><td>5.4</td><td>mmol/L</td></tr></tbody></table>";
  const md = htmlToMarkdown(html);
  const lines = md.split("\n");
  const bodyRow = lines.find((l) => l.includes("Huyết áp"));
  const glucoseRow = lines.find((l) => l.includes("Glucose"));

  assert.ok(bodyRow, "merged row missing");
  assert.ok(glucoseRow, "plain row missing");
  // Three pipes boundaries => three columns in every row, merged content duplicated.
  assert.equal(bodyRow.split("|").length, glucoseRow.split("|").length);
  assert.ok(bodyRow.split("|").filter((c) => c.includes("Huyết áp 120/80")).length >= 2,
    "merged cell content was not carried into the covered columns");
});

test("C11 a rowspan cell keeps the row beneath aligned", () => {
  const html = "<table><tr><th>Nhóm</th><th>Mục</th></tr>"
    + '<tr><td rowspan="2">Xét nghiệm</td><td>Máu</td></tr>'
    + "<tr><td>Nước tiểu</td></tr></table>";
  const lines = htmlToMarkdown(html).split("\n");
  const secondDataRow = lines.find((l) => l.includes("Nước tiểu"));

  assert.ok(secondDataRow, "second data row missing");
  assert.equal(secondDataRow.split("|").length, 4, "row under a rowspan shifted left");
});

test("C11 header alignment emits GFM separators the renderer can parse", () => {
  const html = '<table><thead><tr><th style="text-align: center">Giữa</th>'
    + '<th style="text-align: right">Phải</th><th>Trái</th></tr></thead>'
    + "<tbody><tr><td>1</td><td>2</td><td>3</td></tr></tbody></table>";
  const md = htmlToMarkdown(html);
  const separator = md.split("\n")[1];

  assert.equal(separator, "| :---: | ---: | --- |");
});

// -- C12: figure / figcaption round trip ------------------------------------------

test("C12 a figcaption survives as an italic caption line, not loose text", () => {
  const html = '<figure><img src="/media/a.png" alt="Sơ đồ"><figcaption>Hình 1: Quỹ đạo tim mạch</figcaption></figure>';
  const md = htmlToMarkdown(html);

  assert.ok(md.includes("![Sơ đồ](/media/a.png)"), md);
  assert.ok(md.includes("*Hình 1: Quỹ đạo tim mạch*"), "caption not emitted");
  assert.doesNotMatch(md, /figcaption|figure/, "figure tags leaked into markdown");
});

test("C12 a caption identical to the alt text is not duplicated", () => {
  const html = '<figure><img src="/media/a.png" alt="Sơ đồ"><figcaption>Sơ đồ</figcaption></figure>';
  const md = htmlToMarkdown(html);

  assert.equal(md.split("Sơ đồ").length - 1, 1, "caption repeated twice");
});

test("C12 a figure without a usable image degrades to its caption text", () => {
  const html = "<figure><figcaption>Chú thích mồ côi</figcaption></figure>";
  const md = htmlToMarkdown(html);

  assert.ok(md.includes("Chú thích mồ côi"), md);
});
