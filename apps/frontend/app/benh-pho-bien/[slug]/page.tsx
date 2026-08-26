"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { PublicAiButton, PublicBookingButton, PublicPageShell } from "../../../components/PublicPageShell";
import { ApiError, fetchArticleBySlug } from "../../../lib/api-client";
import { formatBusinessDate } from "../../../lib/business-time";
import { presentApiError } from "../../../lib/present-api-error";
import type { Article, ArticleSection } from "../../../types/hospital";

const CATEGORY_LABELS: Record<string, string> = {
  CARDIOLOGY: "Tim mạch",
  DERMATOLOGY: "Da liễu",
  ENDOCRINOLOGY: "Nội tiết",
  GASTROENTEROLOGY: "Tiêu hóa",
  GENERAL: "Sức khỏe tổng quát",
  GYNECOLOGY: "Sản phụ khoa",
  NEUROLOGY: "Thần kinh",
  ONCOLOGY: "Ung bướu",
  PEDIATRICS: "Nhi khoa",
  RESPIRATORY: "Hô hấp",
  UROLOGY: "Tiết niệu",
};

function safeErrorCopy(reason: unknown): string {
  return presentApiError(
    reason instanceof ApiError ? reason.code : undefined,
    reason instanceof ApiError ? reason.status : undefined,
  );
}

function categoryLabel(value: string | null | undefined): string {
  const normalized = value?.trim().toUpperCase() ?? "";
  return normalized && CATEGORY_LABELS[normalized] ? CATEGORY_LABELS[normalized] : "Bệnh phổ biến";
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

function cleanSections(value: ArticleSection[] | undefined): ArticleSection[] {
  return (value ?? [])
    .map((section) => ({
      heading: typeof section.heading === "string" ? section.heading.trim() : "",
      body: typeof section.body === "string" ? section.body.trim() : "",
    }))
    .filter((section) => section.heading.length > 0 || section.body.length > 0);
}

function anchorId(heading: string, index: number): string {
  const normalized = heading.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const slug = normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `muc-${slug || "noi-dung"}-${index + 1}`;
}

function validSlug(value: string | null | undefined): value is string {
  return Boolean(value && /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(value));
}

function canonicalDiseaseGuideUrl(slug: string): string {
  const defaultOrigin = "https://healthcare-beta.example";
  const path = `/benh-pho-bien/${encodeURIComponent(slug)}`;
  try {
    const configured = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? defaultOrigin);
    if (!/^https?:$/u.test(configured.protocol) || configured.username || configured.password) {
      return `${defaultOrigin}${path}`;
    }
    return new URL(path, `${configured.origin}/`).toString();
  } catch {
    return `${defaultOrigin}${path}`;
  }
}

export default function DiseaseGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const loadedSlugRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Keep stale content for a retry of the same resource, but clear it before
    // a client navigation so disease A can never render under disease B's URL.
    if (loadedSlugRef.current !== slug) {
      setArticle(null);
      loadedSlugRef.current = null;
    }
    const task = Promise.resolve()
      .then(() => {
        if (cancelled) return undefined;
        setLoading(true);
        setError(null);
        return fetchArticleBySlug(slug);
      })
      .then((value) => {
        // This route carries a clinical trust label. A general article must
        // never inherit that label merely because its slug was entered here.
        if (
          !cancelled
          && value?.contentKind === "DISEASE_GUIDE"
          && value.slug === slug
        ) {
          loadedSlugRef.current = slug;
          setArticle(value);
        } else if (!cancelled) {
          loadedSlugRef.current = null;
          setArticle(null);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(safeErrorCopy(reason));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    void task;
    return () => {
      cancelled = true;
    };
  }, [retryCount, slug]);

  const sections = useMemo(() => cleanSections(article?.sections), [article?.sections]);
  const takeaways = stringList(article?.keyTakeaways);
  const warningSigns = stringList(article?.warningSigns);
  const preventionTips = stringList(article?.preventionTips);
  const sources = stringList(article?.sourceReferences);
  const bodyParagraphs = article?.body?.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean) ?? [];
  const relatedSpecialtyHref = validSlug(article?.relatedSpecialtySlug)
    ? `/specialties/${encodeURIComponent(article.relatedSpecialtySlug)}`
    : null;
  const tocSections = useMemo(
    () => sections.map((section, index) => ({ ...section, id: anchorId(section.heading || "Nội dung", index) })),
    [sections],
  );
  const structuredData = useMemo(() => {
    if (!article) return null;
    const canonicalUrl = canonicalDiseaseGuideUrl(article.slug);
    return {
      "@context": "https://schema.org",
      "@type": ["MedicalWebPage", "Article"],
      "@id": canonicalUrl,
      name: article.title,
      headline: article.title,
      identifier: article.slug,
      description: article.seoDescription ?? article.summary,
      datePublished: article.publishedAt,
      dateModified: article.updatedAt ?? article.publishedAt,
      inLanguage: "vi-VN",
      url: canonicalUrl,
      mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl },
      author: article.authorName ? { "@type": "Person", name: article.authorName } : undefined,
      publisher: { "@type": "Organization", name: "HealthCare" },
    };
  }, [article]);
  const structuredDataJson = structuredData
    ? JSON.stringify(structuredData)
      .replace(/&/g, "\\u0026")
      .replace(/</g, "\\u003c")
      .replace(/>/g, "\\u003e")
      .replace(/\u2028/g, "\\u2028")
      .replace(/\u2029/g, "\\u2029")
    : null;

  return (
    <PublicPageShell>
      <div aria-busy={loading} className="article-page section-inner">
        <Link className="portal-context-link" href="/benh-pho-bien">← Kho bệnh phổ biến</Link>
        {loading ? <p className="catalog-status catalog-status--loading" role="status">{article ? "Đang cập nhật bài viết…" : "Đang tải bài viết…"}</p> : null}
        {error ? (
          <div aria-live="assertive" className="catalog-status catalog-status--error" role="alert">
            <span>{article ? `Chưa thể cập nhật bài viết mới. ${error} Đang hiển thị nội dung đã tải trước đó.` : error}</span>
            <button className="outline-button outline-button--small" onClick={() => setRetryCount((value) => value + 1)} type="button">Thử tải lại</button>
          </div>
        ) : null}
        {!loading && !error && !article ? (
          <div className="catalog-status" role="status">
            <p>Không tìm thấy hướng dẫn này trong kho nội dung đã được kiểm duyệt.</p>
            <div className="resource-actions">
              <Link className="outline-button outline-button--small" href="/benh-pho-bien">Xem kho bệnh phổ biến</Link>
              <PublicBookingButton className="button button--amber">Đặt lịch với bác sĩ</PublicBookingButton>
            </div>
          </div>
        ) : null}
        {article ? (
          <article>
            {structuredDataJson ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredDataJson }} /> : null}
            <header className="resource-page__header">
              <p className="section-note">{categoryLabel(article.category)} · Nguồn bệnh viện được bác sĩ nội bộ duyệt</p>
              <h1>{article.title}</h1>
              <p>{article.summary}</p>
              <dl className="resource-meta-grid">
                <div><dt>Xuất bản</dt><dd>{formatBusinessDate(article.publishedAt)}</dd></div>
                <div><dt>Cập nhật</dt><dd>{formatBusinessDate(article.updatedAt ?? article.publishedAt)}</dd></div>
                <div><dt>Đọc ước tính</dt><dd>{article.readingMinutes ?? 5} phút</dd></div>
                <div><dt>Đánh giá nội dung</dt><dd>Bác sĩ nội bộ duyệt</dd></div>
              </dl>
              <div className="resource-actions">
                <PublicBookingButton>Đặt lịch thăm khám</PublicBookingButton>
                <PublicAiButton className="outline-button">Hỏi trợ lý triệu chứng</PublicAiButton>
                {relatedSpecialtyHref ? <Link className="outline-button" href={relatedSpecialtyHref}>Xem chuyên khoa liên quan</Link> : null}
              </div>
            </header>

            {tocSections.length ? (
              <nav aria-label="Mục lục bài viết" className="resource-panel resource-panel--accent">
                <p className="section-note">Mục lục</p>
                <ol>
                  {tocSections.map((section) => <li key={section.id}><a href={`#${section.id}`}>{section.heading || "Nội dung"}</a></li>)}
                </ol>
              </nav>
            ) : null}

            <div className="article-body article-detail-card__body">
              {sections.length ? null : bodyParagraphs.map((paragraph, index) => <p key={`${paragraph.slice(0, 32)}-${index}`}>{paragraph}</p>)}
              {!bodyParagraphs.length && !sections.length ? <p className="resource-muted">Nội dung chi tiết đang được cập nhật.</p> : null}
              {takeaways.length ? <section className="resource-panel"><h2>Điểm cần nhớ</h2><ul>{takeaways.map((item) => <li key={item}>{item}</li>)}</ul></section> : null}
              {warningSigns.length ? (
                <section className="resource-panel resource-panel--warning" aria-labelledby="warning-signs-title">
                  <h2 id="warning-signs-title">Dấu hiệu cần được đánh giá sớm</h2>
                  <p className="section-note">Nếu triệu chứng xuất hiện đột ngột, nặng lên nhanh hoặc bạn thấy không an toàn, hãy gọi 115.</p>
                  <ul>{warningSigns.map((item) => <li key={item}>{item}</li>)}</ul>
                  <a className="outline-button outline-button--small" href="tel:115">Gọi 115</a>
                </section>
              ) : null}
              {article.whenToSeekCare ? <section className="resource-panel"><h2>Khi nào nên đi khám?</h2><p>{article.whenToSeekCare}</p></section> : null}
              {preventionTips.length ? <section className="resource-panel"><h2>Chủ động chăm sóc</h2><ul>{preventionTips.map((item) => <li key={item}>{item}</li>)}</ul></section> : null}
              {tocSections.map((section) => <section id={section.id} key={section.id}><h2>{section.heading || "Nội dung"}</h2><p>{section.body || "Nội dung đang được cập nhật."}</p></section>)}
              {sources.length ? <section className="resource-panel"><h2>Nguồn tham khảo</h2><ul>{sources.map((source) => <li key={source}>{source}</li>)}</ul></section> : null}
            </div>

            <aside className="resource-panel resource-panel--accent" aria-label="Bước tiếp theo">
              <h2>Muốn được tư vấn riêng?</h2>
              <p>Hãy dùng bài viết để chuẩn bị câu hỏi, sau đó đặt lịch với chuyên khoa phù hợp. Nội dung này chỉ giáo dục sức khỏe, không phải chẩn đoán hay đơn thuốc.</p>
              <div className="resource-actions">
                <PublicBookingButton>Đặt lịch với bác sĩ</PublicBookingButton>
                {relatedSpecialtyHref ? <Link className="text-button" href={relatedSpecialtyHref}>Mở chuyên khoa liên quan →</Link> : null}
              </div>
            </aside>
            <p className="clinical-disclaimer">{article.clinicalDisclaimer ?? "Thông tin này chỉ nhằm giáo dục sức khỏe, không phải chẩn đoán hay đơn thuốc."} Nếu có dấu hiệu khẩn cấp, gọi 115.</p>
          </article>
        ) : null}
      </div>
    </PublicPageShell>
  );
}
