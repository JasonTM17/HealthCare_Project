"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useEffect, useState } from "react";
import type { Branch } from "../types/hospital";
import BrandMark from "./BrandMark";
import Icon from "./UiIcon";

interface NavbarProps {
  onOpenBooking: () => void;
  onOpenAiTriage: () => void;
  branches?: Branch[];
}

const NAV_LINKS = [
  { label: "Giới thiệu", href: "/about" },
  { label: "Chuyên khoa", href: "/specialties" },
  { label: "Bác sĩ", href: "/doctors" },
  { label: "Gói khám", href: "/packages" },
  { label: "Cơ sở", href: "/branches" },
  { label: "Cẩm nang", href: "/articles" },
];

const Navbar: React.FC<NavbarProps> = ({ onOpenBooking, onOpenAiTriage, branches = [] }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const pathname = usePathname();
  const emergencyBranch = branches.find((branch) => Boolean(branch.emergencyHotline));
  const contactBranch = branches.find((branch) => Boolean(branch.phone));
  const contactPhone = emergencyBranch?.emergencyHotline ?? contactBranch?.phone;

  const closeMobileMenu = (): void => setMobileMenuOpen(false);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileMenuOpen]);

  return (
    <>
      <a className="skip-link" href="#main-content">Bỏ qua điều hướng</a>
      <div className="utility-bar">
        <div className="utility-bar__inner">
          <div className="utility-bar__left">
            {contactPhone ? (
              <a className="utility-hotline" href={`tel:${contactPhone.replace(/\s/g, "")}`}>
                <Icon name="phone" size={15} />
                <span>{emergencyBranch ? "Cấp cứu" : "Hotline"}</span>
                <strong>{contactPhone}</strong>
              </a>
            ) : (
              <Link className="utility-hotline" href="/contact">
                <Icon name="location" size={15} />
                <span>Liên hệ cơ sở</span>
              </Link>
            )}
            <span className="utility-divider" aria-hidden="true" />
            <Link className="utility-hours" href="/branches"><Icon name="clock" size={15} />Xem giờ làm việc</Link>
          </div>
          <div className="utility-bar__right">
            <Link href="/huong-dan">Hướng dẫn khách hàng</Link>
            <Link href="/tra-cuu">Tra cứu lịch hẹn</Link>
          </div>
        </div>
      </div>

      <header className="site-nav">
        <div className="site-nav__inner">
          <Link aria-label="HealthCare, về trang chủ" className="brand-link" href="/" onClick={closeMobileMenu}>
            <BrandMark />
          </Link>

          <nav aria-label="Điều hướng chính" className="desktop-nav">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link aria-current={isActive ? "page" : undefined} className={`nav-link${isActive ? " nav-link--active" : ""}`} href={link.href} key={link.href}>
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="site-nav__actions">
            <button className="nav-ai-button" onClick={onOpenAiTriage} type="button">
              <Icon name="stethoscope" size={16} />
              <span>Chọn chuyên khoa</span>
            </button>
            <button className="button button--nav" onClick={onOpenBooking} type="button">
              <Icon name="calendar" size={17} />
              <span>Đặt lịch khám</span>
            </button>
            <button
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation"
              aria-label={mobileMenuOpen ? "Đóng menu" : "Mở menu"}
              className="nav-menu-button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              type="button"
            >
              <Icon name={mobileMenuOpen ? "x" : "menu"} size={22} />
            </button>
          </div>
        </div>

        {mobileMenuOpen ? (
          <div className="mobile-menu" id="mobile-navigation">
            <nav aria-label="Điều hướng trên thiết bị nhỏ">
              {NAV_LINKS.map((link) => {
                const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
                return (
                  <Link aria-current={isActive ? "page" : undefined} className="mobile-menu__link" href={link.href} key={link.href} onClick={closeMobileMenu}>
                    {link.label}
                    <Icon name="arrow-up-right" size={17} />
                  </Link>
                );
              })}
            </nav>
            <div className="mobile-menu__actions">
              <Link className="outline-button" href="/tra-cuu" onClick={closeMobileMenu}>Tra cứu lịch hẹn</Link>
              <button className="outline-button" onClick={() => { closeMobileMenu(); onOpenAiTriage(); }} type="button">
                <Icon name="stethoscope" size={17} /> Hỗ trợ chọn chuyên khoa
              </button>
              <button className="button button--amber" onClick={() => { closeMobileMenu(); onOpenBooking(); }} type="button">
                <Icon name="calendar" size={17} /> Đặt lịch khám
              </button>
            </div>
          </div>
        ) : null}
      </header>
    </>
  );
};

export default Navbar;
