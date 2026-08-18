"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { AuthUser } from "../types/hospital";
import { logoutCurrentUser } from "../lib/api-client";

export type PortalRole = "PATIENT" | "DOCTOR";

const ROLE_LABEL: Record<PortalRole, string> = {
  PATIENT: "Cổng bệnh nhân",
  DOCTOR: "Cổng bác sĩ",
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
  const homePath = role === "PATIENT" ? "/patient/dashboard" : "/doctor/dashboard";
  const links = role === "PATIENT"
    ? [
        { href: homePath, label: "Tổng quan" },
        { href: "/tra-cuu", label: "Tra cứu lịch hẹn" },
      ]
    : [{ href: homePath, label: "Tổng quan" }];

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logoutCurrentUser();
    } catch {
      // logoutCurrentUser clears the browser session even when remote sign-out is unavailable.
    } finally {
      router.replace("/auth/login");
    }
  };

  return (
    <div className="portal-shell">
      <header className="portal-header">
        <div className="portal-header__inner">
          <Link className="portal-brand" href={homePath}>
            <span aria-hidden="true" className="portal-brand__mark">+</span>
            <span>
              <strong>HealthCare</strong>
              <small>{ROLE_LABEL[role]}</small>
            </span>
          </Link>

          <nav aria-label="Điều hướng cổng thông tin" className="portal-nav">
            {links.map((link) => (
              <Link
                aria-current={pathname === link.href ? "page" : undefined}
                className={pathname === link.href ? "portal-nav__link portal-nav__link--active" : "portal-nav__link"}
                href={link.href}
                key={link.href}
              >
                {link.label}
              </Link>
            ))}
            <Link className="portal-nav__link" href="/">Trang chính</Link>
          </nav>

          <div className="portal-user">
            <div className="portal-user__copy">
              <strong>{user.displayName}</strong>
              <span>{user.email}</span>
            </div>
            <button className="outline-button outline-button--small" disabled={loggingOut} onClick={handleLogout} type="button">
              {loggingOut ? "Đang thoát..." : "Đăng xuất"}
            </button>
          </div>
        </div>
      </header>
      <main className="portal-main">{children}</main>
      <footer className="portal-footer">
        Thông tin sức khỏe được bảo vệ và chỉ hiển thị theo quyền của tài khoản hiện tại.
      </footer>
    </div>
  );
}
