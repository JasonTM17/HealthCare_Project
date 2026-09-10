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
          <div className="article-news-layout">
            <main className="article-news-main">
              <article className="resource-hero-card resource-hero-card--teal article-editorial-header">
                <div className="article-editorial-header__badges">
                  <div className="resource-icon article-editorial-header__emblem" aria-hidden="true">
                    <ClinicalIcon name="article" />
                  </div>
                  {article.category ? (
                    <span className="article-editorial-header__cat-tag">{article.category}</span>
                  ) : null}
                  <span className="article-editorial-header__trust-tag">🛡 Tham vấn y khoa: Hội đồng Bác sĩ Chuyên khoa</span>
                  <span className="resource-chip">Nội dung tham khảo · không thay thế chẩn đoán</span>
                </div>

                <h1 className="article-editorial-header__title">{article.title}</h1>

                <div className="article-editorial-header__byline">
                  <div className="article-editorial-header__author">
                    <div className="article-editorial-header__avatar">
                      <span>BS</span>
                    </div>
                    <div>
                      <div className="article-editorial-header__author-name">
                        {article.authorName || "Hội đồng Cố vấn Y khoa"}
                      </div>
                      <div className="article-editorial-header__author-role">
                        {article.category ? `Bác sĩ Chuyên khoa ${article.category}` : "Bác sĩ Chuyên khoa Bệnh viện"}
                      </div>
                    </div>
                  </div>

                  <dl className="resource-meta-grid article-editorial-header__meta">
                    <div>
                      <dt>Xuất bản</dt>
                      <dd>{formatBusinessDate(article.publishedAt)}</dd>
                    </div>
                    <div>
                      <dt>Cập nhật phác đồ</dt>
                      <dd>{article.updatedAt ? formatBusinessDate(article.updatedAt) : "Năm 2026"}</dd>
                    </div>
                    <div>
                      <dt>Thời lượng đọc</dt>
                      <dd>{readingMinutesLabel}</dd>
                    </div>
                  </dl>
                </div>

                <div className="article-editorial-header__sapo">
                  <p className="resource-lead">{article.summary}</p>
                </div>

                <div className="article-editorial-header__featured-image">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={resolveArticleAlt(article)}
                    className="article-editorial-header__img"
                    src={resolveArticleCoverImage(article)}
                  />
                  <p className="article-editorial-header__img-caption">
                    Ảnh minh họa: Quy trình khám, chẩn đoán và điều trị theo phác đồ chuẩn Bộ Y tế &amp; WHO tại Hệ thống Bệnh viện.
                  </p>
                </div>
              </article>

              {structuredSections.length ? (
                <nav aria-label="Mục lục bài viết" className="article-toc">
                  <div className="article-toc__heading">
                    <span className="article-toc__icon">📑</span>
                    <strong>Mục lục bài viết</strong>
                  </div>
                  <ol className="article-toc__list">
                    {structuredSections.map((sec, idx) => (
                      <li key={`toc-${idx}`}>
                        <a href={`#section-${idx + 1}`} className="article-toc__link">
                          {sec.heading}
                        </a>
                      </li>
                    ))}
                    {preventionTips.length ? (
                      <li>
                        <a href="#section-prevention" className="article-toc__link">
                          Hướng dẫn phòng bệnh &amp; lối sống lành mạnh
                        </a>
                      </li>
                    ) : null}
                    {sources.length ? (
                      <li>
                        <a href="#section-sources" className="article-toc__link">
                          Tài liệu y văn tham khảo chính thống
                        </a>
                      </li>
                    ) : null}
                  </ol>
                </nav>
              ) : null}

              <div className="article-detail-card__body article-news-content">
                {structuredSections.length ? (
                  <div className="article-detail-card__sections">
                    {structuredSections.map((section, index) => (
                      <section id={`section-${index + 1}`} key={`${section.heading}-${index}`} className="article-news-section">
                        <h2 className="article-news-section__heading">{section.heading}</h2>
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
                  <section id="section-prevention" className="article-news-section article-news-prevention">
                    <h2 className="article-news-section__heading">Hướng dẫn phòng bệnh &amp; lối sống lành mạnh</h2>
                    <div className="article-news-prevention__box">
                      <ul className="article-news-prevention__list">
                        {preventionTips.map((tip) => (
                          <li key={tip}>
                            <span className="article-news-prevention__check">✓</span>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </section>
                ) : null}

                {sources.length ? (
                  <section id="section-sources" className="article-news-section article-news-sources">
                    <h3 className="article-news-sources__heading">Tài liệu y văn tham khảo</h3>
                    <ul className="article-news-sources__list">
                      {sources.map((src) => (
                        <li key={src}>
                          <span className="article-news-sources__bullet">•</span>
                          <span>{src}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                <div className="article-news-disclaimer" role="note">
                  <p>{article.clinicalDisclaimer ?? "Thông tin trong bài viết chỉ mang tính chất giáo dục y tế và tham khảo, không thay thế cho chẩn đoán hay phác đồ điều trị chuyên khoa của bác sĩ."}</p>
                </div>
              </div>
            </main>

            <aside className="article-news-sidebar">
              <div className="article-news-sidebar__card article-news-sidebar__doctor">
                <div className="article-news-sidebar__doctor-header">
                  <div className="article-news-sidebar__doctor-avatar">
                    <span>BS</span>
                  </div>
                  <div>
                    <span className="article-news-sidebar__doctor-badge">BÁC SĨ THAM VẤN</span>
                    <h3 className="article-news-sidebar__doctor-name">{article.authorName || "BS.CKI Đội ngũ Y khoa"}</h3>
                    <p className="article-news-sidebar__doctor-sub">
                      {article.category ? `Khoa ${article.category}` : "Bệnh viện Đa khoa"}
                    </p>
                  </div>
                </div>
                <p className="article-news-sidebar__doctor-desc">
                  Bạn đang gặp phải các dấu hiệu bệnh tương tự? Đặt lịch trực tiếp để được bác sĩ chuyên khoa thăm khám và tư vấn phác đồ phù hợp.
                </p>
                <div className="resource-actions article-news-sidebar__actions">
                  <PublicBookingButton>Đặt lịch khám với bác sĩ</PublicBookingButton>
                  <PublicAiButton className="outline-button outline-button--small">Hỏi trợ lý triệu chứng</PublicAiButton>
                </div>
              </div>

              {article.relatedSpecialtySlug ? (
                <div className="article-news-sidebar__card article-news-sidebar__specialty">
                  <span className="article-news-sidebar__card-tag">CHUYÊN KHOA LIÊN QUAN</span>
                  <h3>Khoa {article.category || "Chuyên môn"}</h3>
                  <p>Tìm hiểu các dịch vụ khám, trang thiết bị chẩn đoán và đội ngũ bác sĩ chuyên khoa.</p>
                  <Link
                    className="outline-button outline-button--small"
                    href={`/specialties/${encodeURIComponent(article.relatedSpecialtySlug)}`}
                  >
                    Xem chuyên khoa liên quan →
                  </Link>
                </div>
              ) : null}

              {takeaways.length ? (
                <div className="article-news-sidebar__card article-news-sidebar__takeaways">
                  <span className="article-news-sidebar__card-tag">💡 THÔNG ĐIỆP CHÍNH</span>
                  <h3>Điểm cốt lõi cần nhớ</h3>
                  <ul className="article-news-sidebar__takeaways-list">
                    {takeaways.map((item) => (
                      <li key={item}>
                        <span className="text-teal-700 font-bold">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {warningSigns.length ? (
                <div className="article-news-sidebar__card article-news-sidebar__warning">
                  <span className="article-news-sidebar__warning-tag">⚠ CẢNH BÁO Y TẾ</span>
                  <h3>Dấu hiệu cần đi cấp cứu ngay</h3>
                  <p className="text-xs text-rose-800 mb-2">Nếu triệu chứng xuất hiện đột ngột hoặc nặng lên nhanh chóng, hãy gọi 115.</p>
                  <ul className="article-news-sidebar__warning-list">
                    {warningSigns.map((item) => (
                      <li key={item}>
                        <span className="text-rose-600 font-bold">⚠</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <a className="outline-button outline-button--small outline-button--danger" href="tel:115">
                    Gọi cấp cứu 115
                  </a>
                </div>
              ) : null}

              <div className="article-news-sidebar__card article-news-sidebar__steps">
                <span className="article-news-sidebar__card-tag">HƯỚNG DẪN</span>
                <h3>Ba bước để dùng thông tin an toàn</h3>
                <div className="article-news-sidebar__step-items">
                  {ARTICLE_STEPS.map(([number, title, description]) => (
                    <div className="resource-step-card article-news-sidebar__step-card" key={number}>
                      <span className="article-news-sidebar__step-num">{number}</span>
                      <div>
                        <strong>{title}</strong>
                        <p>{description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        ) : null}
      </div>
    </PublicPageShell>
  );
}
