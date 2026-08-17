"use client";

import React, { useState } from "react";
import Link from "next/link";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import BookingModal from "../components/BookingModal";
import AiTriageModal from "../components/AiTriageModal";
import {
  SEED_SPECIALTIES,
  SEED_DOCTORS,
  SEED_PACKAGES,
  SEED_BRANCHES,
} from "../lib/api";

export default function Home() {
  const [isBookingOpen, setIsBookingOpen] = useState<boolean>(false);
  const [isAiTriageOpen, setIsAiTriageOpen] = useState<boolean>(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | undefined>();
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState<string | undefined>();
  const [selectedPackageId, setSelectedPackageId] = useState<string | undefined>();
  const [selectedBranchId, setSelectedBranchId] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState<string>("");

  const handleOpenBooking = (doctorId?: string, specialtyId?: string, packageId?: string, branchId?: string) => {
    setSelectedDoctorId(doctorId);
    setSelectedSpecialtyId(specialtyId);
    setSelectedPackageId(packageId);
    setSelectedBranchId(branchId);
    setIsBookingOpen(true);
  };

  const handleAiSpecialtySelect = (specialtyName: string) => {
    const matched = SEED_SPECIALTIES.find((s) => s.name.includes(specialtyName) || specialtyName.includes(s.name));
    handleOpenBooking(undefined, matched?.id, undefined);
  };

  // Filter specialties and doctors based on search
  const filteredSpecialties = SEED_SPECIALTIES.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDoctors = SEED_DOCTORS.filter((d) =>
    d.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.specialtyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.bio.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col bg-sand-100 text-ink font-sans pb-16 sm:pb-0">
      <Navbar
        onOpenBooking={() => handleOpenBooking()}
        onOpenAiTriage={() => setIsAiTriageOpen(true)}
      />

      <main className="flex-1">
        {/* ── 1. Hero Section with Smart Search & Care Rail ─────────── */}
        <section className="relative overflow-hidden bg-gradient-to-b from-brand-900 via-brand-800 to-brand-950 text-white py-16 lg:py-24 px-4 sm:px-6">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" />

          <div className="relative max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-800/80 border border-brand-600/50 text-xs font-semibold text-mint-200">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Nền tảng Y tế Số: đặt lịch khám chuẩn 30 phút</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight font-serif">
                Chăm Sóc Tận Tâm, <br />
                <span className="text-amber-400">Y Khoa Chuẩn Mực.</span>
              </h1>

              <p className="text-base sm:text-lg text-brand-100/90 max-w-2xl leading-relaxed">
                Hệ sinh thái bệnh viện đa khoa quy tụ đội ngũ chuyên gia đầu ngành, áp dụng kỹ thuật chẩn đoán và điều trị tiên tiến với quy trình đặt khám không chờ đợi.
              </p>

              {/* Quick Search Bar */}
              <div className="pt-2 max-w-xl">
                <div className="relative flex items-center bg-white rounded-2xl p-2 shadow-2xl">
                  <span className="pl-3 text-ink-faint text-lg">🔍</span>
                  <input
                    type="text"
                    placeholder="Tìm theo chuyên khoa, triệu chứng hoặc tên bác sĩ..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 text-sm text-ink focus:outline-none placeholder-ink-faint"
                  />
                  <button
                    type="button"
                    onClick={() => handleOpenBooking()}
                    className="px-6 py-2.5 bg-brand-700 hover:bg-brand-800 text-white text-xs font-bold rounded-xl transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Đặt hẹn ngay
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-brand-200/90 pt-2">
                <span>✓ Giữ chỗ thời gian thực 10 phút</span>
                <span>✓ Không thu phí trước</span>
                <span>✓ Hỗ trợ BHYT & Bảo lãnh trực tiếp</span>
              </div>
            </div>

            {/* Quick-Access Care Rail */}
            <div className="lg:col-span-5 grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => handleOpenBooking()}
                className="p-5 bg-white/10 hover:bg-white/15 border border-white/20 backdrop-blur-md rounded-2xl text-left transition-all hover:-translate-y-1 group cursor-pointer"
              >
                <span className="text-3xl mb-3 block">📅</span>
                <h3 className="font-bold text-white text-base group-hover:text-amber-300 transition-colors">
                  Đặt Lịch Khám
                </h3>
                <p className="text-xs text-brand-200 mt-1">Chọn bác sĩ & giữ slot 30 phút nhanh chóng</p>
              </button>

              <button
                type="button"
                onClick={() => setIsAiTriageOpen(true)}
                className="p-5 bg-gradient-to-br from-amber-500/20 to-brand-500/20 hover:from-amber-500/30 hover:to-brand-500/30 border border-amber-400/30 backdrop-blur-md rounded-2xl text-left transition-all hover:-translate-y-1 group cursor-pointer"
              >
                <span className="text-3xl mb-3 block">🤖</span>
                <h3 className="font-bold text-amber-300 text-base group-hover:text-white transition-colors">
                  AI Triage Triệu Chứng
                </h3>
                <p className="text-xs text-brand-200 mt-1">Tư vấn chuyên khoa & hướng dẫn xử trí sơ bộ</p>
              </button>

              <Link
                href="/#packages"
                className="p-5 bg-white/10 hover:bg-white/15 border border-white/20 backdrop-blur-md rounded-2xl text-left transition-all hover:-translate-y-1 group block"
              >
                <span className="text-3xl mb-3 block">📦</span>
                <h3 className="font-bold text-white text-base group-hover:text-amber-300 transition-colors">
                  Gói Khám Toàn Diện
                </h3>
                <p className="text-xs text-brand-200 mt-1">Tầm soát ung thư & kiểm tra định kỳ</p>
              </Link>

              <Link
                href="/#branches"
                className="p-5 bg-white/10 hover:bg-white/15 border border-white/20 backdrop-blur-md rounded-2xl text-left transition-all hover:-translate-y-1 group block"
              >
                <span className="text-3xl mb-3 block">🏥</span>
                <h3 className="font-bold text-white text-base group-hover:text-amber-300 transition-colors">
                  Cơ Sở & Cấp Cứu
                </h3>
                <p className="text-xs text-brand-200 mt-1">Chỉ đường & hotline cấp cứu 24/7</p>
              </Link>
            </div>
          </div>
        </section>

        {/* ── 2. Key Centers of Excellence (Chuyên Khoa Mũi Nhọn) ───── */}
        <section id="specialties" className="py-20 px-4 sm:px-6 max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-xs uppercase tracking-widest font-bold text-brand-700">
              TRUNG TÂM Y KHOA CHUYÊN SÂU
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-brand-950 mt-2 font-serif">
              Các Chuyên Khoa Mũi Nhọn
            </h2>
            <p className="text-ink-muted text-sm sm:text-base mt-3">
              Trang bị đồng bộ hệ thống chẩn đoán hình ảnh cao cấp (MRI 1.5 Tesla, CT 128 lát cắt, Nội soi NBI) giúp phát hiện tổn thương ở giai đoạn sớm.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredSpecialties.map((sp) => (
              <div
                key={sp.id}
                className="p-6 bg-white border border-mint-100 hover:border-brand-400 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group"
              >
                <div>
                  <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-800 text-3xl flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-brand-700 group-hover:text-white transition-all duration-300">
                    {sp.icon || "🏥"}
                  </div>
                  <Link href={`/chuyen-khoa/${sp.slug}`}>
                    <h3 className="text-lg font-bold text-ink mb-2 group-hover:text-brand-700 transition-colors">
                      {sp.name}
                    </h3>
                  </Link>
                  <p className="text-xs text-ink-muted leading-relaxed mb-6">
                    {sp.description}
                  </p>
                </div>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => handleOpenBooking(undefined, sp.id, undefined)}
                    className="w-full py-2.5 px-4 bg-brand-700 hover:bg-brand-800 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <span>Đặt lịch khám</span>
                    <span>→</span>
                  </button>
                  <Link
                    href={`/chuyen-khoa/${sp.slug}`}
                    className="block text-center text-xs font-semibold text-brand-700 hover:underline py-1"
                  >
                    Xem chi tiết chuyên khoa
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 3. Specialist Doctors Showcase ────────────────────────── */}
        <section id="doctors" className="py-20 px-4 sm:px-6 bg-mint-100/80 border-y border-mint-100">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
              <div>
                <span className="text-xs uppercase tracking-widest font-bold text-brand-700">
                  ĐỘI NGŨ CHUYÊN GIA
                </span>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-brand-950 mt-2 font-serif">
                  Bác Sĩ Giàu Kinh Nghiệm
                </h2>
                <p className="text-ink-muted text-sm mt-2 max-w-2xl">
                  Đội ngũ Phó Giáo sư, Tiến sĩ, Bác sĩ Chuyên khoa II từng công tác tại các bệnh viện trung ương, tận tâm và thấu hiểu bệnh nhân.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleOpenBooking()}
                className="px-6 py-2.5 bg-brand-700 hover:bg-brand-800 text-white text-xs font-bold rounded-full shadow transition-all self-start md:self-auto cursor-pointer"
              >
                Đặt lịch khám →
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredDoctors.map((doc) => (
                <div
                  key={doc.id}
                  className="bg-white rounded-2xl overflow-hidden border border-mint-100 shadow-sm hover:shadow-lg transition-all flex flex-col justify-between"
                >
                  <div className="p-6">
                    <div className="w-24 h-24 rounded-full bg-brand-700/10 text-brand-800 mx-auto flex items-center justify-center text-4xl mb-4 border-2 border-brand-200">
                      👨‍⚕️
                    </div>
                    <div className="text-center">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-2.5 py-0.5 rounded-full inline-block mb-1.5">
                        {doc.specialtyName}
                      </span>
                      <h3 className="text-base font-extrabold text-ink">
                        {doc.fullName}
                      </h3>
                      <p className="text-xs text-ink-muted mt-0.5 font-medium">
                        {doc.title} • {doc.experienceYears} năm kinh nghiệm
                      </p>
                      <p className="text-xs text-ink-muted mt-3 line-clamp-3 text-left leading-relaxed">
                        {doc.bio}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-sand-100 border-t border-mint-100">
                    <button
                      type="button"
                      onClick={() => handleOpenBooking(doc.id, undefined, undefined)}
                      className="w-full py-2.5 bg-brand-700 hover:bg-brand-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>📅 Đặt hẹn với bác sĩ</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 4. Health Packages & Screening ────────────────────────── */}
        <section id="packages" className="py-20 px-4 sm:px-6 bg-brand-950 text-white">
          <div className="max-w-7xl mx-auto">
            <div className="text-center max-w-3xl mx-auto mb-14">
              <span className="text-xs uppercase tracking-widest font-bold text-amber-300">
                CHỦ ĐỘNG BẢO VỆ SỨC KHỎE
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-2 font-serif">
                Gói Khám Sức Khỏe Toàn Diện
              </h2>
              <p className="text-brand-200 text-sm mt-3">
                Thiết kế khoa học theo từng độ tuổi và nhóm nguy cơ, giúp phát hiện sớm các mầm mống bệnh lý trước khi có triệu chứng.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {SEED_PACKAGES.map((pkg) => (
                <div
                  key={pkg.id}
                  className={`rounded-3xl p-8 flex flex-col justify-between border transition-all ${
                    pkg.featured
                      ? "bg-gradient-to-b from-brand-900 to-brand-800 border-amber-400/40 shadow-2xl relative"
                      : "bg-brand-900/60 border-brand-800 shadow-lg"
                  }`}
                >
                  {pkg.featured && (
                    <span className="absolute -top-3 right-6 bg-amber-400 text-brand-950 text-[10px] font-extrabold uppercase px-3 py-1 rounded-full tracking-wider shadow">
                      ĐƯỢC ĐĂNG KÝ NHIỀU NHẤT
                    </span>
                  )}

                  <div>
                    <Link href={`/goi-kham/${pkg.slug}`}>
                      <h3 className="text-xl font-extrabold text-white mb-2 hover:text-amber-300 transition-colors">
                        {pkg.name}
                      </h3>
                    </Link>
                    <p className="text-xs text-brand-200 leading-relaxed mb-6">
                      {pkg.description}
                    </p>

                    <div className="mb-6 pb-6 border-b border-brand-700/50">
                      <span className="text-xs text-brand-300">Chi phí trọn gói:</span>
                      <div className="text-3xl font-extrabold text-amber-300 font-mono mt-1">
                        {pkg.price.toLocaleString("vi-VN")} <span className="text-sm font-sans">VNĐ</span>
                      </div>
                    </div>

                    <div className="space-y-2.5 mb-8">
                      <span className="text-xs font-bold text-brand-200 uppercase tracking-wider block mb-2">
                        Danh mục nổi bật:
                      </span>
                      {pkg.checklist?.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-2.5 text-xs text-brand-100">
                          <span className="text-emerald-400 font-bold">✓</span>
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => handleOpenBooking(undefined, undefined, pkg.id)}
                      className="w-full py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-brand-950 text-xs font-extrabold rounded-xl shadow-lg transition-all text-center cursor-pointer"
                    >
                      Đăng Ký Gói Khám Này →
                    </button>
                    <Link
                      href={`/goi-kham/${pkg.slug}`}
                      className="block text-center text-xs text-brand-300 hover:text-white py-1"
                    >
                      Xem chi tiết 32 danh mục xét nghiệm
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 5. Patient Journey & Direct Billing ───────────────────── */}
        <section id="guide" className="py-20 px-4 sm:px-6 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-xs uppercase tracking-widest font-bold text-brand-700">
                TIỆN ÍCH DÀNH CHO BỆNH NHÂN
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-brand-950 mt-2 font-serif">
                Quy Trình Khám Nhanh 4 Bước
              </h2>
              <p className="text-ink-muted text-sm mt-3 mb-8">
                Tối ưu hóa thời gian với hệ thống số hóa hồ sơ bệnh án, giúp người bệnh giảm thiểu thời gian chờ đợi tại viện.
              </p>

              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 bg-white border border-mint-100 rounded-2xl">
                  <span className="w-8 h-8 rounded-full bg-brand-700 text-white font-bold text-sm flex items-center justify-center flex-shrink-0">
                    1
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-ink">Đặt hẹn & Nhận mã khám</h4>
                    <p className="text-xs text-ink-muted mt-0.5">Đặt lịch trực tuyến trong 60 giây và nhận mã lịch hẹn điện tử.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-white border border-mint-100 rounded-2xl">
                  <span className="w-8 h-8 rounded-full bg-brand-700 text-white font-bold text-sm flex items-center justify-center flex-shrink-0">
                    2
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-ink">Tiếp đón ưu tiên</h4>
                    <p className="text-xs text-ink-muted mt-0.5">Đến quầy tiếp đón trước 15 phút, quét mã và vào thẳng phòng khám.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-white border border-mint-100 rounded-2xl">
                  <span className="w-8 h-8 rounded-full bg-brand-700 text-white font-bold text-sm flex items-center justify-center flex-shrink-0">
                    3
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-ink">Thăm khám & Cận lâm sàng</h4>
                    <p className="text-xs text-ink-muted mt-0.5">Bác sĩ chuyên gia thăm khám kỹ lưỡng và chỉ định xét nghiệm nếu cần.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-white border border-mint-100 rounded-2xl">
                  <span className="w-8 h-8 rounded-full bg-brand-700 text-white font-bold text-sm flex items-center justify-center flex-shrink-0">
                    4
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-ink">Tư vấn phác đồ & Nhận kết quả số</h4>
                    <p className="text-xs text-ink-muted mt-0.5">Bác sĩ giải thích phác đồ điều trị, kết quả được lưu trữ số an toàn.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Insurance & Billing Card */}
            <div className="p-8 bg-gradient-to-br from-ink to-brand-950 text-white rounded-3xl shadow-xl border border-brand-800 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-800/80 rounded-full text-xs font-semibold text-brand-200">
                🛡️ BẢO HIỂM Y TẾ & BẢO LÃNH VIỆN PHÍ
              </div>
              <h3 className="text-2xl font-bold text-white font-serif">
                Hợp Tác Toàn Diện Hơn 30 Đối Tác Bảo Hiểm
              </h3>
              <p className="text-xs text-brand-200 leading-relaxed">
                HealthCare hỗ trợ thanh toán bảo hiểm y tế nhà nước và dịch vụ bảo lãnh viện phí trực tiếp cho các công ty bảo hiểm đối tác. Danh sách đối tác đang được hoàn thiện.
              </p>

              <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                  <span className="font-bold text-amber-300 block mb-1">BHYT Toàn Quốc</span>
                  <span className="text-brand-200 text-[11px]">Hưởng đầy đủ quyền lợi theo quy định</span>
                </div>
                <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                  <span className="font-bold text-amber-300 block mb-1">Bảo Lãnh Nhanh</span>
                  <span className="text-brand-200 text-[11px]">Xác nhận hạn mức chỉ trong 15 phút</span>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  href="/huong-dan"
                  className="block w-full py-3 bg-brand-700 hover:bg-brand-600 text-white text-xs font-bold rounded-xl transition-all text-center"
                >
                  Xem Hướng Dẫn Chi Tiết & Đối Tác Bảo Hiểm →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── 6. Hospital Network & Branches ───────────────────────── */}
        <section id="branches" className="py-20 px-4 sm:px-6 bg-mint-100/90 border-t border-mint-100">
          <div className="max-w-7xl mx-auto">
            <div className="text-center max-w-3xl mx-auto mb-14">
              <span className="text-xs uppercase tracking-widest font-bold text-brand-700">
                MẠNG LƯỚI PHỤC VỤ
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-brand-950 mt-2 font-serif">
                Hệ Thống Cơ Sở Tại TP. Hồ Chí Minh
              </h2>
              <p className="text-ink-muted text-sm mt-3">
                Vị trí đắc địa tại các quận trung tâm, thuận tiện giao thông và có bãi đỗ xe ô tô rộng rãi.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {SEED_BRANCHES.map((br) => (
                <div
                  key={br.id}
                  className="p-6 bg-white border border-mint-100 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <span className="text-2xl block">🏥</span>
                    <h3 className="text-base font-bold text-brand-950">
                      {br.name}
                    </h3>
                    <p className="text-xs text-ink-muted leading-relaxed">
                      📍 {br.address}
                    </p>
                    <p className="text-xs text-brand-800 font-semibold">
                      📞 Hotline: <span className="font-mono">{br.phone}</span>
                    </p>
                    <p className="text-xs text-ink-muted">
                      🕒 {br.workingHours}
                    </p>
                  </div>

                  <div className="pt-6">
                    <button
                      type="button"
                      onClick={() => handleOpenBooking(undefined, undefined, undefined, br.id)}
                      className="w-full py-2 bg-brand-50 hover:bg-brand-700 text-brand-800 hover:text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                    >
                      Đặt lịch khám tại cơ sở này →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
        {/* ── 7. Health Content & Innovation (Cẩm nang sức khỏe) ───── */}
        <section id="articles" className="py-20 px-4 sm:px-6 max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
            <div>
              <span className="text-xs uppercase tracking-widest font-bold text-brand-700">
                CẨM NANG SỨC KHỎE
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-brand-950 mt-2 font-serif">
                Kiến Thức Y Khoa Mỗi Ngày
              </h2>
              <p className="text-ink-muted text-sm mt-2 max-w-2xl">
                Bài viết sức khỏe và cập nhật công nghệ chẩn đoán từ đội ngũ chuyên môn.
              </p>
            </div>
            <Link
              href="/huong-dan"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-700 hover:text-brand-500 transition-colors"
            >
              Xem thêm nội dung
              <span aria-hidden>→</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: "Nhận biết sớm 5 dấu hiệu bệnh tim mạch",
                summary:
                  "Đau tức ngực khi gắng sức, khó thở về đêm và mệt mỏi bất thường có thể là tín hiệu cần khám tim mạch sớm.",
              },
              {
                title: "Dinh dưỡng hợp lý cho người tăng huyết áp",
                summary:
                  "Giảm muối, tăng rau xanh và hạn chế chất béo bão hòa là ba nguyên tắc nền tảng trong ăn uống hằng ngày.",
              },
              {
                title: "Trẻ biếng ăn: hiểu đúng để chăm đúng",
                summary:
                  "Biếng ăn có nhiều nguyên nhân khác nhau, từ giai đoạn tăng trưởng đến tâm lý. Cha mẹ nên bình tĩnh tìm hiểu thay vì ép trẻ.",
              },
            ].map((article) => (
              <article
                key={article.title}
                className="p-6 bg-white border border-mint-100 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col gap-3"
              >
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Chia sẻ chuyên môn
                </span>
                <h3 className="text-base font-bold text-brand-950 leading-snug">
                  {article.title}
                </h3>
                <p className="text-xs text-ink-muted leading-relaxed flex-1">
                  {article.summary}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* ── 8. Closing CTA Band ────────────────────────────────────── */}
        <section className="bg-sand-200/60 border-y border-sand-200 py-20 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-brand-950 font-serif text-balance">
              Đặt Lịch Hẹn Hôm Nay
            </h2>
            <p className="text-ink-muted text-sm sm:text-base max-w-2xl mx-auto">
              Sức khỏe của bạn rất quan trọng. Đặt lịch với đội ngũ bác sĩ của
              HealthCare để được tư vấn kịp thời.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => handleOpenBooking()}
                className="px-8 py-3.5 bg-amber-400 hover:bg-amber-500 text-brand-950 text-sm font-extrabold rounded-full shadow-lg hover:shadow-xl transition-all cursor-pointer"
              >
                Đặt lịch khám
              </button>
              <Link
                href="/#specialties"
                className="px-8 py-3.5 border-2 border-brand-700 text-brand-700 hover:bg-brand-50 text-sm font-bold rounded-full transition-colors"
              >
                Xem chuyên khoa
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      {/* ── Interactive Modals ─────────────────────────────────────── */}
      <BookingModal
        isOpen={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
        initialDoctorId={selectedDoctorId}
        initialSpecialtyId={selectedSpecialtyId}
        initialPackageId={selectedPackageId}
        initialBranchId={selectedBranchId}
        packages={SEED_PACKAGES}
      />

      <AiTriageModal
        isOpen={isAiTriageOpen}
        onClose={() => setIsAiTriageOpen(false)}
        onSelectSpecialtyForBooking={handleAiSpecialtySelect}
      />
    </div>
  );
}


