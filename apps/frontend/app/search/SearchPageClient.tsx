"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent, type ReactElement } from "react";
import { PublicBackLink, PublicBookingButton, PublicPageShell } from "../../components/PublicPageShell";
import Icon from "../../components/UiIcon";
import {
  fetchArticles,
  fetchAllContent,
  fetchDoctors,
  fetchPackages,
  fetchServices,
  fetchSpecialties,
} from "../../lib/api-client";
import type { Article, Doctor, HealthPackage, MedicalService, Specialty } from "../../types/hospital";

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

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("vi-VN");
}

function matches(query: string, values: Array<string | undefined>): boolean {
  return values.some((value) => value && normalize(value).includes(query));
}

function settledContent<T>(result: PromiseSettledResult<T[]>): T[] {
  return result.status === "fulfilled" ? result.value : [];
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
          ? `Không tải được ${failedCount}/5 nhóm catalog; các kết quả còn lại vẫn lấy trực tiếp từ backend.`
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

  const submitSearch = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const nextQuery = query.trim();
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
          <p className="section-note">Tìm kiếm toàn hệ thống · backend active</p>
          <h1>Tìm đúng điểm bắt đầu cho nhu cầu chăm sóc</h1>
          <p>Kết quả được tổng hợp từ chuyên khoa, bác sĩ, dịch vụ, gói khám và cẩm nang đang được backend cung cấp.</p>
        </header>

        <form className="search-page__form" onSubmit={submitSearch}>
          <label htmlFor="search-page-input">Từ khóa</label>
          <div className="search-page__control">
            <Icon name="search" size={19} />
            <input id="search-page-input" onChange={(event) => setQuery(event.target.value)} placeholder="Ví dụ: tim mạch, khám tổng quát…" type="search" value={query} />
            <button className="button button--primary" disabled={loading} type="submit">Tìm kiếm</button>
          </div>
          <p>Không có dữ liệu tĩnh thay thế khi backend lỗi hoặc chưa có bản ghi active.</p>
        </form>

        {loading ? <p className="catalog-status catalog-status--loading" role="status">Đang tải catalog tìm kiếm…</p> : null}
        {error ? <p className="catalog-status catalog-status--error" role="alert">{error} Không có dữ liệu tĩnh thay thế.</p> : null}
        {!loading && !normalize(query) ? <section className="resource-panel resource-panel--accent"><h2>Nhập một từ khóa để bắt đầu</h2><p>Hệ thống sẽ lọc theo dữ liệu active đã xuất bản, sau đó đưa bạn về đúng trang chuyên khoa, bác sĩ hoặc nội dung.</p></section> : null}
        {!loading && result && resultCount === 0 ? <p className="catalog-status" role="status">{error ? "Chưa có nhóm catalog nào sẵn sàng để tìm kiếm." : `Không tìm thấy kết quả khớp với “${query.trim()}”.`}</p> : null}

        {!loading && result && resultCount > 0 ? (
          <div className="search-results" aria-live="polite">
            <p className="search-results__count">{resultCount} kết quả từ catalog active</p>
            {result.specialties.length > 0 ? <ResultSection eyebrow="Care Rail" title="Chuyên khoa"><div className="search-result-list">{result.specialties.map((item) => <Link className="search-result" href={`/specialties/${item.slug}`} key={item.id}><span className="resource-chip">Chuyên khoa</span><strong>{item.name}</strong><p>{item.description}</p></Link>)}</div></ResultSection> : null}
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
