"use client";

import React from "react";
import Link from "next/link";

const NAV = [
  { href: "/admin", label: "Tổng quan" },
  { href: "/admin/doctors", label: "Bác sĩ" },
  { href: "/admin/specialties", label: "Chuyên khoa" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-56 bg-slate-900 text-white p-5 space-y-2">
        <h2 className="text-lg font-bold mb-4">Quản trị</h2>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-teal-700 hover:text-white transition-colors"
          >
            {item.label}
          </Link>
        ))}
        <div className="pt-6">
          <Link href="/" className="text-xs text-slate-400 hover:text-white">
            ← Về trang chủ
          </Link>
        </div>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
