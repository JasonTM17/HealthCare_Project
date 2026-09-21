"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import UiIcon from "../UiIcon";
import { useAuthSession } from "../useAuthSession";
import {
  ApiError,
  createArticleComment,
  fetchArticleComments,
  hasRole,
  type ArticleComment,
} from "../../lib/api-client";
import { formatBusinessDate } from "../../lib/business-time";

interface ArticleCommentsProps {
  slug: string;
  category?: string | null;
}

function getSpecialtyLabel(category?: string | null, authorName?: string): string | null {
  if (category && category.trim()) {
    return category.trim();
  }
  if (authorName && authorName.includes("- Bác sĩ Chuyên khoa")) {
    const parts = authorName.split("- Bác sĩ Chuyên khoa");
    if (parts[1] && parts[1].trim()) {
      return parts[1].trim();
    }
  }
  return null;
}

function DoctorVerifiedBadge({ category, authorName }: { category?: string | null; authorName?: string }) {
  const specialty = getSpecialtyLabel(category, authorName);
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[4px] bg-teal-800 text-white text-[10px] font-bold">
      <span aria-hidden="true">🩺</span>
      <span>Bác sĩ chuyên khoa xác thực</span>
      {specialty ? (
        <span className="text-teal-200 font-medium">· {specialty}</span>
      ) : null}
    </span>
  );
}

export function ArticleComments({ slug, category }: ArticleCommentsProps) {
  const session = useAuthSession();
  const [comments, setComments] = useState<ArticleComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New root comment form
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Reply form state (commentId being replied to)
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const isDoctor = session ? hasRole(session.user, "ROLE_DOCTOR") : false;
  const isAdmin = session ? hasRole(session.user, "ROLE_ADMIN") : false;
  const canReplyAsMedical = isDoctor || isAdmin;

  const loadComments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchArticleComments(slug);
      setComments(data);
    } catch (err: unknown) {
      setError("Không thể tải danh sách bình luận. Vui lòng thử lại sau.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    // Defer the first state write off the effect body so the render→effect
    // boundary stays free of synchronous setState (react-hooks lint).
    const task = Promise.resolve().then(loadComments);
    return () => {
      void task;
    };
  }, [loadComments]);

  const handleSubmitRoot = async (e: FormEvent) => {
    e.preventDefault();
    const content = draft.trim();
    if (!content || content.length < 2) {
      setSubmitError("Nội dung câu hỏi quá ngắn (tối thiểu 2 ký tự).");
      return;
    }
    if (content.length > 2000) {
      setSubmitError("Nội dung vượt quá 2.000 ký tự.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await createArticleComment(slug, { content });
      setComments((prev) => [...prev, created]);
      setDraft("");
    } catch (err: unknown) {
      // Prefer the backend's specific reason (removed parent, expired session…)
      // over a generic network copy that traps the user in a doomed retry.
      setSubmitError(err instanceof ApiError && err.message
        ? err.message
        : "Chưa thể gửi bình luận. Hãy kiểm tra kết nối và thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReplySubmit = async (e: FormEvent, parentId: string) => {
    e.preventDefault();
    const content = replyDraft.trim();
    if (!content || content.length < 2) {
      setReplyError("Nội dung phản hồi quá ngắn.");
      return;
    }

    setReplySubmitting(true);
    setReplyError(null);
    try {
      const created = await createArticleComment(slug, {
        content,
        parentCommentId: parentId,
      });
      setComments((prev) => [...prev, created]);
      setReplyDraft("");
      setReplyingToId(null);
    } catch (err: unknown) {
      setReplyError(err instanceof ApiError && err.message
        ? err.message
        : "Chưa thể gửi phản hồi. Vui lòng thử lại.");
    } finally {
      setReplySubmitting(false);
    }
  };

  const rootComments = comments.filter((c) => !c.parentCommentId);
  const repliesByParent = comments.reduce<Record<string, ArticleComment[]>>((acc, c) => {
    if (c.parentCommentId) {
      if (!acc[c.parentCommentId]) acc[c.parentCommentId] = [];
      acc[c.parentCommentId].push(c);
    }
    return acc;
  }, {});

  return (
    <section id="article-comments" aria-labelledby="article-comments-heading" className="article-news-section article-comments-section mt-10 pt-8 border-t border-slate-200">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2">
          <span className="text-xl">💬</span>
          <h2 id="article-comments-heading" className="text-xl font-bold text-slate-800 m-0">
            Hỏi đáp &amp; Thảo luận y khoa ({comments.filter((c) => c.active !== false).length})
          </h2>
        </div>
        <span className="text-xs text-slate-500 font-medium">
          Ý kiến tham khảo · Bác sĩ chuyên khoa phản hồi trực tiếp
        </span>
      </div>

      {/* Medical Q&A Guidelines Box */}
      <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-[4px]">
        <div className="flex items-center gap-2 mb-2.5">
          <span className="text-base" aria-hidden="true">🛡️</span>
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider m-0">
            Quy tắc hỏi đáp y khoa an toàn
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-600">
          <div className="flex items-start gap-2">
            <span className="text-rose-600 font-bold shrink-0" aria-hidden="true">🚨</span>
            <p className="m-0 leading-relaxed">
              <strong className="text-slate-800">Không dùng cho trường hợp cấp cứu 115:</strong> Nếu bạn đang có triệu chứng nguy cấp (đau ngực dữ dội, khó thở, hôn mê), hãy gọi ngay <strong className="text-rose-700">115</strong> hoặc tới cơ sở y tế gần nhất.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-teal-700 font-bold shrink-0" aria-hidden="true">🩺</span>
            <p className="m-0 leading-relaxed">
              <strong className="text-slate-800">Không thay thế thăm khám trực tiếp:</strong> Ý kiến bác sĩ mang tính chất tham vấn y khoa định hướng, không thay thế chẩn đoán lâm sàng hay đơn thuốc trực tiếp.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-amber-700 font-bold shrink-0" aria-hidden="true">🔒</span>
            <p className="m-0 leading-relaxed">
              <strong className="text-slate-800">Bảo mật thông tin cá nhân:</strong> Không công khai số CCCD, số điện thoại, địa chỉ nhà hoặc bệnh án nhạy cảm. Mô tả rõ tuổi, giới tính và thời gian xuất hiện triệu chứng.
            </p>
          </div>
        </div>
      </div>

      {/* Composer form or Guest login prompt */}
      {session ? (
        <form onSubmit={handleSubmitRoot} className="mb-8 p-5 bg-slate-50 border border-slate-200 rounded-[4px]">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <div className="flex items-center gap-2">
              <label htmlFor="article-comment-input" className="text-xs font-semibold text-slate-800">
                Đặt câu hỏi hoặc chia sẻ băn khoăn về bài viết:
              </label>
              {category && (
                <span className="px-2 py-0.5 rounded-[2px] bg-teal-50 border border-teal-200 text-[10px] font-medium text-teal-800">
                  Chuyên khoa {category}
                </span>
              )}
            </div>
            <span className="text-[11px] text-slate-500 font-mono" aria-live="polite">
              {draft.length} / 2.000 ký tự
            </span>
          </div>
          <textarea
            id="article-comment-input"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (submitError) setSubmitError(null);
            }}
            placeholder="Đặt câu hỏi y khoa hoặc chia sẻ băn khoăn về bài viết (Ví dụ: Bác sĩ cho em hỏi nếu có triệu chứng như bài viết thì nên đi khám chuyên khoa nào trước?...)"
            rows={3}
            maxLength={2000}
            className="w-full p-3 text-sm border border-slate-300 rounded-[4px] bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700 transition"
            disabled={submitting}
            aria-label="Nội dung câu hỏi y khoa"
          />
          {submitError && (
            <p className="text-xs text-rose-600 mt-1 mb-2 font-medium" role="alert">
              {submitError}
            </p>
          )}
          <div className="flex items-center justify-between flex-wrap gap-3 mt-3">
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700">Tác giả câu hỏi:</span>
              <span>{session.user?.displayName || "Bạn đọc"}</span>
              <span className="text-slate-300">|</span>
              <span>Bình luận sẽ được lưu trữ và hiển thị công khai để bác sĩ giải đáp.</span>
            </div>
            <button
              type="submit"
              disabled={submitting || draft.trim().length < 2}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-teal-800 hover:bg-teal-900 disabled:opacity-50 text-white text-xs font-semibold rounded-[4px] transition min-h-[44px] cursor-pointer"
            >
              <UiIcon name="send" size={14} />
              <span>{submitting ? "Đang gửi..." : "Gửi bình luận y tế"}</span>
            </button>
          </div>
        </form>
      ) : (
        <div className="mb-8 p-5 bg-teal-50/70 border border-teal-200 rounded-[4px] flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-start gap-3 max-w-xl">
            <div
              className="w-9 h-9 rounded-[4px] bg-teal-100 text-teal-800 flex items-center justify-center shrink-0 text-base font-bold border border-teal-200"
              aria-hidden="true"
            >
              🔒
            </div>
            <div>
              <h3 className="text-sm font-bold text-teal-950 m-0">
                Bạn có câu hỏi dành cho bác sĩ chuyên khoa?
              </h3>
              <p className="text-xs text-teal-900 mt-1 mb-0 leading-relaxed">
                Đăng nhập để đặt câu hỏi cho bác sĩ và nhận phản hồi trực tiếp trên cẩm nang y khoa.
              </p>
            </div>
          </div>
          <Link
            href={`/auth/login?next=${encodeURIComponent(`/articles/${slug}`)}`}
            className="inline-flex items-center justify-center gap-1 px-4 py-2.5 bg-teal-800 hover:bg-teal-900 text-white text-xs font-semibold rounded-[4px] transition cursor-pointer min-h-[44px]"
          >
            <span>Đăng nhập để bình luận →</span>
          </Link>
        </div>
      )}

      {/* Comment List */}
      {loading ? (
        <p className="text-xs text-slate-500 py-6 text-center">Đang tải câu hỏi &amp; phản hồi...</p>
      ) : error ? (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-[4px] text-xs text-rose-800">
          <span>{error}</span>
          <button
            onClick={() => void loadComments()}
            className="ml-2 font-bold underline cursor-pointer"
            type="button"
          >
            Thử lại
          </button>
        </div>
      ) : rootComments.length === 0 ? (
        <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-[4px] text-slate-500">
          <p className="text-sm font-medium mb-1">Chưa có câu hỏi hoặc thảo luận nào về bài viết này.</p>
          <p className="text-xs text-slate-400">Hãy là người đầu tiên đặt câu hỏi để nhận phản hồi từ đội ngũ bác sĩ chuyên khoa!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rootComments.map((comment) => {
            const replies = repliesByParent[comment.id] || [];
            const isReplyingThis = replyingToId === comment.id;
            const isDoctorRoot = comment.authorRole === "DOCTOR";
            const isAdminRoot = comment.authorRole === "ADMIN";

            // A soft-deleted root keeps its slot as a thread anchor so replies
            // stay reachable; it renders as a bare tombstone with no author or
            // interaction affordances.
            if (comment.active === false) {
              return (
                <article className="p-5 rounded-[4px] border border-dashed border-slate-300 bg-slate-50/70" key={comment.id}>
                  <p className="text-sm text-slate-500 italic whitespace-pre-wrap m-0">
                    [Bình luận đã xóa]
                  </p>
                  {replies.length > 0 ? (
                    <p className="mt-1 text-[11px] text-slate-400 m-0">
                      {replies.length} phản hồi được giữ lại trong luồng này.
                    </p>
                  ) : null}
                </article>
              );
            }

            return (
              <article
                key={comment.id}
                className={`p-5 rounded-[4px] border ${
                  isDoctorRoot
                    ? "bg-teal-50/70 border-teal-300 border-l-4 border-l-teal-700"
                    : isAdminRoot
                    ? "bg-indigo-50/70 border-indigo-300 border-l-4 border-l-indigo-700"
                    : "bg-white border-slate-200"
                }`}
              >
                {/* Author row */}
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-8 h-8 rounded-[4px] flex items-center justify-center text-xs font-bold shrink-0 border ${
                        isDoctorRoot
                          ? "bg-teal-800 text-white border-teal-900"
                          : isAdminRoot
                          ? "bg-indigo-700 text-white border-indigo-800"
                          : "bg-slate-100 text-slate-700 border-slate-300"
                      }`}
                    >
                      {isDoctorRoot ? "BS" : isAdminRoot ? "AD" : comment.authorName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        {comment.authorName}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {formatBusinessDate(comment.createdAt)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-slate-100 border border-slate-200 text-[10px] font-semibold text-slate-600">
                      ❓ Câu hỏi
                    </span>
                    {isDoctorRoot ? (
                      <DoctorVerifiedBadge category={category} authorName={comment.authorName} />
                    ) : isAdminRoot ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[4px] bg-indigo-100 border border-indigo-300 text-[10px] font-bold text-indigo-900">
                        🛡️ Ban Biên Tập
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-slate-100 border border-slate-200 text-[10px] font-medium text-slate-600">
                        Bạn đọc
                      </span>
                    )}
                  </div>
                </div>

                {/* Content */}
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed my-3 pl-10">
                  {comment.content}
                </p>

                {/* Actions row: Reply button & reply count */}
                <div className="flex items-center justify-between flex-wrap gap-2 pl-10 mt-3 pt-2 border-t border-slate-100">
                  <span className="text-[11px] text-slate-500 font-medium">
                    {replies.length > 0 ? `💬 ${replies.length} phản hồi trong luồng` : "Chưa có phản hồi chuyên môn"}
                  </span>

                  {canReplyAsMedical ? (
                    <button
                      onClick={() => {
                        setReplyingToId(isReplyingThis ? null : comment.id);
                        setReplyDraft("");
                        setReplyError(null);
                      }}
                      type="button"
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-teal-800 hover:text-teal-950 bg-teal-50 hover:bg-teal-100 border border-teal-300 rounded-[4px] transition cursor-pointer min-h-[44px]"
                    >
                      <UiIcon name="activity" size={13} />
                      <span>{isReplyingThis ? "Hủy trả lời" : "Trả lời chuyên môn với tư cách Bác sĩ"}</span>
                    </button>
                  ) : session ? (
                    <button
                      onClick={() => {
                        setReplyingToId(isReplyingThis ? null : comment.id);
                        setReplyDraft("");
                        setReplyError(null);
                      }}
                      type="button"
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-[4px] transition cursor-pointer min-h-[44px]"
                    >
                      <UiIcon name="message-square" size={13} />
                      <span>{isReplyingThis ? "Hủy phản hồi" : "Phản hồi câu hỏi"}</span>
                    </button>
                  ) : (
                    <Link
                      href={`/auth/login?next=${encodeURIComponent(`/articles/${slug}`)}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-900 hover:underline min-h-[44px]"
                    >
                      <span>Đăng nhập để phản hồi →</span>
                    </Link>
                  )}
                </div>

                {/* Inline Reply Composer */}
                {isReplyingThis && (
                  <form
                    onSubmit={(e) => handleReplySubmit(e, comment.id)}
                    className="ml-10 mt-3 p-4 bg-teal-50/70 border border-teal-300 rounded-[4px]"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-teal-950 flex items-center gap-1.5">
                        <span>{canReplyAsMedical ? "🩺" : "💬"}</span>
                        <span>{canReplyAsMedical ? "Phản hồi chuyên môn của Bác sĩ:" : "Phản hồi của bạn đọc:"}</span>
                      </span>
                      <span className="text-[11px] text-teal-700 font-mono">
                        {replyDraft.length} / 2.000 ký tự
                      </span>
                    </div>
                    <textarea
                      value={replyDraft}
                      onChange={(e) => setReplyDraft(e.target.value)}
                      placeholder={
                        canReplyAsMedical
                          ? "Nhập tư vấn chuyên môn, giải đáp thắc mắc của bạn đọc..."
                          : "Nhập phản hồi trao đổi thêm..."
                      }
                      rows={2}
                      maxLength={2000}
                      className="w-full p-2.5 text-xs border border-teal-300 rounded-[4px] bg-white text-slate-800 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
                      disabled={replySubmitting}
                      required
                    />
                    {replyError && (
                      <p className="text-[11px] text-rose-600 mt-1 mb-1 font-medium" role="alert">{replyError}</p>
                    )}
                    <div className="flex justify-end gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => setReplyingToId(null)}
                        className="px-3 py-1.5 text-xs text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-[4px] cursor-pointer min-h-[44px]"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        disabled={replySubmitting || replyDraft.trim().length < 2}
                        className="px-4 py-1.5 bg-teal-800 hover:bg-teal-900 disabled:opacity-50 text-white text-xs font-semibold rounded-[4px] transition cursor-pointer min-h-[44px]"
                      >
                        {replySubmitting ? "Đang gửi..." : canReplyAsMedical ? "Gửi phản hồi chuyên khoa" : "Gửi phản hồi"}
                      </button>
                    </div>
                  </form>
                )}

                {/* Nested Replies with Vertical Hierarchy Guide Line */}
                {replies.length > 0 && (
                  <div className="ml-10 mt-4 space-y-3 border-l-2 border-teal-600 pl-4">
                    <div className="text-[11px] font-bold text-teal-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <span>🩺 Luồng phản hồi &amp; giải đáp ({replies.length})</span>
                    </div>
                    {replies.map((reply) => {
                      const isDoctorReply = reply.authorRole === "DOCTOR";
                      const isAdminReply = reply.authorRole === "ADMIN";

                      if (reply.active === false) {
                        return (
                          <div className="p-4 rounded-[4px] border border-dashed border-slate-300 bg-slate-50/70" key={reply.id}>
                            <p className="text-xs text-slate-500 italic m-0">[Bình luận đã xóa]</p>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={reply.id}
                          className={`p-4 rounded-[4px] border ${
                            isDoctorReply
                              ? "bg-teal-50/70 border-teal-300 border-l-4 border-l-teal-700"
                              : isAdminReply
                              ? "bg-indigo-50/70 border-indigo-300 border-l-4 border-l-indigo-700"
                              : "bg-slate-50 border-slate-200"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-7 h-7 rounded-[4px] flex items-center justify-center text-xs font-bold shrink-0 border ${
                                  isDoctorReply
                                    ? "bg-teal-800 text-white border-teal-900"
                                    : isAdminReply
                                    ? "bg-indigo-700 text-white border-indigo-800"
                                    : "bg-slate-200 text-slate-700 border-slate-300"
                                }`}
                              >
                                {isDoctorReply ? "BS" : isAdminReply ? "AD" : reply.authorName.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <span className="text-xs font-bold text-slate-900 block">
                                  {reply.authorName}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  {formatBusinessDate(reply.createdAt)}
                                </span>
                              </div>
                            </div>

                            {isDoctorReply ? (
                              <DoctorVerifiedBadge category={category} authorName={reply.authorName} />
                            ) : isAdminReply ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[4px] bg-indigo-100 border border-indigo-300 text-[10px] font-bold text-indigo-900">
                                🛡️ Ban Biên Tập
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-slate-200 text-[10px] font-medium text-slate-700">
                                Thành viên phản hồi
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap m-0 pl-10">
                            {reply.content}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
