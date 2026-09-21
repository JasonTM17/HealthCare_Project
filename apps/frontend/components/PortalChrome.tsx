"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { AuthUser, Notification } from "../types/hospital";
import {
  fetchDoctorProfile,
  fetchNotifications,
  fetchPatientOverview,
  fetchPatientProfile,
  logoutCurrentUser,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  SAFE_LOGOUT_ERROR_MESSAGE,
} from "../lib/api-client";
import { formatBusinessDateTime } from "../lib/business-time";
import {
  NOTIFICATION_POLL_INTERVAL_MS,
  startNotificationPoll,
} from "../lib/notification-polling";
import BrandMark from "./BrandMark";
import UiIcon from "./UiIcon";

export type PortalRole = "PATIENT" | "DOCTOR";

const ROLE_LABEL: Record<PortalRole, string> = {
  PATIENT: "Cổng bệnh nhân",
  DOCTOR: "Cổng bác sĩ",
};


interface PortalChromeProps {
  role: PortalRole;
  user: AuthUser;
  avatarUrl?: string | null;
  children: ReactNode;
}
const AVATAR_MEMORY_CACHE: Record<string, string> = {};

function getCachedAvatar(role: PortalRole, userId: string, propAvatar?: string | null): string | null {
  if (propAvatar) return propAvatar;
  const key = `${role}:${userId}`;
  return AVATAR_MEMORY_CACHE[key] ?? null;
}

function setCachedAvatar(role: PortalRole, userId: string, url: string): void {
  const key = `${role}:${userId}`;
  AVATAR_MEMORY_CACHE[key] = url;
}

const SECTION_HASH_FOR_HREF: Record<string, string> = {
  "/doctor/appointments": "#daily-appointments",
  "/patient/appointments": "#appointments",
  "/patient/medical-records": "#records",
  "/patient/prescriptions": "#prescriptions",
  "/patient/diagnostic-results": "#diagnostics",
  "/patient/notifications": "#notifications",
  "/patient/profile": "#profile",
};

const HREF_FOR_SECTION_HASH: Record<string, string> = {
  "#daily-appointments": "/doctor/appointments",
  "#appointments": "/patient/appointments",
  "#records": "/patient/medical-records",
  "#prescriptions": "/patient/prescriptions",
  "#diagnostics": "/patient/diagnostic-results",
  "#notifications": "/patient/notifications",
  "#profile": "/patient/profile",
};

export function formatNotificationType(eventType: string): string {
  // One label per value of the backend `Notification.EventType` enum, mirrored
  // by the V94 `chk_notifications_event_type` whitelist. Anything else falls
  // through to the generic clinical label, so a new server-side event type
  // degrades to a readable badge instead of an invented one.
  const labels: Record<string, string> = {
    APPOINTMENT_CREATED: "Đã tạo lịch hẹn",
    APPOINTMENT_CONFIRMED: "Lịch hẹn đã xác nhận",
    APPOINTMENT_RESCHEDULED: "Lịch hẹn đã thay đổi",
    APPOINTMENT_CANCELLED: "Lịch hẹn đã hủy",
    APPOINTMENT_REMINDER: "Nhắc lịch khám",
    DIAGNOSTIC_RESULT_AVAILABLE: "Có kết quả mới",
    VISIT_COMPLETED: "Khám đã hoàn tất",
    PAYMENT_SUBMITTED: "Thanh toán chờ duyệt",
    PAYMENT_CONFIRMED: "Thanh toán đã xác nhận",
    PAYMENT_REJECTED: "Thanh toán cần kiểm tra",
    PAYMENT_REFUNDED: "Đã hoàn tiền",
    HEALTH_QUESTION_SUBMITTED: "Câu hỏi mới chờ duyệt",
    HEALTH_QUESTION_ANSWERED: "Câu hỏi đã có trả lời",
    CONSULTATION_MESSAGE: "Tư vấn có tin nhắn mới",
    CARE_PLAN_CREATED: "Kế hoạch chăm sóc mới",
    CARE_PLAN_ITEM_COMPLETED: "Nhiệm vụ kế hoạch hoàn thành",
    CARE_PLAN_ITEM_CANCELLED: "Nhiệm vụ kế hoạch đã hủy",
  };
  return labels[eventType] ?? "Thông báo y tế";
}

function getNotificationAction(
  item: Notification,
  role: PortalRole,
): { label: string; hash: string } | null {
  if (item.eventType.includes("APPOINTMENT")) {
    // The doctor portal anchors its schedule under a different section hash.
    if (role === "DOCTOR") {
      return { label: "Xem lịch khám", hash: "#daily-appointments" };
    }
    return { label: "Xem lịch hẹn", hash: "#appointments" };
  }
  if (item.eventType.includes("PRESCRIPTION")) {
    // Prescription deep-links stay a patient-portal surface.
    if (role === "DOCTOR") return null;
    return { label: "Xem đơn thuốc", hash: "#prescriptions" };
  }
  if (item.eventType.includes("DIAGNOSTIC") || item.eventType.includes("RESULT")) {
    // Diagnostic results are likewise patient-only content.
    if (role === "DOCTOR") return null;
    return { label: "Xem kết quả CLS", hash: "#diagnostics" };
  }
  // Consultation and health-Q&A notices have dedicated nav pages on both
  // portals; no dashboard hash exists for them, so no action button.
  return null;
}

export default function PortalChrome({ role, user, avatarUrl, children }: PortalChromeProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [resolvedAvatar, setResolvedAvatar] = useState<string | null>(() => getCachedAvatar(role, user.id, avatarUrl));
  const [avatarError, setAvatarError] = useState(false);
  const [avatarLoaded, setAvatarLoaded] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notificationsList, setNotificationsList] = useState<Notification[]>([]);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const effectiveAvatar = avatarUrl ?? resolvedAvatar ?? getCachedAvatar(role, user.id);

  // The mobile tab strip scrolls horizontally, so keep the active tab visible
  // whenever the route changes instead of leaving it hidden off-screen.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const active = nav.querySelector<HTMLElement>(".portal-nav__link--active");
    if (!active) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    active.scrollIntoView({ block: "nearest", inline: "nearest", behavior: prefersReducedMotion ? "auto" : "smooth" });
  }, [pathname]);

  // Returns the settle promise so the background poll can tell when a read is
  // still in flight and refuse to stack a second one on top of it.
  const loadNotifications = useCallback((): Promise<unknown> => {
    if (role === "PATIENT") {
      // The badge counts the whole inbox, not the ten rows this panel previews:
      // deriving it from the first page under-reported as soon as a patient had
      // more than ten notifications, and the badge is the only signal that
      // anything is waiting.
      const badge = fetchPatientOverview()
        .then((overview) => {
          if (typeof overview?.unreadNotificationCount === "number") {
            setUnreadCount(overview.unreadNotificationCount);
          }
        })
        .catch(() => {
          // A failed count must not blank a badge the patient may still have
          // notifications behind; keep the last known value.
        });
      const preview = fetchNotifications(0, 10)
        .then((data) => {
          if (data?.content) setNotificationsList(data.content);
        })
        .catch(() => {
          // The preview list is optional; the badge above is the load-bearing part.
        });
      return Promise.allSettled([badge, preview]);
    }
    // The doctor portal has no overview endpoint yet, so the badge is derived
    // from a wider first page of the same role-agnostic notifications API.
    return fetchNotifications(0, 50)
      .then((data) => {
        if (!data?.content) return;
        setNotificationsList(data.content.slice(0, 10));
        setUnreadCount(data.content.filter((item) => !item.read).length);
      })
      .catch(() => {
        // Same contract as the patient branch: keep the last known values.
      });
  }, [role]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleUpdate = () => {
      loadNotifications();
    };
    window.addEventListener("healthcare:notifications-updated", handleUpdate);
    return () => {
      window.removeEventListener("healthcare:notifications-updated", handleUpdate);
    };
  }, [loadNotifications]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    // A doctor who leaves the portal open must see a new unread badge without
    // navigating. Bounded, non-stacking and paused while the tab is hidden.
    const poll = startNotificationPoll({
      tick: loadNotifications,
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
  }, [loadNotifications]);

  useEffect(() => {
    if (!isPopoverOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsPopoverOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsPopoverOpen(false);
        setSelectedNotification(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPopoverOpen]);

  const handleTogglePopover = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsPopoverOpen((prev) => {
      if (!prev) {
        loadNotifications();
      }
      return !prev;
    });
  };

  const handleOpenNotificationDetail = async (notification: Notification) => {
    setSelectedNotification(notification);
    setIsPopoverOpen(false);
    if (!notification.read) {
      try {
        await markNotificationAsRead(notification.id);
        setNotificationsList((prev) =>
          prev.map((item) => (item.id === notification.id ? { ...item, read: true } : item))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("healthcare:notifications-updated"));
        }
      } catch {
        // ignore mark read error
      }
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotificationsList((prev) => prev.map((item) => ({ ...item, read: true })));
      setUnreadCount(0);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("healthcare:notifications-updated"));
      }
    } catch {
      // ignore
    }
  };

  const handleViewAllNotifications = () => {
    setIsPopoverOpen(false);
    setSelectedNotification(null);
  };

  useEffect(() => {
    if (avatarUrl) {
      setCachedAvatar(role, user.id, avatarUrl);
      return;
    }
    if (getCachedAvatar(role, user.id)) {
      return;
    }
    let cancelled = false;
    const task = Promise.resolve().then(async () => {
      setAvatarLoading(true);
      try {
        if (role === "DOCTOR") {
          const doc = await fetchDoctorProfile();
          if (!cancelled && doc.photoUrl) {
            setCachedAvatar(role, user.id, doc.photoUrl);
            setResolvedAvatar(doc.photoUrl);
          }
        } else {
          const pat = await fetchPatientProfile();
          if (!cancelled && pat.avatarUrl) {
            setCachedAvatar(role, user.id, pat.avatarUrl);
            setResolvedAvatar(pat.avatarUrl);
          }
        }
      } catch {
        // Fallback to initials
      } finally {
        if (!cancelled) {
          setAvatarLoading(false);
        }
      }
    });
    return () => {
      cancelled = true;
      void task;
    };
  }, [avatarUrl, role, user.id]);
  const homePath = role === "PATIENT" ? "/patient/dashboard" : "/doctor/dashboard";
  // Every portal now owns a full-screen inbox, so the bell's destinations are
  // real routes for both roles instead of a patient-only dashboard anchor.
  const notificationsPath = role === "PATIENT" ? "/patient/notifications" : "/doctor/notifications";

  const links = role === "PATIENT"
    ? [
        { href: homePath, label: "Tổng quan" },
        { href: "/patient/profile", label: "Hồ sơ sức khỏe" },
        { href: "/patient/appointments", label: "Lịch hẹn" },
        { href: "/patient/medical-records", label: "Lịch sử khám" },
        { href: "/patient/prescriptions", label: "Đơn thuốc" },
        { href: "/patient/diagnostic-results", label: "Kết quả CLS" },
        { href: "/patient/documents", label: "Tài liệu PDF" },
        { href: "/patient/consultations", label: "Tư vấn" },
        { href: "/patient/care-plan", label: "Kế hoạch" },
        { href: "/patient/health-questions", label: "Hỏi đáp" },
        { href: "/patient/community", label: "Cộng đồng" },
        { href: "/patient/chat", label: "Trợ lý AI" },
        { href: "/patient/preferences", label: "Cài đặt" },
      ]
    : [
        { href: homePath, label: "Tổng quan" },
        { href: "/doctor/profile", label: "Hồ sơ cá nhân" },
        { href: "/doctor/appointments", label: "Lịch khám" },
        { href: "/doctor/consultations", label: "Tư vấn" },
        { href: "/doctor/care-plans", label: "Kế hoạch" },
        { href: "/doctor/health-questions", label: "Hỏi đáp" },
        { href: "/doctor/ai-content-reviews", label: "Duyệt AI" },
        { href: "/doctor/articles", label: "Cộng đồng" },
      ];
  const [activeHash, setActiveHash] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleCheck = () => {
      const hash = window.location.hash;
      if (!hash || hash === "#" || hash === "#overview") {
        setActiveHash("");
      } else {
        setActiveHash(hash);
      }
    };

    handleCheck();
    window.addEventListener("hashchange", handleCheck);
    window.addEventListener("scroll", handleCheck, { passive: true });
    window.addEventListener("portal:tab-change", handleCheck);

    return () => {
      window.removeEventListener("hashchange", handleCheck);
      window.removeEventListener("scroll", handleCheck);
      window.removeEventListener("portal:tab-change", handleCheck);
    };
  }, [pathname]);

  const isActive = (href: string): boolean => {
    if (pathname === homePath) {
      if (activeHash) {
        const mappedHref = HREF_FOR_SECTION_HASH[activeHash];
        if (mappedHref) {
          return href === mappedHref;
        }
      }
      return href === homePath && !activeHash;
    }
    return pathname === href || (href !== homePath && pathname.startsWith(`${href}/`));
  };



  const handleLogout = async () => {
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

  const handleBrandClick = (e: React.MouseEvent<HTMLAnchorElement>): void => {
    if (typeof window !== "undefined") {
      if (pathname === homePath) {
        e.preventDefault();
      }
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, left: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
    }
  };

  return (
    <div className="portal-shell">
      <a className="skip-link" href="#portal-main-content">Bỏ qua điều hướng</a>
      <header className="portal-header">
        <div className="portal-header__inner">
          <Link className="portal-brand" href={homePath} onClick={handleBrandClick}>
            <BrandMark size="compact" tagline={ROLE_LABEL[role]} />
          </Link>

          <nav aria-label="Điều hướng cổng thông tin" className="portal-nav" ref={navRef}>
            {links.map((link) => (
              <Link
                aria-current={isActive(link.href) ? "page" : undefined}
                className={isActive(link.href) ? "portal-nav__link portal-nav__link--active" : "portal-nav__link"}
                href={pathname === homePath && SECTION_HASH_FOR_HREF[link.href] ? `${homePath}${SECTION_HASH_FOR_HREF[link.href]}` : (pathname === homePath && link.href === homePath ? `${homePath}#` : link.href)}
                key={link.href}
                onClick={() => {
                  const hash = SECTION_HASH_FOR_HREF[link.href] || "";
                  setActiveHash(hash);
                  if (typeof window !== "undefined") {
                    if (pathname === homePath) {
                      window.location.hash = hash;
                      window.dispatchEvent(new CustomEvent("portal:tab-change", { detail: { hash, href: link.href } }));
                    }
                  }
                }}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="portal-user">
            {(() => {
              // The notifications API is role-agnostic (backend allows
              // PATIENT, DOCTOR and ADMIN and scopes rows to the caller) and
              // both portals now ship a full-screen inbox, so the bell and its
              // "Xem tất cả" footer render identically for each role.
              return (
              <div className="portal-notification-wrapper" ref={popoverRef}>
                <Link
                  className="portal-notification-bell"
                  href={notificationsPath}
                  aria-label={unreadCount > 0 ? `Thông báo từ bệnh viện (${unreadCount} tin mới)` : "Thông báo từ bệnh viện"}
                  title="Thông báo từ bệnh viện"
                  aria-expanded={isPopoverOpen}
                  aria-haspopup="dialog"
                  onClick={handleTogglePopover}
                >
                  <UiIcon name="bell" size={20} />
                  {unreadCount > 0 ? (
                    <span className="portal-notification-badge" aria-label={`${unreadCount} tin mới`}>
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  ) : null}
                </Link>

                {isPopoverOpen ? (
                  <div
                    className="portal-notification-popover"
                    role="dialog"
                    aria-label={unreadCount > 0
                      ? `Xem trước thông báo bệnh viện, ${unreadCount} tin chưa đọc`
                      : "Xem trước thông báo bệnh viện"}
                  >
                    <div className="portal-notification-popover__header">
                      <div className="portal-notification-popover__title">
                        <UiIcon name="bell" size={16} />
                        <span>Thông báo từ bệnh viện</span>
                        {unreadCount > 0 ? (
                          // The count is spoken through the dialog label above, so
                          // the decorative pill does not repeat a bare number.
                          <span aria-hidden="true" className="portal-notification-popover__count">
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </span>
                        ) : null}
                      </div>
                      {unreadCount > 0 ? (
                        <button
                          type="button"
                          className="portal-notification-popover__mark-all"
                          onClick={handleMarkAllRead}
                        >
                          Đánh dấu đã đọc tất cả
                        </button>
                      ) : null}
                    </div>

                    <div className="portal-notification-popover__list">
                      {notificationsList.length === 0 ? (
                        <div className="portal-notification-popover__empty">
                          <span aria-hidden="true" className="portal-notification-popover__empty-mark">
                            <UiIcon name="bell" size={20} />
                          </span>
                          <p>Chưa có thông báo mới</p>
                        </div>
                      ) : (
                        notificationsList.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className={`portal-notification-popover__item${!item.read ? " portal-notification-popover__item--unread" : ""}`}
                            onClick={() => handleOpenNotificationDetail(item)}
                          >
                            <div className="portal-notification-popover__meta">
                              <span className="portal-notification-popover__badge">
                                {formatNotificationType(item.eventType)}
                              </span>
                              <time dateTime={item.createdAt}>
                                {formatBusinessDateTime(item.createdAt)}
                              </time>
                            </div>
                            <h4 className="portal-notification-popover__item-title">{item.title}</h4>
                            <p className="portal-notification-popover__snippet">{item.message}</p>
                          </button>
                        ))
                      )}
                    </div>

                    <div className="portal-notification-popover__footer">
                      <Link
                        className="portal-notification-popover__view-all"
                        href={notificationsPath}
                        onClick={handleViewAllNotifications}
                      >
                        <span>Xem tất cả thông báo</span>
                        <UiIcon name="arrow-right" size={14} />
                      </Link>
                    </div>
                  </div>
                ) : null}
              </div>
              );
            })()}

            <Link
              className="portal-user__link"
              href={role === "PATIENT" ? "/patient/profile" : "/doctor/profile"}
              aria-label="Xem thông tin tài khoản"
              title="Xem và cập nhật thông tin tài khoản"
            >
              <span className={`portal-user__avatar${avatarLoading && !effectiveAvatar ? " portal-user__avatar--loading" : !avatarLoaded && effectiveAvatar && !avatarError ? " portal-user__avatar--shimmer" : ""}`} aria-hidden="true">
                {effectiveAvatar && !avatarError ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt={user.displayName}
                      className={`portal-user__avatar-img${avatarLoaded ? " portal-user__avatar-img--loaded" : ""}`}
                      onError={() => setAvatarError(true)}
                      onLoad={() => setAvatarLoaded(true)}
                      src={effectiveAvatar}
                    />
                    {!avatarLoaded ? (
                      <span className="portal-user__avatar-placeholder">
                        {user.displayName?.charAt(0)?.toUpperCase() ?? "U"}
                      </span>
                    ) : null}
                  </>
                ) : (
                  user.displayName?.charAt(0)?.toUpperCase() ?? "U"
                )}
              </span>
              <div className="portal-user__copy">
                <strong>{user.displayName}</strong>
                <span>{user.email}</span>
              </div>
            </Link>
            <div className="grid max-w-xs justify-items-end gap-1">
              <button className="outline-button outline-button--small min-h-11" disabled={loggingOut} onClick={handleLogout} type="button">
                {loggingOut ? "Đang thoát..." : "Đăng xuất"}
              </button>
              {logoutError ? <p aria-live="polite" className="text-right text-xs font-semibold leading-5 text-amber-800" role="status">{logoutError}</p> : null}
            </div>
          </div>
        </div>
      </header>
      <main className="portal-main" id="portal-main-content" tabIndex={-1}>{children}</main>
      <footer className="portal-footer">
        Thông tin sức khỏe của bạn được bảo mật an toàn theo tiêu chuẩn bệnh viện và chỉ dành riêng cho bạn.
      </footer>

      {selectedNotification ? (
        <div
          className="portal-modal-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedNotification(null);
            }
          }}
        >
          <div
            className="portal-notification-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="notification-modal-title"
          >
            <div className="portal-notification-modal__header">
              <div className="portal-notification-modal__meta">
                <span className="portal-notification-popover__badge">
                  {formatNotificationType(selectedNotification.eventType)}
                </span>
                <span className="portal-notification-modal__time">
                  {formatBusinessDateTime(selectedNotification.createdAt)}
                </span>
              </div>
              <button
                type="button"
                className="portal-notification-modal__close"
                aria-label="Đóng chi tiết thông báo"
                onClick={() => setSelectedNotification(null)}
              >
                <UiIcon name="x" size={18} />
              </button>
            </div>

            <div className="portal-notification-modal__body">
              <h3 id="notification-modal-title" className="portal-notification-modal__title">
                {selectedNotification.title}
              </h3>
              <div className="portal-notification-modal__content">
                <p>{selectedNotification.message}</p>
              </div>
              {selectedNotification.referenceId ? (
                <div className="portal-notification-modal__ref">
                  <span>Mã tham chiếu:</span>
                  <strong>{selectedNotification.referenceId}</strong>
                </div>
              ) : null}
            </div>

            <div className="portal-notification-modal__footer">
              {(() => {
                const action = getNotificationAction(selectedNotification, role);
                if (action) {
                  return (
                    <button
                      type="button"
                      className="button button--primary button--small"
                      onClick={() => {
                        setSelectedNotification(null);
                        setActiveHash(action.hash);
                        if (typeof window !== "undefined") {
                          if (pathname === homePath) {
                            window.location.hash = action.hash;
                            window.dispatchEvent(
                              new CustomEvent("portal:tab-change", {
                                detail: { hash: action.hash },
                              })
                            );
                          } else {
                            router.push(`${homePath}${action.hash}`);
                          }
                        }
                      }}
                    >
                      {action.label}
                    </button>
                  );
                }
                return null;
              })()}
              <button
                type="button"
                className="outline-button outline-button--small"
                onClick={() => setSelectedNotification(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
