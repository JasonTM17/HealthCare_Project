"use client";

import React, { useState } from "react";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import BookingModal from "../../components/BookingModal";
import AiTriageModal from "../../components/AiTriageModal";
import Icon from "../../components/UiIcon";
import { AppointmentDetails } from "../../types/hospital";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080/api/v1";

export default function TraCuuPage() {
  const [bookingCodeInput, setBookingCodeInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [appointment, setAppointment] = useState<AppointmentDetails | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState(false);

  // Modals
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [isAiTriageOpen, setIsAiTriageOpen] = useState(false);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingCodeInput.trim()) {
      setErrorMessage("Vui lòng nhập Mã lịch hẹn");
      return;
    }
    if (!phoneInput.trim()) {
      setErrorMessage("Vui lòng nhập số điện thoại đã dùng khi đặt lịch");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setAppointment(null);
    setCancelSuccess(false);

    try {
      const res = await fetch(
        `${API_BASE_URL}/appointments/${bookingCodeInput.trim()}?phone=${encodeURIComponent(phoneInput.trim())}`
      );
      if (!res.ok) {
        throw new Error(
          "Không tìm thấy lịch hẹn với mã này. Vui lòng kiểm tra lại mã đã nhận qua tin nhắn/email."
        );
      }
      const data: AppointmentDetails = await res.json();
      setAppointment(data);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Không tìm thấy lịch hẹn hoặc thông tin xác thực không đúng."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAppointment = async () => {
    if (!appointment) return;
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/appointments/${appointment.bookingCode}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: cancelReason || "Bệnh nhân yêu cầu hủy",
          phone: phoneInput.trim(),
        }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Không thể hủy lịch hẹn.");
      }
      setAppointment({ ...appointment, status: "CANCELLED" });
      setCancelSuccess(true);
      setShowCancelDialog(false);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Không thể hủy lịch hẹn.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-sand-100 text-ink font-sans">
      <Navbar
        onOpenBooking={() => setIsBookingOpen(true)}
        onOpenAiTriage={() => setIsAiTriageOpen(true)}
      />

      <main className="flex-1 py-12 px-4 sm:px-6 max-w-4xl mx-auto w-full">
        {/* Breadcrumb */}
        <div className="text-xs text-ink-muted mb-6 flex items-center gap-2">
          <Link href="/" className="hover:text-brand-700">Trang chủ</Link>
          <span>/</span>
          <span className="text-brand-900 font-semibold">Tra cứu lịch hẹn & Phiếu khám</span>
        </div>

        {/* Page Header */}
        <div className="text-center mb-8">
          <span className="text-xs uppercase tracking-widest font-bold text-brand-700">
            CỔNG THÔNG TIN BỆNH NHÂN
          </span>
          <h1 className="text-3xl font-extrabold text-brand-950 mt-1 font-serif">
            Tra Cứu Lịch Hẹn Trực Tuyến
          </h1>
          <p className="text-xs sm:text-sm text-ink-muted mt-2 max-w-xl mx-auto">
            Nhập Mã lịch hẹn (được cấp khi đặt khám thành công) để xem trạng thái, phòng khám, bác sĩ phụ trách hoặc thay đổi lịch hẹn.
          </p>
        </div>

        {/* Search Card */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-mint-100 shadow-md mb-8">
          <form onSubmit={handleLookup} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
              <div className="sm:col-span-8">
                <label className="block text-xs font-bold text-ink-muted uppercase mb-1.5">
                  Mã lịch hẹn khám <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: APT-9F3A..."
                  value={bookingCodeInput}
                  onChange={(e) => setBookingCodeInput(e.target.value)}
                  className="w-full p-3 bg-sand-100 border border-mint-200 rounded-xl font-mono text-sm font-bold text-ink focus:ring-2 focus:ring-brand-600 focus:outline-none uppercase"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="block text-xs font-bold text-ink-muted uppercase mb-1.5">
                  Số điện thoại đặt lịch <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="0901234567"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  className="w-full p-3 bg-sand-100 border border-mint-200 rounded-xl text-sm text-ink focus:ring-2 focus:ring-brand-600 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-12 flex items-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-brand-700 hover:bg-brand-800 disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? <><Icon name="clock" size={16} /> Đang tra cứu...</> : <><Icon name="search" size={16} /> Tra Cứu Ngay</>}
                </button>
              </div>
            </div>
          </form>

          {errorMessage && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <Icon name="alert-triangle" size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {cancelSuccess && (
            <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold flex items-center gap-2">
              <Icon name="check" size={16} />
              <span>Lịch hẹn đã được hủy thành công theo yêu cầu của bạn.</span>
            </div>
          )}
        </div>

        {/* Appointment Result Ticket */}
        {appointment && (
          <div className="bg-white rounded-3xl overflow-hidden border border-brand-100 shadow-xl animate-fadeIn">
            {/* Header Status Bar */}
            <div className="bg-gradient-to-r from-brand-900 to-brand-800 text-white p-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-[10px] text-brand-300 font-bold uppercase tracking-wider block">
                  PHIẾU KHÁM BỆNH ĐIỆN TỬ
                </span>
                <h3 className="text-xl font-extrabold text-white">
                  Mã Lịch Hẹn: <span className="text-amber-400 font-mono">{appointment.bookingCode}</span>
                </h3>
              </div>

              <span
                className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                  appointment.status === "CONFIRMED"
                    ? "bg-emerald-400 text-brand-950"
                    : appointment.status === "CANCELLED"
                    ? "bg-red-200 text-red-900"
                    : "bg-amber-300 text-amber-950"
                }`}
              >
                {appointment.status === "CONFIRMED"
                  ? "ĐÃ XÁC NHẬN"
                  : appointment.status === "CANCELLED"
                  ? "ĐÃ HỦY LỊCH"
                  : "CHỜ XÁC NHẬN"}
              </span>
            </div>

            {/* Ticket Body */}
            <div className="p-6 sm:p-8 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-6 border-b border-mint-100 text-sm">
                <div>
                  <span className="text-xs text-ink-faint font-bold block mb-1">THÔNG TIN BỆNH NHÂN</span>
                  <p className="font-extrabold text-ink text-base">{appointment.patientName}</p>
                  <p className="flex items-center gap-1.5 text-xs text-ink-muted mt-1"><Icon name="phone" size={14} /> Số điện thoại: {appointment.patientPhone}</p>
                  {appointment.patientEmail && (
                    <p className="flex items-center gap-1.5 text-xs text-ink-muted"><Icon name="mail" size={14} /> Email: {appointment.patientEmail}</p>
                  )}
                  {appointment.reasonForVisit && (
                    <p className="text-xs text-brand-800 bg-brand-50 p-2.5 rounded-lg mt-2">
                      <span className="font-semibold">Lý do khám:</span> {appointment.reasonForVisit}
                    </p>
                  )}
                </div>

                <div>
                  <span className="text-xs text-ink-faint font-bold block mb-1">THỜI GIAN & ĐỊA ĐIỂM KHÁM</span>
                  <div className="p-3 bg-amber-50/80 border border-amber-200/60 rounded-xl mb-2">
                    <p className="text-xs text-amber-900 font-semibold">Ngày khám:</p>
                    <p className="text-base font-extrabold text-amber-950">
                      <span className="inline-flex items-center gap-1.5"><Icon name="calendar" size={15} /> {appointment.appointmentDate} (Khung giờ: {appointment.startTime.slice(0, 5)} - {appointment.endTime.slice(0, 5)})</span>
                    </p>
                  </div>
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-ink"><Icon name="building" size={15} /> {appointment.branchName}</p>
                  <p className="text-xs text-ink-muted mt-0.5">{appointment.branchAddress}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                <div>
                  <span className="text-xs text-ink-faint font-bold block mb-1">BÁC SĨ PHỤ TRÁCH</span>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="w-12 h-12 rounded-full bg-brand-100 text-brand-800 flex items-center justify-center text-xl font-bold">
                      <Icon name="stethoscope" size={22} />
                    </div>
                    <div>
                      <p className="font-bold text-ink">{appointment.doctorName}</p>
                      <p className="text-xs text-brand-700">{appointment.specialtyName}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <span className="text-xs text-ink-faint font-bold block mb-1">HÌNH THỨC THANH TOÁN</span>
                  <p className="text-xs text-ink-muted mt-2">
                    Phương thức thanh toán và bảo lãnh cần được xác nhận với cơ sở; backend chưa cung cấp policy cho lịch hẹn này.
                  </p>
                </div>
              </div>

              {/* Patient Guidelines Box */}
              <div className="p-4 bg-sand-100 border border-mint-100 rounded-2xl text-xs text-ink-muted space-y-1.5">
                <span className="flex items-center gap-1.5 font-bold text-ink"><Icon name="book-open" size={15} /> Hướng dẫn khi đến khám:</span>
                <p>1. Mang theo mã lịch hẹn <span className="font-mono font-bold text-brand-900">{appointment.bookingCode}</span> khi đến cơ sở.</p>
                <p>2. Giấy tờ, thời gian có mặt và quy định tiếp đón cần được xác nhận lại với cơ sở.</p>
                <p>3. Không dùng trang tra cứu này như hướng dẫn y khoa hoặc cam kết bảo hiểm.</p>
              </div>

              {/* Actions */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-mint-100">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-5 py-2.5 bg-mint-100 hover:bg-mint-200 text-ink-muted text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
                >
                  <Icon name="printer" size={15} /> In Phiếu Khám
                </button>

                {appointment.status === "CONFIRMED" && (
                  <button
                    type="button"
                    onClick={() => setShowCancelDialog(true)}
                    className="px-5 py-2.5 text-xs font-bold text-red-600 hover:text-red-800 hover:bg-red-50 rounded-xl transition-colors"
                  >
                    Hủy Lịch Hẹn Này
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Cancellation Confirmation Dialog */}
        {showCancelDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-red-100 space-y-4">
              <h3 className="text-lg font-bold text-red-700 flex items-center gap-2">
                <Icon name="alert-triangle" size={16} /> Xác Nhận Hủy Lịch Khám
              </h3>
              <p className="text-xs text-ink-muted leading-relaxed">
                Bạn có chắc chắn muốn hủy lịch hẹn mã <span className="font-mono font-bold text-ink">{appointment?.bookingCode}</span> với {appointment?.doctorName} vào ngày {appointment?.appointmentDate}?
              </p>
              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1">
                  Lý do hủy (không bắt buộc):
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Thay đổi lịch công tác..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full p-2.5 bg-sand-100 border border-mint-200 rounded-lg text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCancelDialog(false)}
                  className="px-4 py-2 text-xs font-bold text-ink-muted hover:bg-mint-100 rounded-lg"
                >
                  Không, giữ lịch
                </button>
                <button
                  type="button"
                  onClick={handleCancelAppointment}
                  className="px-5 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg shadow"
                >
                  Đồng ý Hủy Lịch
                </button>
              </div>
            </div>
          </div>
        )}
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




