"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { fetchDoctors, type Page } from "../../lib/api-client";
import type { Doctor } from "../../types/hospital";

export default function DoctorsPage() {
  const [page, setPage] = useState<Page<Doctor> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchDoctors({ page: currentPage, size: 12, sort: "fullName,asc" })
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
  }, [currentPage]);

  return (
    <main className="section">
      <h2>Bác Sĩ Giàu Kinh Nghiệm</h2>
      <p className="text-slate-600">
        Đội ngũ chuyên gia đầu ngành, tận tâm và thấu hiểu bệnh nhân.
      </p>

      {loading && <p className="text-slate-500">Đang tải...</p>}
      {error && <p className="text-red-600">Lỗi: {error}</p>}

      {page && (
        <>
          <p className="text-xs text-slate-500">
            Tổng cộng {page.totalElements} bác sĩ · Trang {page.number + 1}/
            {page.totalPages}
          </p>

          {page.empty ? (
            <p className="text-slate-500">Chưa có bác sĩ.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
              {page.content.map((doc) => (
                <Link
                  key={doc.id}
                  href={`/doctors/${doc.slug}`}
                  className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow block"
                >
                  <div className="w-20 h-20 rounded-full bg-teal-700/10 text-teal-800 mx-auto flex items-center justify-center text-3xl mb-3">
                    👨‍⚕️
                  </div>
                  <h3 className="text-base font-bold text-slate-900 text-center">
                    {doc.fullName}
                  </h3>
                  {doc.bio && (
                    <p className="text-xs text-slate-600 mt-2 line-clamp-2 text-center">
                      {doc.bio}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          )}

          {page.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-8">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                disabled={page.first}
                className="px-4 py-2 rounded-full border border-slate-300 text-sm disabled:opacity-40 hover:bg-slate-50"
              >
                ← Trước
              </button>
              <span className="text-sm text-slate-600">
                Trang {page.number + 1} / {page.totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(page.totalPages - 1, p + 1))}
                disabled={page.last}
                className="px-4 py-2 rounded-full border border-slate-300 text-sm disabled:opacity-40 hover:bg-slate-50"
              >
                Sau →
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
