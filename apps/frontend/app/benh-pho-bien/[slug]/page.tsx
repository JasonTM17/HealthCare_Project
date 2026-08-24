"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { PublicBookingButton, PublicPageShell } from "../../../components/PublicPageShell";
import { fetchArticleBySlug } from "../../../lib/api-client";
import type { Article } from "../../../types/hospital";

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

export default function DiseaseGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params); const [article, setArticle] = useState<Article | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(false); const [retry, setRetry] = useState(0);
  useEffect(() => { let cancelled = false; void Promise.resolve().then(() => { if (cancelled) return undefined; setLoading(true); setError(false); return fetchArticleBySlug(slug); }).then((value) => { if (!cancelled && value) setArticle(value); }).catch(() => { if (!cancelled) setError(true); }).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, [slug, retry]);
  const takeaways = stringList(article?.keyTakeaways);
  const warningSigns = stringList(article?.warningSigns);
  const preventionTips = stringList(article?.preventionTips);
  const sources = stringList(article?.sourceReferences);
  return <PublicPageShell><div className="article-page section-inner"><Link className="portal-context-link" href="/benh-pho-bien">← Kho bệnh phổ biến</Link>{loading ? <p className="catalog-status" role="status">Đang tải bài viết…</p> : null}{error ? <div className="catalog-status catalog-status--error" role="alert">Bài viết chưa thể tải. <button className="outline-button outline-button--small" onClick={() => setRetry((v) => v + 1)} type="button">Thử tải lại</button></div> : null}{article ? <article><header className="resource-page__header"><p className="section-note">{article.category ?? "Bệnh phổ biến"} · Nguồn bệnh viện được bác sĩ nội bộ duyệt</p><h1>{article.title}</h1><p>{article.summary}</p><div className="resource-actions"><PublicBookingButton>Đặt lịch thăm khám</PublicBookingButton>{article.relatedSpecialtySlug ? <Link className="outline-button" href={`/specialties/${article.relatedSpecialtySlug}`}>Xem chuyên khoa</Link> : null}</div></header><div className="article-body"><p>{article.body}</p>{takeaways.length ? <section className="resource-panel"><h2>Điểm cần nhớ</h2><ul>{takeaways.map((item) => <li key={item}>{item}</li>)}</ul></section> : null}{warningSigns.length ? <section className="resource-panel resource-panel--warning"><h2>Dấu hiệu cảnh báo</h2><p className="section-note">Nếu triệu chứng nặng lên nhanh hoặc bạn thấy không an toàn, hãy gọi 115.</p><ul>{warningSigns.map((item) => <li key={item}>{item}</li>)}</ul></section> : null}{article.whenToSeekCare ? <section className="resource-panel"><h2>Khi nào nên đi khám?</h2><p>{article.whenToSeekCare}</p></section> : null}{preventionTips.length ? <section className="resource-panel"><h2>Chủ động chăm sóc</h2><ul>{preventionTips.map((item) => <li key={item}>{item}</li>)}</ul></section> : null}{article.sections?.map((section) => <section key={`${section.heading}-${section.body}`}><h2>{section.heading}</h2><p>{section.body}</p></section>)}{sources.length ? <section className="resource-panel"><h2>Nguồn tham khảo</h2><ul>{sources.map((source) => <li key={source}>{source}</li>)}</ul></section> : null}</div><p className="clinical-disclaimer">{article.clinicalDisclaimer ?? "Thông tin này chỉ nhằm giáo dục sức khỏe, không phải chẩn đoán hay đơn thuốc."} Nếu có dấu hiệu khẩn cấp, gọi 115.</p></article> : null}</div></PublicPageShell>;
}
