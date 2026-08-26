"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import PortalChrome from "../../../components/PortalChrome";
import { ForbiddenState, LoadingState, LoginRequiredState } from "../../../components/PortalStates";
import { useAuthSession } from "../../../components/useAuthSession";
import {
  ApiError,
  clearAuthSession,
  fetchNotificationPreferences,
  hasRole,
  updateNotificationPreference,
} from "../../../lib/api-client";
import type {
  AuthUser,
  NotificationCategory,
  NotificationChannel,
  NotificationPreference,
} from "../../../types/hospital";

const CATEGORY_ORDER: NotificationCategory[] = [
  "SECURITY",
  "APPOINTMENT",
  "PAYMENT",
  "CLINICAL_UPDATE",
  "CONSULTATION",
  "CARE_PLAN",
  "MARKETING",
];

const CHANNEL_ORDER: NotificationChannel[] = ["EMAIL", "IN_APP"];

const TIMEZONE_OPTIONS = [
  { value: "Asia/Ho_Chi_Minh", label: "Việt Nam (GMT+7)" },
  { value: "Asia/Bangkok", label: "Bangkok (GMT+7)" },
  { value: "Asia/Singapore", label: "Singapore (GMT+8)" },
  { value: "Asia/Tokyo", label: "Tokyo (GMT+9)" },
  { value: "Australia/Sydney", label: "Sydney" },
  { value: "Europe/London", label: "London" },
  { value: "America/New_York", label: "New York" },
  { value: "America/Los_Angeles", label: "Los Angeles" },
] as const;

const LOCKED_CATEGORIES = new Set<NotificationCategory>(["SECURITY", "APPOINTMENT", "PAYMENT"]);

const CATEGORY_COPY: Record<NotificationCategory, { title: string; description: string }> = {
  SECURITY: {
    title: "Bảo mật tài khoản",
    description: "Xác minh đăng nhập, thay đổi an toàn và cảnh báo bảo vệ tài khoản.",
  },
  APPOINTMENT: {
    title: "Lịch hẹn",
    description: "Nhắc lịch khám, thay đổi giờ hẹn và thông báo điều phối quan trọng.",
  },
  PAYMENT: {
    title: "Thanh toán",
    description: "Xác nhận giao dịch, đối soát và thông báo tài chính cần thiết.",
  },
  CLINICAL_UPDATE: {
    title: "Cập nhật lâm sàng",
    description: "Kết quả, phác đồ và các cập nhật chuyên môn đã được duyệt.",
  },
  CONSULTATION: {
    title: "Tư vấn riêng",
    description: "Tin nhắn từ bác sĩ, điều phối và cập nhật phiên tư vấn.",
  },
  CARE_PLAN: {
    title: "Kế hoạch chăm sóc",
    description: "Nhắc việc theo dõi, mốc chăm sóc và các việc cần làm tiếp theo.",
  },
  MARKETING: {
    title: "Tin tức sức khỏe",
    description: "Nội dung dịch vụ và tin cập nhật phù hợp với tài khoản của bạn.",
  },
};

const CHANNEL_COPY: Record<NotificationChannel, { title: string; description: string }> = {
  EMAIL: {
    title: "Email",
    description: "Gửi tới hộp thư của bạn.",
  },
  IN_APP: {
    title: "Trong ứng dụng",
    description: "Hiển thị trong cổng bệnh nhân.",
  },
};

type PreferenceKey = `${NotificationCategory}:${NotificationChannel}`;

interface NotificationChannelState {
  channel: NotificationChannel;
  title: string;
  description: string;
  enabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  timezone: string;
}

interface NotificationCategoryState {
  category: NotificationCategory;
  title: string;
  description: string;
  locked: boolean;
  channels: NotificationChannelState[];
}

type PreferencesState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error"; message: string; statusCode?: number }
  | { status: "ready"; cards: NotificationCategoryState[]; baseline: Record<PreferenceKey, PreferenceSnapshot> };

interface PreferenceSnapshot {
  enabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  timezone: string;
}

interface FlashNotice {
  kind: "success" | "error";
  message: string;
}

function preferenceKey(category: NotificationCategory, channel: NotificationChannel): PreferenceKey {
  return `${category}:${channel}`;
}

function defaultPreferenceEnabled(category: NotificationCategory): boolean {
  return category !== "MARKETING";
}

function snapshotChannel(channel: NotificationChannelState): PreferenceSnapshot {
  return {
    enabled: channel.enabled,
    quietHoursStart: channel.quietHoursStart,
    quietHoursEnd: channel.quietHoursEnd,
    timezone: channel.timezone,
  };
}

function snapshotsEqual(first: PreferenceSnapshot | undefined, second: PreferenceSnapshot): boolean {
  return Boolean(first)
    && first?.enabled === second.enabled
    && first.quietHoursStart === second.quietHoursStart
    && first.quietHoursEnd === second.quietHoursEnd
    && first.timezone === second.timezone;
}

function buildBaseline(cards: NotificationCategoryState[]): Record<PreferenceKey, PreferenceSnapshot> {
  return Object.fromEntries(
    cards.flatMap((card) => card.channels.map((channel) => [
      preferenceKey(card.category, channel.channel),
      snapshotChannel(channel),
    ] as const)),
  ) as Record<PreferenceKey, PreferenceSnapshot>;
}

function buildNotificationCards(rows: NotificationPreference[]): NotificationCategoryState[] {
  const byKey = new Map(rows.map((row) => [preferenceKey(row.category, row.channel), row] as const));
  return CATEGORY_ORDER.map((category) => ({
    category,
    title: CATEGORY_COPY[category].title,
    description: CATEGORY_COPY[category].description,
    locked: LOCKED_CATEGORIES.has(category),
    channels: CHANNEL_ORDER.map((channel) => {
      const preference = byKey.get(preferenceKey(category, channel));
      return {
        channel,
        title: CHANNEL_COPY[channel].title,
        description: CHANNEL_COPY[channel].description,
        enabled: LOCKED_CATEGORIES.has(category) ? true : preference?.enabled ?? defaultPreferenceEnabled(category),
        quietHoursStart: preference?.quietHoursStart ?? null,
        quietHoursEnd: preference?.quietHoursEnd ?? null,
        timezone: preference?.timezone ?? "Asia/Ho_Chi_Minh",
      };
    }),
  }));
}

function getPreferencesError(error: unknown, phase: "load" | "save"): { message: string; statusCode?: number } {
  const statusCode = error instanceof ApiError ? error.status : undefined;
  if (statusCode === 401) return { message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", statusCode };
  if (statusCode === 403) return { message: "Tài khoản hiện tại chưa được phép chỉnh thông báo.", statusCode };
  if (statusCode === 404) {
    return phase === "load"
      ? { message: "Không tìm thấy cấu hình thông báo của tài khoản.", statusCode }
      : { message: "Không tìm thấy kênh thông báo cần lưu.", statusCode };
  }
  if (statusCode === 400 || statusCode === 409 || statusCode === 422) {
    return { message: "Cấu hình thông báo đã thay đổi. Vui lòng tải lại rồi thử lại.", statusCode };
  }
  if (statusCode === 429) return { message: "Bạn đang thay đổi quá nhanh. Vui lòng chờ rồi thử lại.", statusCode };
  if (statusCode && statusCode >= 500) return { message: "Dịch vụ thông báo tạm thời không khả dụng.", statusCode };
  return phase === "load"
    ? { message: "Không thể tải cấu hình thông báo. Vui lòng thử lại.", statusCode }
    : { message: "Không thể lưu thay đổi thông báo. Vui lòng thử lại.", statusCode };
}

function AccountSummary({ user }: { user: AuthUser }) {
  return (
    <section aria-labelledby="account-summary-title" className="preferences-account">
      <div>
        <p className="section-note">TÀI KHOẢN BỆNH NHÂN</p>
        <h2 id="account-summary-title">Thông tin tài khoản</h2>
      </div>
      <dl className="preferences-account__list">
        <div>
          <dt>Họ và tên</dt>
          <dd>{user.displayName}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{user.email}</dd>
        </div>
        <div>
          <dt>Trạng thái email</dt>
          <dd>{user.emailVerified === false ? "Chưa xác minh" : "Đã xác minh"}</dd>
        </div>
      </dl>
    </section>
  );
}

export default function PatientPreferencesPage() {
  const session = useAuthSession();
  const user = session?.user ?? null;
  const authState: "ready" | "unauthenticated" | "forbidden" = !session
    ? "unauthenticated"
    : hasRole(session.user, "PATIENT")
      ? "ready"
      : "forbidden";
  const [state, setState] = useState<PreferencesState>({ status: "loading" });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<FlashNotice | null>(null);
  const requestEpoch = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const saveEpoch = useRef(0);
  const activeSave = useRef<AbortController | null>(null);

  const loadPreferences = useCallback(async () => {
    if (!session || !hasRole(session.user, "PATIENT")) return;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const epoch = ++requestEpoch.current;
    setState({ status: "loading" });
    setNotice(null);
    try {
      const rows = await fetchNotificationPreferences({ signal: controller.signal });
      if (controller.signal.aborted || epoch !== requestEpoch.current) return;
      if (rows.length === 0) {
        setState({ status: "empty" });
        return;
      }
      const cards = buildNotificationCards(rows);
      setState({ status: "ready", cards, baseline: buildBaseline(cards) });
    } catch (error) {
      if (controller.signal.aborted || epoch !== requestEpoch.current) return;
      const detail = getPreferencesError(error, "load");
      if (detail.statusCode === 401) clearAuthSession();
      setState({ status: "error", ...detail });
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null;
    }
  }, [session]);

  useEffect(() => {
    const task = Promise.resolve().then(() => loadPreferences());
    return () => {
      requestEpoch.current += 1;
      activeRequest.current?.abort();
      activeRequest.current = null;
      saveEpoch.current += 1;
      activeSave.current?.abort();
      activeSave.current = null;
    };
  }, [loadPreferences]);

  if (authState === "unauthenticated") {
    return <main className="portal-entry"><LoginRequiredState nextPath="/patient/preferences" /></main>;
  }
  if (authState === "forbidden" || !user) {
    return (
      <main className="portal-entry">
        <ForbiddenState description="Tài khoản hiện tại không có vai trò bệnh nhân." title="Không thể mở tùy chọn thông báo">
          <Link className="outline-button outline-button--small" href="/">Về trang chính</Link>
        </ForbiddenState>
      </main>
    );
  }

  const handleToggle = (category: NotificationCategory, channel: NotificationChannel, enabled: boolean) => {
    if (saving) return;
    setState((current) => {
      if (current.status !== "ready") return current;
      return {
        ...current,
        cards: current.cards.map((card) => {
          if (card.category !== category) return card;
          if (card.locked) return card;
          return {
            ...card,
            channels: card.channels.map((item) => (
              item.channel === channel ? { ...item, enabled } : item
            )),
          };
        }),
      };
    });
    setNotice(null);
  };

  const handleScheduleChange = (
    category: NotificationCategory,
    field: "quietHoursStart" | "quietHoursEnd" | "timezone",
    value: string,
  ) => {
    if (saving || LOCKED_CATEGORIES.has(category)) return;
    setState((current) => {
      if (current.status !== "ready") return current;
      return {
        ...current,
        cards: current.cards.map((card) => card.category === category
          ? {
              ...card,
              channels: card.channels.map((channel) => ({
                ...channel,
                [field]: field === "timezone" ? value : value || null,
              })),
            }
          : card),
      };
    });
    setNotice(null);
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (state.status !== "ready" || saving) return;

    const invalidSchedule = state.cards.some((card) => !card.locked && card.channels.some((channel) => (
      Boolean(channel.quietHoursStart) !== Boolean(channel.quietHoursEnd)
    )));
    if (invalidSchedule) {
      setNotice({ kind: "error", message: "Vui lòng chọn đủ giờ bắt đầu và kết thúc, hoặc để trống cả hai." });
      return;
    }

    const changes = state.cards.flatMap((card) => card.channels.flatMap((channel) => {
      const key = preferenceKey(card.category, channel.channel);
      const snapshot = snapshotChannel(channel);
      const baseline = state.baseline[key];
      return snapshotsEqual(state.baseline[key], snapshot)
        ? []
        : [{
            category: card.category,
            channel: channel.channel,
            ...snapshot,
            clearQuietHours: snapshot.quietHoursStart === null
              && snapshot.quietHoursEnd === null
              && Boolean(baseline?.quietHoursStart || baseline?.quietHoursEnd),
          }];
    }));
    if (changes.length === 0) {
      setNotice({ kind: "success", message: "Không có thay đổi nào cần lưu." });
      return;
    }

    activeSave.current?.abort();
    const controller = new AbortController();
    activeSave.current = controller;
    const epoch = ++saveEpoch.current;
    setSaving(true);
    setNotice(null);
    let completed = 0;
    try {
      for (const change of changes) {
        await updateNotificationPreference(change.category, change.channel, {
          enabled: change.enabled,
          quietHoursStart: change.quietHoursStart,
          quietHoursEnd: change.quietHoursEnd,
          timezone: change.timezone,
          clearQuietHours: change.clearQuietHours,
        }, { signal: controller.signal });
        if (controller.signal.aborted || epoch !== saveEpoch.current) return;
        completed += 1;
      }
      if (controller.signal.aborted || epoch !== saveEpoch.current) return;
      setState((current) => (current.status === "ready"
        ? { status: "ready", cards: current.cards, baseline: buildBaseline(current.cards) }
        : current));
      setNotice({ kind: "success", message: `Đã lưu ${changes.length} thay đổi thông báo.` });
    } catch (error) {
      if (controller.signal.aborted || epoch !== saveEpoch.current) return;
      const detail = getPreferencesError(error, "save");
      if (detail.statusCode === 401) clearAuthSession();
      if (completed > 0) {
        await loadPreferences();
      }
      if (controller.signal.aborted || epoch !== saveEpoch.current) return;
      setNotice({ kind: "error", message: detail.message });
    } finally {
      if (activeSave.current === controller) {
        activeSave.current = null;
        setSaving(false);
      }
    }
  };

  const dirtyCount = state.status === "ready"
    ? state.cards.flatMap((card) => card.channels.filter((channel) => (
      !snapshotsEqual(
        state.baseline[preferenceKey(card.category, channel.channel)],
        snapshotChannel(channel),
      )
    ))).length
    : 0;

  return (
    <PortalChrome role="PATIENT" user={user}>
      <div className="portal-content preferences-page">
        <header className="portal-hero">
          <div>
            <p className="section-note">TÀI KHOẢN</p>
            <h1>Tùy chọn thông báo</h1>
            <p>Quản lý email và thông báo trong ứng dụng cho từng nhóm chăm sóc. Bảo mật, lịch hẹn và thanh toán luôn được bảo vệ ở trạng thái khóa.</p>
          </div>
          <div className="portal-hero__actions">
            <Link className="outline-button" href="/patient/dashboard">Về tổng quan</Link>
          </div>
        </header>

        <div className="preferences-layout">
          <AccountSummary user={user} />
          <section aria-labelledby="preferences-title" className="preferences-card">
            <div className="preferences-card__heading">
              <div>
                <p className="section-note">THÔNG BÁO</p>
                <h2 id="preferences-title">Bật tắt theo kênh</h2>
                <p className="preferences-card__lede">
                  Bảo mật, lịch hẹn và thanh toán được khóa để luôn bật; các nhóm còn lại có thể điều chỉnh theo nhu cầu của bạn.
                </p>
              </div>
              <button className="text-button" disabled={state.status === "loading" || saving} onClick={() => void loadPreferences()} type="button">
                Làm mới
              </button>
            </div>

            {state.status === "loading" ? <LoadingState label="Đang tải tùy chọn thông báo..." /> : null}
            {state.status === "error" ? (
              <div aria-live="assertive" className="preferences-state preferences-state--error" role="alert">
                <h3>Không thể tải tùy chọn thông báo</h3>
                <p>{state.message}</p>
                <button className="outline-button outline-button--small" onClick={() => void loadPreferences()} type="button">Thử lại</button>
              </div>
            ) : null}
            {state.status === "empty" ? (
              <div aria-live="polite" className="preferences-state preferences-state--empty" role="status">
                <h3>Chưa có dữ liệu tùy chọn riêng</h3>
                <p>Hệ thống sẽ dùng thiết lập an toàn mặc định cho tài khoản của bạn.</p>
                <button className="outline-button outline-button--small" onClick={() => void loadPreferences()} type="button">Thử tải lại</button>
              </div>
            ) : null}
            {state.status === "ready" ? (
              <form aria-busy={saving} className="preferences-form" onSubmit={handleSave}>
                <div className="notification-preferences-grid">
                  {state.cards.map((card) => (
                    <article
                      className={card.locked ? "notification-preference-card notification-preference-card--locked" : "notification-preference-card"}
                      key={card.category}
                    >
                      <div className="notification-preference-card__header">
                        <div>
                          <p className="section-note">{card.locked ? "BẮT BUỘC" : "TÙY CHỌN"}</p>
                          <h3>{card.title}</h3>
                        </div>
                        <span className={card.locked ? "notification-preference-card__badge notification-preference-card__badge--locked" : "notification-preference-card__badge"}>
                          {card.locked ? "Khóa" : "Điều chỉnh"}
                        </span>
                      </div>
                      <p className="notification-preference-card__description">{card.description}</p>
                      {card.locked ? <p className="notification-preference-card__hint">Kênh này luôn bật để bảo vệ tài khoản và giao dịch.</p> : null}
                      <div className="notification-preference-card__channels">
                        {card.channels.map((channel) => (
                          <label
                            className={card.locked ? "notification-preference-toggle notification-preference-toggle--locked" : "notification-preference-toggle"}
                            key={channel.channel}
                          >
                            <span>
                              <strong>{channel.title}</strong>
                              <small>{channel.description}</small>
                            </span>
                            <span className="notification-preference-toggle__control">
                              <span className="notification-preference-toggle__state">{channel.enabled ? "Bật" : "Tắt"}</span>
                              <input
                                aria-label={`${card.title} - ${channel.title}`}
                                checked={channel.enabled}
                                disabled={saving || card.locked}
                                onChange={(event) => handleToggle(card.category, channel.channel, event.target.checked)}
                                type="checkbox"
                              />
                            </span>
                          </label>
                        ))}
                      </div>
                      {!card.locked ? (
                        <fieldset className="notification-preference-card__schedule" disabled={saving}>
                          <legend>Giờ yên tĩnh</legend>
                          <p>Chỉ hoãn nhắc nhở tùy chọn; thông báo bảo mật và giao dịch quan trọng vẫn được gửi.</p>
                          <div className="notification-preference-card__schedule-grid">
                            <label>
                              <span>Từ</span>
                              <input
                                aria-label={`${card.title} - giờ yên tĩnh bắt đầu`}
                                onChange={(event) => handleScheduleChange(card.category, "quietHoursStart", event.target.value)}
                                type="time"
                                value={card.channels[0]?.quietHoursStart ?? ""}
                              />
                            </label>
                            <label>
                              <span>Đến</span>
                              <input
                                aria-label={`${card.title} - giờ yên tĩnh kết thúc`}
                                onChange={(event) => handleScheduleChange(card.category, "quietHoursEnd", event.target.value)}
                                type="time"
                                value={card.channels[0]?.quietHoursEnd ?? ""}
                              />
                            </label>
                            <label className="notification-preference-card__timezone">
                              <span>Múi giờ</span>
                              <select
                                aria-label={`${card.title} - múi giờ`}
                                onChange={(event) => handleScheduleChange(card.category, "timezone", event.target.value)}
                                value={card.channels[0]?.timezone ?? "Asia/Ho_Chi_Minh"}
                              >
                                {TIMEZONE_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                            </label>
                          </div>
                        </fieldset>
                      ) : null}
                    </article>
                  ))}
                </div>

                {notice ? (
                  <p
                    aria-live="polite"
                    className={notice.kind === "success" ? "preferences-notice" : "preferences-notice preferences-notice--error"}
                    role={notice.kind === "success" ? "status" : "alert"}
                  >
                    {notice.message}
                  </p>
                ) : null}
                <div className="preferences-form__actions">
                  <p className="preferences-form__summary">
                    {dirtyCount > 0 ? `Có ${dirtyCount} thay đổi chưa lưu.` : "Không có thay đổi nào chưa lưu."}
                  </p>
                  <button
                    className="button button--primary preferences-form__submit"
                    disabled={saving || dirtyCount === 0}
                    type="submit"
                  >
                    {saving ? "Đang lưu..." : "Lưu thay đổi"}
                  </button>
                </div>
              </form>
            ) : null}
          </section>
        </div>
      </div>
    </PortalChrome>
  );
}
