"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ClinicalIcon from "../../../components/ClinicalIcon";
import { ApiError, fetchArticleBySlug } from "../../../lib/api-client";
import { formatBusinessDate } from "../../../lib/business-time";
import { presentApiError } from "../../../lib/present-api-error";
import type { Article } from "../../../types/hospital";
import { PublicAiButton, PublicBackLink, PublicBookingButton, PublicPageShell } from "../../../components/PublicPageShell";
import { RichContentRenderer } from "../../../components/editor";
import { resolveArticleCoverImage, resolveArticleAlt } from "../../../lib/article-visuals";

const ARTICLE_STEPS = [
  ["01", "Đọc phần tóm tắt", "Xác nhận bài viết có đúng chủ đề bạn đang tìm không."],
  ["02", "Ghi chú câu hỏi", "Ghi lại phần còn băn khoăn để hỏi lại bác sĩ hoặc trợ lý."],
  ["03", "Đi tiếp sang đặt lịch", "Nếu cần tư vấn trực tiếp, mở luồng đặt lịch ngay từ bài viết."],
] as const;

function safeErrorCopy(reason: unknown): string {
  return presentApiError(
    reason instanceof ApiError ? reason.code : undefined,
    reason instanceof ApiError ? reason.status : undefined,
  );
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      return value.split("\n").map((line) => line.trim()).filter(Boolean);
    }
  }
  return [];
}

export default function ArticleDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const loadedSlugRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const task = Promise.resolve()
      .then(() => {
        if (cancelled) return undefined;
        if (!slug || typeof slug !== "string") return undefined;
        if (loadedSlugRef.current !== slug) setArticle(null);
        loadedSlugRef.current = slug;
        setLoading(true);
        setError(null);
        return fetchArticleBySlug(slug);
      })
      .then((data) => {
        if (data !== undefined && !cancelled) {
          // Disease guides have their own clinically eligible public route.
          // Do not make a general article URL a second trust surface.
          setArticle(data.contentKind === "DISEASE_GUIDE" ? null : data);
        }
      })
      .catch((reason: unknown) => { if (!cancelled) setError(safeErrorCopy(reason)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    void task;
    return () => { cancelled = true; };
  }, [retryCount, slug]);

  const structuredSections = article?.sections?.filter((section) => section.heading.trim() || section.body.trim()) ?? [];
  const bodyParagraphs = article?.body?.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean) ?? [];
  const readingMinutesLabel = article?.readingMinutes ? `${article.readingMinutes} phút đọc` : "Thời lượng chưa cập nhật";
  const takeaways = stringList(article?.keyTakeaways);
  const warningSigns = stringList(article?.warningSigns);
  const preventionTips = stringList(article?.preventionTips);
  const sources = stringList(article?.sourceReferences);

  return (
    <PublicPageShell>
      <div aria-busy={loading} className="resource-page section-inner">
        <PublicBackLink href="/articles">← Quay lại cẩm nang sức khỏe</PublicBackLink>
        <header className="resource-page__header">
          <p className="section-note">Cẩm nang sức khỏe</p>
          <h1>Kiến thức y khoa trong nhịp sống hằng ngày</h1>
          <p>Thông tin tham khảo giúp bạn chủ động chuẩn bị câu hỏi và chăm sóc sức khỏe tốt hơn.</p>
        </header>
        {loading ? <p className="catalog-status catalog-status--loading" role="status">{article ? "Đang cập nhật bài viết…" : "Đang tải bài viết…"}</p> : null}
        {error ? (
          <div aria-live="assertive" className="catalog-status catalog-status--error" role="alert">
            <span>{article ? `Chưa thể cập nhật bài viết mới. ${error} Đang hiển thị nội dung đã tải trước đó.` : error}</span>
            <button className="outline-button outline-button--small" onClick={() => setRetryCount((count) => count + 1)} type="button">
              Thử tải lại
            </button>
          </div>
        ) : null}
        {!loading && !error && !article ? (
          <div className="catalog-status" role="status">
            <p>Không tìm thấy bài viết này trong cẩm nang công khai. Nếu bạn đang tìm hướng dẫn bệnh, hãy mở kho bệnh phổ biến.</p>
            <div className="resource-actions">
              <Link className="outline-button outline-button--small" href="/articles">Về cẩm nang sức khỏe</Link>
              <Link className="text-button" href="/benh-pho-bien">Mở kho bệnh phổ biến →</Link>
            </div>
          </div>
        ) : null}
        {article ? (
          <>
            <article className="resource-hero-card resource-hero-card--teal article-detail-hero">
              <div className="resource-hero-card__body article-detail-hero__body">
                <div className="article-detail-hero__eyebrow-row">
                  <div className="resource-icon article-detail-hero__seal" aria-hidden="true">
                    <ClinicalIcon name="article" />
                  </div>
                  <div className="article-detail-hero__badges">
                    {article.category ? (
                      <span className="article-detail-hero__category-badge">{article.category}</span>
                    ) : null}
                    <span className="article-detail-hero__trust-badge">🛡 100% Hội đồng Y khoa kiểm định</span>
                    <span className="resource-chip">Nội dung tham khảo · không thay thế chẩn đoán</span>
                  </div>
                </div>

                <h2>{article.title}</h2>
                <p className="resource-lead">{article.summary}</p>

                <div className="resource-actions">
                  <PublicBookingButton>Đặt lịch nếu bạn cần trao đổi trực tiếp</PublicBookingButton>
                  <PublicAiButton className="outline-button outline-button--light">Hỏi trợ lý triệu chứng</PublicAiButton>
                  {article.relatedSpecialtySlug ? (
                    <Link className="outline-button outline-button--light" href={`/specialties/${encodeURIComponent(article.relatedSpecialtySlug)}`}>
                      Xem chuyên khoa liên quan
                    </Link>
                  ) : null}
                </div>

                <dl className="resource-meta-grid">
                  {article.category ? (
                    <div>
                      <dt>Chuyên khoa</dt>
                      <dd>{article.category}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>Đọc ước tính</dt>
                    <dd>{readingMinutesLabel}</dd>
                  </div>
                  {article.authorName ? (
                    <div>
                      <dt>Chuyên gia thẩm định</dt>
                      <dd>{article.authorName}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>Xuất bản</dt>
                    <dd>{formatBusinessDate(article.publishedAt)}</dd>
                  </div>
                  {article.updatedAt ? (
                    <div>
                      <dt>Cập nhật phác đồ</dt>
                      <dd>{formatBusinessDate(article.updatedAt)}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>

              <div className="article-detail-hero__media">
                <div className="article-detail-hero__image-frame">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={resolveArticleAlt(article)}
                    className="article-detail-hero__image"
                    src={resolveArticleCoverImage(article)}
                  />
                  <div className="article-detail-hero__image-overlay-badge">
                    <span>🔬 CHUYÊN ĐỀ LÂM SÀNG</span>
                  </div>
                </div>
                <p className="article-detail-hero__caption">
                  Ảnh minh họa chuyên môn: Quy trình thăm khám, chẩn đoán và hướng dẫn chăm sóc chuẩn Bộ Y tế &amp; WHO.
                </p>
              </div>
            </article>

            <section className="resource-panel resource-panel--wide">
              <div className="section-heading">
                <div>
                  <p className="section-note">Cách đọc bài viết</p>
                  <h2>Ba bước để dùng thông tin an toàn</h2>
                </div>
              </div>
              <div className="resource-steps resource-steps--grid">
                {ARTICLE_STEPS.map(([number, title, description]) => (
                  <div className="resource-step-card" key={number}>
                    <span>{number}</span>
                    <strong>{title}</strong>
                    <p>{description}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="resource-grid resource-grid--two">
              <section aria-labelledby="article-body-title" className="resource-panel">
                <p className="section-note">Nội dung chi tiết</p>
                <h2 id="article-body-title">Phần bài viết</h2>
                {structuredSections.length ? (
                  <div className="article-detail-card__body article-detail-card__sections">
                    {structuredSections.map((section, index) => (
                      <section key={`${section.heading}-${index}`}>
                        <h3>{section.heading}</h3>
                        <RichContentRenderer
                          content={section.body}
                          fallback={<p>{section.body}</p>}
                        />
                      </section>
                    ))}
                  </div>
                ) : article?.body ? (
                  <div className="article-detail-card__body">
                    <RichContentRenderer
                      content={article.body}
                      fallback={bodyParagraphs.map((paragraph, index) => (
                        <p key={`${paragraph.slice(0, 24)}-${index}`}>{paragraph}</p>
                      ))}
                    />
                  </div>
                ) : (
                  <div className="article-detail-card__notice">
                    <strong>Nội dung chi tiết đang chờ biên tập</strong>
                    <p>Bạn vẫn có thể đọc phần tóm tắt, mở chuyên khoa liên quan hoặc đặt lịch nếu cần bác sĩ đánh giá trực tiếp.</p>
                  </div>
                )}
                {preventionTips.length ? (
                  <div className="mt-8 pt-6 border-t border-slate-200">
                    <section aria-labelledby="article-prevention-title" className="resource-panel">
                      <p className="section-note">Chủ động chăm sóc</p>
                      <h2 id="article-prevention-title">Hướng dẫn phòng bệnh & lối sống</h2>
                      <ul className="space-y-2 text-slate-700">
                        {preventionTips.map((tip) => (
                          <li key={tip} className="flex items-start gap-2">
                            <span className="text-teal-700 font-bold">✓</span>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  </div>
                ) : null}
                {sources.length ? (
                  <div className="mt-6 pt-4 border-t border-slate-100">
                    <section aria-labelledby="article-sources-title" className="resource-panel">
                      <p className="section-note">Độ tin cậy y khoa</p>
                      <h2 id="article-sources-title">Tài liệu & nguồn tham khảo</h2>
                      <ul className="space-y-1 text-xs text-slate-600">
                        {sources.map((source) => (
                          <li key={source} className="flex items-center gap-2">
                            <span className="text-slate-400">•</span>
                            <span>{source}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  </div>
                ) : null}
              </section>

              <div className="space-y-6">
                {takeaways.length ? (
                  <section aria-labelledby="article-takeaways-title" className="resource-panel">
                    <p className="section-note">Điểm cần nhớ</p>
                    <h2 id="article-takeaways-title">Thông điệp chính</h2>
                    <ul className="space-y-2 text-slate-700 text-sm">
                      {takeaways.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <span className="text-teal-700 font-bold">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {warningSigns.length ? (
                  <section aria-labelledby="article-warning-title" className="resource-panel resource-panel--warning">
                    <p className="section-note">Cảnh báo y tế</p>
                    <h2 id="article-warning-title">Dấu hiệu cần được đánh giá sớm</h2>
                    <p className="text-xs text-amber-900 mb-3 font-medium">
                      Nếu triệu chứng xuất hiện đột ngột, nặng lên nhanh hoặc bạn thấy không an toàn, hãy gọi 115.
                    </p>
                    <ul className="space-y-2 text-amber-950 text-sm mb-4">
                      {warningSigns.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <span className="text-rose-600 font-bold">⚠</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                    <a className="outline-button outline-button--small" href="tel:115">Gọi cấp cứu 115</a>
                  </section>
                ) : null}

                <section aria-labelledby="article-next-step-title" className="resource-panel resource-panel--accent">
                  <p className="section-note">Bước tiếp theo</p>
                  <h2 id="article-next-step-title">Chuyển từ đọc sang hành động</h2>
                  <p>
                    Dùng bài viết để chuẩn bị câu hỏi, sau đó mở chuyên khoa liên quan hoặc đặt lịch khi bạn
                    muốn được tư vấn trực tiếp.
                  </p>
                  {article.relatedSpecialtySlug ? (
                    <Link className="text-button" href={`/specialties/${encodeURIComponent(article.relatedSpecialtySlug)}`}>
                      Đi tới chuyên khoa liên quan →
                    </Link>
                  ) : null}
                </section>
              </div>
            </div>
            <p className="resource-muted" role="note">{article.clinicalDisclaimer ?? "Thông tin này chỉ nhằm giáo dục sức khỏe, không phải chẩn đoán hay đơn thuốc."}</p>
          </>
        ) : null}
      </div>
    </PublicPageShell>
  );
}
