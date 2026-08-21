"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent, type ReactElement } from "react";
import { PublicAiButton, PublicBackLink, PublicBookingButton, PublicPageShell } from "../../components/PublicPageShell";
import Icon from "../../components/UiIcon";
import {
  fetchArticles,
  fetchAllContent,
  fetchDoctors,
  fetchPackages,
  fetchSemanticSearch,
  fetchServices,
  fetchSpecialties,
  readAuthSession,
} from "../../lib/api-client";
import type { AiTriageCitation, Article, Doctor, HealthPackage, MedicalService, SemanticSearchResponse, Specialty } from "../../types/hospital";

interface SearchPageClientProps {
  initialQuery: string;
}

interface SearchCatalog {
  specialties: Specialty[];
  doctors: Doctor[];
  services: MedicalService[];
  packages: HealthPackage[];
  articles: Article[];
}

const SEARCH_GUIDE_STEPS = [
  ["01", "Nhập nhu cầu", "Gõ triệu chứng, tên chuyên khoa, tên bác sĩ, dịch vụ hoặc chủ đề sức khỏe bạn đang quan tâm."],
  ["02", "Đọc kết quả chính thức", "Ưu tiên các thẻ có đường dẫn tới catalog công khai vì đây là dữ liệu active đã xuất bản."],
  ["03", "Dùng AI như gợi ý mở rộng", "Kết quả semantic giúp mở thêm hướng tìm hiểu, không thay thế tư vấn y khoa hoặc chẩn đoán."],
] as const;

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("vi-VN");
}

function matches(query: string, values: Array<string | undefined>): boolean {
  return values.some((value) => value && normalize(value).includes(query));
}

function settledContent<T>(result: PromiseSettledResult<T[]>): T[] {
  return result.status === "fulfilled" ? result.value : [];
}

function semanticSourceLabel(sourceType: SemanticSearchResponse["results"][number]["source_type"]): string {
  const labels: Record<SemanticSearchResponse["results"][number]["source_type"], string> = {
    specialty: "Chuyên khoa",
    doctor: "Bác sĩ",
    service: "Dịch vụ",
    package: "Gói khám",
    article: "Cẩm nang",
    faq: "Hỏi đáp",
  };
  return labels[sourceType];
}

function semanticScoreLabel(score: number): string {
  if (!Number.isFinite(score)) return "Độ phù hợp chưa xác định";
  const normalizedScore = score <= 1 ? score * 100 : score;
  const boundedScore = Math.max(0, Math.min(100, normalizedScore));
  return `${Math.round(boundedScore)}% phù hợp`;
}

function citationLabel(citation: AiTriageCitation): string {
  const title = citation.title.trim();
  return title || `${semanticSourceLabel(citation.source_type)} · ${citation.source_id}`;
}

function ResultSection({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactElement;
}): ReactElement {
  return (
    <section className="search-results__section" aria-labelledby={`search-${title}`}>
      <div className="section-heading search-results__heading">
        <div><p className="section-note">{eyebrow}</p><h2 id={`search-${title}`}>{title}</h2></div>
      </div>
      {children}
    </section>
  );
}

export default function SearchPageClient({ initialQuery }: SearchPageClientProps): ReactElement {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [catalog, setCatalog] = useState<SearchCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery.trim());
  const [semantic, setSemantic] = useState<SemanticSearchResponse | null>(null);
  const [semanticLoading, setSemanticLoading] = useState(false);
  const [semanticError, setSemanticError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      fetchAllContent((page, size) => fetchSpecialties(page, size)),
      fetchAllContent((page, size) => fetchDoctors({ page, size })),
      fetchAllContent((page, size) => fetchServices(page, size)),
      fetchAllContent((page, size) => fetchPackages(page, size)),
      fetchAllContent((page, size) => fetchArticles(page, size)),
    ] as const)
      .then((responses) => {
        if (cancelled) return;
        const [specialties, doctors, services, packages, articles] = responses;
        const failedCount = responses.filter((response) => response.status === "rejected").length;
        setCatalog({
          specialties: settledContent(specialties),
          doctors: settledContent(doctors),
          services: settledContent(services),
          packages: settledContent(packages),
          articles: settledContent(articles),
        });
        setError(failedCount > 0
          ? `Một phần thông tin tạm thời chưa thể hiển thị (${failedCount}/5 nhóm). Bạn vẫn có thể xem các kết quả còn lại.`
          : null);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Không thể tải catalog tìm kiếm.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!submittedQuery || !readAuthSession()) return;

    let cancelled = false;
    void Promise.resolve()
      .then(() => {
        if (!cancelled) {
          setSemanticLoading(true);
          setSemanticError(null);
        }
        return fetchSemanticSearch(submittedQuery);
      })
      .then((response) => {
        if (!cancelled) setSemantic(response);
      })
      .catch(() => {
        if (!cancelled) setSemanticError("Tạm thời chưa thể mở rộng kết quả tìm kiếm. Vui lòng thử lại sau.");
      })
      .finally(() => {
        if (!cancelled) setSemanticLoading(false);
      });

    return () => { cancelled = true; };
  }, [submittedQuery]);

  const result = useMemo(() => {
    const normalizedQuery = normalize(query);
    if (!catalog || !normalizedQuery) return null;
    return {
      specialties: catalog.specialties.filter((item) => matches(normalizedQuery, [item.name, item.slug, item.description])),
      doctors: catalog.doctors.filter((item) => matches(normalizedQuery, [item.fullName, item.slug, item.bio, item.specialtyName])),
      services: catalog.services.filter((item) => matches(normalizedQuery, [item.name, item.slug, item.description])),
      packages: catalog.packages.filter((item) => matches(normalizedQuery, [item.name, item.slug, item.description])),
      articles: catalog.articles.filter((item) => matches(normalizedQuery, [item.title, item.slug, item.summary, item.body])),
    };
  }, [catalog, query]);

  const resultCount = result
    ? result.specialties.length + result.doctors.length + result.services.length + result.packages.length + result.articles.length
    : 0;
  const hasAuthSession = Boolean(readAuthSession());
  const catalogGroupCount = catalog
    ? [catalog.specialties, catalog.doctors, catalog.services, catalog.packages, catalog.articles].filter((items) => items.length > 0).length
    : 0;

  const submitSearch = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const nextQuery = query.trim();
    setSubmittedQuery(nextQuery);
    setSemantic(null);
    setSemanticError(null);
    router.replace(nextQuery ? `/search?q=${encodeURIComponent(nextQuery)}` : "/search");
  };

  return (
    <PublicPageShell
      doctors={catalog?.doctors ?? []}
      packages={catalog?.packages ?? []}
      specialties={catalog?.specialties ?? []}
    >
      <div className="catalog-page section-inner search-page">
        <PublicBackLink href="/">← Về trang chính</PublicBackLink>
        <header className="resource-page__header">
          <p className="section-note">Tìm bác sĩ và dịch vụ</p>
          <h1>Tìm đúng điểm bắt đầu cho nhu cầu chăm sóc</h1>
          <p>Tìm trong danh sách chuyên khoa, bác sĩ, dịch vụ, gói khám và cẩm nang sức khỏe.</p>
        </header>

        <section className="resource-hero-card resource-hero-card--teal search-page__hero">
          <div className="resource-icon" aria-hidden="true">
            <Icon name="search" size={42} />
          </div>
          <div className="resource-hero-card__body">
            <p className="resource-chip">Cổng tìm kiếm thống nhất</p>
            <h2>Một ô tìm kiếm, hai lớp kiểm chứng.</h2>
            <p className="resource-lead">
              Catalog công khai đưa bạn tới đúng trang có thể đặt lịch; lớp AI chỉ mở rộng gợi ý khi đã đăng nhập
              và luôn hiển thị ranh giới nguồn.
            </p>
            <div className="resource-actions">
              <PublicBookingButton>Đặt lịch khám</PublicBookingButton>
              <PublicAiButton className="outline-button outline-button--light">Hỏi trợ lý triệu chứng</PublicAiButton>
              <Link className="outline-button outline-button--light" href="/huong-dan">
                Xem hướng dẫn
              </Link>
            </div>
            <dl className="resource-meta-grid">
              <div>
                <dt>Nhóm dữ liệu</dt>
                <dd>{catalogGroupCount || "Đang tải"}/5</dd>
              </div>
              <div>
                <dt>AI semantic</dt>
                <dd>{hasAuthSession ? "Có phiên đăng nhập" : "Cần đăng nhập"}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="resource-panel resource-panel--wide search-page__guide">
          <div className="section-heading">
            <div>
              <p className="section-note">Lộ trình tìm kiếm</p>
              <h2>Từ từ khóa tới hành động an toàn</h2>
            </div>
          </div>
          <div className="resource-steps resource-steps--grid">
            {SEARCH_GUIDE_STEPS.map(([number, title, description]) => (
              <div className="resource-step-card" key={number}>
                <span>{number}</span>
                <strong>{title}</strong>
                <p>{description}</p>
              </div>
            ))}
          </div>
        </section>

        <form className="search-page__form" onSubmit={submitSearch}>
          <label htmlFor="search-page-input">Từ khóa</label>
          <div className="search-page__control">
            <Icon name="search" size={19} />
            <input id="search-page-input" onChange={(event) => setQuery(event.target.value)} placeholder="Ví dụ: tim mạch, khám tổng quát…" type="search" value={query} />
            <button className="button button--primary" disabled={loading} type="submit">Tìm kiếm</button>
          </div>
          <p>Bạn có thể nhập tên bác sĩ, chuyên khoa, dịch vụ hoặc chủ đề sức khỏe cần tìm hiểu.</p>
        </form>

        {loading ? <p className="catalog-status catalog-status--loading" role="status">Đang tải catalog tìm kiếm…</p> : null}
        {error ? <p className="catalog-status catalog-status--error" role="alert">{error} Không có dữ liệu tĩnh thay thế.</p> : null}
        {!hasAuthSession && normalize(query) ? <p className="catalog-status">Đăng nhập để nhận thêm gợi ý nội dung liên quan đến nhu cầu của bạn.</p> : null}
        {semanticLoading ? <p className="catalog-status catalog-status--loading" role="status">Đang tìm thêm nội dung liên quan…</p> : null}
        {semanticError ? <p className="catalog-status catalog-status--error" role="alert">{semanticError}</p> : null}
        {semantic?.results.length ? (
          <section className="search-results__section" aria-labelledby="semantic-results">
            <div className="section-heading search-results__heading">
              <div>
                <p className="section-note">Gợi ý mở rộng có provenance</p>
                <h2 id="semantic-results">Có thể bạn cũng quan tâm</h2>
                <p className="search-results__assistive">
                  Đây là gợi ý AI dựa trên tìm kiếm semantic. Hãy mở kết quả catalog chính thức hoặc đặt lịch để được xác nhận y khoa.
                </p>
              </div>
            </div>
            <div className="search-result-list">
              {semantic.results.map((item) => (
                <article className="search-result search-result--semantic" key={`${item.source_type}-${item.source_id}`}>
                  <span className="resource-chip">{semanticSourceLabel(item.source_type)}</span>
                  <strong>{item.title}</strong>
                  <p>{item.content}</p>
                  <dl className="semantic-result-meta">
                    <div>
                      <dt>Độ phù hợp</dt>
                      <dd>{semanticScoreLabel(item.score)}</dd>
                    </div>
                    <div>
                      <dt>Nguồn</dt>
                      <dd>{citationLabel(item.citation)}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
            <p className="search-results__provenance">
              Provenance AI: {semantic.provenance || "Backend chưa trả về provenance."}
              {semantic.specialty ? ` · Gợi ý chuyên khoa: ${semantic.specialty}` : ""}
            </p>
          </section>
        ) : null}
        {!loading && !normalize(query) ? <section className="resource-panel resource-panel--accent"><h2>Nhập một từ khóa để bắt đầu</h2><p>Hệ thống sẽ lọc theo dữ liệu active đã xuất bản, sau đó đưa bạn về đúng trang chuyên khoa, bác sĩ hoặc nội dung.</p></section> : null}
        {!loading && result && resultCount === 0 ? <p className="catalog-status" role="status">{error ? "Chưa có nhóm catalog nào sẵn sàng để tìm kiếm." : `Không tìm thấy kết quả khớp với “${query.trim()}”.`}</p> : null}

        {!loading && result && resultCount > 0 ? (
          <div className="search-results" aria-live="polite">
            <p className="search-results__count">{resultCount} kết quả phù hợp</p>
            {result.specialties.length > 0 ? <ResultSection eyebrow="Chăm sóc chuyên sâu" title="Chuyên khoa"><div className="search-result-list">{result.specialties.map((item) => <Link className="search-result" href={`/specialties/${item.slug}`} key={item.id}><span className="resource-chip">Chuyên khoa</span><strong>{item.name}</strong><p>{item.description}</p></Link>)}</div></ResultSection> : null}
            {result.doctors.length > 0 ? <ResultSection eyebrow="Đội ngũ" title="Bác sĩ"><div className="search-result-list">{result.doctors.map((item) => <article className="search-result" key={item.id}><Link href={`/doctors/${item.slug}`}><span className="resource-chip">Bác sĩ</span><strong>{item.fullName}</strong><p>{item.specialtyName ?? item.bio}</p></Link><PublicBookingButton className="outline-button outline-button--small" selection={{ doctorId: item.id }}>Đặt lịch</PublicBookingButton></article>)}</div></ResultSection> : null}
            {result.services.length > 0 ? <ResultSection eyebrow="Dịch vụ" title="Dịch vụ y tế"><div className="search-result-list">{result.services.map((item) => <Link className="search-result" href={`/services/${item.slug}`} key={item.id}><span className="resource-chip">Dịch vụ</span><strong>{item.name}</strong><p>{item.description}</p></Link>)}</div></ResultSection> : null}
            {result.packages.length > 0 ? <ResultSection eyebrow="Kiểm tra chủ động" title="Gói khám"><div className="search-result-list">{result.packages.map((item) => <Link className="search-result" href={`/packages/${item.slug}`} key={item.id}><span className="resource-chip resource-chip--warm">Gói khám</span><strong>{item.name}</strong><p>{item.description}</p></Link>)}</div></ResultSection> : null}
            {result.articles.length > 0 ? <ResultSection eyebrow="Cẩm nang" title="Bài viết"><div className="search-result-list">{result.articles.map((item) => <Link className="search-result" href={`/articles/${item.slug}`} key={item.id}><span className="resource-chip">Cẩm nang</span><strong>{item.title}</strong><p>{item.summary}</p></Link>)}</div></ResultSection> : null}
          </div>
        ) : null}
      </div>
    </PublicPageShell>
  );
}
