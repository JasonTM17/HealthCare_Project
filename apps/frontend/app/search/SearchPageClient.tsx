"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactElement } from "react";
import { PublicAiButton, PublicBookingButton, PublicPageShell } from "../../components/PublicPageShell";
import PackageBookingModal from "../../components/PackageBookingModal";
import Icon from "../../components/UiIcon";
import {
  ApiError,
  fetchArticles,
  fetchDoctors,
  fetchPackages,
  fetchSemanticSearch,
  fetchServices,
  fetchSpecialties,
} from "../../lib/api-client";
import { presentApiError } from "../../lib/present-api-error";
import { dedupePublicDoctors } from "../../lib/public-catalog";
import { useAuthSession } from "../../components/useAuthSession";
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

type SearchGroupKey = keyof SearchCatalog;
type SearchGroupStatus = "loading" | "loaded" | "failed";

interface CatalogPage<T> {
  content: T[];
  totalPages: number;
  last?: boolean;
}

interface BoundedCatalog<T> {
  content: T;
  loadedPages: number;
  totalPages: number;
  truncated: boolean;
}

const SEARCH_PAGE_SIZE = 100;
const SEARCH_PAGE_CAP = 3;

const EMPTY_SEARCH_CATALOG: SearchCatalog = {
  specialties: [],
  doctors: [],
  services: [],
  packages: [],
  articles: [],
};

const SEARCH_GROUP_LABELS: Record<SearchGroupKey, string> = {
  specialties: "chuyên khoa",
  doctors: "bác sĩ",
  services: "dịch vụ",
  packages: "gói khám",
  articles: "bài viết",
};

const INITIAL_SEARCH_GROUP_STATUS: Record<SearchGroupKey, SearchGroupStatus> = {
  specialties: "loading",
  doctors: "loading",
  services: "loading",
  packages: "loading",
  articles: "loading",
};

async function fetchBoundedContent<T>(
  fetchPage: (page: number, size: number) => Promise<CatalogPage<T>>,
  size = SEARCH_PAGE_SIZE,
  maxPages = SEARCH_PAGE_CAP,
): Promise<BoundedCatalog<T[]>> {
  const firstPage = validateCatalogPage(await fetchPage(0, size));
  const totalPages = Number.isFinite(firstPage.totalPages) ? Math.max(firstPage.totalPages, 0) : 0;
  const remainingPageCount = Math.min(Math.max(totalPages - 1, 0), Math.max(maxPages - 1, 0));
  const remainingPages = remainingPageCount > 0
    ? await Promise.all(Array.from({ length: remainingPageCount }, (_, index) => fetchPage(index + 1, size).then(validateCatalogPage)))
    : [];
  const pages = [firstPage, ...remainingPages];

  return {
    content: pages.flatMap((page) => page.content),
    loadedPages: pages.length,
    totalPages,
    truncated: totalPages > maxPages,
  };
}

function validateCatalogPage<T>(page: CatalogPage<T>): CatalogPage<T> {
  if (!page || !Array.isArray(page.content) || !Number.isFinite(page.totalPages) || page.totalPages < 0) {
    throw new Error("Invalid catalog page response");
  }
  return page;
}

// One group's bounded catalog fetch, extracted so the initial load and a
// per-group "Thử lại" retry run the exact same request pipeline. The result is
// the catalog-row union; the caller stores it into the computed key slot.
function loadCatalogGroup(group: SearchGroupKey): Promise<BoundedCatalog<SearchCatalog[SearchGroupKey]>> {
  switch (group) {
    case "specialties":
      return fetchBoundedContent((page, size) => fetchSpecialties(page, size));
    case "doctors":
      return fetchBoundedContent((page, size) => fetchDoctors({ page, size })).then((response) => ({
        ...response,
        content: dedupePublicDoctors(response.content),
      }));
    case "services":
      return fetchBoundedContent((page, size) => fetchServices(page, size));
    case "packages":
      return fetchBoundedContent((page, size) => fetchPackages(page, size));
    case "articles":
      return fetchBoundedContent((page, size) => fetchArticles(page, size));
  }
}

const SEARCH_GROUP_KEYS = Object.keys(INITIAL_SEARCH_GROUP_STATUS) as SearchGroupKey[];

const SEARCH_GUIDE_STEPS = [
  ["01", "Nhập nhu cầu", "Gõ triệu chứng, tên chuyên khoa, tên bác sĩ, dịch vụ hoặc chủ đề sức khỏe bạn đang quan tâm."],
  ["02", "Đọc thông tin bệnh viện", "Ưu tiên các kết quả có đường dẫn tới danh mục chính thức để xem thông tin có thể đặt lịch."],
  ["03", "Mở gợi ý thông minh", "Gợi ý giúp bạn có thêm hướng tìm hiểu, không thay thế tư vấn y khoa hoặc chẩn đoán."],
] as const;

type SearchCategory = "ALL" | "SPECIALTY" | "DOCTOR" | "PACKAGE" | "SERVICE" | "ARTICLE";

interface CategoryTab {
  key: SearchCategory;
  label: string;
}

const CATEGORY_TABS: readonly CategoryTab[] = [
  { key: "ALL", label: "Tất cả" },
  { key: "SPECIALTY", label: "Chuyên khoa" },
  { key: "DOCTOR", label: "Bác sĩ" },
  { key: "PACKAGE", label: "Gói khám" },
  { key: "SERVICE", label: "Dịch vụ" },
  { key: "ARTICLE", label: "Bài viết" },
] as const;

function normalize(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("vi-VN")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

function matches(query: string, values: Array<string | undefined>): boolean {
  return values.some((value) => value && normalize(value).includes(query));
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

function doctorResultMeta(doctor: Doctor): string {
  const branches = (doctor.branchNames ?? []).filter(Boolean);
  const branchLabel = branches.length > 2
    ? `${branches.slice(0, 2).join(" · ")} +${branches.length - 2} cơ sở`
    : branches.join(" · ");
  return [doctor.specialtyName, branchLabel].filter(Boolean).join(" · ") || doctor.bio;
}

// aria-labelledby idrefs cannot contain whitespace; Vietnamese headings such
// as "Chuyên khoa" would otherwise produce ids the browser never resolves.
function slugifyHeading(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "section";
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
    <section className="search-results__section" aria-labelledby={`search-${slugifyHeading(title)}`}>
      <div className="section-heading search-results__heading">
        <div><p className="section-note">{eyebrow}</p><h2 id={`search-${slugifyHeading(title)}`}>{title}</h2></div>
      </div>
      {children}
    </section>
  );
}

export default function SearchPageClient({ initialQuery }: SearchPageClientProps): ReactElement {
  const router = useRouter();
  const authSession = useAuthSession();
  const [query, setQuery] = useState(initialQuery);
  const [catalog, setCatalog] = useState<SearchCatalog>(EMPTY_SEARCH_CATALOG);
  const [groupStatus, setGroupStatus] = useState<Record<SearchGroupKey, SearchGroupStatus>>(INITIAL_SEARCH_GROUP_STATUS);
  const [failedGroupKeys, setFailedGroupKeys] = useState<SearchGroupKey[]>([]);
  const [truncatedGroupKeys, setTruncatedGroupKeys] = useState<SearchGroupKey[]>([]);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery.trim());
  const [semantic, setSemantic] = useState<SemanticSearchResponse | null>(null);
  const [semanticLoading, setSemanticLoading] = useState(false);
  const [semanticError, setSemanticError] = useState<string | null>(null);
  const [semanticStateKey, setSemanticStateKey] = useState<string | null>(null);
  const [semanticResultKey, setSemanticResultKey] = useState<string | null>(null);
  const semanticAuthorityKeyRef = useRef<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<SearchCategory>("ALL");
  const [selectedPackageForModal, setSelectedPackageForModal] = useState<HealthPackage | null>(null);

  const semanticQuery = submittedQuery.trim();
  const sessionAuthorityKey = authSession
    ? `${authSession.user.id}\u0000${Date.parse(authSession.absoluteExpiresAt)}`
    : null;
  const semanticAuthorityKey = sessionAuthorityKey && semanticQuery
    ? `${sessionAuthorityKey}\u0000${semanticQuery}`
    : null;

  useEffect(() => {
    semanticAuthorityKeyRef.current = semanticAuthorityKey;
  }, [semanticAuthorityKey]);

  // Per-group run tokens: a late response from a superseded attempt (an
  // initial load landing after its own retry) must not overwrite the slot it
  // lost, so each group tracks its newest request id.
  const groupRunRef = useRef<Record<SearchGroupKey, number>>({
    specialties: 0,
    doctors: 0,
    services: 0,
    packages: 0,
    articles: 0,
  });
  const mountedRef = useRef(true);

  const loadGroup = useCallback((group: SearchGroupKey): void => {
    const runId = groupRunRef.current[group] + 1;
    groupRunRef.current[group] = runId;
    setGroupStatus((previous) => ({ ...previous, [group]: "loading" }));
    void loadCatalogGroup(group)
      .then((response) => {
        if (!mountedRef.current || groupRunRef.current[group] !== runId) return;
        setCatalog((previous) => ({ ...previous, [group]: response.content } as SearchCatalog));
        setGroupStatus((previous) => ({ ...previous, [group]: "loaded" }));
        // The group is serving again — drop it from the failed set so the
        // aggregate line and its retry buttons stop reporting a resolved gap.
        setFailedGroupKeys((previous) => (previous.includes(group) ? previous.filter((key) => key !== group) : previous));
        if (response.truncated) {
          setTruncatedGroupKeys((previous) => previous.includes(group) ? previous : [...previous, group]);
        }
      })
      .catch(() => {
        if (!mountedRef.current || groupRunRef.current[group] !== runId) return;
        setGroupStatus((previous) => ({ ...previous, [group]: "failed" }));
        setFailedGroupKeys((previous) => (previous.includes(group) ? previous : [...previous, group]));
      });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    // Deferred off the effect body so the render→effect boundary stays free of
    // synchronous setState (the codebase's load pattern). Each group starts on
    // its own request, and a failed one can be retried without disturbing the
    // groups that already loaded.
    void Promise.resolve().then(() => {
      for (const group of SEARCH_GROUP_KEYS) loadGroup(group);
    });
    return () => { mountedRef.current = false; };
  }, [loadGroup]);

  useEffect(() => {
    let cancelled = false;
    const capturedAuthorityKey = semanticAuthorityKey;
    const isCurrentAuthority = (): boolean => (
      !cancelled && semanticAuthorityKeyRef.current === capturedAuthorityKey
    );
    if (!capturedAuthorityKey) {
      if (isCurrentAuthority()) {
        setSemantic(null);
        setSemanticStateKey(null);
        setSemanticResultKey(null);
        setSemanticLoading(false);
        setSemanticError(null);
      }
      return () => { cancelled = true; };
    }

    if (isCurrentAuthority()) {
      // A new session or submitted query invalidates both the in-flight
      // loading state and the previously resolved result. Keep the result key
      // separate so loading cannot make an old response visible.
      setSemantic(null);
      setSemanticStateKey(capturedAuthorityKey);
      setSemanticResultKey(null);
      setSemanticLoading(true);
      setSemanticError(null);
    }

    void Promise.resolve()
      .then(() => fetchSemanticSearch(semanticQuery))
      .then((response) => {
        if (isCurrentAuthority()) {
          setSemantic(response);
          setSemanticResultKey(capturedAuthorityKey);
        }
      })
      .catch((error: unknown) => {
        if (isCurrentAuthority()) {
          setSemantic(null);
          setSemanticResultKey(null);
          setSemanticError(presentApiError(
            error instanceof ApiError ? error.code : null,
            error instanceof ApiError ? error.status : undefined,
          ));
        }
      })
      .finally(() => {
        if (isCurrentAuthority()) setSemanticLoading(false);
      });

    return () => { cancelled = true; };
  }, [semanticAuthorityKey, semanticQuery]);

  const loading = Object.values(groupStatus).some((status) => status === "loading");
  const catalogSettled = !loading;
  const loadedGroupCount = Object.values(groupStatus).filter((status) => status !== "loading").length;
  const loadedCatalogGroupCount = Object.values(groupStatus).filter((status) => status === "loaded").length;
  const loadingGroupLabels = (Object.keys(groupStatus) as SearchGroupKey[])
    .filter((group) => groupStatus[group] === "loading")
    .map((group) => SEARCH_GROUP_LABELS[group]);
  const truncatedGroupLabels = truncatedGroupKeys.map((group) => SEARCH_GROUP_LABELS[group]);
  const error = failedGroupKeys.length > 0
    ? `Một phần thông tin tạm thời chưa thể hiển thị (${failedGroupKeys.length}/5 nhóm). Bạn vẫn có thể xem các kết quả còn lại.`
    : null;

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
  const hasAuthSession = Boolean(authSession);
  const semanticStateVisible = Boolean(semanticAuthorityKey && semanticStateKey === semanticAuthorityKey);
  const semanticVisible = Boolean(semanticStateVisible && semanticResultKey === semanticAuthorityKey);

  const categoryCounts: Record<SearchCategory, number> = useMemo(() => ({
    ALL: resultCount,
    SPECIALTY: result?.specialties.length ?? 0,
    DOCTOR: result?.doctors.length ?? 0,
    PACKAGE: result?.packages.length ?? 0,
    SERVICE: result?.services.length ?? 0,
    ARTICLE: result?.articles.length ?? 0,
  }), [result, resultCount]);

  const submitSearch = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const nextQuery = query.trim();
    setSubmittedQuery(nextQuery);
    setActiveCategory("ALL");
    setSemantic(null);
    setSemanticError(null);
    router.replace(nextQuery ? `/search?q=${encodeURIComponent(nextQuery)}` : "/search");
  };

  return (
    <PublicPageShell
      doctors={catalog.doctors}
      packages={catalog.packages}
      specialties={catalog.specialties}
    >
      <div className="catalog-page section-inner search-page">
        {/* Breadcrumb above already links home; a duplicate back-link here
            stacked two home paths within one screen. */}
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
            <h2>Một ô tìm kiếm cho toàn bệnh viện.</h2>
            <p className="resource-lead">
              Danh mục bệnh viện đưa bạn tới đúng trang có thể đặt lịch; gợi ý thông minh chỉ mở rộng
              hướng tìm hiểu khi bạn đã đăng nhập và luôn nêu rõ nguồn tham khảo.
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
                <dt>Danh mục tìm kiếm</dt>
                <dd>{loadedGroupCount}/5 nhóm đã phản hồi</dd>
              </div>
              <div>
                <dt>Gợi ý thông minh</dt>
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
            <button className="button button--primary" type="submit">Tìm kiếm</button>
          </div>
          <p>Bạn có thể nhập tên bác sĩ, chuyên khoa, dịch vụ hoặc chủ đề sức khỏe cần tìm hiểu.</p>
        </form>

        {loading ? <p className="catalog-status catalog-status--loading" role="status">Đang tải {loadingGroupLabels.join(", ")}… Các nhóm đã sẵn sàng vẫn đang hiển thị.</p> : null}
        {error ? <p className="catalog-status catalog-status--error" role="alert">{error} Bạn vẫn có thể thử lại sau.</p> : null}
        {/* Per-group recovery: the aggregate line above states the gap, this
            offers a retry for each failed group without discarding the groups
            that already loaded. */}
        {failedGroupKeys.length > 0 ? (
          <p className="catalog-status" role="status">
            <span>Chưa tải được: {failedGroupKeys.map((group) => SEARCH_GROUP_LABELS[group]).join(", ")}.</span>{" "}
            {failedGroupKeys.map((group) => (
              <button
                aria-label={`Thử tải lại nhóm ${SEARCH_GROUP_LABELS[group]}`}
                className="text-button"
                key={group}
                onClick={() => loadGroup(group)}
                type="button"
              >
                Thử lại {SEARCH_GROUP_LABELS[group]}
              </button>
            ))}
          </p>
        ) : null}
        {truncatedGroupLabels.length > 0 ? (
          <p className="catalog-status" role="status">
            Tìm kiếm hiện chỉ quét {SEARCH_PAGE_CAP} trang đầu của {truncatedGroupLabels.join(", ")}. Các nhóm này còn dữ liệu phía sau; hãy mở danh mục tương ứng để xem đầy đủ.
          </p>
        ) : null}
        {!hasAuthSession && normalize(query) ? <p className="catalog-status">Đăng nhập để nhận thêm gợi ý nội dung liên quan đến nhu cầu của bạn.</p> : null}
        {semanticStateVisible && semanticLoading ? <p className="catalog-status catalog-status--loading" role="status">Đang tìm thêm nội dung liên quan…</p> : null}
        {semanticStateVisible && resultCount === 0 && semanticError ? <p className="catalog-status catalog-status--error" role="alert">{semanticError}</p> : null}
        {semanticVisible && semantic?.results.length ? (
          <section className="search-results__section" aria-labelledby="semantic-results">
            <div className="section-heading search-results__heading">
              <div>
                <p className="section-note">Gợi ý thông minh có nguồn tham khảo</p>
                <h2 id="semantic-results">Có thể bạn cũng quan tâm</h2>
                <p className="search-results__assistive">
                  Đây là gợi ý tự động dựa trên nội dung đã được chọn lọc. Hãy mở thông tin bệnh viện hoặc đặt lịch để được xác nhận y khoa.
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
              Nguồn gợi ý: {semantic.provenance || "HealthCare"}
              {semantic.specialty ? ` · Gợi ý chuyên khoa: ${semantic.specialty}` : ""}
            </p>
          </section>
        ) : null}
        {catalogSettled && !normalize(query) ? <section className="resource-panel resource-panel--accent"><h2>Nhập một từ khóa để bắt đầu</h2><p>Ví dụ: tên chuyên khoa, bác sĩ, dịch vụ hoặc bài viết bạn quan tâm — kết quả sẽ dẫn thẳng đến trang phù hợp.</p></section> : null}
        {catalogSettled && result && resultCount === 0 ? <p className="catalog-status" role="status">{loadedCatalogGroupCount === 0 ? "Chưa có nhóm thông tin nào sẵn sàng để tìm kiếm." : `Không tìm thấy kết quả khớp với “${query.trim()}”.`}</p> : null}

        {result && resultCount > 0 ? (
          <div className="search-results" aria-live="polite">
            <div className="search-category-tabs flex flex-wrap items-center gap-2 pb-3 border-b border-slate-200" role="tablist" aria-label="Bộ lọc danh mục tìm kiếm">
              {CATEGORY_TABS.map((tab) => {
                const isActive = activeCategory === tab.key;
                const count = categoryCounts[tab.key];
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveCategory(tab.key)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-sm border transition-colors cursor-pointer ${
                      isActive
                        ? "border-[#003336] bg-[#003336] text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    {tab.label} <span className={isActive ? "text-teal-200" : "text-slate-400"}>({count})</span>
                  </button>
                );
              })}
            </div>
            <p className="search-results__count">{resultCount} kết quả phù hợp</p>
            {(activeCategory === "ALL" || activeCategory === "SPECIALTY") && result.specialties.length > 0 ? (
              <ResultSection eyebrow="Chăm sóc chuyên sâu" title="Chuyên khoa">
                <div className="search-result-list">
                  {result.specialties.map((item) => (
                    <Link className="search-result" href={`/specialties/${item.slug}`} key={item.id}>
                      <span className="resource-chip">Chuyên khoa</span>
                      <strong>{item.name}</strong>
                      <p>{item.description}</p>
                    </Link>
                  ))}
                </div>
              </ResultSection>
            ) : null}
            {(activeCategory === "ALL" || activeCategory === "DOCTOR") && result.doctors.length > 0 ? (
              <ResultSection eyebrow="Đội ngũ" title="Bác sĩ">
                <div className="search-result-list">
                  {result.doctors.map((item) => (
                    <article className="search-result" key={item.id}>
                      <Link href={`/doctors/${item.slug}`}>
                        <span className="resource-chip">Bác sĩ</span>
                        <strong>{item.fullName}</strong>
                        <p>{doctorResultMeta(item)}</p>
                      </Link>
                      <PublicBookingButton className="outline-button outline-button--small" selection={{ doctorId: item.id }}>
                        Đặt lịch
                      </PublicBookingButton>
                    </article>
                  ))}
                </div>
              </ResultSection>
            ) : null}
            {(activeCategory === "ALL" || activeCategory === "PACKAGE") && result.packages.length > 0 ? (
              <ResultSection eyebrow="Kiểm tra chủ động" title="Gói khám">
                <div className="search-result-list">
                  {result.packages.map((item) => (
                    <article className="search-result" key={item.id}>
                      <Link href={`/packages/${item.slug}`}>
                        <span className="resource-chip resource-chip--warm">Gói khám</span>
                        <strong>{item.name}</strong>
                        <p>{item.description}</p>
                      </Link>
                      <button
                        type="button"
                        className="outline-button outline-button--small"
                        onClick={() => setSelectedPackageForModal(item)}
                      >
                        Đặt lịch với gói này
                      </button>
                    </article>
                  ))}
                </div>
              </ResultSection>
            ) : null}
            {(activeCategory === "ALL" || activeCategory === "SERVICE") && result.services.length > 0 ? (
              <ResultSection eyebrow="Dịch vụ" title="Dịch vụ y tế">
                <div className="search-result-list">
                  {result.services.map((item) => (
                    <Link className="search-result" href={`/services/${item.slug}`} key={item.id}>
                      <span className="resource-chip">Dịch vụ</span>
                      <strong>{item.name}</strong>
                      <p>{item.description}</p>
                    </Link>
                  ))}
                </div>
              </ResultSection>
            ) : null}
            {(activeCategory === "ALL" || activeCategory === "ARTICLE") && result.articles.length > 0 ? (
              <ResultSection eyebrow="Cẩm nang" title="Bài viết">
                <div className="search-result-list">
                  {result.articles.map((item) => (
                    <Link className="search-result" href={`/articles/${item.slug}`} key={item.id}>
                      <span className="resource-chip">Cẩm nang</span>
                      <strong>{item.title}</strong>
                      <p>{item.summary}</p>
                    </Link>
                  ))}
                </div>
              </ResultSection>
            ) : null}
            {activeCategory !== "ALL" && categoryCounts[activeCategory] === 0 ? (
              <p className="catalog-status" role="status">
                Không tìm thấy kết quả nào trong danh mục “{CATEGORY_TABS.find((t) => t.key === activeCategory)?.label}”.
              </p>
            ) : null}
          </div>
        ) : null}
        {selectedPackageForModal ? (
          <PackageBookingModal
            isOpen={Boolean(selectedPackageForModal)}
            onClose={() => setSelectedPackageForModal(null)}
            packageItem={selectedPackageForModal}
          />
        ) : null}
      </div>
    </PublicPageShell>
  );
}
