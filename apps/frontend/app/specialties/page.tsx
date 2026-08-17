"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { fetchSpecialties, type Page } from "../../lib/api-client";
import type { Specialty } from "../../types/hospital";

const SPECIALTY_ICONS = [
  "❤️", "🧠", "🫀", "👁️", "🦴", "🌸", "👶", "🫁", "🦷", "👂",
];

export default function SpecialtiesPage() {
  const [page, setPage] = useState<Page<Specialty> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchSpecialties(0, 50)
      .then((data) => {
        if (!cancelled) setPage(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="section">
      <h2>Chuyên Khoa Mũi Nhọn</h2>
      <p className="text-slate-600">
        Trang bị đồng bộ hệ thống chẩn đoán hình ảnh cao cấp, đội ngũ chuyên gia đầu ngành.
      </p>

      {loading && <p className="text-slate-500">Đang tải...</p>}
      {error && <p className="text-red-600">Lỗi: {error}</p>}

      {page && (
        <>
          {page.empty ? (
            <p className="text-slate-500">Chưa có chuyên khoa.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
              {page.content.map((sp, idx) => (
                <Link
                  key={sp.id}
                  href={`/specialties/${sp.slug}`}
                  className="p-6 bg-white border border-slate-200 hover:border-teal-400 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group"
                >
                  <div>
                    <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-800 text-3xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      {sp.icon || SPECIALTY_ICONS[idx % SPECIALTY_ICONS.length]}
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-teal-700 transition-colors">
                      {sp.name}
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {sp.description}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
