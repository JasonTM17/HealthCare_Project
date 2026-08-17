"use client";

import React, { useState } from "react";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import BookingModal from "../../components/BookingModal";
import AiTriageModal from "../../components/AiTriageModal";

export default function HuongDanPage() {
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [isAiTriageOpen, setIsAiTriageOpen] = useState(false);

  const insurancePartners = [
    { name: "Đối tác bảo hiểm y tế nhà nước", type: "Bảo hiểm y tế", discount: "Theo quy định" },
    { name: "Đối tác bảo hiểm sức khỏe tư nhân", type: "Bảo lãnh trực tiếp", discount: "Theo hợp đồng" },
    { name: "Đối tác TPA quốc tế", type: "Bảo lãnh viện phí", discount: "Theo hợp đồng" },
  ];

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
          <span className="text-brand-900 font-semibold">Hướng dẫn khám bệnh & Bảo hiểm y tế</span>
        </div>

        {/* Page Header */}
        <div className="text-center max-w-3xl mx-auto">
          <span className="text-xs uppercase tracking-widest font-bold text-brand-700">
            DỊCH VỤ KHÁCH HÀNG & TIỆN ÍCH
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-brand-950 mt-2 font-serif">
            Hướng Dẫn Thăm Khám & Bảo Lãnh Viện Phí
          </h1>
          <p className="text-ink-muted text-sm mt-3 leading-relaxed">
            Mọi thông tin cần thiết giúp bạn và gia đình chuẩn bị chu đáo trước khi đến khám bệnh tại Hệ thống Bệnh viện Đa khoa Quốc tế HealthCare.
          </p>
        </div>

        {/* 4-Step Patient Journey */}
        <section className="bg-white p-8 rounded-3xl border border-mint-100 shadow-sm space-y-8">
          <h2 className="text-xl font-bold text-brand-950 flex items-center gap-2">
            <span>📋</span> Quy Trình Khám Bệnh Ngoại Trú Chuẩn Hóa
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="p-5 bg-brand-50/50 border border-brand-100 rounded-2xl space-y-2">
              <span className="w-9 h-9 rounded-xl bg-brand-700 text-white font-extrabold text-base flex items-center justify-center">
                1
              </span>
              <h3 className="font-bold text-ink text-sm">Đặt Lịch Hẹn</h3>
              <p className="text-xs text-ink-muted leading-relaxed">
                Đặt lịch trực tuyến trước 1 ngày để chọn bác sĩ mong muốn và nhận mã ưu tiên tiếp đón.
              </p>
            </div>

            <div className="p-5 bg-brand-50/50 border border-brand-100 rounded-2xl space-y-2">
              <span className="w-9 h-9 rounded-xl bg-brand-700 text-white font-extrabold text-base flex items-center justify-center">
                2
              </span>
              <h3 className="font-bold text-ink text-sm">Tiếp Đón & Đo Sinh Hiệu</h3>
              <p className="text-xs text-ink-muted leading-relaxed">
                Đến quầy lễ tân trước 15 phút, xuất trình mã đặt lịch, đo huyết áp, nhịp tim và cân nặng.
              </p>
            </div>

            <div className="p-5 bg-brand-50/50 border border-brand-100 rounded-2xl space-y-2">
              <span className="w-9 h-9 rounded-xl bg-brand-700 text-white font-extrabold text-base flex items-center justify-center">
                3
              </span>
              <h3 className="font-bold text-ink text-sm">Khám Chuyên Khoa</h3>
              <p className="text-xs text-ink-muted leading-relaxed">
                Bác sĩ chuyên gia khám lâm sàng, chỉ định xét nghiệm hoặc chẩn đoán hình ảnh nếu cần thiết.
              </p>
            </div>

            <div className="p-5 bg-brand-50/50 border border-brand-100 rounded-2xl space-y-2">
              <span className="w-9 h-9 rounded-xl bg-brand-700 text-white font-extrabold text-base flex items-center justify-center">
                4
              </span>
              <h3 className="font-bold text-ink text-sm">Kết Luận & Lấy Thuốc</h3>
              <p className="text-xs text-ink-muted leading-relaxed">
                Bác sĩ tư vấn phác đồ điều trị, nhận toa thuốc điện tử và thanh toán bảo lãnh tại viện.
              </p>
            </div>
          </div>
        </section>

        {/* Insurance Partners Directory */}
        <section className="bg-brand-950 text-white p-8 sm:p-10 rounded-3xl shadow-xl space-y-8">
          <div>
            <span className="text-xs uppercase tracking-widest font-bold text-amber-300">
              MẠNG LƯỚI ĐỐI TÁC BẢO HIỂM
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1 font-serif">
              Bảo Lãnh Viện Phí Trực Tiếp (Direct Billing)
            </h2>
            <p className="text-brand-200 text-xs sm:text-sm mt-2 max-w-2xl">
              Bệnh nhân có thẻ bảo hiểm sức khỏe thuộc danh sách liên kết sẽ được trừ trực tiếp chi phí khám chữa bệnh ngay tại quầy thu ngân chỉ trong 15 phút.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {insurancePartners.map((item, idx) => (
              <div key={idx} className="p-4 bg-white/10 border border-white/15 rounded-2xl space-y-1">
                <span className="text-amber-300 font-bold text-sm block">{item.name}</span>
                <p className="text-xs text-brand-200">{item.type} • <span className="text-emerald-300">{item.discount}</span></p>
              </div>
            ))}
          </div>

          <div className="p-5 bg-brand-900/80 border border-brand-700/60 rounded-2xl text-xs text-brand-100 space-y-2">
            <span className="font-bold text-amber-300 block">📌 Giấy tờ cần chuẩn bị khi sử dụng Bảo Hiểm:</span>
            <p>1. Căn cước công dân (CCCD) hoặc Hộ chiếu bản gốc.</p>
            <p>2. Thẻ Bảo hiểm sức khỏe tư nhân (hoặc thẻ điện tử trên ứng dụng di động).</p>
            <p>3. Thẻ Bảo hiểm Y tế nhà nước (BHYT) kèm ảnh trên ứng dụng VssID.</p>
          </div>
        </section>

        {/* FAQ Accordion Section */}
        <section className="bg-white p-8 rounded-3xl border border-mint-100 shadow-sm space-y-6">
          <h2 className="text-xl font-bold text-brand-950 flex items-center gap-2">
            <span>❓</span> Các Câu Hỏi Thường Gặp (FAQs)
          </h2>

          <div className="space-y-4 text-xs sm:text-sm">
            <div className="p-4 bg-sand-100 rounded-2xl border border-mint-100 space-y-1.5">
              <h4 className="font-bold text-ink">Tôi có cần nhịn ăn trước khi xét nghiệm máu hoặc khám tổng quát không?</h4>
              <p className="text-ink-muted text-xs leading-relaxed">
                Có. Đối với các xét nghiệm đường huyết, mỡ máu, chức năng gan thận hoặc siêu âm ổ bụng tổng quát, quý khách vui lòng nhịn ăn từ 6 - 8 tiếng trước giờ khám (có thể uống một ít nước lọc).
              </p>
            </div>

            <div className="p-4 bg-sand-100 rounded-2xl border border-mint-100 space-y-1.5">
              <h4 className="font-bold text-ink">Bệnh viện có khám vào ngày Chủ Nhật và ngoài giờ hành chính không?</h4>
              <p className="text-ink-muted text-xs leading-relaxed">
                Khoa Cấp cứu hoạt động 24/7 tất cả các ngày trong năm. Phòng khám Ngoại trú hoạt động từ Thứ 2 đến Thứ 7 (07:00 - 17:00). Cơ sở Thủ Đức có tổ chức khám chuyên khoa ngoài giờ vào sáng Chủ Nhật.
              </p>
            </div>

            <div className="p-4 bg-sand-100 rounded-2xl border border-mint-100 space-y-1.5">
              <h4 className="font-bold text-ink">Nếu tôi đến trễ hơn giờ hẹn đã đặt thì lịch khám có bị hủy không?</h4>
              <p className="text-ink-muted text-xs leading-relaxed">
                Hệ thống giữ chỗ ưu tiên trong vòng 15 phút so với giờ hẹn đã xác nhận. Nếu đến trễ quá 15 phút, quý khách sẽ được sắp xếp vào lượt khám gần nhất của bác sĩ.
              </p>
            </div>
          </div>

          <div className="pt-4 text-center">
            <button
              type="button"
              onClick={() => setIsBookingOpen(true)}
              className="px-8 py-3 bg-brand-700 hover:bg-brand-800 text-white font-bold text-xs rounded-full shadow-md transition-all cursor-pointer"
            >
              Đặt Lịch Khám Trực Tuyến Ngay →
            </button>
          </div>
        </section>
      </main>

      <Footer />

      <BookingModal
        isOpen={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
      />

      <AiTriageModal
        isOpen={isAiTriageOpen}
        onClose={() => setIsAiTriageOpen(false)}
        onSelectSpecialtyForBooking={() => setIsBookingOpen(true)}
      />
    </div>
  );
}

