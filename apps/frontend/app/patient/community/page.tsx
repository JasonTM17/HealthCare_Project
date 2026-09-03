"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import PortalChrome from "../../../components/PortalChrome";
import {
  createArticleComment,
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

  // Expanded article / discussion state
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [comments, setComments] = useState<ArticleComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<ArticleComment | null>(null);
  const [commentSuccess, setCommentSuccess] = useState(false);

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
    } catch {
      setError("Không thể tải danh sách bài viết cộng đồng.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const task = Promise.resolve().then(loadData);
    const unsubscribe = subscribeToCatalogChange(() => {
      void loadData();
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

  const handleSelectArticle = async (article: Article) => {
    setSelectedArticle(article);
    setLoadingComments(true);
    setCommentSuccess(false);
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
    if (!selectedArticle || !newComment.trim()) return;
    setBusy(true);
    try {
      await createArticleComment(selectedArticle.slug, {
        content: newComment.trim(),
        parentCommentId: replyTo?.id || null,
      });
      setNewComment("");
      setReplyTo(null);
      setCommentSuccess(true);
      const updated = await fetchArticleComments(selectedArticle.slug);
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
      <div className="w-full max-w-[1240px] mx-auto pb-8 space-y-6">
        <header className="portal-hero mb-6">
          <div>
            <p className="section-note">CỘNG ĐỒNG Y KHOA & CẨM NANG BỆNH VIỆN</p>
            <h1 className="text-2xl font-black text-teal-950 tracking-tight">
              Cộng đồng Y khoa & Cẩm nang Sức khỏe
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Người bệnh có thể theo dõi bài viết chuyên môn từ các Bác sĩ, đặt câu hỏi trao đổi trực tiếp và tham gia bình luận y tế an toàn.
            </p>

            {/* Specialty Filter Chips */}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
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
                    className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
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
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
            Đang tải danh sách bài viết y khoa...
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
            Không có bài viết nào trong chuyên mục này.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
            {/* Articles Feed */}
            <div className={selectedArticle ? "lg:col-span-7 space-y-4" : "lg:col-span-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"}>
              {filteredArticles.map((article) => {
                const isSelected = selectedArticle?.id === article.id;
                return (
                  <article
                    className={`flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-sm transition-all hover:border-teal-500 hover:shadow-md cursor-pointer ${
                      isSelected ? "border-teal-600 ring-2 ring-teal-600/20" : "border-slate-200"
                    }`}
                    key={article.id}
                    onClick={() => void handleSelectArticle(article)}
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="rounded-full bg-teal-50 px-2.5 py-0.5 font-bold text-teal-800">
                          {article.category || "Cẩm nang y tế"}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <UiIcon name="clock" size={13} />
                          <span>{article.readingMinutes || 5} phút đọc</span>
                        </span>
                      </div>

                      <h3 className="mt-3 text-lg font-bold text-teal-950 line-clamp-2 hover:text-teal-800">
                        {article.title}
                      </h3>
                      <p className="mt-2 text-sm text-slate-600 line-clamp-3 leading-relaxed">
                        {article.summary}
                      </p>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                      <span className="font-semibold text-slate-700 inline-flex items-center gap-1.5">
                        <UiIcon name="stethoscope" size={14} />
                        <span>{article.authorName || "Bác sĩ Bệnh viện"}</span>
                      </span>
                      <button
                        className="font-bold text-teal-700 hover:text-teal-900 inline-flex items-center gap-1"
                        type="button"
                      >
                        <UiIcon name="message-square" size={13} />
                        <span>Bình luận & hỏi đáp →</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Right Panel: Selected Article Details & Comments Thread */}
            {selectedArticle && (
              <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-md sticky top-24 h-fit max-h-[85vh] flex flex-col">
                <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                  <div>
                    <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-bold text-teal-800">
                      {selectedArticle.category || "Cẩm nang"}
                    </span>
                    <h2 className="mt-1 text-lg font-bold text-teal-950 line-clamp-2">
                      {selectedArticle.title}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5 inline-flex items-center gap-1">
                      <UiIcon name="stethoscope" size={13} />
                      <span>Tác giả: <strong>{selectedArticle.authorName || "Bác sĩ chuyên khoa"}</strong></span>
                    </p>
                  </div>
                  <button
                    aria-label="Đóng bảng thảo luận"
                    className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                    onClick={() => setSelectedArticle(null)}
                    type="button"
                  >
                    <UiIcon name="x" size={16} />
                  </button>
                </div>

                {/* Scrollable Article Summary + Comments */}
                <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1">
                  <div className="rounded-xl bg-slate-50 p-3.5 text-xs leading-relaxed">
                    <p className="font-semibold text-slate-800 mb-1">Tóm tắt nội dung bài viết:</p>
                    <p className="text-slate-600">{selectedArticle.summary}</p>
                    {selectedArticle.body && (
                      <div className="mt-2 pt-2 border-t border-slate-200 text-slate-600">
                        <p className="font-semibold text-slate-900 mb-1">Chi tiết chuyên môn:</p>
                        <p className="whitespace-pre-wrap">{selectedArticle.body}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h3 className="font-bold text-teal-950 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <UiIcon name="message-square" size={14} />
                      <span>Thảo luận cùng Bác sĩ ({comments.length})</span>
                    </h3>
                  </div>

                  {commentSuccess && (
                    <div className="rounded-lg bg-emerald-50 p-2.5 text-xs font-semibold text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
                      <UiIcon name="shield-check" size={15} />
                      <span>Bình luận của bạn đã được đăng thành công!</span>
                    </div>
                  )}

                  {loadingComments ? (
                    <p className="text-xs text-slate-400">Đang tải bình luận...</p>
                  ) : comments.length === 0 ? (
                    <div className="rounded-xl bg-teal-50/50 p-5 text-center text-xs text-teal-800 border border-teal-100">
                      Chưa có bình luận nào. Hãy là người đầu tiên đặt câu hỏi cho Bác sĩ!
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {comments.map((c) => {
                        const isDoctor = c.authorRole === "DOCTOR";
                        const isAdmin = c.authorRole === "ADMIN";
                        return (
                          <div
                            className={`rounded-xl p-3 text-xs ${
                              isDoctor
                                ? "border border-teal-300 bg-teal-50/80"
                                : isAdmin
                                ? "border border-purple-200 bg-purple-50/70"
                                : "border border-slate-200 bg-white"
                            }`}
                            key={c.id}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900">{c.authorName}</span>
                                {isDoctor && (
                                  <span className="rounded bg-teal-800 px-1.5 py-0.5 text-[10px] font-bold text-white inline-flex items-center gap-1">
                                    <UiIcon name="shield-check" size={11} />
                                    <span>Bác sĩ xác thực</span>
                                  </span>
                                )}
                                {isAdmin && (
                                  <span className="rounded bg-purple-700 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                    Quản trị
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400">
                                {new Date(c.createdAt).toLocaleDateString("vi-VN")}
                              </span>
                            </div>
                            <p className="mt-1.5 text-slate-700 leading-relaxed whitespace-pre-wrap">{c.content}</p>
                            <div className="mt-2 flex justify-end">
                              <button
                                className="text-[11px] font-semibold text-teal-800 hover:underline"
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
                </div>

                {/* Comment Input Box */}
                <form className="border-t border-slate-100 pt-3" onSubmit={handlePostComment}>
                  {replyTo && (
                    <div className="mb-2 flex items-center justify-between rounded-lg bg-teal-50 px-2 py-1 text-[11px] text-teal-800">
                      <span>Đang trả lời <strong>{replyTo.authorName}</strong></span>
                      <button
                        className="font-bold text-slate-500 hover:text-slate-800"
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
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                    disabled={busy}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Đặt câu hỏi y khoa hoặc chia sẻ cảm nhận với Bác sĩ..."
                    rows={3}
                    value={newComment}
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      className="min-h-11 rounded-xl bg-teal-900 px-5 py-2 text-xs font-bold text-white hover:bg-teal-800 disabled:opacity-50 transition"
                      disabled={busy || !newComment.trim()}
                      type="submit"
                    >
                      {busy ? "Đang gửi..." : "Gửi bình luận y tế"}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </PortalChrome>
  );
}
