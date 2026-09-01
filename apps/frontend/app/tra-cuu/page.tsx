"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import Icon from "../../components/UiIcon";
import { PublicAiButton, PublicBookingButton, PublicPageShell } from "../../components/PublicPageShell";
import useDialogFocus from "../../components/useDialogFocus";
import { AppointmentDetails } from "../../types/hospital";

// Lookup/cancellation must use the same-origin proxy, just like the rest of
// the patient portal.  The backend origin remains server-only in Next config.
const API_BASE_URL = "/api/v1";
const LOOKUP_TIMEOUT_MS = 12_000;

const TRACKING_STEPS = [
  ["01", "Nhập mã hẹn", "Dùng đúng mã được cấp sau khi đặt lịch thành công."],
  ["02", "Xác thực điện thoại", "Nhập số điện thoại đã dùng khi đặt lịch để bảo vệ thông tin cá nhân."],
  ["03", "Kiểm tra trạng thái", "Xem bác sĩ, cơ sở, khung giờ và các hướng dẫn cần xác nhận trước khi đến."],
] as const;

async function fetchWithTimeout(input: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export default function TraCuuPage() {
  const [bookingCodeInput, setBookingCodeInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [appointment, setAppointment] = useState<AppointmentDetails | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState(false);
  const lookupRequestRef = useRef(0);
  const cancelDialogRef = useRef<HTMLDivElement>(null);

  useDialogFocus(cancelDialogRef, showCancelDialog, () => setShowCancelDialog(false));

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const requestId = ++lookupRequestRef.current;
    setAppointment(null);
    setCancelSuccess(false);
    setErrorMessage("");
    setLoading(false);
    if (!bookingCodeInput.trim()) {
      setErrorMessage("Vui lòng nhập Mã lịch hẹn");
      return;
    }
    if (!phoneInput.trim()) {
      setErrorMessage("Vui lòng nhập số điện thoại đã dùng khi đặt lịch");
      return;
    }

    setLoading(true);

    try {
      const res = await fetchWithTimeout(
        `${API_BASE_URL}/appointments/${encodeURIComponent(bookingCodeInput.trim())}?phone=${encodeURIComponent(phoneInput.trim())}`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        if (requestId !== lookupRequestRef.current) return;
        setErrorMessage(
          res.status === 404
            ? "Không tìm thấy lịch hẹn. Vui lòng kiểm tra lại mã và số điện thoại đã dùng khi đặt lịch."
            : "Tạm thời chưa thể tra cứu lịch hẹn. Vui lòng thử lại sau."
        );
        return;
      }
      const data: AppointmentDetails = await res.json();
      if (requestId !== lookupRequestRef.current) return;
      setAppointment(data);
    } catch (error) {
      if (requestId !== lookupRequestRef.current) return;
      setErrorMessage(
        error instanceof Error && error.name === "AbortError"
          ? "Tạm thời hệ thống phản hồi chậm. Vui lòng thử lại sau."
          : "Tạm thời chưa thể tra cứu lịch hẹn. Vui lòng kiểm tra kết nối và thử lại sau."
      );
    } finally {
      if (requestId === lookupRequestRef.current) setLoading(false);
    }
  };

  const handleCancelAppointment = async () => {
    if (!appointment) return;
    setLoading(true);

    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/appointments/${encodeURIComponent(appointment.bookingCode)}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: cancelReason || "Bệnh nhân yêu cầu hủy",
          phone: phoneInput.trim(),
        }),
      });
      if (!res.ok) {
        setErrorMessage(
          res.status === 404
            ? "Không tìm thấy lịch hẹn cần hủy. Vui lòng tra cứu lại thông tin."
            : res.status === 409
              ? "Lịch hẹn này không còn có thể hủy trực tuyến. Vui lòng liên hệ cơ sở để được hỗ trợ."
              : "Tạm thời chưa thể hủy lịch hẹn. Vui lòng thử lại sau."
        );
        return;
      }
      setAppointment({ ...appointment, status: "CANCELLED" });
      setCancelSuccess(true);
      setShowCancelDialog(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error && error.name === "AbortError"
          ? "Tạm thời hệ thống phản hồi chậm. Vui lòng thử lại sau."
          : "Tạm thời chưa thể hủy lịch hẹn. Vui lòng kiểm tra kết nối và thử lại sau."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicPageShell>
      <section className="resource-page section-inner">
        {/* Breadcrumb */}
        <div className="resource-breadcrumb">
          <Link href="/">Trang chủ</Link>
          <span>/</span>
          <span>Tra cứu lịch hẹn & Phiếu khám</span>
        </div>

        {/* Page Header */}
        <header className="resource-page__header">
          <p className="section-note">Cổng thông tin bệnh nhân</p>
          <h1>Tra cứu lịch hẹn trực tuyến</h1>
          <p>
            Nhập Mã lịch hẹn (được cấp khi đặt khám thành công) để xem trạng thái, phòng khám, bác sĩ phụ trách hoặc thay đổi lịch hẹn.
          </p>
        </header>

        <section className="resource-hero-card resource-hero-card--teal">
          <div className="resource-icon" aria-hidden="true">
            <Icon name="search" size={34} />
          </div>
          <div className="resource-hero-card__body">
            <p className="resource-chip">Tra cứu & quản lý lịch</p>
            <h2>Một nơi để kiểm tra mã hẹn, chuẩn bị trước khi đến và xử lý yêu cầu hủy khi đủ điều kiện.</h2>
            <p className="resource-lead">
              Thông tin được tra theo mã hẹn và số điện thoại. Nếu chưa tìm thấy dữ liệu, bạn có thể thử lại hoặc liên hệ bệnh viện để được hỗ trợ.
            </p>
            <div className="resource-actions">
              <PublicBookingButton>Đặt lịch mới</PublicBookingButton>
              <PublicAiButton className="outline-button outline-button--light">Hỏi trợ lý triệu chứng</PublicAiButton>
              <Link className="outline-button outline-button--light" href="/huong-dan">
                Xem hướng dẫn đặt khám
              </Link>
            </div>
            <dl className="resource-meta-grid">
              <div>
                <dt>Dữ liệu yêu cầu</dt>
                <dd>Mã hẹn + số điện thoại</dd>
              </div>
              <div>
                <dt>Trạng thái hỗ trợ</dt>
                <dd>Xác nhận, chờ xác nhận, đã hủy</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="resource-panel resource-panel--wide">
          <div className="section-heading">
            <div>
              <p className="section-note">Cách tra cứu an toàn</p>
              <h2>Ba bước kiểm tra trước cuộc hẹn</h2>
            </div>
          </div>
          <div className="resource-steps resource-steps--grid">
            {TRACKING_STEPS.map(([number, title, description]) => (
              <div className="resource-step-card" key={number}>
                <span>{number}</span>
                <strong>{title}</strong>
                <p>{description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Search Card */}
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-mint-100 shadow-md mb-8">
          <form onSubmit={handleLookup} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
              <div className="sm:col-span-8">
                <label className="block text-xs font-bold text-ink-muted uppercase mb-1.5" htmlFor="appointment-booking-code">
                  Mã lịch hẹn khám <span className="text-red-500">*</span>
                </label>
                <input
                  id="appointment-booking-code"
                  name="bookingCode"
                  type="text"
                  required
                  placeholder="Ví dụ: APT-9F3A..."
                  value={bookingCodeInput}
                  onChange={(e) => setBookingCodeInput(e.target.value)}
                  className="w-full p-3 bg-sand-100 border border-mint-200 rounded-xl font-mono text-sm font-bold text-ink focus:ring-2 focus:ring-brand-600 focus:outline-none uppercase"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="block text-xs font-bold text-ink-muted uppercase mb-1.5" htmlFor="appointment-phone">
                  Số điện thoại đặt lịch <span className="text-red-500">*</span>
                </label>
                <input
                  id="appointment-phone"
                  name="phone"
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
                  className="w-full py-3 bg-brand-700 hover:bg-brand-800 disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? <><Icon name="clock" size={16} /> Đang tra cứu...</> : <><Icon name="search" size={16} /> Tra cứu ngay</>}
                </button>
              </div>
            </div>
          </form>

          {errorMessage && (
            <div aria-live="assertive" className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2" role="alert">
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
            <div className="bg-brand-900 text-white p-6 flex flex-wrap items-center justify-between gap-4">
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
                    Phương thức thanh toán và bảo lãnh có thể khác nhau theo từng cơ sở. Vui lòng xác nhận trước khi đến khám.
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn" role="presentation">
            <div
              aria-describedby="cancel-dialog-description"
              aria-labelledby="cancel-dialog-title"
              aria-modal="true"
              className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-red-100 space-y-4"
              ref={cancelDialogRef}
              role="dialog"
            >
              <h3 className="text-lg font-bold text-red-700 flex items-center gap-2" id="cancel-dialog-title">
                <Icon name="alert-triangle" size={16} /> Xác Nhận Hủy Lịch Khám
              </h3>
              <p className="text-xs text-ink-muted leading-relaxed" id="cancel-dialog-description">
                Bạn có chắc chắn muốn hủy lịch hẹn mã <span className="font-mono font-bold text-ink">{appointment?.bookingCode}</span> với {appointment?.doctorName} vào ngày {appointment?.appointmentDate}?
              </p>
              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1" htmlFor="cancel-reason">
                  Lý do hủy (không bắt buộc):
                </label>
                <input
                  id="cancel-reason"
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
                  disabled={loading}
                  onClick={() => setShowCancelDialog(false)}
                  className="px-4 py-2 text-xs font-bold text-ink-muted hover:bg-mint-100 rounded-lg"
                >
                  Không, giữ lịch
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleCancelAppointment}
                  className="px-5 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg shadow"
                >
                  Đồng ý Hủy Lịch
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </PublicPageShell>
  );
}



