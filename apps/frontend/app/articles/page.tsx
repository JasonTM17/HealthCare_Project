"use client";

import React, { useEffect, useState } from "react";
import { fetchPackages, type Page } from "../../lib/api-client";
import type { HealthPackage } from "../../types/hospital";

const MONTHS = [
  "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
  "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12",
];

export default function ArticlesPage() {
  const [packages, setPackages] = useState<Page<HealthPackage> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPackages(0, 50)
      .then((data) => {
        if (!cancelled) setPackages(data);
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
      <h2>Bài Viết Y Khoa</h2>
      <p className="text-slate-600">
        Cập nhật kiến thức và thông tin sức khỏe mới nhất.
      </p>

      {loading && <p className="text-slate-500">Đang tải...</p>}
      {error && <p className="text-red-600">Lỗi: {error}</p>}

      {packages && (
        <>
          {packages.empty ? (
            <p className="text-slate-500">Chưa có bài viết.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
              {packages.content.map((pkg) => (
                <div
                  key={pkg.id}
                  className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm"
                >
                  <span className="text-2xl block mb-3">📦</span>
                  <h3 className="text-base font-bold text-slate-900">{pkg.name}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed mt-1">
                    {pkg.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
