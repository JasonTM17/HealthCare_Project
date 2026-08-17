"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { fetchSpecialtyBySlug } from "../../../lib/api-client";
import type { Specialty } from "../../../types/hospital";

export default function SpecialtyDetailPage({ params }: { params: { slug: string } }) {
  const [specialty, setSpecialty] = useState<Specialty | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSpecialtyBySlug(params.slug)
      .then((data) => {
        if (!cancelled) setSpecialty(data);
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
  }, [params.slug]);

  return (
    <main className="section">
      <Link href="/specialties" className="text-sm text-teal-700 hover:underline">
        ← Quay lại chuyên khoa
      </Link>

      {loading && <p className="text-slate-500 mt-4">Đang tải...</p>}
      {error && <p className="text-red-600 mt-4">Lỗi: {error}</p>}

      {specialty && (
        <div className="mt-6 p-8 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">{specialty.name}</h1>
          {specialty.description && (
            <p className="text-sm text-slate-600 mt-4 leading-relaxed">
              {specialty.description}
            </p>
          )}
          <div className="mt-6">
            <Link
              href="/doctors"
              className="inline-block px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-sm font-bold rounded-xl transition-colors"
            >
              Xem bác sĩ chuyên khoa này
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
