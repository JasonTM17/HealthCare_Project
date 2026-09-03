"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { AuthUser } from "../types/hospital";
import { logoutCurrentUser, SAFE_LOGOUT_ERROR_MESSAGE } from "../lib/api-client";
import UiIcon from "./UiIcon";

export type PortalRole = "PATIENT" | "DOCTOR";

const ROLE_LABEL: Record<PortalRole, string> = {
  PATIENT: "Cổng bệnh nhân",
  DOCTOR: "Cổng bác sĩ",
};

const PATIENT_SECTION_HASHES: Record<string, string> = {
  "/patient/appointments": "#appointments",
  "/patient/medical-records": "#records",
  "/patient/prescriptions": "#prescriptions",
  "/patient/diagnostic-results": "#diagnostics",
  "/patient/preferences": "#profile",
};

const DOCTOR_SECTION_HASHES: Record<string, string> = {
  "/doctor/appointments": "#daily-appointments",
};

interface PortalChromeProps {
  role: PortalRole;
  user: AuthUser;
  children: ReactNode;
}

export default function PortalChrome({ role, user, children }: PortalChromeProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [activeHash, setActiveHash] = useState<string>("");
  const navClickTimeRef = useRef(0);
  const homePath = role === "PATIENT" ? "/patient/dashboard" : "/doctor/dashboard";

  useEffect(() => {
    const handleHash = () => {
      setActiveHash(window.location.hash || "");
    };
    handleHash();
    window.addEventListener("hashchange", handleHash);
    window.addEventListener("popstate", handleHash);

    const isDashboard = pathname === homePath;
    if (!isDashboard) {
      return () => {
        window.removeEventListener("hashchange", handleHash);
        window.removeEventListener("popstate", handleHash);
      };
    }

    const sectionMap = role === "PATIENT" ? PATIENT_SECTION_HASHES : DOCTOR_SECTION_HASHES;
    const sectionIds = Object.values(sectionMap).map((h) => h.replace("#", ""));

    let ticking = false;
    const handleScroll = () => {
      if (performance.now() - navClickTimeRef.current < 1200) {
        return;
      }
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        if (performance.now() - navClickTimeRef.current < 1200) {
          return;
        }
        if (window.scrollY < 260) {
          setActiveHash("");
          return;
        }

        const triggerLine = 220;
        let matched = "";
        for (let i = sectionIds.length - 1; i >= 0; i--) {
          const id = sectionIds[i];
          const el = document.getElementById(id);
          if (el) {
            const rect = el.getBoundingClientRect();
            if (rect.top <= triggerLine && rect.bottom >= 80) {
              matched = `#${id}`;
              break;
            }
          }
        }
        if (matched) {
          setActiveHash(matched);
        }
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("hashchange", handleHash);
      window.removeEventListener("popstate", handleHash);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [pathname, homePath, role]);
  const links = role === "PATIENT"
    ? [
        { href: homePath, label: "Tổng quan" },
        { href: "/patient/appointments", label: "Lịch hẹn" },
        { href: "/patient/medical-records", label: "Hồ sơ" },
        { href: "/patient/prescriptions", label: "Đơn thuốc" },
        { href: "/patient/diagnostic-results", label: "Kết quả CLS" },
        { href: "/patient/consultations", label: "Tư vấn" },
        { href: "/patient/care-plan", label: "Kế hoạch" },
        { href: "/patient/health-questions", label: "Hỏi đáp" },
        { href: "/patient/community", label: "Cộng đồng" },
        { href: "/patient/chat", label: "Trợ lý AI" },
        { href: "/patient/preferences", label: "Tài khoản" },
      ]
    : [
        { href: homePath, label: "Tổng quan" },
        { href: "/doctor/appointments", label: "Lịch khám" },
        { href: "/doctor/consultations", label: "Tư vấn" },
        { href: "/doctor/care-plans", label: "Kế hoạch" },
        { href: "/doctor/health-questions", label: "Hỏi đáp" },
        { href: "/doctor/ai-content-reviews", label: "Duyệt AI" },
        { href: "/doctor/articles", label: "Bài viết y khoa" },
        { href: "/doctor/profile", label: "Hồ sơ cá nhân" },
      ];

  const isActive = (href: string): boolean => {
    if (pathname === homePath) {
      const sectionMap = role === "PATIENT" ? PATIENT_SECTION_HASHES : DOCTOR_SECTION_HASHES;
      const targetHash = sectionMap[href];
      if (targetHash) {
        return activeHash === targetHash;
      }
      if (href === homePath) {
        return !activeHash || activeHash === "#top" || activeHash === "#portal-main-content";
      }
      return false;
    }
    return pathname === href || (href !== homePath && pathname.startsWith(`${href}/`));
  };

  const handleNavClick = useCallback((href: string, e: React.MouseEvent) => {
    if (pathname === homePath) {
      const sectionMap = role === "PATIENT" ? PATIENT_SECTION_HASHES : DOCTOR_SECTION_HASHES;
      const targetHash = sectionMap[href];
      if (targetHash) {
        e.preventDefault();
        navClickTimeRef.current = performance.now();
        setActiveHash(targetHash);
        window.history.pushState(null, "", targetHash);
        const el = document.querySelector(targetHash);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        return;
      }
      if (href === homePath) {
        e.preventDefault();
        navClickTimeRef.current = performance.now();
        setActiveHash("");
        window.history.pushState(null, "", homePath);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    }
  }, [pathname, homePath, role]);

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
                href={link.href}
                key={link.href}
                onClick={(e) => handleNavClick(link.href, e)}
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
                {user.displayName?.charAt(0)?.toUpperCase() ?? "U"}
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
