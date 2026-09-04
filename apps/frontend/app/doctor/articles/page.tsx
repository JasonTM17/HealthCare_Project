"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import PortalChrome from "../../../components/PortalChrome";
import {
  broadcastCatalogChange,
  createArticleComment,
  deleteArticleComment,
  doctorCreateArticle,
  doctorDeleteArticle,
  doctorListArticles,
  doctorUpdateArticle,
  fetchArticleBySlug,
  fetchArticleComments,
  fetchArticles,
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
import ImageUpload from "../../../components/ImageUpload";
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

  // Tab state: Hospital Medical Feed vs My Articles Studio
  const [activeTab, setActiveTab] = useState<"community_feed" | "my_articles">("community_feed");

  // Data states
  const [myArticles, setMyArticles] = useState<Article[]>([]);
  const [communityArticles, setCommunityArticles] = useState<Article[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Editorial Reading View ("Đọc như 1 bài báo")
  const [readingArticle, setReadingArticle] = useState<Article | null>(null);
  const readingArticleRef = useRef<Article | null>(null);
  const [readingComments, setReadingComments] = useState<ArticleComment[]>([]);
  const [loadingReadingComments, setLoadingReadingComments] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [realtimeSyncNotice, setRealtimeSyncNotice] = useState<string | null>(null);

  useEffect(() => {
    readingArticleRef.current = readingArticle;
  }, [readingArticle]);

  // Editor Modal state
  const [showEditor, setShowEditor] = useState(false);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Kiến thức chuyên khoa");
  const [specialtySlug, setSpecialtySlug] = useState("tim-mach");
  const [readingMinutes, setReadingMinutes] = useState("5");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [active, setActive] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [myArticleList, communityPage, specList] = await Promise.all([
        doctorListArticles(),
        fetchArticles(0, 50),
        fetchSpecialties(),
      ]);
      setMyArticles(myArticleList.content);
      setCommunityArticles(communityPage.content);
      setSpecialties(specList.content);
      return communityPage.content;
    } catch {
      setError("Không thể tải dữ liệu diễn đàn bài viết y khoa.");
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const openReadingArticle = async (article: Article) => {
    setReadingArticle(article);
    setLoadingReadingComments(true);
    setReplyingToCommentId(null);
    setReplyText("");
    try {
      const commentsData = await fetchArticleComments(article.slug);
      setReadingComments(commentsData);
    } catch {
      setReadingComments([]);
    } finally {
      setLoadingReadingComments(false);
    }
  };

  useEffect(() => {
    if (!session?.user || !hasRole(session.user, "DOCTOR")) return;
    const task = Promise.resolve().then(loadData);
    const unsubscribe = subscribeToCatalogChange(async () => {
      const freshList = await loadData();
      if (readingArticleRef.current) {
        const currentSlug = readingArticleRef.current.slug;
        const matched = freshList.find((a) => a.slug === currentSlug);
        if (matched) {
          setReadingArticle(matched);
          setRealtimeSyncNotice("Nội dung bài viết vừa được cập nhật realtime!");
          setTimeout(() => setRealtimeSyncNotice(null), 4000);
        } else {
          try {
            const fresh = await fetchArticleBySlug(currentSlug);
            if (fresh) {
              setReadingArticle(fresh);
              setRealtimeSyncNotice("Nội dung bài viết vừa được cập nhật realtime!");
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
  }, [loadData, session]);

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
      setCoverImageUrl("");
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
        setSuccess("Đã cập nhật bài viết y khoa thành công!");
      } else {
        await doctorCreateArticle(payload);
        setSuccess("Đã đăng bài viết y khoa mới thành công lên mạng xã hội bệnh viện!");
      }
      broadcastCatalogChange({ kind: "article", action: editingSlug ? "updated" : "created", slug: finalSlug });
      setShowEditor(false);
      await loadData();
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
      setSuccess("Đã xóa bài viết khỏi diễn đàn.");
      if (readingArticle?.slug === slug) setReadingArticle(null);
      await loadData();
    } catch {
      setError("Không thể xóa bài viết.");
    } finally {
      setBusy(false);
    }
  };

  const handleSendReply = async (e: FormEvent) => {
    e.preventDefault();
    if (!readingArticle || !replyText.trim()) return;
    setBusy(true);
    try {
      await createArticleComment(readingArticle.slug, {
        content: replyText.trim(),
        parentCommentId: replyingToCommentId,
      });
      setReplyText("");
      setReplyingToCommentId(null);
      const commentsData = await fetchArticleComments(readingArticle.slug);
      setReadingComments(commentsData);
    } catch {
      setError("Không thể gửi phản hồi thảo luận.");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!readingArticle || !window.confirm("Xóa bình luận này?")) return;
    try {
      await deleteArticleComment(readingArticle.slug, commentId);
      const commentsData = await fetchArticleComments(readingArticle.slug);
      setReadingComments(commentsData);
    } catch {
      setError("Không thể xóa bình luận.");
    }
  };

  const filteredCommunityArticles = selectedSpecialty === "all"
    ? communityArticles
    : communityArticles.filter((a) => a.relatedSpecialtySlug === selectedSpecialty);

  return (
    <PortalChrome role="DOCTOR" user={session.user}>
      <div className="w-full max-w-[1240px] mx-auto pb-12 space-y-6">
        {/* Header Title with Action Button and Symmetrical Tabs */}
        <header className="mb-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-100">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-teal-50 text-teal-800 border border-teal-200/60">
                Mạng xã hội y khoa & Diễn đàn bệnh viện
              </span>
              <h1 className="text-2xl font-black text-teal-950 tracking-tight mt-2">
                Cộng đồng & Bài viết Y khoa
              </h1>
              <p className="text-sm text-slate-600 mt-1 max-w-2xl">
                Đọc và thảo luận chuyên môn cùng các Bác sĩ đồng nghiệp, chia sẻ kiến thức phòng bệnh và giải đáp thắc mắc của người bệnh.
              </p>
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-lg bg-teal-900 px-5 py-2.5 text-sm font-bold text-white shadow-xs hover:bg-teal-800 transition-all min-h-11 cursor-pointer"
              onClick={() => handleOpenEditor()}
              type="button"
            >
              <UiIcon name="plus" size={16} />
              <span>Đăng bài viết mới</span>
            </button>
          </div>

          {/* Symmetrical Segmented Tabs */}
          <div className="pt-4 flex flex-wrap items-center gap-3">
            <div className="inline-flex p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 gap-1.5">
              <button
                className={`min-h-10 px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === "community_feed"
                    ? "bg-white text-teal-950 shadow-xs border border-slate-200/60"
                    : "text-slate-600 hover:text-teal-900 hover:bg-slate-200/60"
                }`}
                onClick={() => setActiveTab("community_feed")}
                type="button"
              >
                <UiIcon name="book-open" size={15} />
                <span>Bảng tin Y khoa Bệnh viện</span>
                <span className="ml-1 rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-bold text-teal-800 border border-teal-200/50">
                  {communityArticles.length}
                </span>
              </button>

              <button
                className={`min-h-10 px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === "my_articles"
                    ? "bg-white text-teal-950 shadow-xs border border-slate-200/60"
                    : "text-slate-600 hover:text-teal-900 hover:bg-slate-200/60"
                }`}
                onClick={() => setActiveTab("my_articles")}
                type="button"
              >
                <UiIcon name="stethoscope" size={15} />
                <span>Bài viết của tôi</span>
                <span className="ml-1 rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-bold text-teal-800 border border-teal-200/50">
                  {myArticles.length}
                </span>
              </button>
            </div>
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

        {/* ── TAB 1: Bảng tin Y khoa Bệnh viện (Social Medical Feed) ── */}
        {activeTab === "community_feed" && (
          <div className="space-y-6">
            {/* Specialty Filter Chips */}
            <div className="flex flex-wrap gap-2">
              <button
                className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                  selectedSpecialty === "all"
                    ? "bg-teal-900 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
                onClick={() => setSelectedSpecialty("all")}
                type="button"
              >
                Tất cả chuyên khoa ({communityArticles.length})
              </button>
              {specialties.map((s) => {
                const count = communityArticles.filter((a) => a.relatedSpecialtySlug === s.slug).length;
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

            {loading ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
                Đang tải bảng tin y khoa từ các Bác sĩ...
              </div>
            ) : filteredCommunityArticles.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
                Không có bài viết nào trong chuyên mục này.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredCommunityArticles.map((article) => (
                  <article
                    className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-all hover:border-teal-500 hover:shadow-md cursor-pointer group"
                    key={article.id}
                    onClick={() => void openReadingArticle(article)}
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
                          <span className="text-[11px]">Nhấp để xem →</span>
                        </div>

                        <h3 className="text-base font-bold text-teal-950 line-clamp-2 group-hover:text-teal-700 transition-colors">
                          {article.title}
                        </h3>
                        <p className="mt-2 text-xs text-slate-600 line-clamp-3 leading-relaxed">
                          {article.summary}
                        </p>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                        <span className="font-semibold text-slate-800 inline-flex items-center gap-1.5">
                          <UiIcon name="stethoscope" size={14} />
                          <span>{article.authorName || "Bác sĩ Bệnh viện"}</span>
                        </span>
                        <span className="font-bold text-teal-800 inline-flex items-center gap-1">
                          <UiIcon name="message-square" size={13} />
                          <span>Thảo luận y khoa</span>
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: Bài viết của tôi (Doctor's Own Articles) ── */}
        {activeTab === "my_articles" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-teal-950">
                Bài viết y khoa của tôi ({myArticles.length})
              </h2>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">
                Đang tải danh sách bài viết...
              </div>
            ) : myArticles.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
                <p className="text-slate-500">Bạn chưa đăng bài viết nào.</p>
                <button
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-teal-900 px-4 py-2 text-xs font-bold text-white hover:bg-teal-800 min-h-11 cursor-pointer"
                  onClick={() => handleOpenEditor()}
                  type="button"
                >
                  <UiIcon name="plus" size={14} />
                  <span>Đăng bài viết đầu tiên</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {myArticles.map((a) => (
                  <div
                    className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-teal-500"
                    key={a.id}
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="rounded-md bg-teal-50 px-2.5 py-0.5 font-bold text-teal-800">
                          {a.category || "Cẩm nang y tế"}
                        </span>
                        <span className={`font-semibold ${a.active ? "text-emerald-700" : "text-amber-700"}`}>
                          {a.active ? "● Đang hiển thị công khai" : "○ Bản nháp"}
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
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold bg-teal-50 text-teal-900 hover:bg-teal-100 cursor-pointer"
                        onClick={() => void openReadingArticle(a)}
                        type="button"
                      >
                        <UiIcon name="book-open" size={14} />
                        <span>Xem</span>
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-teal-800 cursor-pointer"
                          onClick={() => handleOpenEditor(a)}
                          title="Sửa bài viết"
                          type="button"
                        >
                          <UiIcon name="sparkles" size={15} />
                        </button>
                        <button
                          className="rounded-lg p-2 text-slate-600 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                          onClick={() => void handleDeleteArticle(a.slug, a.title)}
                          title="Xóa bài viết"
                          type="button"
                        >
                          <UiIcon name="trash" size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── EDITORIAL ARTICLE READER MODAL ("ĐỌC NHƯ 1 BÀI BÁO Y KHOA") ── */}
        {readingArticle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto backdrop-blur-sm">
            <div className="my-8 w-full max-w-3xl rounded-[10px] bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
              {/* Header Bar */}
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/90">
                <span className="rounded-[4px] bg-teal-50 border border-teal-200 px-3 py-1 text-xs font-bold text-teal-900 tracking-wider uppercase font-mono">
                  {readingArticle.category || "Chuyên đề Sức khỏe Bệnh viện"}
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

              {/* Scrollable Article Body */}
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
                            <span>Đã xác thực</span>
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
                    <strong className="font-semibold text-amber-900 not-italic">Lưu ý chuyên môn:</strong> Thông tin y khoa trên diễn đàn mang tính chất phổ biến kiến thức chăm sóc sức khỏe. Người bệnh cần tham khảo ý kiến trực tiếp của Bác sĩ điều trị trước khi áp dụng bất kỳ phác đồ dùng thuốc nào.
                  </p>
                </div>

                {/* Attached Comments Thread */}
                <div className="mt-8 pt-6 border-t border-slate-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-teal-950 flex items-center gap-2">
                      <UiIcon name="message-square" size={18} />
                      <span>Thảo luận chuyên môn & Hỏi đáp ({readingComments.length})</span>
                    </h3>
                  </div>

                  {loadingReadingComments ? (
                    <p className="text-xs text-slate-400">Đang tải thảo luận...</p>
                  ) : readingComments.length === 0 ? (
                    <div className="rounded-[6px] bg-slate-50 p-6 text-center text-xs text-slate-500 border border-dashed border-slate-300">
                      Chưa có phản hồi nào. Hãy là Bác sĩ đầu tiên bình luận chuyên môn cho bài viết này!
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {readingComments.map((c) => {
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
                                    <span>Bác sĩ</span>
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
                            <div className="mt-2.5 flex items-center justify-between border-t border-slate-100/70 pt-2">
                              <button
                                className="text-xs font-bold text-teal-800 hover:underline cursor-pointer"
                                onClick={() => {
                                  setReplyingToCommentId(c.id);
                                  setReplyText(`@${c.authorName}: `);
                                }}
                                type="button"
                              >
                                Trả lời
                              </button>
                              <button
                                className="text-xs font-semibold text-red-600 hover:underline cursor-pointer"
                                onClick={() => void handleDeleteComment(c.id)}
                                type="button"
                              >
                                Xóa
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Reply Composer Form */}
                  <form className="border-t border-slate-200 pt-4" onSubmit={handleSendReply}>
                    {replyingToCommentId && (
                      <div className="mb-2 flex items-center justify-between rounded-[6px] bg-teal-50 border border-teal-200 px-3 py-1.5 text-xs text-teal-800">
                        <span>Đang trả lời bình luận</span>
                        <button
                          className="font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
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
                      className="w-full rounded-[6px] border border-slate-300 p-3.5 text-sm focus:border-teal-700 focus:ring-1 focus:ring-teal-700 focus:outline-none transition leading-relaxed text-slate-800 placeholder:text-slate-400 bg-white shadow-2xs"
                      disabled={busy}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Gửi phản hồi y khoa chính thức từ Bác sĩ..."
                      rows={3}
                      value={replyText}
                    />
                    <div className="mt-2.5 flex justify-end">
                      <button
                        className="min-h-10 rounded-[6px] bg-teal-800 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-teal-900 disabled:opacity-50 transition-colors cursor-pointer shadow-xs"
                        disabled={busy || !replyText.trim()}
                        type="submit"
                      >
                        {busy ? "Đang gửi..." : "Gửi giải đáp chuyên môn"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── ARTICLE CREATION & EDIT MODAL WITH IMAGE UPLOAD ── */}
        {showEditor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto backdrop-blur-sm">
            <div className="my-8 w-full max-w-2xl rounded-[10px] bg-white p-6 shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <h2 className="text-xl font-bold text-teal-950">
                  {editingSlug ? "Chỉnh sửa bài viết y khoa" : "Đăng bài viết y khoa mới"}
                </h2>
                <button
                  aria-label="Đóng biểu mẫu"
                  className="rounded-[4px] p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
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
                    className="mt-1 w-full min-h-10 rounded-[6px] border border-slate-300 px-3.5 py-2 text-sm focus:border-teal-700 focus:ring-1 focus:ring-teal-700 focus:outline-none"
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
                      className="mt-1 w-full min-h-10 rounded-[6px] border border-slate-300 px-3 py-2 text-sm focus:border-teal-700 focus:ring-1 focus:ring-teal-700 focus:outline-none"
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="Tim mạch, Tiêu hóa..."
                      type="text"
                      value={category}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">Chuyên khoa</label>
                    <select
                      className="mt-1 w-full min-h-10 rounded-[6px] border border-slate-300 px-3 py-2 text-sm bg-white focus:border-teal-700 focus:ring-1 focus:ring-teal-700 focus:outline-none"
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
                      className="mt-1 w-full min-h-10 rounded-[6px] border border-slate-300 px-3 py-2 text-sm focus:border-teal-700 focus:ring-1 focus:ring-teal-700 focus:outline-none"
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
                    className="mt-1 w-full rounded-[6px] border border-slate-300 p-3 text-sm focus:border-teal-700 focus:ring-1 focus:ring-teal-700 focus:outline-none"
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
                    className="mt-1 w-full rounded-[6px] border border-slate-300 p-3 text-sm focus:border-teal-700 focus:ring-1 focus:ring-teal-700 focus:outline-none leading-relaxed"
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Kiến thức y khoa, chỉ định chuyên môn, phác đồ theo dõi và lời khuyên của bác sĩ..."
                    required
                    rows={6}
                    value={body}
                  />
                </div>

                {/* Direct Image Upload Component (No raw URL path exposed) */}
                <div>
                  <ImageUpload
                    aspectRatio="banner"
                    helperText="Tải lên tệp ảnh bìa bài viết (PNG, JPG, WEBP tối đa 10 MB)"
                    label="Ảnh bìa bài viết y khoa (Tải lên từ thiết bị)"
                    onChange={(url) => setCoverImageUrl(url)}
                    purpose="ARTICLE_COVER"
                    value={coverImageUrl}
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <input
                    checked={active}
                    className="h-5 w-5 rounded border-slate-300 text-teal-800 focus:ring-teal-600 cursor-pointer"
                    id="active"
                    onChange={(e) => setActive(e.target.checked)}
                    type="checkbox"
                  />
                  <label className="text-sm font-semibold text-slate-800 cursor-pointer" htmlFor="active">
                    Xuất bản công khai trên mạng xã hội bệnh viện
                  </label>
                </div>

                <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
                  <button
                    className="rounded-[6px] border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 min-h-10 cursor-pointer"
                    onClick={() => setShowEditor(false)}
                    type="button"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    className="min-h-10 rounded-[6px] bg-teal-800 px-6 py-2 text-sm font-bold uppercase tracking-wider text-white hover:bg-teal-900 disabled:opacity-50 transition cursor-pointer shadow-xs"
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
      </div>
    </PortalChrome>
  );
}
