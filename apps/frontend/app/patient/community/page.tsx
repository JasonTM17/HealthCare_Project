"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import PortalChrome from "../../../components/PortalChrome";
import {
  createArticleComment,
  fetchArticleBySlug,
  fetchArticleComments,
  fetchArticles,
  fetchSpecialties,
  hasRole,
  subscribeToCatalogChange,
  type Article,
  type ArticleComment,
  type Specialty,
} from "../../../lib/api-client";
import { ForbiddenState, LoadingState, LoginRequiredState } from "../../../components/PortalStates";
import { useAuthSession, useAuthSessionStatus } from "../../../components/useAuthSession";
import UiIcon from "../../../components/UiIcon";

export default function PatientCommunityPage() {
  const session = useAuthSession();
  const status = useAuthSessionStatus();

  const [articles, setArticles] = useState<Article[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Full Editorial Article Reading View ("Đọc như 1 bài báo")
  const [readingArticle, setReadingArticle] = useState<Article | null>(null);
  const readingArticleRef = useRef<Article | null>(null);
  const [comments, setComments] = useState<ArticleComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<ArticleComment | null>(null);
  const [commentSuccess, setCommentSuccess] = useState(false);
  const [realtimeSyncNotice, setRealtimeSyncNotice] = useState<string | null>(null);

  useEffect(() => {
    readingArticleRef.current = readingArticle;
  }, [readingArticle]);

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
    const unsubscribe = subscribeToCatalogChange(async (event) => {
      const freshList = await loadData();
      // If currently reading an article, refresh its content in realtime!
      if (readingArticleRef.current) {
        const currentSlug = readingArticleRef.current.slug;
        const matched = freshList.find((a) => a.slug === currentSlug);
        if (matched) {
          setReadingArticle(matched);
          setRealtimeSyncNotice("Bài viết vừa được cập nhật nội dung mới nhất theo thời gian thực!");
          setTimeout(() => setRealtimeSyncNotice(null), 4000);
        } else {
          try {
            const fresh = await fetchArticleBySlug(currentSlug);
            if (fresh) {
              setReadingArticle(fresh);
              setRealtimeSyncNotice("Bài viết vừa được cập nhật nội dung mới nhất theo thời gian thực!");
              setTimeout(() => setRealtimeSyncNotice(null), 4000);
            }
          } catch {
            // ignore
          }
        }
      }
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

  const handleOpenArticle = async (article: Article) => {
    setReadingArticle(article);
    setLoadingComments(true);
    setCommentSuccess(false);
    setReplyTo(null);
    setNewComment("");
    try {
      const data = await fetchArticleComments(article.slug);
      setComments(data);
    } catch {
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  };

  const handlePostComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!readingArticle || !newComment.trim()) return;
    setBusy(true);
    try {
      await createArticleComment(readingArticle.slug, {
        content: newComment.trim(),
        parentCommentId: replyTo?.id || null,
      });
      setNewComment("");
      setReplyTo(null);
      setCommentSuccess(true);
      const updated = await fetchArticleComments(readingArticle.slug);
      setComments(updated);
      setTimeout(() => setCommentSuccess(false), 3000);
    } catch {
      setError("Không thể gửi bình luận. Vui lòng thử lại sau.");
    } finally {
      setBusy(false);
    }
  };

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
              <article
                className="flex flex-col justify-between rounded-sm border border-slate-200 bg-white shadow-sm overflow-hidden transition-all hover:border-teal-500 hover:shadow-md cursor-pointer group"
                key={article.id}
                onClick={() => void handleOpenArticle(article)}
              >
                {article.coverImageUrl ? (
                  <div className="relative h-44 w-full overflow-hidden bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt={article.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      src={article.coverImageUrl}
                    />
                    <span className="absolute top-3 left-3 rounded-md bg-teal-950/80 backdrop-blur-md px-2.5 py-0.5 text-xs font-bold text-teal-100">
                      {article.category || "Cẩm nang y tế"}
                    </span>
                  </div>
                ) : (
                  <div className="h-28 w-full bg-gradient-to-r from-teal-900 to-teal-700 p-4 flex items-end">
                    <span className="rounded-md bg-white/20 backdrop-blur-md px-2.5 py-0.5 text-xs font-bold text-white">
                      {article.category || "Cẩm nang y tế"}
                    </span>
                  </div>
                )}

                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                      <span className="inline-flex items-center gap-1">
                        <UiIcon name="clock" size={13} />
                        <span>{article.readingMinutes || 5} phút đọc</span>
                      </span>
                      <span className="text-[11px] text-teal-800 font-semibold">Nhấp để xem →</span>
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
                      <UiIcon name="message-square" size={13} />
                      <span>Hỏi đáp Bác sĩ</span>
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* ── FULL EDITORIAL ARTICLE READER MODAL ("ĐỌC NHƯ 1 BÀI BÁO Y KHOA") ── */}
        {readingArticle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto backdrop-blur-sm">
            <div className="my-8 w-full max-w-3xl rounded-lg bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
              {/* Header Bar */}
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/90">
                <span className="rounded-[4px] bg-teal-50 border border-teal-200 px-3 py-1 text-xs font-bold text-teal-900 tracking-wider uppercase font-mono">
                  {readingArticle.category || "Chuyên đề Y khoa"}
                </span>
                <button
                  aria-label="Đóng bài báo"
                  className="rounded-[4px] p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                  onClick={() => setReadingArticle(null)}
                  type="button"
                >
                  <UiIcon name="x" size={20} />
                </button>
              </div>

              {/* Scrollable Editorial Content */}
              <div className="flex-1 overflow-y-auto px-6 sm:px-10 py-6 space-y-6">
                {/* Realtime sync banner */}
                {realtimeSyncNotice && (
                  <div className="rounded-[6px] bg-emerald-50 border border-emerald-300 px-4 py-2.5 text-xs font-semibold text-emerald-900 flex items-center gap-2 shadow-xs">
                    <UiIcon name="shield-check" size={16} />
                    <span>{realtimeSyncNotice}</span>
                  </div>
                )}

                {/* Hero Cover Image */}
                {readingArticle.coverImageUrl && (
                  <div className="w-full h-64 sm:h-80 rounded-[8px] overflow-hidden border border-slate-200 shadow-xs">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt={readingArticle.title}
                      className="w-full h-full object-cover"
                      src={readingArticle.coverImageUrl}
                    />
                  </div>
                )}

                {/* Article Headline */}
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black text-teal-950 tracking-tight leading-snug">
                    {readingArticle.title}
                  </h1>

                  {/* Doctor Author Bar */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-y border-slate-100 py-3 text-xs text-slate-600">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-teal-800 text-white font-bold flex items-center justify-center shadow-xs">
                        <UiIcon name="stethoscope" size={18} />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
                          <span>{readingArticle.authorName || "Bác sĩ Chuyên khoa"}</span>
                          <span className="rounded-[4px] bg-teal-800 px-1.5 py-0.2 text-[10px] font-bold text-white inline-flex items-center gap-1">
                            <UiIcon name="shield-check" size={10} />
                            <span>Bác sĩ xác thực</span>
                          </span>
                        </div>
                        <p className="text-[11px] text-teal-800 m-0">Bệnh viện Đa khoa HealthCare</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1 text-slate-500">
                        <UiIcon name="clock" size={14} />
                        <span>{readingArticle.readingMinutes || 5} phút đọc</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Lead Summary Callout - Professional Medical Key Takeaways */}
                <div className="rounded-[6px] border-l-4 border-l-teal-700 bg-slate-50/90 border border-slate-200 p-4 sm:p-5 text-sm text-slate-800 leading-relaxed shadow-2xs">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-teal-700"></span>
                    <span className="font-bold text-xs uppercase tracking-wider text-teal-950 font-mono">
                      Điểm tin cốt lõi & Tóm tắt y khoa
                    </span>
                  </div>
                  <p className="m-0 font-medium text-slate-800 leading-relaxed">{readingArticle.summary}</p>
                </div>

                {/* Deep Formatted Body */}
                <div className="prose max-w-none text-slate-800 text-base leading-relaxed whitespace-pre-wrap">
                  {readingArticle.body || "Nội dung bài viết đang được cập nhật."}
                </div>

                {/* Clinical Disclaimer */}
                <div className="rounded-[6px] border-l-2 border-l-amber-600 bg-amber-50/40 border border-slate-200 px-4 py-3 text-xs text-slate-600 leading-relaxed">
                  <p className="m-0 italic">
                    <strong className="font-semibold text-amber-900 not-italic">Khuyến cáo y khoa:</strong> Thông tin trên bài viết mang tính chất phổ biến kiến thức chăm sóc sức khỏe, không thay thế cho quy trình thăm khám, chẩn đoán và chỉ định phác đồ điều trị trực tiếp từ Bác sĩ chuyên khoa.
                  </p>
                </div>

                {/* Attached Comments Thread */}
                <div className="mt-8 pt-6 border-t border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-teal-950 flex items-center gap-2">
                      <UiIcon name="message-square" size={18} />
                      <span>Hỏi đáp & Thảo luận cùng Bác sĩ ({comments.length})</span>
                    </h3>
                  </div>

                  {commentSuccess && (
                    <div className="rounded-[6px] bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 border border-emerald-200 flex items-center gap-2">
                      <UiIcon name="shield-check" size={16} />
                      <span>Bình luận của bạn đã được đăng công khai trên diễn đàn!</span>
                    </div>
                  )}

                  {loadingComments ? (
                    <p className="text-xs text-slate-400">Đang tải thảo luận...</p>
                  ) : comments.length === 0 ? (
                    <div className="rounded-[6px] bg-slate-50 p-6 text-center text-xs text-slate-500 border border-dashed border-slate-300">
                      Chưa có bình luận nào. Hãy là người đầu tiên đặt câu hỏi hoặc gửi chia sẻ chuyên môn cho Bác sĩ!
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {comments.map((c) => {
                        const isDoctor = c.authorRole === "DOCTOR";
                        const isAdmin = c.authorRole === "ADMIN";
                        return (
                          <div
                            className={`rounded-[6px] p-4 text-xs ${
                              isDoctor
                                ? "border-l-4 border-l-teal-700 border border-teal-200 bg-teal-50/40"
                                : isAdmin
                                ? "border-l-4 border-l-purple-700 border border-purple-200 bg-purple-50/40"
                                : "border border-slate-200 bg-white shadow-2xs"
                            }`}
                            key={c.id}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900">{c.authorName}</span>
                                {isDoctor && (
                                  <span className="rounded-[4px] bg-teal-800 px-1.5 py-0.5 text-[10px] font-bold text-white inline-flex items-center gap-1">
                                    <UiIcon name="shield-check" size={11} />
                                    <span>Bác sĩ xác thực</span>
                                  </span>
                                )}
                                {isAdmin && (
                                  <span className="rounded-[4px] bg-purple-700 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                    Quản trị
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400">
                                {new Date(c.createdAt).toLocaleDateString("vi-VN")}
                              </span>
                            </div>
                            <p className="mt-2 text-slate-700 leading-relaxed whitespace-pre-wrap text-sm">{c.content}</p>
                            <div className="mt-2.5 flex justify-end">
                              <button
                                className="text-xs font-semibold text-teal-800 hover:underline cursor-pointer"
                                onClick={() => {
                                  setReplyTo(c);
                                  setNewComment(`@${c.authorName}: `);
                                }}
                                type="button"
                              >
                                Trả lời
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Comment Input Composer */}
                  <form className="border-t border-slate-200 pt-4" onSubmit={handlePostComment}>
                    {replyTo && (
                      <div className="mb-2 flex items-center justify-between rounded-[6px] bg-teal-50 border border-teal-200 px-3 py-1.5 text-xs text-teal-800">
                        <span>Đang trả lời <strong>{replyTo.authorName}</strong></span>
                        <button
                          className="font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                          onClick={() => {
                            setReplyTo(null);
                            setNewComment("");
                          }}
                          type="button"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                    <textarea
                      className="w-full rounded-[6px] border border-slate-300 p-3.5 text-sm focus:border-teal-700 focus:ring-1 focus:ring-teal-700 focus:outline-none transition leading-relaxed text-slate-800 placeholder:text-slate-400 bg-white shadow-2xs"
                      disabled={busy}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Đặt câu hỏi y khoa hoặc chia sẻ cảm nhận với Bác sĩ..."
                      rows={3}
                      value={newComment}
                    />
                    <div className="mt-2.5 flex justify-end">
                      <button
                        className="min-h-10 rounded-[6px] bg-teal-800 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-teal-900 disabled:opacity-50 transition-colors cursor-pointer shadow-xs"
                        disabled={busy || !newComment.trim()}
                        type="submit"
                      >
                        {busy ? "Đang gửi..." : "Gửi bình luận y tế"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PortalChrome>
  );
}
