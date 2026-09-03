"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import PortalChrome from "../../../components/PortalChrome";
import {
  broadcastCatalogChange,
  createArticleComment,
  deleteArticleComment,
  doctorCreateArticle,
  doctorDeleteArticle,
  doctorListArticles,
  doctorUpdateArticle,
  fetchArticleComments,
  fetchSpecialties,
  hasRole,
  subscribeToCatalogChange,
  type AdminArticlePayload,
  type Article,
  type ArticleComment,
  type Specialty,
} from "../../../lib/api-client";
import { ForbiddenState, LoadingState, LoginRequiredState } from "../../../components/PortalStates";
import { useAuthSession, useAuthSessionStatus } from "../../../components/useAuthSession";
import UiIcon from "../../../components/UiIcon";

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export default function DoctorArticlesPage() {
  const session = useAuthSession();
  const status = useAuthSessionStatus();

  const [articles, setArticles] = useState<Article[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal / Form state
  const [showEditor, setShowEditor] = useState(false);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Kiến thức tim mạch");
  const [specialtySlug, setSpecialtySlug] = useState("tim-mach");
  const [readingMinutes, setReadingMinutes] = useState("5");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [active, setActive] = useState(true);

  // Discussion / Comments state
  const [activeDiscussionSlug, setActiveDiscussionSlug] = useState<string | null>(null);
  const [comments, setComments] = useState<ArticleComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);

  const loadArticles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [articleList, specList] = await Promise.all([
        doctorListArticles(),
        fetchSpecialties(),
      ]);
      setArticles(articleList.content);
      setSpecialties(specList.content);
    } catch {
      setError("Không thể tải danh sách bài viết.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadComments = useCallback(async (slug: string) => {
    setLoadingComments(true);
    try {
      const data = await fetchArticleComments(slug);
      setComments(data);
    } catch {
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  }, []);

  useEffect(() => {
    if (!session?.user || !hasRole(session.user, "DOCTOR")) return;
    const task = Promise.resolve().then(loadArticles);
    const unsubscribe = subscribeToCatalogChange(() => {
      void loadArticles();
    });
    return () => {
      void task;
      unsubscribe();
    };
  }, [loadArticles, session]);

  if (status !== "settled" && loading) {
    return (
      <main className="portal-shell">
        <LoadingState label="Đang tải cổng bài viết bác sĩ..." />
      </main>
    );
  }

  if (!session?.user) {
    return (
      <main className="portal-shell">
        <LoginRequiredState nextPath="/doctor/articles" />
      </main>
    );
  }

  if (!hasRole(session.user, "DOCTOR")) {
    return (
      <main className="portal-shell">
        <ForbiddenState
          title="Không có quyền truy cập"
          description="Khu vực này chỉ dành cho tài khoản Bác sĩ."
        />
      </main>
    );
  }

  const handleOpenEditor = (article?: Article) => {
    if (article) {
      setEditingSlug(article.slug);
      setTitle(article.title);
      setCategory(article.category || "");
      setSpecialtySlug(article.relatedSpecialtySlug || "tim-mach");
      setReadingMinutes(String(article.readingMinutes || 5));
      setSummary(article.summary || "");
      setBody(article.body || "");
      setCoverImageUrl(article.coverImageUrl || "");
      setActive(article.active !== false);
    } else {
      setEditingSlug(null);
      setTitle("");
      setCategory("Cẩm nang sức khỏe");
      setSpecialtySlug(specialties[0]?.slug || "tim-mach");
      setReadingMinutes("5");
      setSummary("");
      setBody("");
      setCoverImageUrl("/media/articles/article-sample.jpg");
      setActive(true);
    }
    setShowEditor(true);
  };

  const handleSaveArticle = async (e: FormEvent) => {
    e.preventDefault();
    const finalSlug = editingSlug || toSlug(title);
    if (!finalSlug) {
      setError("Tiêu đề bài viết không hợp lệ để tạo định danh đường dẫn.");
      return;
    }
    if (!summary.trim()) {
      setError("Bài viết y khoa bắt buộc phải có tóm tắt nội dung.");
      return;
    }
    if (!body.trim()) {
      setError("Bài viết y khoa bắt buộc phải có nội dung chuyên môn chi tiết.");
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);

    const payload: AdminArticlePayload = {
      slug: finalSlug,
      title: title.trim(),
      category: category.trim() || undefined,
      relatedSpecialtySlug: specialtySlug || undefined,
      authorName: session.user.displayName || "Bác sĩ Bệnh viện",
      readingMinutes: parseInt(readingMinutes, 10) || 5,
      summary: summary.trim(),
      body: body.trim(),
      coverImageUrl: coverImageUrl.trim() || undefined,
      active,
    };

    try {
      if (editingSlug) {
        await doctorUpdateArticle(editingSlug, payload);
        setSuccess("Đã cập nhật bài viết thành công!");
      } else {
        await doctorCreateArticle(payload);
        setSuccess("Đã đăng bài viết y khoa mới thành công!");
      }
      broadcastCatalogChange({ kind: "article", action: editingSlug ? "updated" : "created", slug: finalSlug });
      setShowEditor(false);
      await loadArticles();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Lỗi khi lưu bài viết.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteArticle = async (slug: string, articleTitle: string) => {
    if (!window.confirm(`Xóa bài viết "${articleTitle}"? Thao tác này không thể hoàn tác.`)) return;
    setBusy(true);
    try {
      await doctorDeleteArticle(slug);
      broadcastCatalogChange({ kind: "article", action: "deleted", slug });
      setSuccess("Đã xóa bài viết.");
      await loadArticles();
    } catch {
      setError("Không thể xóa bài viết.");
    } finally {
      setBusy(false);
    }
  };

  const handleSendReply = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeDiscussionSlug || !replyText.trim()) return;
    setBusy(true);
    try {
      await createArticleComment(activeDiscussionSlug, {
        content: replyText.trim(),
        parentCommentId: replyingToCommentId,
      });
      setReplyText("");
      setReplyingToCommentId(null);
      await loadComments(activeDiscussionSlug);
    } catch {
      setError("Không thể gửi phản hồi thảo luận.");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!activeDiscussionSlug || !window.confirm("Xóa bình luận này?")) return;
    try {
      await deleteArticleComment(activeDiscussionSlug, commentId);
      await loadComments(activeDiscussionSlug);
    } catch {
      setError("Không thể xóa bình luận.");
    }
  };

  return (
    <PortalChrome role="DOCTOR" user={session.user}>
      <div className="w-full max-w-[1240px] mx-auto pb-8 space-y-6">
        <header className="portal-hero mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4 w-full">
            <div>
              <p className="section-note">CỘNG ĐỒNG Y KHOA & BÀI VIẾT BỆNH VIỆN</p>
              <h1 className="text-2xl font-black text-teal-950 tracking-tight">
                Cộng đồng & Bài viết Y khoa
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Bác sĩ có quyền đăng bài chia sẻ kiến thức sức khỏe, phòng ngừa bệnh lý và trao đổi, giải đáp bình luận trực tiếp cùng người bệnh.
              </p>
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-teal-900 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-teal-800 transition-all min-h-11"
              onClick={() => handleOpenEditor()}
              type="button"
            >
              <UiIcon name="plus" size={16} />
              <span>Đăng bài viết mới</span>
            </button>
          </div>
        </header>

        {success && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900 flex items-center gap-2">
            <UiIcon name="shield-check" size={18} />
            <span>{success}</span>
          </div>
        )}
        {error && (
          <div className="portal-inline-error mb-4" role="alert">
            {error}
          </div>
        )}

        {/* Editor Modal */}
        {showEditor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto backdrop-blur-sm">
            <div className="my-8 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <h2 className="text-xl font-bold text-teal-950">
                  {editingSlug ? "Chỉnh sửa bài viết y khoa" : "Đăng bài viết y khoa mới"}
                </h2>
                <button
                  aria-label="Đóng biểu mẫu"
                  className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                  onClick={() => setShowEditor(false)}
                  type="button"
                >
                  <UiIcon name="x" size={18} />
                </button>
              </div>

              <form className="mt-4 space-y-4" onSubmit={handleSaveArticle}>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">Tiêu đề bài viết *</label>
                  <input
                    className="mt-1 w-full min-h-11 rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ví dụ: Hướng dẫn chăm sóc và phòng ngừa tăng huyết áp tại nhà"
                    required
                    type="text"
                    value={title}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">Chuyên mục</label>
                    <input
                      className="mt-1 w-full min-h-11 rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="Tim mạch, Tiêu hóa..."
                      type="text"
                      value={category}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">Chuyên khoa</label>
                    <select
                      className="mt-1 w-full min-h-11 rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white focus:border-teal-600 focus:outline-none"
                      onChange={(e) => setSpecialtySlug(e.target.value)}
                      value={specialtySlug}
                    >
                      {specialties.map((s) => (
                        <option key={s.id} value={s.slug}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">Thời gian đọc (phút)</label>
                    <input
                      className="mt-1 w-full min-h-11 rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                      min={1}
                      onChange={(e) => setReadingMinutes(e.target.value)}
                      type="number"
                      value={readingMinutes}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">Tóm tắt ngắn (Summary) *</label>
                  <textarea
                    className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-teal-600 focus:outline-none"
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="Tóm tắt ngắn gọn các luận điểm chính để người bệnh nắm nhanh..."
                    required
                    rows={2}
                    value={summary}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">Nội dung chi tiết (Body) *</label>
                  <textarea
                    className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-teal-600 focus:outline-none leading-relaxed"
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Kiến thức y khoa, chỉ định chuyên môn, phác đồ theo dõi và lời khuyên của bác sĩ..."
                    required
                    rows={6}
                    value={body}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">Ảnh bìa (Cover Image URL)</label>
                    <input
                      className="mt-1 w-full min-h-11 rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-teal-600 focus:outline-none"
                      onChange={(e) => setCoverImageUrl(e.target.value)}
                      placeholder="/media/articles/article-sample.jpg"
                      type="text"
                      value={coverImageUrl}
                    />
                  </div>
                  <div className="flex items-center gap-3 pt-6">
                    <input
                      checked={active}
                      className="h-5 w-5 rounded border-slate-300 text-teal-800 focus:ring-teal-600"
                      id="active"
                      onChange={(e) => setActive(e.target.checked)}
                      type="checkbox"
                    />
                    <label className="text-sm font-semibold text-slate-800" htmlFor="active">
                      Xuất bản công khai trên diễn đàn
                    </label>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
                  <button
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 min-h-11"
                    onClick={() => setShowEditor(false)}
                    type="button"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    className="min-h-11 rounded-xl bg-teal-900 px-6 py-2 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50 transition"
                    disabled={busy}
                    type="submit"
                  >
                    {busy ? "Đang xử lý..." : editingSlug ? "Cập nhật bài viết" : "Đăng bài viết ngay"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Main Content: 2-column or list */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          {/* Article List */}
          <div className={activeDiscussionSlug ? "lg:col-span-7 space-y-4" : "lg:col-span-12 space-y-4"}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-teal-950">
                Danh sách bài viết của Bác sĩ ({articles.length})
              </h2>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
                Đang tải dữ liệu bài viết...
              </div>
            ) : articles.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
                <p className="text-slate-500">Bạn chưa đăng bài viết nào.</p>
                <button
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-teal-900 px-4 py-2 text-xs font-bold text-white hover:bg-teal-800 min-h-11"
                  onClick={() => handleOpenEditor()}
                  type="button"
                >
                  <UiIcon name="plus" size={14} />
                  <span>Đăng bài viết đầu tiên</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {articles.map((a) => {
                  const isSelected = activeDiscussionSlug === a.slug;
                  return (
                    <div
                      className={`flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-sm transition-all ${
                        isSelected ? "border-teal-600 ring-2 ring-teal-600/20" : "border-slate-200"
                      }`}
                      key={a.id}
                    >
                      <div>
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span className="rounded-full bg-teal-50 px-2.5 py-0.5 font-bold text-teal-800">
                            {a.category || "Cẩm nang y tế"}
                          </span>
                          <span className={`font-semibold ${a.active ? "text-emerald-700" : "text-amber-700"}`}>
                            {a.active ? "● Đang hiển thị" : "○ Bản nháp"}
                          </span>
                        </div>

                        <h3 className="mt-3 text-base font-bold text-teal-950 line-clamp-2">
                          {a.title}
                        </h3>
                        <p className="mt-2 text-xs text-slate-600 line-clamp-3 leading-relaxed">
                          {a.summary}
                        </p>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                        <button
                          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                            isSelected
                              ? "bg-teal-900 text-white"
                              : "bg-teal-50 text-teal-900 hover:bg-teal-100"
                          }`}
                          onClick={() => {
                            setActiveDiscussionSlug(a.slug);
                            void loadComments(a.slug);
                          }}
                          type="button"
                        >
                          <UiIcon name="message-square" size={14} />
                          <span>Xem thảo luận</span>
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-teal-800"
                            onClick={() => handleOpenEditor(a)}
                            title="Sửa bài viết"
                            type="button"
                          >
                            <UiIcon name="sparkles" size={14} />
                          </button>
                          <button
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700"
                            onClick={() => void handleDeleteArticle(a.slug, a.title)}
                            title="Xóa bài viết"
                            type="button"
                          >
                            <UiIcon name="trash" size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Discussion / Comment Thread Manager */}
          {activeDiscussionSlug && (
            <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-md sticky top-24 h-fit max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800">
                    Kênh thảo luận cùng Bệnh nhân
                  </span>
                  <h3 className="text-base font-bold text-teal-950 line-clamp-1">
                    {articles.find((a) => a.slug === activeDiscussionSlug)?.title || activeDiscussionSlug}
                  </h3>
                </div>
                <button
                  aria-label="Đóng kênh thảo luận"
                  className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                  onClick={() => setActiveDiscussionSlug(null)}
                  type="button"
                >
                  <UiIcon name="x" size={16} />
                </button>
              </div>

              {/* Comments List */}
              <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
                {loadingComments ? (
                  <p className="text-xs text-slate-400">Đang tải danh sách bình luận...</p>
                ) : comments.length === 0 ? (
                  <div className="rounded-xl bg-slate-50 p-6 text-center text-xs text-slate-500">
                    Chưa có bình luận nào từ người bệnh cho bài viết này.
                  </div>
                ) : (
                  comments.map((c) => {
                    const isDoctor = c.authorRole === "DOCTOR";
                    const isAdmin = c.authorRole === "ADMIN";
                    return (
                      <div
                        className={`rounded-xl p-3.5 text-xs ${
                          isDoctor
                            ? "border border-teal-300 bg-teal-50/80"
                            : isAdmin
                            ? "border border-purple-200 bg-purple-50/70"
                            : "border border-slate-200 bg-white"
                        }`}
                        key={c.id}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{c.authorName}</span>
                            {isDoctor && (
                              <span className="rounded bg-teal-800 px-1.5 py-0.5 text-[10px] font-bold text-white inline-flex items-center gap-1">
                                <UiIcon name="shield-check" size={11} />
                                <span>Bác sĩ</span>
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
                        <div className="mt-2.5 flex items-center justify-between border-t border-slate-100/60 pt-2">
                          <button
                            className="text-[11px] font-bold text-teal-800 hover:underline inline-flex items-center gap-1"
                            onClick={() => {
                              setReplyingToCommentId(c.id);
                              setReplyText(`@${c.authorName}: `);
                            }}
                            type="button"
                          >
                            <span>Trả lời bệnh nhân</span>
                          </button>
                          <button
                            className="text-[11px] font-semibold text-red-600 hover:underline"
                            onClick={() => void handleDeleteComment(c.id)}
                            type="button"
                          >
                            Xóa
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Reply Form */}
              <form className="border-t border-slate-100 pt-3" onSubmit={handleSendReply}>
                {replyingToCommentId && (
                  <div className="mb-2 flex items-center justify-between rounded-lg bg-teal-50 px-2 py-1 text-[11px] text-teal-800">
                    <span>Đang trả lời phản hồi</span>
                    <button
                      className="font-bold text-slate-500 hover:text-slate-800"
                      onClick={() => {
                        setReplyingToCommentId(null);
                        setReplyText("");
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
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Gửi phản hồi chuyên môn y khoa chính thức cho người bệnh..."
                  rows={3}
                  value={replyText}
                />
                <div className="mt-2 flex justify-end">
                  <button
                    className="min-h-11 rounded-xl bg-teal-900 px-5 py-2 text-xs font-bold text-white hover:bg-teal-800 disabled:opacity-50 transition"
                    disabled={busy || !replyText.trim()}
                    type="submit"
                  >
                    {busy ? "Đang gửi..." : "Gửi giải đáp bác sĩ"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </PortalChrome>
  );
}
