"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import UiIcon from "../UiIcon";
import { useAuthSession } from "../useAuthSession";
import {
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
  if (category && category.trim()) return category.trim();
  if (authorName && authorName.includes("Chuyên khoa")) {
    const parts = authorName.split("Chuyên khoa");
    if (parts[1]) return parts[1].trim();
  }
  return null;
}

function DoctorVerifiedBadge({ specialty }: { specialty: string | null }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[4px] bg-teal-800 text-white text-[11px] font-bold">
      <span>Bác sĩ chuyên khoa xác thực</span>
      {specialty ? <span className="text-teal-200 font-normal">· {specialty}</span> : null}
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
      setSubmitError("Chưa thể gửi bình luận. Hãy kiểm tra kết nối và thử lại.");
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
      setReplyError("Chưa thể gửi phản hồi. Vui lòng thử lại.");
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

  const specialtyContext = getSpecialtyLabel(category);

  return (
    <section id="article-comments" aria-labelledby="article-comments-heading" className="article-news-section article-comments-section mt-10 pt-8 border-t border-slate-200">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2">
          <h2 id="article-comments-heading" className="text-xl font-bold text-slate-900 m-0">
            Hỏi đáp &amp; Thảo luận y khoa ({comments.length})
          </h2>
        </div>
        <span className="text-xs text-slate-500 font-medium">
          Ý kiến tham khảo · Bác sĩ chuyên khoa phản hồi trực tiếp
        </span>
      </div>

      {/* Safety Guidelines Card */}
      <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-[4px]">
        <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-800">
          <span>Quy tắc hỏi đáp y khoa an toàn:</span>
        </div>
        <ul className="text-[12px] text-slate-600 space-y-1 pl-4 list-disc mb-0">
          <li><strong>Không dùng cho trường hợp cấp cứu 115</strong>: Nếu có triệu chứng đe dọa tính mạng (đau thắt ngực, khó thở, ngất xỉu), hãy gọi 115 ngay.</li>
          <li><strong>Không thay thế thăm khám trực tiếp</strong>: Câu trả lời từ bác sĩ mang tính định hướng thông tin y tế, không phải là đơn thuốc hay chẩn đoán chính thức.</li>
          <li><strong>Bảo mật thông tin cá nhân</strong>: Vui lòng không cung cấp thông tin nhạy cảm (số CCCD, tài khoản, số điện thoại riêng) trong bình luận công khai.</li>
        </ul>
      </div>

      {/* Composer form */}
      {session ? (
        <form onSubmit={handleSubmitRoot} className="mb-8 p-5 bg-white border border-slate-300 rounded-[4px]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <span>Đặt câu hỏi hoặc chia sẻ băn khoăn về bài viết:</span>
              {specialtyContext ? (
                <span className="px-2 py-0.5 bg-teal-50 text-teal-800 text-[10px] font-bold rounded-[2px] border border-teal-200">
                  {specialtyContext}
                </span>
              ) : null}
            </span>
            <span className="text-[11px] text-slate-500 font-mono" aria-live="polite">
              {draft.length} / 2.000 ký tự
            </span>
          </div>
          <textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (submitError) setSubmitError(null);
            }}
            placeholder="Ví dụ: Bác sĩ cho em hỏi nếu có triệu chứng như bài viết thì nên đi khám chuyên khoa nào trước?..."
            rows={3}
            maxLength={2000}
            className="w-full p-3 text-sm border border-slate-300 rounded-[4px] bg-white text-slate-800 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700 transition"
            disabled={submitting}
          />
          {submitError && (
            <p className="text-xs text-rose-600 mt-1 mb-2 font-medium" role="alert">
              {submitError}
            </p>
          )}
          <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
            <span className="text-[11px] text-slate-500">
              Bình luận sẽ được lưu trữ và hiển thị công khai để bác sĩ giải đáp.
            </span>
            <button
              type="submit"
              disabled={submitting || draft.trim().length < 2}
              className="inline-flex items-center justify-center gap-1.5 px-4 min-h-[44px] bg-teal-800 hover:bg-teal-900 disabled:opacity-50 text-white text-xs font-semibold rounded-[4px] transition cursor-pointer"
            >
              <UiIcon name="send" size={14} />
              <span>{submitting ? "Đang gửi..." : "Gửi câu hỏi y khoa"}</span>
            </button>
          </div>
        </form>
      ) : (
        <div className="mb-8 p-4 bg-teal-50/80 border border-teal-200 rounded-[4px] flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs text-teal-950 font-bold m-0">
              Bạn có câu hỏi dành cho bác sĩ chuyên khoa?
            </p>
            <p className="text-[11px] text-teal-800 m-0">
              Đăng nhập để đặt câu hỏi trực tiếp và nhận phản hồi từ đội ngũ chuyên môn trên cẩm nang y khoa.
            </p>
          </div>
          <Link
            href={`/auth/login?next=${encodeURIComponent(`/articles/${slug}`)}`}
            className="inline-flex items-center justify-center gap-1 px-4 min-h-[44px] bg-teal-800 hover:bg-teal-900 text-white text-xs font-semibold rounded-[4px] transition cursor-pointer"
          >
            Đăng nhập để bình luận →
          </Link>
        </div>
      )}

      {/* Comment List */}
      {loading ? (
        <div className="py-8 text-center" role="status">
          <p className="text-xs text-slate-500 catalog-status--loading">Đang tải câu hỏi &amp; phản hồi...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-[4px] text-xs text-rose-800 catalog-status--error" role="alert">
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
          <p className="text-sm font-semibold mb-1 text-slate-700">Chưa có câu hỏi hoặc thảo luận nào về bài viết này.</p>
          <p className="text-xs text-slate-500">Hãy là người đầu tiên đặt câu hỏi để nhận phản hồi từ đội ngũ bác sĩ chuyên khoa!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rootComments.map((comment) => {
            const replies = repliesByParent[comment.id] || [];
            const isReplyingThis = replyingToId === comment.id;
            const authorSpecialty = getSpecialtyLabel(category, comment.authorName);

            return (
              <article
                key={comment.id}
                className="p-4 bg-white border border-slate-200 rounded-[4px]"
              >
                {/* Author row */}
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-[4px] border flex items-center justify-center text-xs font-bold ${
                      comment.authorRole === "DOCTOR"
                        ? "bg-teal-800 text-white border-teal-900"
                        : comment.authorRole === "ADMIN"
                        ? "bg-indigo-700 text-white border-indigo-800"
                        : "bg-slate-100 text-slate-700 border-slate-300"
                    }`}>
                      {comment.authorRole === "DOCTOR" ? "BS" : comment.authorRole === "ADMIN" ? "AD" : comment.authorName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900">
                          {comment.authorName}
                        </span>
                        <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-[2px]">
                          Câu hỏi
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {formatBusinessDate(comment.createdAt)}
                      </span>
                    </div>
                  </div>
                  {comment.authorRole === "DOCTOR" ? (
                    <DoctorVerifiedBadge specialty={authorSpecialty} />
                  ) : comment.authorRole === "ADMIN" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-indigo-50 border border-indigo-300 text-[10px] font-bold text-indigo-800">
                      Ban Biên Tập
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-slate-100 text-[10px] font-medium text-slate-600">
                      Bạn đọc
                    </span>
                  )}
                </div>

                {/* Content */}
                <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed my-2 pl-10.5">
                  {comment.content}
                </p>

                {/* Actions: Reply button for Doctors / Admins */}
                {canReplyAsMedical && (
                  <div className="pl-10.5 mt-2">
                    <button
                      onClick={() => {
                        setReplyingToId(isReplyingThis ? null : comment.id);
                        setReplyDraft("");
                        setReplyError(null);
                      }}
                      type="button"
                      className="inline-flex items-center gap-1.5 min-h-[44px] text-xs font-bold text-teal-800 hover:text-teal-950 cursor-pointer"
                    >
                      <UiIcon name="activity" size={14} />
                      <span>{isReplyingThis ? "Hủy phản hồi" : "Trả lời với tư cách Bác sĩ chuyên khoa"}</span>
                    </button>
                  </div>
                )}

                {/* Inline Reply Composer for Doctor */}
                {isReplyingThis && (
                  <form
                    onSubmit={(e) => handleReplySubmit(e, comment.id)}
                    className="ml-10.5 mt-3 p-4 bg-teal-50/60 border border-teal-300 rounded-[4px]"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-teal-950 flex items-center gap-1.5">
                        <span>Phản hồi chuyên môn từ Bác sĩ:</span>
                        {specialtyContext ? (
                          <span className="text-teal-800 font-normal">({specialtyContext})</span>
                        ) : null}
                      </span>
                      <span className="text-[11px] text-teal-700 font-mono">{replyDraft.length} / 2.000</span>
                    </div>
                    <textarea
                      value={replyDraft}
                      onChange={(e) => setReplyDraft(e.target.value)}
                      placeholder="Nhập tư vấn chuyên môn, giải thích cơ chế và hướng dẫn người bệnh theo phác đồ..."
                      rows={3}
                      maxLength={2000}
                      className="w-full p-3 text-xs border border-teal-300 rounded-[4px] bg-white text-slate-900 focus:outline-none focus:border-teal-700"
                      disabled={replySubmitting}
                      required
                    />
                    {replyError && (
                      <p className="text-[11px] text-rose-600 mt-1 mb-1 font-medium">{replyError}</p>
                    )}
                    <div className="flex justify-end gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => setReplyingToId(null)}
                        className="px-3 min-h-[44px] text-xs text-slate-600 hover:text-slate-800 cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        disabled={replySubmitting || replyDraft.trim().length < 2}
                        className="px-4 min-h-[44px] bg-teal-800 hover:bg-teal-900 disabled:opacity-50 text-white text-xs font-semibold rounded-[4px] cursor-pointer"
                      >
                        {replySubmitting ? "Đang gửi..." : "Gửi phản hồi chuyên khoa"}
                      </button>
                    </div>
                  </form>
                )}

                {/* Nested Replies (Forum Threaded Hierarchy) */}
                {replies.length > 0 && (
                  <div className="border-l-2 border-teal-600 pl-4 ml-10.5 mt-4 space-y-3">
                    <div className="text-[11px] font-bold text-teal-900 uppercase tracking-wider flex items-center gap-1">
                      <span>Luồng phản hồi &amp; giải đáp ({replies.length})</span>
                    </div>
                    {replies.map((reply) => {
                      const isDoctorReply = reply.authorRole === "DOCTOR" || reply.authorRole === "ADMIN";
                      const replySpecialty = getSpecialtyLabel(category, reply.authorName);

                      return (
                        <div
                          key={reply.id}
                          className={`p-3.5 rounded-[4px] border ${
                            isDoctorReply
                              ? "bg-teal-50/70 border-teal-300 border-l-4 border-l-teal-700"
                              : "bg-slate-50 border-slate-200"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900">
                                {reply.authorName}
                              </span>
                              {isDoctorReply ? (
                                <DoctorVerifiedBadge specialty={replySpecialty} />
                              ) : null}
                            </div>
                            <span className="text-[10px] text-slate-500">
                              {formatBusinessDate(reply.createdAt)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap m-0">
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
