"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Navbar from "../../../components/Navbar";
import Footer from "../../../components/Footer";
import BookingModal from "../../../components/BookingModal";
import AiTriageModal from "../../../components/AiTriageModal";
import { SEED_SPECIALTIES, SEED_DOCTORS } from "../../../lib/api";

export default function ChuyenKhoaDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [isAiTriageOpen, setIsAiTriageOpen] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | undefined>();

  const specialty =
    SEED_SPECIALTIES.find((s) => s.slug === slug) || SEED_SPECIALTIES[0];

  const doctorsInSpecialty = SEED_DOCTORS.filter(
    (d) =>
      d.specialtyName?.toLowerCase().includes(specialty.name.toLowerCase().split(" ")[0]) ||
      specialty.name.toLowerCase().includes(d.specialtyName?.toLowerCase() || "")
  );

  const displayDoctors = doctorsInSpecialty.length > 0 ? doctorsInSpecialty : [SEED_DOCTORS[0]];

  const handleBookDoctor = (docId: string) => {
    setSelectedDoctorId(docId);
    setIsBookingOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-sand-100 text-ink font-sans">
      <Navbar
        onOpenBooking={() => setIsBookingOpen(true)}
        onOpenAiTriage={() => setIsAiTriageOpen(true)}
      />

      <main className="flex-1 py-12 px-4 sm:px-6 max-w-6xl mx-auto w-full space-y-12">
        {/* Breadcrumb */}
        <div className="text-xs text-ink-muted flex items-center gap-2">
          <Link href="/" className="hover:text-brand-700">Trang chủ</Link>
          <span>/</span>
          <Link href="/#specialties" className="hover:text-brand-700">Chuyên khoa</Link>
          <span>/</span>
          <span className="text-brand-900 font-semibold">{specialty.name}</span>
        </div>

        {/* Hero Banner for Specialty */}
        <div className="bg-gradient-to-r from-brand-900 via-brand-800 to-brand-950 text-white p-8 sm:p-12 rounded-3xl shadow-xl relative overflow-hidden">
          <div className="max-w-2xl space-y-4">
            <span className="text-4xl sm:text-5xl block">{specialty.icon || "🏥"}</span>
            <span className="text-xs uppercase tracking-widest font-bold text-amber-300">
              TRUNG TÂM CHUYÊN KHOA KỸ THUẬT CAO
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white font-serif">
              {specialty.name}
            </h1>
            <p className="text-sm text-brand-100/90 leading-relaxed">
              {specialty.description} Áp dụng quy chuẩn điều trị hội chẩn đa chuyên khoa (MDT) và trang bị hệ thống máy móc chẩn đoán tối tân.
            </p>
            <div className="pt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setIsBookingOpen(true)}
                className="px-6 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-brand-950 text-xs font-extrabold rounded-full shadow-lg transition-all cursor-pointer"
              >
                📅 Đặt Khám Chuyên Khoa Này →
              </button>
            </div>
          </div>
        </div>

        {/* Key Diagnostic Techniques */}
        <section className="bg-white p-8 rounded-3xl border border-mint-100 shadow-sm space-y-6">
          <h2 className="text-xl font-bold text-brand-950 flex items-center gap-2">
            <span>🔬</span> Kỹ Thuật Chẩn Đoán & Điều Trị Nổi Bật
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs sm:text-sm">
            <div className="p-4 bg-sand-100 rounded-2xl border border-mint-100 space-y-2">
              <span className="font-bold text-brand-900 block text-sm">Chẩn Đoán Hình Ảnh Cao Cấp</span>
              <p className="text-ink-muted leading-relaxed">
                Hệ thống MRI 1.5 Tesla, CT-Scanner 128 lát cắt đa dãy và siêu âm Doppler màu cho độ phân giải sắc nét từng vi cấu trúc.
              </p>
            </div>
            <div className="p-4 bg-sand-100 rounded-2xl border border-mint-100 space-y-2">
              <span className="font-bold text-brand-900 block text-sm">Phẫu Thuật Nội Soi Ít Xâm Lấn</span>
              <p className="text-ink-muted leading-relaxed">
                Kỹ thuật mổ nội soi 3D/4K giảm thiểu đau đớn, vết mổ thẩm mỹ, hạn chế mất máu và rút ngắn thời gian nằm viện chỉ còn 1-2 ngày.
              </p>
            </div>
            <div className="p-4 bg-sand-100 rounded-2xl border border-mint-100 space-y-2">
              <span className="font-bold text-brand-900 block text-sm">Phác Đồ Cá Thể Hóa Chuẩn Quốc Tế</span>
              <p className="text-ink-muted leading-relaxed">
                Mỗi bệnh nhân được xây dựng kế hoạch điều trị riêng biệt dựa trên bệnh lý nền, tiền sử dị ứng và lối sống sinh hoạt.
              </p>
            </div>
          </div>
        </section>

        {/* Doctors in this Specialty */}
        <section className="space-y-6">
          <div className="flex justify-between items-end">
            <div>
              <span className="text-xs uppercase tracking-widest font-bold text-brand-700">
                CHUYÊN GIA PHỤ TRÁCH
              </span>
              <h2 className="text-2xl font-extrabold text-brand-950 mt-1 font-serif">
                Bác Sĩ Chuyên Khoa {specialty.name}
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayDoctors.map((doc) => (
              <div
                key={doc.id}
                className="bg-white rounded-2xl overflow-hidden border border-mint-100 shadow-sm p-6 flex flex-col justify-between"
              >
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-full bg-brand-100 text-brand-800 flex items-center justify-center text-2xl font-bold flex-shrink-0">
                    👨‍⚕️
                  </div>
                  <div>
                    <h3 className="font-bold text-ink text-base">{doc.fullName}</h3>
                    <p className="text-xs text-brand-700 font-medium">{doc.title} • {doc.experienceYears} năm KN</p>
                    <p className="text-xs text-ink-muted mt-2 line-clamp-3 leading-relaxed">{doc.bio}</p>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-mint-100">
                  <button
                    type="button"
                    onClick={() => handleBookDoctor(doc.id)}
                    className="w-full py-2.5 bg-brand-700 hover:bg-brand-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>📅 Đặt hẹn khám với bác sĩ</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <Footer />

      <BookingModal
        isOpen={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
        initialSpecialtyId={specialty.id}
        initialDoctorId={selectedDoctorId}
      />

      <AiTriageModal
        isOpen={isAiTriageOpen}
        onClose={() => setIsAiTriageOpen(false)}
        onSelectSpecialtyForBooking={() => setIsBookingOpen(true)}
      />
    </div>
  );
}


