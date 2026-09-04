"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { AuthUser } from "../types/hospital";
import { fetchDoctorProfile, fetchPatientProfile, logoutCurrentUser, SAFE_LOGOUT_ERROR_MESSAGE } from "../lib/api-client";
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
};

const HREF_FOR_SECTION_HASH: Record<string, string> = {
  "#daily-appointments": "/doctor/appointments",
  "#appointments": "/patient/appointments",
  "#records": "/patient/medical-records",
  "#prescriptions": "/patient/prescriptions",
  "#diagnostics": "/patient/diagnostic-results",
};

export default function PortalChrome({ role, user, avatarUrl, children }: PortalChromeProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [resolvedAvatar, setResolvedAvatar] = useState<string | null>(() => getCachedAvatar(role, user.id, avatarUrl));
  const [avatarError, setAvatarError] = useState(false);
  const effectiveAvatar = avatarUrl ?? resolvedAvatar ?? getCachedAvatar(role, user.id);

  useEffect(() => {
    if (avatarUrl) {
      setCachedAvatar(role, user.id, avatarUrl);
      return;
    }
    if (getCachedAvatar(role, user.id)) {
      return;
    }
    let cancelled = false;
    const loadAvatar = async () => {
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
      }
    };
    void loadAvatar();
    return () => {
      cancelled = true;
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
      if (!hash || window.scrollY < 150) {
        setActiveHash("");
      } else {
        setActiveHash(hash);
      }
    };

    handleCheck();
    window.addEventListener("hashchange", handleCheck);
    window.addEventListener("scroll", handleCheck, { passive: true });

    return () => {
      window.removeEventListener("hashchange", handleCheck);
      window.removeEventListener("scroll", handleCheck);
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

  return (
    <div className="portal-shell">
      <a className="skip-link" href="#portal-main-content">Bỏ qua điều hướng</a>
      <header className="portal-header">
        <div className="portal-header__inner">
          <Link className="portal-brand" href={homePath}>
            <span aria-hidden="true" className="portal-brand__mark"><UiIcon name="shield-check" size={22} /></span>
            <span>
              <strong>HealthCare</strong>
              <small>{ROLE_LABEL[role]}</small>
            </span>
          </Link>

          <nav aria-label="Điều hướng cổng thông tin" className="portal-nav">
            {links.map((link) => (
              <Link
                aria-current={isActive(link.href) ? "page" : undefined}
                className={isActive(link.href) ? "portal-nav__link portal-nav__link--active" : "portal-nav__link"}
                href={pathname === homePath && SECTION_HASH_FOR_HREF[link.href] ? `${homePath}${SECTION_HASH_FOR_HREF[link.href]}` : (pathname === homePath && link.href === homePath ? `${homePath}#` : link.href)}
                key={link.href}
                onClick={() => {
                  const hash = SECTION_HASH_FOR_HREF[link.href];
                  setActiveHash(hash || "");
                }}
              >
                {link.label}
              </Link>
            ))}
            <Link className="portal-nav__link" href="/">Trang chính</Link>
          </nav>

          <div className="portal-user">
            <Link
              className="portal-user__link"
              href={role === "PATIENT" ? "/patient/profile" : "/doctor/profile"}
              title="Xem và cập nhật thông tin tài khoản"
            >
              <span className="portal-user__avatar" aria-hidden="true">
                {effectiveAvatar && !avatarError ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={user.displayName}
                    className="portal-user__avatar-img"
                    onError={() => setAvatarError(true)}
                    src={effectiveAvatar}
                  />
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
              <button className="outline-button outline-button--small" disabled={loggingOut} onClick={handleLogout} type="button">
                {loggingOut ? "Đang thoát..." : "Đăng xuất"}
              </button>
              {logoutError ? <p aria-live="polite" className="text-right text-xs font-semibold leading-5 text-amber-800" role="status">{logoutError}</p> : null}
            </div>
          </div>
        </div>
      </header>
      <main className="portal-main" id="portal-main-content" tabIndex={-1}>{children}</main>
      <footer className="portal-footer">
        Thông tin sức khỏe được bảo vệ và chỉ hiển thị theo quyền của tài khoản hiện tại.
      </footer>
    </div>
  );
}
