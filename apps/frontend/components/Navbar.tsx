"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavbarProps {
  onOpenBooking: () => void;
  onOpenAiTriage: () => void;
}

export default function Navbar({ onOpenBooking, onOpenAiTriage }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const navLinks = [
    { label: "Trang Chủ", href: "/" },
    { label: "Chuyên Khoa", href: "/#specialties" },
    { label: "Đội Ngũ Bác Sĩ", href: "/#doctors" },
    { label: "Gói Khám", href: "/#packages" },
    { label: "Hướng Dẫn Khám & BHYT", href: "/huong-dan" },
    { label: "Tra Cứu Lịch Hẹn", href: "/tra-cuu" },
  ];

  return (
    <>
      {/* ── Top Utility Bar (non-sticky; header below is sticky) ────── */}
      <div className="bg-brand-950 text-brand-100 text-xs py-2 px-4 border-b border-brand-900">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-1.5 text-amber-400 font-bold">
              <span className="animate-pulse" aria-hidden>🚨</span>
              <span>Cấp cứu 24/7: <a href="tel:19001234" className="text-white text-sm font-mono tracking-wider hover:underline">1900 1234</a></span>
            </div>
            <span className="hidden md:inline text-brand-600" aria-hidden>|</span>
            <span className="hidden md:inline text-brand-200">🕒 Khám bệnh: Thứ 2 - Thứ 7 (07:00 - 17:00)</span>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 text-brand-200 text-[11px] sm:text-xs">
            <Link href="/#branches" className="hover:text-white transition-colors">
              🏥 3 Cơ sở TP.HCM
            </Link>
            <span className="text-brand-700" aria-hidden>|</span>
            <button
              type="button"
              onClick={onOpenAiTriage}
              className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 font-bold cursor-pointer"
            >
              <span aria-hidden>🤖</span> Trợ Lý AI
            </button>
            <span className="text-brand-700" aria-hidden>|</span>
            <Link href="/tra-cuu" className="text-brand-300 hover:text-white font-semibold">
              🔍 Tra cứu
            </Link>
          </div>
        </div>
      </div>

      {/* ── Main Navigation Header (sticky) ─────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-brand-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-brand-800 to-brand-600 text-white flex items-center justify-center text-2xl font-extrabold shadow-md">
              +
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight text-brand-950 block leading-tight">
                HealthCare
              </span>
              <span className="text-[10px] sm:text-[11px] font-semibold tracking-wider uppercase text-brand-700 block">
                Hệ Thống Y Tế Đa Khoa
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-semibold text-ink-muted">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`transition-colors hover:text-brand-700 ${
                    isActive ? "text-brand-700 font-bold" : ""
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onOpenAiTriage}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-brand-800 bg-brand-50 border border-brand-200 rounded-full hover:bg-brand-100 transition-all cursor-pointer"
            >
              <span aria-hidden>✨</span> Triage Triệu Chứng
            </button>

            <button
              type="button"
              onClick={onOpenBooking}
              className="px-5 sm:px-6 py-2.5 bg-gradient-to-r from-brand-700 to-brand-800 hover:from-brand-800 hover:to-brand-900 text-white text-xs sm:text-sm font-bold rounded-full shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer"
            >
              <span aria-hidden>📅</span> Đặt Lịch Khám
            </button>

            {/* Mobile hamburger button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden w-10 h-10 rounded-xl bg-brand-50 hover:bg-brand-100 flex items-center justify-center text-brand-700 text-lg"
              aria-label="Mở menu"
            >
              {mobileMenuOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-mint-100 bg-white px-4 py-4 space-y-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2 text-sm font-semibold text-ink hover:text-brand-700 border-b border-mint-100"
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenAiTriage();
                }}
                className="w-full py-2.5 bg-brand-50 text-brand-800 font-bold text-xs rounded-xl text-center"
              >
                🤖 Trợ lý Y tế AI (Phân luồng triệu chứng)
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenBooking();
                }}
                className="w-full py-2.5 bg-brand-700 text-white font-bold text-xs rounded-xl text-center shadow"
              >
                📅 Đặt lịch khám trực tuyến
              </button>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
