"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import PortalChrome from "../../../components/PortalChrome";
import { ForbiddenState, LoadingState, LoginRequiredState } from "../../../components/PortalStates";
import { useAuthSession } from "../../../components/useAuthSession";
import {
  ApiError,
  clearAuthSession,
  fetchUserPreferences,
  hasRole,
  updateUserPreferences,
} from "../../../lib/api-client";
import type { AuthUser, UserPreferences } from "../../../types/hospital";

const DEFAULT_PREFERENCES: UserPreferences = {
  emailNotifications: true,
  appointmentReminders: true,
  marketingEmails: false,
  locale: "vi-VN",
  timezone: "Asia/Ho_Chi_Minh",
};

type PreferencesState =
  | { status: "loading" }
  | { status: "ready"; data: UserPreferences }
  | { status: "error"; message: string; statusCode?: number };

function getPreferencesError(error: unknown): { message: string; statusCode?: number } {
  const statusCode = error instanceof ApiError ? error.status : undefined;
  if (statusCode === 401) return { message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", statusCode };
  if (statusCode === 403) return { message: "Tài khoản hiện tại chưa được phép xem tùy chọn này.", statusCode };
  if (statusCode === 404) return { message: "Tùy chọn tài khoản chưa sẵn sàng. Vui lòng thử lại sau.", statusCode };
  if (statusCode && statusCode >= 500) return { message: "Dịch vụ tài khoản tạm thời không khả dụng.", statusCode };
  return { message: "Không thể tải tùy chọn tài khoản. Vui lòng thử lại.", statusCode };
}

function booleanPreference(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizePreferences(value: UserPreferences | null | undefined): UserPreferences {
  const source = (value ?? {}) as UserPreferences & Record<string, unknown>;
  return {
    emailNotifications: booleanPreference(source.emailNotifications ?? source.emailNotificationsEnabled, DEFAULT_PREFERENCES.emailNotifications),
    appointmentReminders: booleanPreference(source.appointmentReminders ?? source.appointmentRemindersEnabled, DEFAULT_PREFERENCES.appointmentReminders),
    marketingEmails: booleanPreference(source.marketingEmails ?? source.marketingEmailsEnabled, DEFAULT_PREFERENCES.marketingEmails),
    locale: typeof source.locale === "string" && source.locale.trim() ? source.locale : DEFAULT_PREFERENCES.locale,
    timezone: typeof source.timezone === "string" && source.timezone.trim() ? source.timezone : DEFAULT_PREFERENCES.timezone,
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : null,
  };
}

function AccountSummary({ user }: { user: AuthUser }) {
  return (
    <section aria-labelledby="account-summary-title" className="preferences-account">
      <div>
        <p className="section-note">TÀI KHOẢN BỆNH NHÂN</p>
        <h2 id="account-summary-title">Thông tin tài khoản</h2>
      </div>
      <dl className="preferences-account__list">
        <div><dt>Họ và tên</dt><dd>{user.displayName}</dd></div>
        <div><dt>Email</dt><dd>{user.email}</dd></div>
        <div><dt>Trạng thái email</dt><dd>{user.emailVerified === false ? "Chưa xác minh" : "Đã xác minh"}</dd></div>
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
  const [notice, setNotice] = useState<string | null>(null);
  const [usingDefaults, setUsingDefaults] = useState(false);

  const loadPreferences = useCallback(async () => {
    if (!session || !hasRole(session.user, "PATIENT")) return;
    setState({ status: "loading" });
    setNotice(null);
    try {
      const loaded = await fetchUserPreferences();
      setUsingDefaults(!loaded);
      setState({ status: "ready", data: normalizePreferences(loaded) });
    } catch (error) {
      const detail = getPreferencesError(error);
      if (detail.statusCode === 401) clearAuthSession();
      setState({ status: "error", ...detail });
    }
  }, [session]);

  useEffect(() => {
    const task = Promise.resolve().then(() => loadPreferences());
    return () => void task;
  }, [loadPreferences]);

  if (authState === "unauthenticated") {
    return <main className="portal-entry"><LoginRequiredState nextPath="/patient/preferences" /></main>;
  }
  if (authState === "forbidden" || !user) {
    return (
      <main className="portal-entry">
        <ForbiddenState description="Tài khoản hiện tại không có vai trò bệnh nhân." title="Không thể mở tùy chọn tài khoản">
          <Link className="outline-button outline-button--small" href="/">Về trang chính</Link>
        </ForbiddenState>
      </main>
    );
  }

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (state.status !== "ready" || saving) return;
    setSaving(true);
    setNotice(null);
    try {
      const saved = await updateUserPreferences(state.data);
      setState({ status: "ready", data: normalizePreferences(saved) });
      setUsingDefaults(false);
      setNotice("Đã lưu tùy chọn tài khoản.");
    } catch (error) {
      const detail = getPreferencesError(error);
      if (detail.statusCode === 401) clearAuthSession();
      setNotice(detail.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <PortalChrome role="PATIENT" user={user}>
      <div className="portal-content preferences-page">
        <header className="portal-hero">
          <div>
            <p className="section-note">TÀI KHOẢN</p>
            <h1>Thông tin và tùy chọn</h1>
            <p>Kiểm soát các email liên quan đến lịch khám và cách HealthCare liên hệ với bạn.</p>
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
                <h2 id="preferences-title">Tùy chọn liên hệ</h2>
              </div>
              <button className="text-button" disabled={state.status === "loading" || saving} onClick={() => void loadPreferences()} type="button">Làm mới</button>
            </div>

            {state.status === "loading" ? <LoadingState label="Đang tải tùy chọn tài khoản..." /> : null}
            {state.status === "error" ? (
              <div aria-live="assertive" className="preferences-state preferences-state--error" role="alert">
                <h3>Không thể tải tùy chọn</h3>
                <p>{state.message}</p>
                <button className="outline-button outline-button--small" onClick={() => void loadPreferences()} type="button">Thử lại</button>
              </div>
            ) : null}
            {state.status === "ready" ? (
              <form className="preferences-form" onSubmit={handleSave}>
                {usingDefaults ? <p className="preferences-state preferences-state--empty" role="status">Chưa có tùy chọn lưu riêng. Đang dùng thiết lập mặc định.</p> : null}
                <label className="preferences-option">
                  <input checked={state.data.emailNotifications} disabled={saving} onChange={(event) => setState({ status: "ready", data: { ...state.data, emailNotifications: event.target.checked } })} type="checkbox" />
                  <span><strong>Email tài khoản</strong><small>Nhận thông tin bảo mật và thay đổi quan trọng liên quan đến tài khoản.</small></span>
                </label>
                <div className="preferences-form__selects">
                  <label className="auth-form__field" htmlFor="preferences-locale"><span>Ngôn ngữ</span>
                    <select id="preferences-locale" value={state.data.locale} disabled={saving} onChange={(event) => setState({ status: "ready", data: { ...state.data, locale: event.target.value } })}>
                      <option value="vi-VN">Tiếng Việt</option>
                      <option value="en-US">English</option>
                    </select>
                  </label>
                  <label className="auth-form__field" htmlFor="preferences-timezone"><span>Múi giờ</span>
                    <select id="preferences-timezone" value={state.data.timezone} disabled={saving} onChange={(event) => setState({ status: "ready", data: { ...state.data, timezone: event.target.value } })}>
                      <option value="Asia/Ho_Chi_Minh">GMT+07:00 Việt Nam</option>
                      <option value="UTC">UTC</option>
                    </select>
                  </label>
                </div>
                <label className="preferences-option">
                  <input checked={state.data.appointmentReminders} disabled={saving} onChange={(event) => setState({ status: "ready", data: { ...state.data, appointmentReminders: event.target.checked } })} type="checkbox" />
                  <span><strong>Nhắc lịch khám</strong><small>Nhận nhắc nhở và cập nhật về lịch hẹn của bạn.</small></span>
                </label>
                <label className="preferences-option">
                  <input checked={state.data.marketingEmails} disabled={saving} onChange={(event) => setState({ status: "ready", data: { ...state.data, marketingEmails: event.target.checked } })} type="checkbox" />
                  <span><strong>Thông tin chăm sóc sức khỏe</strong><small>Nhận nội dung sức khỏe và thông tin dịch vụ phù hợp.</small></span>
                </label>
                {notice ? <p aria-live="polite" className={notice.startsWith("Đã") ? "preferences-notice" : "preferences-notice preferences-notice--error"} role={notice.startsWith("Đã") ? "status" : "alert"}>{notice}</p> : null}
                <button className="button button--primary preferences-form__submit" disabled={saving} type="submit">{saving ? "Đang lưu..." : "Lưu tùy chọn"}</button>
              </form>
            ) : null}
          </section>
        </div>
      </div>
    </PortalChrome>
  );
}
