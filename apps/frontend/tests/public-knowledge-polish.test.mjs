import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

const PUBLIC_KNOWLEDGE_ROUTES = [
  "app/benh-pho-bien/page.tsx",
  "app/benh-pho-bien/[slug]/page.tsx",
  "app/articles/page.tsx",
  "app/articles/[slug]/page.tsx",
  "app/faq/page.tsx",
];

test("public knowledge routes expose stable accessible loading and recovery states", async () => {
  const sources = await Promise.all(PUBLIC_KNOWLEDGE_ROUTES.map(read));

  for (const source of sources) {
    assert.match(source, /aria-busy=\{loading|aria-busy=\{articlesLoading|aria-busy=\{questionsLoading/);
    assert.match(source, /catalog-status--loading/);
    assert.match(source, /role="status"/);
    assert.match(source, /catalog-status--error/);
    assert.match(source, /role="alert"/);
    assert.match(source, /Thử tải lại/);
    assert.match(source, /aria-live="assertive"/);
    assert.match(source, /resource-actions/);
  }
});

test("public knowledge data failures stay code-owned and preserve a usable next step", async () => {
  const [diseaseList, diseaseDetail, articles, articleDetail, faq] = await Promise.all(
    PUBLIC_KNOWLEDGE_ROUTES.map(read),
  );

  assert.match(diseaseList, /presentApiError/);
  assert.match(diseaseDetail, /presentApiError/);
  assert.match(articles, /presentApiError/);
  assert.match(articleDetail, /presentApiError/);
  assert.match(faq, /presentApiError/);

  assert.match(diseaseList, /Đang hiển thị nội dung đã tải trước đó/);
  assert.match(articles, /Đang hiển thị nội dung đã tải trước đó/);
  assert.match(faq, /Đang hiển thị nội dung đã tải trước đó/);
  assert.match(diseaseDetail, /benh-pho-bien/);
  assert.match(articleDetail, /benh-pho-bien/);
});

test("catalog links encode backend-owned slugs and keep headings in a readable hierarchy", async () => {
  const [diseaseList, articles, articleDetail] = await Promise.all([
    read("app/benh-pho-bien/page.tsx"),
    read("app/articles/page.tsx"),
    read("app/articles/[slug]/page.tsx"),
  ]);

  assert.match(diseaseList, /encodeURIComponent\(article\.slug\)/);
  assert.match(articles, /encodeURIComponent\(article\.slug\)/);
  assert.match(articles, /<h3>\{article\.title\}<\/h3>/);
  assert.match(articles, /encodeURIComponent\(featuredArticle\.slug\)/);
  assert.match(articleDetail, /encodeURIComponent\(article\.relatedSpecialtySlug\)/);
  assert.match(articleDetail, /contentKind === "DISEASE_GUIDE"/);
});

test("public knowledge content keeps medical trust boundaries visible", async () => {
  const [diseaseList, diseaseDetail, articles, articleDetail, faq] = await Promise.all(
    PUBLIC_KNOWLEDGE_ROUTES.map(read),
  );

  assert.match(diseaseList, /Không thay thế thăm khám hoặc chẩn đoán/);
  assert.match(diseaseDetail, /không phải chẩn đoán hay đơn thuốc/i);
  assert.match(articles, /chỉ để tham khảo/);
  assert.match(articleDetail, /không thay thế chẩn đoán/);
  assert.match(faq, /dữ liệu thật của hệ thống/);
  assert.doesNotMatch(articles, /Không có bài viết demo thay thế/);
});

test("existing public route tokens cover the requested viewport and reduced-motion bar", async () => {
  const styles = await read("app/styles.css");
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*\.site-shell--public-route \.resource-page__header h1/);
  assert.match(styles, /@media \(max-width: 480px\)[\s\S]*\.site-shell--public-route \.catalog-card/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.site-shell--public-route \.catalog-status--loading::before/);
  assert.match(styles, /min-height: 2\.75rem/);
});
