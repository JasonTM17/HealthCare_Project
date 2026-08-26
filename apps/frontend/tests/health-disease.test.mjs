import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

test("disease hub keeps article and published Q&A outages independent", async () => {
  const source = await read("app/benh-pho-bien/page.tsx");

  for (const marker of [
    "fetchAllContent",
    "fetchPublishedHealthQuestions",
    "articlesLoading",
    "questionsLoading",
    "articlesError",
    "questionsError",
    "Thử tải lại hướng dẫn",
    "Thử tải lại hỏi đáp",
  ]) {
    assert.match(source, new RegExp(escapeRegExp(marker)), `missing ${marker}`);
  }
  assert.match(source, /presentApiError\(/);
  assert.doesNotMatch(source, /(?:error|reason)\.message/);
});

test("disease hub exposes closed taxonomy labels, search and bounded pagination", async () => {
  const source = await read("app/benh-pho-bien/page.tsx");

  assert.match(source, /CATEGORY_LABELS/);
  assert.match(source, /TOPIC_LABELS/);
  assert.match(source, /type="search"/);
  assert.match(source, /disease-category/);
  assert.match(source, /CatalogPagination/);
  assert.match(source, /Phân trang hướng dẫn bệnh phổ biến/);
  assert.match(source, /Phân trang hỏi đáp sức khỏe/);
  assert.match(source, /encodeURIComponent\(article\.slug\)/);
  assert.match(source, /item\.contentKind === "DISEASE_GUIDE"/);
  assert.match(source, /!articlesLoading && !articlePage\.empty/);
  assert.match(source, /!questionsLoading && !questionPage\.empty/);
});

test("disease detail provides a safe, navigable clinical reading surface", async () => {
  const source = await read("app/benh-pho-bien/[slug]/page.tsx");

  for (const marker of [
    "fetchArticleBySlug",
    "presentApiError(",
    "Mục lục bài viết",
    "Dấu hiệu cần được đánh giá sớm",
    "Gọi 115",
    "Đánh giá nội dung",
    "Cập nhật",
    "relatedSpecialtyHref",
    "Thử tải lại",
    "MedicalWebPage",
    "dangerouslySetInnerHTML",
    ".replace(/</g",
  ]) {
    assert.match(source, new RegExp(escapeRegExp(marker)), `missing ${marker}`);
  }
  assert.match(source, /id=\{section\.id\}/);
  assert.match(source, /value\?\.contentKind === "DISEASE_GUIDE"/);
  assert.match(source, /value\.slug === slug/);
  assert.match(source, /loadedSlugRef/);
  assert.match(source, /setArticle\(null\)/);
  assert.doesNotMatch(source, /(?:error|reason)\.message/);
});
