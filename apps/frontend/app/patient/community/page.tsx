"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import PortalChrome from "../../../components/PortalChrome";
import {
  fetchArticles,
  fetchSpecialties,
  hasRole,
  subscribeToCatalogChange,
  type Article,
  type Specialty,
} from "../../../lib/api-client";
import { ForbiddenState, LoadingState, LoginRequiredState } from "../../../components/PortalStates";
import { useAuthSession, useAuthSessionStatus } from "../../../components/useAuthSession";
import UiIcon from "../../../components/UiIcon";
import { resolveArticleCoverImage, resolveArticleAlt } from "../../../lib/article-visuals";

export default function PatientCommunityPage() {
  const session = useAuthSession();
  const status = useAuthSessionStatus();

  const [articles, setArticles] = useState<Article[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [articlePage, specList] = await Promise.all([
        fetchArticles(0, 50),
        fetchSpecialties(),
      ]);
      setArticles(articlePage.content);
      setSpecialties(specList.content);
      return articlePage.content;
    } catch {
      setError("Không thể tải danh sách bài viết cộng đồng.");
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const task = Promise.resolve().then(loadData);
    const unsubscribe = subscribeToCatalogChange(async () => {
      await loadData();
    });
    return () => {
      void task;
      unsubscribe();
    };
  }, [loadData]);

  if (status !== "settled" && loading) {
    return (
      <main className="portal-shell">
        <LoadingState label="Đang tải cẩm nang cộng đồng..." />
      </main>
    );
  }

  if (!session?.user) {
    return (
      <main className="portal-shell">
        <LoginRequiredState nextPath="/patient/community" />
      </main>
    );
  }

  if (!hasRole(session.user, "PATIENT")) {
    return (
      <main className="portal-shell">
        <ForbiddenState
          title="Không có quyền truy cập"
          description="Khu vực này chỉ dành cho tài khoản bệnh nhân."
        />
      </main>
    );
  }

  const filteredArticles = selectedSpecialty === "all"
    ? articles
    : articles.filter((a) => a.relatedSpecialtySlug === selectedSpecialty);

  return (
    <PortalChrome role="PATIENT" user={session.user}>
      <div className="w-full max-w-[1240px] mx-auto pb-12 space-y-6">
        <header className="portal-hero mb-6">
          <div>
            <p className="section-note">CỘNG ĐỒNG Y KHOA & CẨM NANG BỆNH VIỆN</p>
            <h1 className="text-2xl font-black text-teal-950 tracking-tight">
              Cộng đồng Y khoa & Cẩm nang Sức khỏe
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Người bệnh có thể theo dõi bài viết chuyên môn từ các Bác sĩ, đọc như báo y tế chính thống, đặt câu hỏi trao đổi trực tiếp và tham gia bình luận y tế an toàn.
            </p>

            {/* Specialty Filter Chips */}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                  selectedSpecialty === "all"
                    ? "bg-teal-900 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
                onClick={() => setSelectedSpecialty("all")}
                type="button"
              >
                Tất cả chuyên khoa ({articles.length})
              </button>
              {specialties.map((s) => {
                const count = articles.filter((a) => a.relatedSpecialtySlug === s.slug).length;
                return (
                  <button
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                      selectedSpecialty === s.slug
                        ? "bg-teal-900 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                    key={s.id}
                    onClick={() => setSelectedSpecialty(s.slug)}
                    type="button"
                  >
                    {s.name} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        {error && (
          <div className="portal-inline-error mb-4" role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-sm border border-slate-200 bg-white p-12 text-center text-slate-500">
            Đang tải danh sách bài viết y khoa...
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="rounded-sm border border-slate-200 bg-white p-12 text-center text-slate-500">
            Không có bài viết nào trong chuyên mục này.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredArticles.map((article) => (
              <Link
                className="flex flex-col justify-between rounded-sm border border-slate-200 bg-white shadow-sm overflow-hidden transition-all hover:border-teal-500 hover:shadow-md cursor-pointer group no-underline text-inherit"
                href={`/articles/${article.slug}`}
                key={article.id}
              >
                <div className="relative h-44 w-full overflow-hidden bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={resolveArticleAlt(article)}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    src={resolveArticleCoverImage(article)}
                  />
                  <span className="absolute top-3 left-3 rounded-[4px] bg-teal-950/85 backdrop-blur-md px-2.5 py-0.5 text-xs font-bold text-teal-100 shadow-xs">
                    {article.category || "Cẩm nang y tế"}
                  </span>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                      <span className="inline-flex items-center gap-1">
                        <UiIcon name="clock" size={13} />
                        <span>{article.readingMinutes || 5} phút đọc</span>
                      </span>
                      <span className="text-[11px] text-teal-800 font-semibold group-hover:underline">Đọc toàn bộ bài báo →</span>
                    </div>

                    <h3 className="text-base font-bold text-teal-950 line-clamp-2 group-hover:text-teal-700 transition-colors">
                      {article.title}
                    </h3>
                    <p className="mt-2 text-xs text-slate-600 line-clamp-3 leading-relaxed">
                      {article.summary}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                    <span className="font-semibold text-slate-700 inline-flex items-center gap-1.5">
                      <UiIcon name="stethoscope" size={14} />
                      <span>{article.authorName || "Bác sĩ Bệnh viện"}</span>
                    </span>
                    <span className="font-bold text-teal-700 hover:text-teal-900 inline-flex items-center gap-1">
                      <UiIcon name="book-open" size={13} />
                      <span>Xem chi tiết</span>
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PortalChrome>
  );
}
