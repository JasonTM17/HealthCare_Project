"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Navbar from "../../../components/Navbar";
import Footer from "../../../components/Footer";
import BookingModal from "../../../components/BookingModal";
import AiTriageModal from "../../../components/AiTriageModal";
import { SEED_PACKAGES } from "../../../lib/api";

export default function GoiKhamDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [isAiTriageOpen, setIsAiTriageOpen] = useState(false);

  const pkg =
    SEED_PACKAGES.find((p) => p.slug === slug) || SEED_PACKAGES[0];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      <Navbar
        onOpenBooking={() => setIsBookingOpen(true)}
        onOpenAiTriage={() => setIsAiTriageOpen(true)}
      />

      <main className="flex-1 py-12 px-4 sm:px-6 max-w-6xl mx-auto w-full space-y-12">
        {/* Breadcrumb */}
        <div className="text-xs text-slate-500 flex items-center gap-2">
          <Link href="/" className="hover:text-teal-700">Trang chủ</Link>
          <span>/</span>
          <Link href="/#packages" className="hover:text-teal-700">Gói khám</Link>
          <span>/</span>
          <span className="text-teal-900 font-semibold">{pkg.name}</span>
        </div>

        {/* Hero Package Overview */}
        <div className="bg-gradient-to-r from-teal-950 via-teal-900 to-teal-800 text-white p-8 sm:p-12 rounded-3xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div className="max-w-2xl space-y-3">
            <span className="text-xs uppercase tracking-widest font-bold text-amber-300">
              GÓI TẦM SOÁT SỨC KHỎE ĐỊNH KỲ
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white font-serif">
              {pkg.name}
            </h1>
            <p className="text-xs sm:text-sm text-teal-200 leading-relaxed">
              {pkg.description}
            </p>
          </div>

          <div className="bg-white/10 border border-white/20 p-6 rounded-2xl backdrop-blur-md text-right min-w-[240px]">
            <span className="text-xs text-teal-300 block">Chi phí trọn gói niêm yết:</span>
            <div className="text-3xl font-extrabold text-amber-300 font-mono mt-1 mb-4">
              {pkg.price.toLocaleString("vi-VN")} <span className="text-xs font-sans">VNĐ</span>
            </div>
            <button
              type="button"
              onClick={() => setIsBookingOpen(true)}
              className="w-full py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-teal-950 text-xs font-extrabold rounded-xl shadow-lg transition-all text-center cursor-pointer"
            >
              Đăng Ký Khám Gói Này →
            </button>
          </div>
        </div>

        {/* Full Checklist Details */}
        <section className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <h2 className="text-xl font-bold text-teal-950 flex items-center gap-2">
            <span>📋</span> Chi Tiết 32 Danh Mục Thăm Khám & Xét Nghiệm
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <span className="font-bold text-teal-900 block text-sm">1. Khám Lâm Sàng Chuyên Khoa</span>
              <ul className="space-y-1 text-slate-600 list-disc list-inside text-xs">
                <li>Đo sinh hiệu (Huyết áp, Mạch, BMI, Cân nặng, Chiều cao)</li>
                <li>Khám Nội tổng quát (Tim, Phổi, Bụng)</li>
                <li>Khám Mắt & Đo thị lực khúc xạ</li>
                <li>Khám Tai Mũi Họng & Răng Hàm Mặt</li>
              </ul>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <span className="font-bold text-teal-900 block text-sm">2. Xét Nghiệm Huyết Học & Sinh Hóa</span>
              <ul className="space-y-1 text-slate-600 list-disc list-inside text-xs">
                <li>Tổng phân tích tế bào máu ngoại vi 24 chỉ số</li>
                <li>Đường huyết đói (Glucose) & HbA1c</li>
                <li>Đánh giá chức năng gan (AST, ALT, GGT)</li>
                <li>Đánh giá chức năng thận (Ure, Creatinine, eGFR)</li>
                <li>Mỡ máu toàn phần (Cholesterol, Triglyceride, HDL, LDL)</li>
              </ul>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <span className="font-bold text-teal-900 block text-sm">3. Chẩn Đoán Hình Ảnh & Thăm Dò Chức Năng</span>
              <ul className="space-y-1 text-slate-600 list-disc list-inside text-xs">
                <li>Chụp X-Quang ngực thẳng kỹ thuật số (KTS)</li>
                <li>Siêu âm ổ bụng tổng quát màu Doppler</li>
                <li>Siêu âm tuyến giáp & Siêu âm tuyến vú (nữ)</li>
                <li>Điện tâm đồ (ECG) 12 chuyển đạo</li>
              </ul>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <span className="font-bold text-teal-900 block text-sm">4. Tầm Soát Dấu Ấn Ung Thư Sớm</span>
              <ul className="space-y-1 text-slate-600 list-disc list-inside text-xs">
                <li>AFP (Tầm soát ung thư gan)</li>
                <li>CEA (Tầm soát ung thư đại trực tràng / đường tiêu hóa)</li>
                <li>PSA (Tầm soát ung thư tuyến tiền liệt cho nam)</li>
                <li>CA 125 / CA 15-3 (Tầm soát buồng trứng / vú cho nữ)</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Preparation Guidelines */}
        <section className="p-6 bg-teal-50 border border-teal-200 rounded-3xl text-xs space-y-2">
          <span className="font-bold text-teal-950 text-sm block">📌 Chuẩn bị trước khi đi khám gói sức khỏe:</span>
          <p className="text-teal-900">1. Nhịn ăn tối thiểu 6–8 tiếng trước khi lấy máu (có thể uống nước lọc).</p>
          <p className="text-teal-900">2. Không uống rượu bia, nước ngọt hoặc dùng chất kích thích trước ngày khám 24 giờ.</p>
          <p className="text-teal-900">3. Phụ nữ không nên khám phụ khoa trong kỳ kinh nguyệt.</p>
        </section>
      </main>

      <Footer />

      <BookingModal
        isOpen={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
        initialPackageId={pkg.id}
      />

      <AiTriageModal
        isOpen={isAiTriageOpen}
        onClose={() => setIsAiTriageOpen(false)}
        onSelectSpecialtyForBooking={() => setIsBookingOpen(true)}
      />
    </div>
  );
}
