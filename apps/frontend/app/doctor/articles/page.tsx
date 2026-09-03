"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
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
  subscribeToCatalogChange,
  type AdminArticlePayload,
  type Article,
  type ArticleComment,
  type Specialty,
} from "../../../lib/api-client";
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
      const [articlePage, specList] = await Promise.all([
        doctorListArticles(0, 50),
        fetchSpecialties(),
      ]);
      setArticles(articlePage.content);
      setSpecialties(specList.content);
    } catch (err) {
      setError("Không thể tải danh sách bài viết y khoa.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const task = Promise.resolve().then(loadArticles);
    const unsubscribe = subscribeToCatalogChange(() => {
      void loadArticles();
    });
    return () => {
      void task;
      unsubscribe();
    };
  }, [loadArticles]);

  const loadComments = async (slug: string) => {
    setActiveDiscussionSlug(slug);
    setLoadingComments(true);
    try {
      const data = await fetchArticleComments(slug);
      setComments(data);
    } catch (err) {
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleOpenEditor = (article?: Article) => {
    if (article) {
      setEditingSlug(article.slug);
      setTitle(article.title);
      setCategory(article.category || "Kiến thức y khoa");
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
      setSpecialtySlug("tim-mach");
      setReadingMinutes("5");
      setSummary("");
      setBody("");
      setCoverImageUrl("/images/packages/heart-screening.jpg");
      setActive(true);
    }
    setError(null);
    setSuccess(null);
    setShowEditor(true);
  };

  const handleSaveArticle = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Vui lòng nhập tiêu đề bài viết.");
      return;
    }
    if (active && (!summary.trim() || !body.trim())) {
      setError("Bài viết xuất bản công khai yêu cầu phải có đầy đủ Tóm tắt và Nội dung chi tiết.");
      return;
    }

    setBusy(true);
    setError(null);
    const finalSlug = editingSlug || toSlug(title);
    const payload: AdminArticlePayload = {
      title: title.trim(),
      slug: finalSlug,
      summary: summary.trim() || null,
      body: body.trim() || null,
      category: category.trim() || null,
      readingMinutes: Number(readingMinutes) || 5,
      relatedSpecialtySlug: specialtySlug.trim() || null,
      coverImageUrl: coverImageUrl.trim() || null,
      contentKind: "GENERAL",
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
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Bài viết y khoa & Diễn đàn bệnh viện</h1>
          <p className="mt-1 text-sm text-slate-600">
            Bác sĩ có quyền đăng bài chia sẻ kiến thức sức khỏe, phòng ngừa bệnh lý và trao đổi, giải đáp bình luận trực tiếp cùng người bệnh.
          </p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-teal-800 transition-all"
          onClick={() => handleOpenEditor()}
          type="button"
        >
          <UiIcon name="plus" size={16} />
          Đăng bài viết mới
        </button>
      </header>

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
          {success}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-900">
          {error}
        </div>
      )}

      {/* Editor Modal / Drawer */}
      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="my-8 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-xl font-bold text-slate-900">
                {editingSlug ? "Chỉnh sửa bài viết" : "Đăng bài viết y khoa mới"}
              </h2>
              <button
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600"
                onClick={() => setShowEditor(false)}
                type="button"
              >
                ✕
              </button>
            </div>

            <form className="mt-4 space-y-4" onSubmit={handleSaveArticle}>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">Tiêu đề bài viết *</label>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Hướng dẫn chăm sóc và phòng ngừa tăng huyết áp tại nhà"
                  required
                  type="text"
                  value={title}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">Chuyên mục</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Tim mạch, Tiêu hóa..."
                    type="text"
                    value={category}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">Chuyên khoa liên quan</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
                    onChange={(e) => setSpecialtySlug(e.target.value)}
                    value={specialtySlug}
                  >
                    {specialties.map((s) => (
                      <option key={s.id} value={s.slug}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">Thời lượng đọc (phút)</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    max="60"
                    min="1"
                    onChange={(e) => setReadingMinutes(e.target.value)}
                    type="number"
                    value={readingMinutes}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">Tóm tắt ngắn gọn *</label>
                <textarea
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Đoạn tóm tắt hiển thị trên danh sách và thẻ bài viết..."
                  rows={2}
                  value={summary}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">Nội dung bài viết *</label>
                <textarea
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Nội dung chuyên môn đầy đủ, lời khuyên và hướng dẫn của bác sĩ..."
                  rows={8}
                  value={body}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">Ảnh bìa (URL)</label>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  onChange={(e) => setCoverImageUrl(e.target.value)}
                  placeholder="/images/packages/heart-screening.jpg hoặc URL ảnh hợp lệ"
                  type="text"
                  value={coverImageUrl}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  checked={active}
                  className="h-4 w-4 rounded text-teal-700 focus:ring-teal-500"
                  id="doctor-article-active"
                  onChange={(e) => setActive(e.target.checked)}
                  type="checkbox"
                />
                <label className="text-sm font-semibold text-slate-800" htmlFor="doctor-article-active">
                  Xuất bản công khai trên Cổng bệnh nhân & Trang chủ
                </label>
              </div>

              <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  disabled={busy}
                  onClick={() => setShowEditor(false)}
                  type="button"
                >
                  Hủy
                </button>
                <button
                  className="rounded-xl bg-teal-700 px-6 py-2 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
                  disabled={busy}
                  type="submit"
                >
                  {busy ? "Đang lưu..." : editingSlug ? "Cập nhật" : "Xuất bản bài viết"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Articles List & Discussion Panel */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Articles List */}
        <div className={activeDiscussionSlug ? "lg:col-span-7 space-y-4" : "lg:col-span-12 space-y-4"}>
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
              Đang tải danh sách bài viết...
            </div>
          ) : articles.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
              Chưa có bài viết nào. Hãy bấm <strong>+ Đăng bài viết mới</strong> để chia sẻ kiến thức đầu tiên!
            </div>
          ) : (
            articles.map((article) => (
              <article
                className={`rounded-2xl border bg-white p-5 shadow-sm transition-all ${
                  activeDiscussionSlug === article.slug
                    ? "border-teal-600 ring-2 ring-teal-600/20"
                    : "border-slate-200 hover:border-slate-300"
                }`}
                key={article.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-bold text-teal-800">
                      {article.category || "Cẩm nang y tế"}
                    </span>
                    <span className="text-xs text-slate-400">
                      ⏱ {article.readingMinutes || 5} phút đọc
                    </span>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      article.active ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {article.active ? "Đang hiển thị" : "Bản nháp"}
                  </span>
                </div>

                <h3 className="mt-2.5 text-lg font-bold text-slate-900 line-clamp-2">
                  {article.title}
                </h3>
                <p className="mt-1 text-sm text-slate-600 line-clamp-3">
                  {article.summary}
                </p>

                <div className="mt-4 flex flex-wrap items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <span>Tác giả: <strong>{article.authorName || "Bác sĩ Bệnh viện"}</strong></span>
                  <div className="flex items-center gap-3">
                    <button
                      className="font-bold text-teal-800 hover:text-teal-900 inline-flex items-center gap-1"
                      onClick={() => void loadComments(article.slug)}
                      type="button"
                    >
                      💬 Xem thảo luận & Bình luận
                    </button>
                    <button
                      className="text-slate-600 hover:text-slate-900 underline"
                      onClick={() => handleOpenEditor(article)}
                      type="button"
                    >
                      Sửa
                    </button>
                    <button
                      className="text-red-700 hover:text-red-800 underline"
                      onClick={() => void handleDeleteArticle(article.slug, article.title)}
                      type="button"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>

        {/* Right: Comments & Discussion Panel */}
        {activeDiscussionSlug && (
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sticky top-6 h-fit max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900">Diễn đàn thảo luận</h3>
                <p className="text-xs text-slate-500 truncate max-w-xs">{activeDiscussionSlug}</p>
              </div>
              <button
                className="text-xs text-slate-400 hover:text-slate-600"
                onClick={() => setActiveDiscussionSlug(null)}
                type="button"
              >
                Đóng ✕
              </button>
            </div>

            {/* Comments List */}
            <div className="my-4 flex-1 space-y-3 overflow-y-auto pr-1">
              {loadingComments ? (
                <p className="text-xs text-slate-400">Đang tải bình luận...</p>
              ) : comments.length === 0 ? (
                <div className="rounded-xl bg-slate-50 p-6 text-center text-xs text-slate-500">
                  Chưa có bình luận nào cho bài viết này. Bệnh nhân có thể đặt câu hỏi trao đổi tại đây.
                </div>
              ) : (
                comments.map((c) => {
                  const isDoctor = c.authorRole === "DOCTOR";
                  const isAdmin = c.authorRole === "ADMIN";
                  return (
                    <div
                      className={`rounded-xl p-3 text-xs ${
                        isDoctor
                          ? "border border-teal-200 bg-teal-50/60"
                          : isAdmin
                          ? "border border-purple-200 bg-purple-50/60"
                          : "border border-slate-200 bg-slate-50/70"
                      }`}
                      key={c.id}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900">{c.authorName}</span>
                          {isDoctor && (
                            <span className="rounded bg-teal-700 px-1.5 py-0.5 text-[10px] font-bold text-white">
                              Bác sĩ
                            </span>
                          )}
                          {isAdmin && (
                            <span className="rounded bg-purple-700 px-1.5 py-0.5 text-[10px] font-bold text-white">
                              Quản trị
                            </span>
                          )}
                        </div>
                        <button
                          className="text-[11px] text-red-600 hover:underline"
                          onClick={() => void handleDeleteComment(c.id)}
                          type="button"
                        >
                          Xóa
                        </button>
                      </div>
                      <p className="mt-1.5 text-slate-700 leading-relaxed text-xs whitespace-pre-wrap">{c.content}</p>
                      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                        <span>{new Date(c.createdAt).toLocaleString("vi-VN")}</span>
                        <button
                          className="font-semibold text-teal-800 hover:underline"
                          onClick={() => {
                            setReplyingToCommentId(c.id);
                            setReplyText(`@${c.authorName}: `);
                          }}
                          type="button"
                        >
                          Trả lời
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Doctor Reply Input */}
            <form className="border-t border-slate-100 pt-3" onSubmit={handleSendReply}>
              {replyingToCommentId && (
                <div className="mb-2 flex items-center justify-between rounded-lg bg-teal-50 px-2 py-1 text-[11px] text-teal-800">
                  <span>Đang trả lời bình luận</span>
                  <button
                    className="font-bold"
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
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-teal-600 focus:outline-none"
                disabled={busy}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Bác sĩ nhập giải đáp chuyên môn cho người bệnh..."
                rows={3}
                value={replyText}
              />
              <div className="mt-2 flex justify-end">
                <button
                  className="rounded-xl bg-teal-700 px-4 py-2 text-xs font-bold text-white hover:bg-teal-800 disabled:opacity-50"
                  disabled={busy || !replyText.trim()}
                  type="submit"
                >
                  {busy ? "Đang gửi..." : "Gửi phản hồi bác sĩ"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
