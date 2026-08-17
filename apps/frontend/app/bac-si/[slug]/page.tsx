"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Navbar from "../../../components/Navbar";
import Footer from "../../../components/Footer";
import BookingModal from "../../../components/BookingModal";
import AiTriageModal from "../../../components/AiTriageModal";
import { SEED_DOCTORS, SEED_SPECIALTIES } from "../../../lib/api";

export default function BacSiDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [isAiTriageOpen, setIsAiTriageOpen] = useState(false);

  const doctor =
    SEED_DOCTORS.find((d) => d.slug === slug) || SEED_DOCTORS[0];

  const specialty = SEED_SPECIALTIES.find(
    (s) => s.name.toLowerCase().includes(doctor.specialtyName?.toLowerCase() || "")
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      <Navbar
        onOpenBooking={() => setIsBookingOpen(true)}
        onOpenAiTriage={() => setIsAiTriageOpen(true)}
      />

      <main className="flex-1 py-12 px-4 sm:px-6 max-w-5xl mx-auto w-full space-y-10">
        {/* Breadcrumb */}
        <div className="text-xs text-slate-500 flex items-center gap-2">
          <Link href="/" className="hover:text-teal-700">Trang chủ</Link>
          <span>/</span>
          <Link href="/#doctors" className="hover:text-teal-700">Bác sĩ</Link>
          <span>/</span>
          <span className="text-teal-900 font-semibold">{doctor.fullName}</span>
        </div>

        {/* Doctor Hero Card */}
        <div className="bg-white rounded-3xl p-8 sm:p-10 border border-slate-200 shadow-md flex flex-col md:flex-row items-start gap-8">
          <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-3xl bg-teal-50 text-teal-800 border-2 border-teal-200 flex items-center justify-center text-6xl font-bold flex-shrink-0 shadow-inner">
            👨‍⚕️
          </div>

          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 bg-teal-50 text-teal-800 text-xs font-bold rounded-full">
                {doctor.specialtyName}
              </span>
              <span className="px-3 py-1 bg-amber-50 text-amber-900 text-xs font-semibold rounded-full">
                ⭐ {doctor.experienceYears} Năm Kinh Nghiệm
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-teal-950 font-serif">
              {doctor.fullName}
            </h1>

            <p className="text-sm font-semibold text-teal-700">
              {doctor.title} • Hệ thống Bệnh viện Đa khoa Quốc tế HealthCare
            </p>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed pt-2">
              {doctor.bio} Từng tham gia nhiều hội nghị khoa học quốc tế, chủ trì các đề tài nghiên cứu cấp bộ và điều trị thành công hàng ngàn ca bệnh lý phức tạp.
            </p>

            <div className="pt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setIsBookingOpen(true)}
                className="px-6 py-3 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-full shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>📅 Đặt Lịch Khám Với Bác Sĩ</span> <span>→</span>
              </button>
            </div>
          </div>
        </div>

        {/* Credentials and Experience Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-teal-950 flex items-center gap-2">
              <span>🎓</span> Quá Trình Đào Tạo & Bằng Cấp
            </h2>
            <ul className="space-y-3 text-xs text-slate-600">
              <li className="flex items-start gap-2">
                <span className="text-teal-700 font-bold">•</span>
                <span>Tốt nghiệp Bác sĩ Đa khoa xuất sắc — Đại học Y Dược TP.HCM</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-700 font-bold">•</span>
                <span>Bác sĩ Chuyên khoa II / Tiến sĩ Y học chuyên ngành lâm sàng</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-700 font-bold">•</span>
                <span>Tu nghiệp Fellow chuyên sâu tại Pháp, Nhật Bản và Singapore</span>
              </li>
            </ul>
          </div>

          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-teal-950 flex items-center gap-2">
              <span>🏥</span> Lĩnh Vực Chuyên Môn Chuyên Sâu
            </h2>
            <ul className="space-y-3 text-xs text-slate-600">
              <li className="flex items-start gap-2">
                <span className="text-teal-700 font-bold">•</span>
                <span>Khám, tầm soát và điều trị toàn diện bệnh lý {doctor.specialtyName}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-700 font-bold">•</span>
                <span>Kỹ thuật can thiệp kỹ thuật cao & phẫu thuật ít xâm lấn</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-700 font-bold">•</span>
                <span>Tư vấn phòng ngừa tái phát và theo dõi sức khỏe dài hạn</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Schedule Timetable Box */}
        <section className="bg-teal-950 text-white p-8 rounded-3xl shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <span className="text-xs uppercase tracking-widest font-bold text-amber-300">
                LỊCH KHÁM TRONG TUẦN
              </span>
              <h2 className="text-xl font-bold text-white mt-1">
                Lịch Làm Việc Tại Bệnh Viện
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setIsBookingOpen(true)}
              className="px-5 py-2 bg-amber-400 hover:bg-amber-500 text-teal-950 text-xs font-bold rounded-full shadow cursor-pointer"
            >
              Chọn Khung Giờ Khám →
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center text-xs">
            {["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"].map((day, idx) => (
              <div key={idx} className="p-3 bg-white/10 rounded-2xl border border-white/15 space-y-1">
                <span className="font-bold text-amber-300 block">{day}</span>
                <span className="text-[11px] text-teal-200 block">Sáng & Chiều</span>
                <span className="text-[10px] text-emerald-300 font-semibold block">Còn chỗ</span>
              </div>
            ))}
          </div>
        </section>
      </main>

      <Footer />

      <BookingModal
        isOpen={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
        initialDoctorId={doctor.id}
        initialSpecialtyId={specialty?.id}
      />

      <AiTriageModal
        isOpen={isAiTriageOpen}
        onClose={() => setIsAiTriageOpen(false)}
        onSelectSpecialtyForBooking={() => setIsBookingOpen(true)}
      />
    </div>
  );
}
