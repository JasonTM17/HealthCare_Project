"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { AuthUser, Notification } from "../types/hospital";
import {
  fetchDoctorProfile,
  fetchNotifications,
  fetchPatientProfile,
  logoutCurrentUser,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  SAFE_LOGOUT_ERROR_MESSAGE,
} from "../lib/api-client";
import { formatBusinessDateTime } from "../lib/business-time";
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

function formatNotificationType(eventType: string): string {
  const labels: Record<string, string> = {
    APPOINTMENT_CREATED: "Đã tạo lịch hẹn",
    APPOINTMENT_CONFIRMED: "Lịch hẹn đã xác nhận",
    APPOINTMENT_RESCHEDULED: "Lịch hẹn đã thay đổi",
    APPOINTMENT_CANCELLED: "Lịch hẹn đã hủy",
    APPOINTMENT_REMINDER: "Nhắc lịch khám",
    DIAGNOSTIC_RESULT_AVAILABLE: "Có kết quả mới",
    PRESCRIPTION_ISSUED: "Đơn thuốc mới",
    SYSTEM_NOTIFICATION: "Thông báo hệ thống",
  };
  return labels[eventType] ?? "Thông báo y tế";
}

function getNotificationAction(item: Notification): { label: string; hash: string } | null {
  if (item.eventType.includes("APPOINTMENT")) {
    return { label: "Xem lịch hẹn", hash: "#appointments" };
  }
  if (item.eventType.includes("PRESCRIPTION")) {
    return { label: "Xem đơn thuốc", hash: "#prescriptions" };
  }
  if (item.eventType.includes("DIAGNOSTIC") || item.eventType.includes("RESULT")) {
    return { label: "Xem kết quả CLS", hash: "#diagnostics" };
  }
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
  const effectiveAvatar = avatarUrl ?? resolvedAvatar ?? getCachedAvatar(role, user.id);

  const loadNotifications = useCallback(() => {
    if (role !== "PATIENT") return;
    fetchNotifications(0, 10)
      .then((data) => {
        if (data?.content) {
          setNotificationsList(data.content);
          const unread = data.content.filter((n) => !n.read).length;
          setUnreadCount(unread);
        }
      })
      .catch(() => {});
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
    setActiveHash("#notifications");
    if (typeof window !== "undefined") {
      if (pathname === homePath) {
        // replaceState keeps the URL hash in sync without the flagged global
        // location mutation; the dispatched event drives the tab switch.
        window.history.replaceState(null, "", "#notifications");
        window.dispatchEvent(
          new CustomEvent("portal:tab-change", {
            detail: { hash: "#notifications", href: "/patient/notifications" },
          })
        );
      } else {
        router.push(`${homePath}#notifications`);
      }
    }
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

          <nav aria-label="Điều hướng cổng thông tin" className="portal-nav">
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
            {role === "PATIENT" ? (
              <div className="portal-notification-wrapper" ref={popoverRef}>
                <Link
                  className="portal-notification-bell"
                  href={pathname === homePath ? "#notifications" : `${homePath}#notifications`}
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
                    aria-label="Xem trước thông báo bệnh viện"
                  >
                    <div className="portal-notification-popover__header">
                      <div className="portal-notification-popover__title">
                        <UiIcon name="bell" size={16} />
                        <span>Thông báo từ bệnh viện</span>
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
                          <p>Chưa có thông báo nào từ bệnh viện.</p>
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
                      <button
                        type="button"
                        className="portal-notification-popover__view-all"
                        onClick={handleViewAllNotifications}
                      >
                        <span>Xem tất cả thông báo</span>
                        <UiIcon name="arrow-right" size={14} />
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

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
                const action = getNotificationAction(selectedNotification);
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
