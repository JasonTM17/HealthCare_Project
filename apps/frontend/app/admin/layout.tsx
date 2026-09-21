"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import AdminState from "./_components/AdminState";
import {
  AUTH_SESSION_INDETERMINATE_MESSAGE,
  fetchNotifications,
  hasRole,
  hydrateAuthSession,
  logoutCurrentUser,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  SAFE_LOGOUT_ERROR_MESSAGE,
} from "../../lib/api-client";
import { formatNotificationType } from "../../components/PortalChrome";
import { formatBusinessDateTime } from "../../lib/business-time";
import {
  NOTIFICATION_POLL_INTERVAL_MS,
  startNotificationPoll,
} from "../../lib/notification-polling";
import type { Notification } from "../../types/hospital";
import UiIcon from "../../components/UiIcon";
import { useAuthSession, useAuthSessionStatus } from "../../components/useAuthSession";

const NAV = [
  { href: "/admin", label: "Tổng quan" },
  { href: "/admin/appointments", label: "Lịch hẹn" },
  { href: "/admin/payments", label: "Thanh toán" },
  { href: "/admin/doctors", label: "Bác sĩ" },
  { href: "/admin/specialties", label: "Chuyên khoa" },
  { href: "/admin/branches", label: "Cơ sở" },
  { href: "/admin/services", label: "Dịch vụ" },
  { href: "/admin/catalog", label: "Gói & bài viết" },
  { href: "/admin/schedules", label: "Lịch bác sĩ" },
  { href: "/admin/content", label: "CMS live" },
  { href: "/admin/ai-content-reviews", label: "AI review" },
  { href: "/admin/ai-credits", label: "AI credits" },
  { href: "/admin/health-questions", label: "Hỏi đáp sức khỏe" },
  { href: "/admin/consultations", label: "Tư vấn bệnh nhân" },
  { href: "/admin/careers", label: "Hồ sơ ứng tuyển" },
];

type GateState =
  | { status: "checking" }
  | { status: "unauthenticated" }
  | { status: "forbidden" }
  | { status: "ready"; displayName?: string };

function AdminAccessGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const session = useAuthSession();
  const hydrationStatus = useAuthSessionStatus();
  const [switchingAccount, setSwitchingAccount] = useState(false);
  const [switchAccountError, setSwitchAccountError] = useState<string | null>(null);
  const gate: GateState = hydrationStatus !== "settled"
    ? { status: "checking" }
    : !session
      ? { status: "unauthenticated" }
      : !hasRole(session.user, "ADMIN")
        ? { status: "forbidden" }
        : { status: "ready", displayName: session.user.displayName };

  const handleSwitchAccount = async (): Promise<void> => {
    if (switchingAccount) return;
    setSwitchingAccount(true);
    setSwitchAccountError(null);
    try {
      const outcome = await logoutCurrentUser();
      if (outcome.status === "LOGGED_OUT") {
        router.replace("/auth/login?next=%2Fadmin");
      } else {
        setSwitchAccountError(SAFE_LOGOUT_ERROR_MESSAGE);
      }
    } catch {
      setSwitchAccountError(SAFE_LOGOUT_ERROR_MESSAGE);
    } finally {
      setSwitchingAccount(false);
    }
  };

  if (hydrationStatus === "indeterminate") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-lg">
          <AdminState
            tone="error"
            title="Không thể xác định trạng thái phiên đăng nhập"
            description={AUTH_SESSION_INDETERMINATE_MESSAGE}
            action={(
              <div className="flex flex-wrap gap-3">
                <button className="min-h-11 rounded-lg bg-teal-800 px-4 text-sm font-bold text-white" onClick={() => void hydrateAuthSession(true)} type="button">Thử xác minh lại</button>
                <button className="min-h-11 rounded-lg border border-teal-800 px-4 text-sm font-bold text-teal-900" onClick={() => window.location.reload()} type="button">Tải lại trang</button>
              </div>
            )}
          />
        </div>
      </main>
    );
  }

  if (gate.status === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-lg">
          <AdminState tone="loading" title="Đang kiểm tra quyền truy cập" description="Chỉ tài khoản quản trị mới được mở khu vực vận hành." />
        </div>
      </main>
    );
  }

  if (gate.status === "unauthenticated") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-lg">
          <AdminState
            tone="forbidden"
            title="Cần đăng nhập để mở khu vực quản trị"
            description="Hãy đăng nhập bằng tài khoản quản trị để tiếp tục. Dữ liệu bệnh viện không được tải khi chưa xác thực."
            action={<div className="flex flex-wrap gap-3"><Link className="inline-flex min-h-11 items-center rounded-lg bg-teal-800 px-4 text-sm font-bold text-white" href="/auth/login?next=%2Fadmin">Đăng nhập</Link><Link className="inline-flex min-h-11 items-center px-2 text-sm font-bold text-teal-800 underline underline-offset-4" href="/">Về trang chính</Link></div>}
          />
        </div>
      </main>
    );
  }

  if (gate.status === "forbidden") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-lg">
          <AdminState
            tone="forbidden"
            title="Tài khoản không có quyền quản trị"
            description="Phiên hiện tại thuộc một vai trò khác. Bạn có thể đổi tài khoản hoặc quay về trang chính."
            action={(
              <div className="grid gap-3">
                <div className="flex flex-wrap gap-3">
                  <button className="min-h-11 rounded-lg bg-teal-800 px-4 text-sm font-bold text-white disabled:opacity-50" disabled={switchingAccount} onClick={() => void handleSwitchAccount()} type="button">{switchingAccount ? "Đang chuyển..." : "Đổi tài khoản"}</button>
                  <Link className="inline-flex min-h-11 items-center px-2 text-sm font-bold text-teal-800 underline underline-offset-4" href="/">Về trang chính</Link>
                </div>
                {switchAccountError ? <p aria-live="polite" className="text-sm font-semibold text-amber-900" role="status">{switchAccountError}</p> : null}
              </div>
            )}
          />
        </div>
      </main>
    );
  }

  return <AdminShell displayName={gate.displayName}>{children}</AdminShell>;
}

/**
 * Lightweight in-app notification bell for the admin shell. The backend
 * notifications API is role-agnostic (rows are scoped to the caller), so this
 * reuses the exact endpoints the patient portal uses. The badge derives from
 * the fetched page — there is no admin overview endpoint yet, same as the
 * doctor portal.
 */
function AdminNotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Returns the request promise so the shared poll can measure the in-flight
  // window instead of assuming a synchronous tick.
  const load = useCallback((): Promise<unknown> => {
    setLoading(true);
    return fetchNotifications(0, 20)
      .then((page) => {
        if (!page?.content) return;
        setItems(page.content);
        setUnread(page.content.filter((item) => !item.read).length);
      })
      .catch(() => {
        // Keep the last known badge; the bell is a convenience surface.
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // Defer off the effect body so the render→effect boundary stays free of
    // synchronous setState (same pattern as the portal load helpers).
    const task = Promise.resolve().then(load);
    return () => {
      void task;
    };
  }, [load]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    // Same bounded contract as the patient/doctor bell: an operations tab left
    // open all shift should advance its unread badge without a navigation.
    const poll = startNotificationPoll({
      tick: load,
      intervalMs: NOTIFICATION_POLL_INTERVAL_MS,
      timers: {
        schedule: (callback, delayMs) => window.setTimeout(callback, delayMs),
        cancel: (handle) => window.clearTimeout(handle as number),
      },
      hidden: () => document.hidden,
    });
    poll.setPaused(document.hidden);
    const handleVisibilityChange = (): void => {
      poll.setPaused(document.hidden);
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      poll.stop();
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onOutsideClick = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onOutsideClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onOutsideClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const handleSelect = async (notification: Notification): Promise<void> => {
    if (notification.read) return;
    try {
      await markNotificationAsRead(notification.id);
      setItems((current) => current.map((item) => (item.id === notification.id ? { ...item, read: true } : item)));
      setUnread((current) => Math.max(0, current - 1));
    } catch {
      // A failed mark-read must not break the dropdown.
    }
  };

  const handleMarkAll = async (): Promise<void> => {
    try {
      await markAllNotificationsAsRead();
      setItems((current) => current.map((item) => ({ ...item, read: true })));
      setUnread(0);
    } catch {
      // ignore — the badge refreshes on next load
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unread > 0 ? `Thông báo hệ thống (${unread} tin mới)` : "Thông báo hệ thống"}
        className="relative inline-flex min-h-11 w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-teal-800"
        onClick={() => {
          setOpen((value) => {
            if (!value) load();
            return !value;
          });
        }}
        title="Thông báo hệ thống"
        type="button"
      >
        <UiIcon name="bell" size={20} />
        {unread > 0 ? (
          <span className="absolute right-1.5 top-1.5 min-w-[18px] rounded-full bg-red-600 px-1 text-center text-[10px] font-bold leading-[18px] text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          aria-label="Thông báo hệ thống"
          className="absolute right-0 z-30 mt-2 w-80 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
          role="dialog"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <strong className="text-sm text-slate-900">Thông báo hệ thống</strong>
            {unread > 0 ? (
              <button className="text-xs font-bold text-teal-700 underline underline-offset-4" onClick={() => void handleMarkAll()} type="button">
                Đánh dấu đã đọc tất cả
              </button>
            ) : null}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">Đang tải thông báo…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">Chưa có thông báo nào.</p>
            ) : (
              items.map((item) => (
                <button
                  className={`block w-full border-b border-slate-50 px-4 py-3 text-left last:border-0 hover:bg-slate-50 ${item.read ? "" : "bg-teal-50/60"}`}
                  key={item.id}
                  onClick={() => void handleSelect(item)}
                  type="button"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                      {formatNotificationType(item.eventType)}
                    </span>
                    <time className="text-[10px] text-slate-400" dateTime={item.createdAt}>
                      {formatBusinessDateTime(item.createdAt)}
                    </time>
                  </span>
                  <span className="mt-1 block text-sm font-semibold text-slate-900">{item.title}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-slate-600">{item.message}</span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AdminShell({ children, displayName }: { children: ReactNode; displayName?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const handleLogout = async (): Promise<void> => {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError(null);
    try {
      const outcome = await logoutCurrentUser();
      if (outcome.status === "LOGGED_OUT") {
        router.replace("/auth/login");
      } else {
        setLogoutError(SAFE_LOGOUT_ERROR_MESSAGE);
      }
    } catch {
      setLogoutError(SAFE_LOGOUT_ERROR_MESSAGE);
    } finally {
      setLoggingOut(false);
    }
  };

  // The rail is position:sticky, which stays in normal flow — the shell must
  // be a flex row at lg or main would start one full viewport below it.
  return (
    <div className="admin-shell min-h-screen bg-slate-50 text-slate-900 lg:flex">
      <a className="skip-link" href="#main-content">Bỏ qua điều hướng</a>
      <aside className="border-b border-teal-900 bg-teal-950 text-white lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r lg:overflow-hidden">
        <div className="flex h-full flex-col p-5 overflow-hidden">
          <div className="shrink-0">
            <div className="flex items-center gap-3 text-teal-100"><UiIcon name="shield-check" size={24} /><strong className="text-lg">HealthCare</strong></div>
            <p className="mt-2 text-base font-bold">Điều hành bệnh viện</p>
            <p className="mt-2 text-xs leading-5 text-teal-100/75">
              {displayName ? `Xin chào, ${displayName}.` : "Tài khoản quản trị đã được xác thực."}
            </p>
          </div>

          <nav aria-label="Điều hướng quản trị" className="admin-nav mt-6 min-h-0 flex-1 overflow-y-auto">
            {NAV.map((item) => {
              const active = item.href === "/admin"
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`admin-nav__link ${
                    active ? "bg-teal-700 font-bold text-white" : "bg-teal-950 text-teal-100/80 hover:bg-teal-900 hover:text-white"
                  }`}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-6 grid gap-2 border-t border-teal-900 pt-5 lg:mt-auto shrink-0">
            <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-teal-100/75 hover:text-white" href="/">Về trang chính</Link>
            <button className="min-h-11 w-fit text-left text-sm font-semibold text-amber-200 hover:text-amber-100 disabled:opacity-50" disabled={loggingOut} onClick={() => void handleLogout()} type="button">
              {loggingOut ? "Đang đăng xuất..." : "Đăng xuất"}
            </button>
            {logoutError ? <p aria-live="polite" className="text-xs font-semibold leading-5 text-amber-100" role="status">{logoutError}</p> : null}
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8" id="main-content" tabIndex={-1}>
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex items-start justify-between gap-4 border-b border-teal-200 bg-teal-50 px-4 py-3 text-sm leading-6 text-teal-950">
            <p className="admin-scope-note">
              <strong>Phạm vi quản trị:</strong> nội dung công khai, lịch làm việc và dữ liệu vận hành chỉ hiển thị theo quyền của tài khoản hiện tại.
            </p>
            <div className="shrink-0 pt-1">
              <AdminNotificationBell />
            </div>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminAccessGate>{children}</AdminAccessGate>;
}
