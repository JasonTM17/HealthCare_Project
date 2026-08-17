import React from "react";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-brand-950 text-brand-200 border-t border-brand-900 py-14 px-4 sm:px-6 text-xs mt-auto">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
        <div className="space-y-3 md:col-span-2">
          <div className="flex items-center gap-2 text-white text-lg font-extrabold">
            <span className="w-8 h-8 rounded-lg bg-brand-700 text-white flex items-center justify-center font-bold">+</span>
            HealthCare Vietnam
          </div>
          <p className="text-brand-300/80 max-w-md leading-relaxed">
            Hệ thống Bệnh viện & Phòng khám Đa khoa Quốc tế chuẩn mực. Quy tụ đội ngũ chuyên gia đầu ngành, trang thiết bị đồng bộ và dịch vụ y tế tận tâm.
          </p>
          <div className="text-ink-faint text-[11px] space-y-1">
            <p>Dự án demo y tế: nội dung giấy phép, chứng nhận và thông tin liên hệ đang được hoàn thiện.</p>
          </div>
        </div>

        <div className="space-y-2.5">
          <h4 className="text-white font-bold text-sm uppercase tracking-wider mb-2">Chuyên Mục Y Khoa</h4>
          <p><Link href="/#specialties" className="hover:text-white transition-colors">Trung tâm chuyên khoa mũi nhọn</Link></p>
          <p><Link href="/#doctors" className="hover:text-white transition-colors">Đội ngũ Phó Giáo sư, Bác sĩ</Link></p>
          <p><Link href="/#packages" className="hover:text-white transition-colors">Gói khám sức khỏe toàn diện</Link></p>
          <p><Link href="/huong-dan" className="hover:text-white transition-colors">Hướng dẫn bảo lãnh viện phí BHYT</Link></p>
          <p><Link href="/tra-cuu" className="hover:text-white transition-colors">Tra cứu lịch hẹn & Phiếu khám</Link></p>
        </div>

        <div className="space-y-2.5">
          <h4 className="text-white font-bold text-sm uppercase tracking-wider mb-2">Liên Hệ & Khẩn Cấp</h4>
          <p className="text-amber-300 font-bold font-mono text-sm">
            🚨 Tổng đài Cấp cứu: <a href="tel:19001234" className="hover:underline">1900 1234</a>
          </p>
          <p className="text-brand-300">📞 Đặt hẹn khám: <span className="font-mono">028 3822 1234</span></p>
          <p className="text-brand-300">📧 Email: contact@healthcare.vn</p>
          <p className="text-brand-300">📍 Trụ sở chính: Số 120 Nguyễn Thị Minh Khai, Q.1, TP.HCM</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto pt-6 border-t border-brand-900/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-brand-400/80">
        <span>© 2026 HealthCare Project. Tất cả quyền được bảo lưu.</span>
        <span>Bản demo giáo dục, chưa phải sản phẩm y tế chính thức.</span>
      </div>

      {/* Mobile Fixed Care Rail */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-brand-950/95 backdrop-blur-md border-t border-brand-800 px-3 py-2 flex items-center justify-around text-[10px]" aria-label="Phím tắt nhanh">
        <Link href="/#packages" className="flex flex-col items-center gap-0.5 text-amber-400 font-bold">
          <span className="text-base" aria-hidden>📦</span>
          <span>Gói khám</span>
        </Link>
        <Link href="/#specialties" className="flex flex-col items-center gap-0.5 text-brand-200 hover:text-white">
          <span className="text-base" aria-hidden>🔬</span>
          <span>Chuyên khoa</span>
        </Link>
        <a href="tel:19001234" className="flex flex-col items-center gap-0.5 text-brand-200 hover:text-white">
          <span className="text-base" aria-hidden>📞</span>
          <span>Liên hệ</span>
        </a>
      </nav>
    </footer>
  );
}

