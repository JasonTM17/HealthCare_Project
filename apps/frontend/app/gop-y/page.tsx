"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PublicPageShell } from "../../components/PublicPageShell";
import { LoadingState } from "../../components/PortalStates";
import { useAuthSession, useAuthSessionStatus } from "../../components/useAuthSession";
import {
  ApiError,
  hydrateAuthSession,
  listMyFeedback,
  submitUserFeedback,
  type UserFeedbackCategory,
  type UserFeedbackItem,
} from "../../lib/api-client";
import { formatDateTime } from "../../lib/datetime";

const CATEGORY_OPTIONS: { value: UserFeedbackCategory; label: string }[] = [
  { value: "GENERAL", label: "Góp ý chung" },
  { value: "UI_UX", label: "Giao diện & trải nghiệm" },
  { value: "BUG_REPORT", label: "Báo lỗi hệ thống" },
  { value: "FEATURE_REQUEST", label: "Đề xuất tính năng" },
  { value: "SERVICE_QUALITY", label: "Chất lượng dịch vụ" },
];

const CATEGORY_LABELS = new Map(CATEGORY_OPTIONS.map((option) => [option.value, option.label]));

const STATUS_LABELS: Record<UserFeedbackItem["status"], string> = {
  NEW: "Đã tiếp nhận",
  TRIAGED: "Đang xử lý",
  RESOLVED: "Đã phản hồi",
};

const MESSAGE_MIN = 10;
const MESSAGE_MAX = 2000;
const SUBJECT_MAX = 200;

const INPUT_CLASS =
  "w-full rounded-sm border-2 border-gray-300 bg-white py-3 px-4 text-sm text-gray-900 focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-600/10 disabled:cursor-not-allowed disabled:bg-gray-100";
const LABEL_CLASS = "mb-1 block text-sm font-semibold text-gray-700";

function FeedbackLoginGate() {
  return (
    <section className="resource-panel portal-state portal-state--auth" aria-labelledby="feedback-login-title">
      <span aria-hidden="true" className="portal-state__mark">↗</span>
      <div>
        <h2 id="feedback-login-title">Đăng nhập để gửi góp ý</h2>
        <p>
          Góp ý được gắn với tài khoản của bạn để đội ngũ HealthCare có thể xác minh thông tin và phản
          hồi đúng người. Vui lòng đăng nhập — sau đó bạn sẽ được đưa thẳng trở lại trang này.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link className="button button--primary min-h-11" href="/auth/login?next=%2Fgop-y">
            Đăng nhập để tiếp tục
          </Link>
          <Link className="outline-button min-h-11" href="/contact">
            Xem kênh liên hệ khác
          </Link>
        </div>
      </div>
    </section>
  );
}

function FeedbackForm({ onSubmitted }: { onSubmitted: (item: UserFeedbackItem) => void }) {
  const [category, setCategory] = useState<UserFeedbackCategory>("GENERAL");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const messageLength = message.trim().length;
  const messageTooShort = messageLength > 0 && messageLength < MESSAGE_MIN;
  const canSubmit =
    !submitting &&
    subject.trim().length > 0 &&
    messageLength >= MESSAGE_MIN &&
    messageLength <= MESSAGE_MAX;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      const created = await submitUserFeedback({
        category,
        subject: subject.trim(),
        message: message.trim(),
      });
      setSubject("");
      setMessage("");
      setCategory("GENERAL");
      onSubmitted(created);
    } catch (err) {
      if (err instanceof ApiError) {
        if (Object.keys(err.fieldErrors).length > 0) setFieldErrors({ ...err.fieldErrors });
        setError(err.message);
      } else {
        setError("Không thể gửi góp ý lúc này. Vui lòng thử lại sau ít phút.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="resource-panel" onSubmit={handleSubmit} noValidate={false}>
      <p className="section-note">Mẫu góp ý</p>
      <h2>Nội dung bạn muốn chia sẻ</h2>

      <div className="mt-5 grid gap-4">
        <div>
          <label className={LABEL_CLASS} htmlFor="feedback-category">Chủ đề</label>
          <select
            id="feedback-category"
            className={INPUT_CLASS}
            value={category}
            onChange={(event) => setCategory(event.target.value as UserFeedbackCategory)}
            disabled={submitting}
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="feedback-subject">Tiêu đề</label>
          <input
            id="feedback-subject"
            className={INPUT_CLASS}
            type="text"
            required
            maxLength={SUBJECT_MAX}
            placeholder="Ví dụ: Nút đặt lịch không phản hồi trên điện thoại"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            disabled={submitting}
          />
          {fieldErrors.subject ? <p className="mt-1 text-sm text-red-600" role="alert">{fieldErrors.subject}</p> : null}
        </div>

        <div>
          <label className={LABEL_CLASS} htmlFor="feedback-message">Nội dung góp ý</label>
          <textarea
            id="feedback-message"
            className={INPUT_CLASS}
            required
            minLength={MESSAGE_MIN}
            maxLength={MESSAGE_MAX}
            rows={6}
            placeholder="Mô tả chi tiết trải nghiệm, lỗi gặp phải hoặc tính năng bạn mong muốn (tối thiểu 10 ký tự)…"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            disabled={submitting}
            aria-describedby="feedback-message-count"
            aria-invalid={messageTooShort}
          />
          <div className="mt-1 flex items-baseline justify-between gap-3">
            {fieldErrors.message ? (
              <p className="text-sm text-red-600" role="alert">{fieldErrors.message}</p>
            ) : messageTooShort ? (
              <p className="text-sm text-amber-700">Cần thêm {MESSAGE_MIN - messageLength} ký tự nữa.</p>
            ) : (
              <span />
            )}
            <p id="feedback-message-count" className="text-xs text-gray-500">
              {message.length}/{MESSAGE_MAX}
            </p>
          </div>
        </div>

        {error ? (
          <p className="rounded-sm border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <div className="resource-actions">
          <button className="button button--primary min-h-11" type="submit" disabled={!canSubmit}>
            {submitting ? "Đang gửi…" : "Gửi góp ý"}
          </button>
          <p className="text-xs text-gray-500">
            Vui lòng không điền thông tin y tế cá nhân hoặc tài liệu nhạy cảm vào ô này.
          </p>
        </div>
      </div>
    </form>
  );
}

function MyFeedbackList({ items, loading }: { items: UserFeedbackItem[]; loading: boolean }) {
  if (loading) return <LoadingState label="Đang tải góp ý của bạn…" />;
  if (items.length === 0) return null;
  return (
    <section className="resource-panel resource-panel--wide">
      <p className="section-note">Lịch sử</p>
      <h2>Góp ý bạn đã gửi</h2>
      <ul className="mt-4 grid gap-3" aria-label="Danh sách góp ý đã gửi">
        {items.map((item) => (
          <li key={item.id} className="rounded-sm border border-gray-200 bg-gray-50 p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <span className="rounded-sm bg-brand-600/10 px-2 py-0.5 font-semibold text-brand-700">
                {CATEGORY_LABELS.get(item.category) ?? item.category}
              </span>
              <span className="rounded-sm bg-gray-200 px-2 py-0.5 font-medium text-gray-700">
                {STATUS_LABELS[item.status]}
              </span>
              <time dateTime={item.createdAt}>
                {formatDateTime(item.createdAt)}
              </time>
            </div>
            <h3 className="mt-2 text-base font-semibold text-gray-900">{item.subject}</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{item.message}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function FeedbackPage() {
  const session = useAuthSession();
  const hydrationStatus = useAuthSessionStatus();
  const [items, setItems] = useState<UserFeedbackItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const refreshList = useCallback(async () => {
    setListLoading(true);
    try {
      setItems(await listMyFeedback());
    } catch {
      // The submit flow still works when the history list cannot be loaded.
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hydrationStatus !== "settled" || !session) return;
    let cancelled = false;
    const task = Promise.resolve().then(async () => {
      if (!cancelled) await refreshList();
    });
    return () => {
      cancelled = true;
      void task;
    };
  }, [hydrationStatus, session, refreshList]);

  const handleSubmitted = useCallback((item: UserFeedbackItem) => {
    setItems((current) => [item, ...current].slice(0, 20));
    setSubmitted(true);
  }, []);

  return (
    <PublicPageShell>
      <div className="resource-page section-inner">
        <header className="resource-page__header">
          <p className="section-note">Lắng nghe từ bạn</p>
          <h1>Góp ý với HealthCare</h1>
          <p>
            Chia sẻ trải nghiệm, báo lỗi hoặc đề xuất cải tiến. Mỗi góp ý được gắn với tài khoản để
            đội ngũ có thể theo dõi và phản hồi.
          </p>
        </header>

        {hydrationStatus === "indeterminate" ? (
          <section className="resource-panel portal-state portal-state--error" role="alert">
            <span aria-hidden="true" className="portal-state__mark">!</span>
            <div>
              <h2>Không thể xác minh phiên đăng nhập</h2>
              <p>Kết nối đến máy chủ xác thực đang gián đoạn. Vui lòng thử lại.</p>
              <button
                className="button button--primary min-h-11"
                type="button"
                onClick={() => void hydrateAuthSession(true)}
              >
                Thử xác minh lại
              </button>
            </div>
          </section>
        ) : hydrationStatus !== "settled" ? (
          <LoadingState label="Đang xác minh phiên đăng nhập…" />
        ) : !session ? (
          <FeedbackLoginGate />
        ) : (
          <>
            {submitted ? (
              <p className="mb-4 rounded-sm border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
                Cảm ơn bạn! Góp ý đã được ghi nhận và sẽ được đội ngũ HealthCare xem xét sớm.
              </p>
            ) : null}
            <div className="resource-grid resource-grid--two">
              <FeedbackForm onSubmitted={handleSubmitted} />
              <section className="resource-panel resource-panel--accent">
                <p className="section-note">Cam kết</p>
                <h2>Góp ý của bạn đi đến đâu?</h2>
                <ul className="resource-list">
                  <li><strong>Báo lỗi hệ thống</strong><span>Chuyển thẳng tới đội kỹ thuật để tái hiện và xử lý.</span></li>
                  <li><strong>Đề xuất tính năng</strong><span>Được cân nhắc trong lộ trình phát triển sản phẩm.</span></li>
                  <li><strong>Chất lượng dịch vụ</strong><span>Chuyển tới ban quản lý cơ sở liên quan.</span></li>
                </ul>
                <p className="resource-muted mt-4">
                  Cần hỗ trợ y tế hoặc lịch hẹn? Hãy dùng <Link className="text-button" href="/contact">kênh liên hệ</Link> hoặc <Link className="text-button" href="/dat-lich">đặt lịch khám</Link> để được phục vụ nhanh hơn.
                </p>
              </section>
            </div>
            <MyFeedbackList items={items} loading={listLoading} />
          </>
        )}
      </div>
    </PublicPageShell>
  );
}
