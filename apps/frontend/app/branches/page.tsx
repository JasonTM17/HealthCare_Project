"use client";

import React, { useEffect, useState } from "react";
import { fetchBranches, type Page } from "../../lib/api-client";
import type { Branch } from "../../types/hospital";

export default function BranchesPage() {
  const [page, setPage] = useState<Page<Branch> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchBranches(0, 50)
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
      <h2>Hệ Thống Cơ Sở</h2>
      <p className="text-slate-600">
        Mạng lưới bệnh viện và phòng khám rộng khắp, dễ dàng tiếp cận.
      </p>

      {loading && <p className="text-slate-500">Đang tải...</p>}
      {error && <p className="text-red-600">Lỗi: {error}</p>}

      {page && (
        <>
          {page.empty ? (
            <p className="text-slate-500">Chưa có cơ sở.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              {page.content.map((br) => (
                <div
                  key={br.id}
                  className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm"
                >
                  <span className="text-2xl block mb-3">🏥</span>
                  <h3 className="text-base font-bold text-teal-950">{br.name}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed mt-1">
                    📍 {br.address}
                  </p>
                  <p className="text-xs text-teal-800 font-semibold mt-1">
                    📞 {br.phone}
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
