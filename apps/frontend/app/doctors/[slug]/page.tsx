"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { fetchDoctorBySlug } from "../../../lib/api-client";
import type { Doctor } from "../../../types/hospital";

export default function DoctorDetailPage({ params }: { params: { slug: string } }) {
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchDoctorBySlug(params.slug)
      .then((data) => {
        if (!cancelled) setDoctor(data);
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
      <Link href="/doctors" className="text-sm text-teal-700 hover:underline">
        ← Quay lại danh sách bác sĩ
      </Link>

      {loading && <p className="text-slate-500 mt-4">Đang tải...</p>}
      {error && <p className="text-red-600 mt-4">Lỗi: {error}</p>}

      {doctor && (
        <div className="mt-6 p-8 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="w-24 h-24 rounded-full bg-teal-700/10 text-teal-800 mx-auto flex items-center justify-center text-4xl mb-4">
            👨‍⚕️
          </div>
          <h1 className="text-2xl font-bold text-slate-900 text-center">
            {doctor.fullName}
          </h1>
          {doctor.bio && (
            <p className="text-sm text-slate-600 mt-4 max-w-2xl mx-auto text-center leading-relaxed">
              {doctor.bio}
            </p>
          )}
          <div className="text-center mt-6">
            <Link
              href="/"
              className="inline-block px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-sm font-bold rounded-xl transition-colors"
            >
              Đặt lịch khám
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
