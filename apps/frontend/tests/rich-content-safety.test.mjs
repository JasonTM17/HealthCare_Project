import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("RichContentRenderer uses pure React rendering without raw HTML injection", async () => {
  const renderer = await read("components/editor/RichContentRenderer.tsx");

  assert.doesNotMatch(renderer, /dangerouslySetInnerHTML/);
});

test("renderInlineMarkdown sanitizes image and link URLs with an allowlist", async () => {
  const renderer = await read("components/editor/RichContentRenderer.tsx");

  assert.match(renderer, /export function renderInlineMarkdown/);
  assert.match(renderer, /const safe = isSafeUrl\(imgUrl\)/);
  assert.match(renderer, /const safe = isSafeUrl\(linkUrl\)/);
  // An unsafe link must produce no anchor at all. The previous `href="#"`
  // fallback still rendered a clickable element that scrolled the reader to
  // the top of a clinical article, so it is now forbidden outright.
  assert.match(renderer, /safe \? \(\s*<a/);
  assert.doesNotMatch(renderer, /href=\{safe \? linkUrl : "#"\}/);
  assert.doesNotMatch(renderer, /href="#"/);

  const isSafeUrlMatch = renderer.match(/export function isSafeUrl\(url:\s*string\):\s*boolean\s*\{([\s\S]*?)\n\}/);
  assert.ok(isSafeUrlMatch, "isSafeUrl function must be exported");
  const isSafeUrlSource = isSafeUrlMatch[1];

  assert.match(isSafeUrlSource, /trim\(\)\.toLowerCase\(\)/);
  assert.match(isSafeUrlSource, /startsWith\("javascript:"\)/);
  assert.match(isSafeUrlSource, /startsWith\("data:"\)/);
  assert.match(isSafeUrlSource, /return false/);
  assert.match(isSafeUrlSource, /startsWith\("https:\/\/"\)/);
  assert.match(isSafeUrlSource, /startsWith\("\/"\)/);

  const isSafeUrlFn = new Function("url", isSafeUrlSource);
  assert.equal(isSafeUrlFn("javascript:alert(document.cookie)"), false);
  assert.equal(isSafeUrlFn(" JAVASCRIPT:alert(1)"), false);
  assert.equal(isSafeUrlFn("data:text/html,<script>alert(1)</script>"), false);
  assert.equal(isSafeUrlFn("https://healthcare.id.vn/articles"), true);
  assert.equal(isSafeUrlFn("/articles/phac-do-dieu-tri"), true);
});

test("htmlToMarkdown strips script and style tag blocks", async () => {
  const renderer = await read("components/editor/RichContentRenderer.tsx");

  const htmlToMarkdownMatch = renderer.match(/export function htmlToMarkdown\(html:\s*string\):\s*string\s*\{([\s\S]*?)\n\}/);
  assert.ok(htmlToMarkdownMatch, "htmlToMarkdown function must be exported");

  assert.match(renderer, /remove script and style tag blocks/);
  assert.match(renderer, /<script\\b[^\n]+<\\\/script>/);
  assert.match(renderer, /<style\\b[^\n]+<\\\/style>/);
  assert.doesNotMatch(renderer, /remove script, style, iframe tags/);
});

test("markdown images render through JSX img props without event attributes", async () => {
  const renderer = await read("components/editor/RichContentRenderer.tsx");

  assert.match(renderer, /<img[\s\S]*?alt=\{imgAlt \|\| "Hình ảnh y khoa"\}[\s\S]*?src=\{imgUrl\}[\s\S]*?\/>/);
  assert.match(renderer, /src=\{imgUrl\}/);
  assert.doesNotMatch(renderer, /onerror/i);
  assert.doesNotMatch(renderer, /onError=\{/);
});
