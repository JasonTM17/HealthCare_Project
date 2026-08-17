"use client";

import React, { useState, useEffect } from "react";
import {
  Doctor,
  Specialty,
  Branch,
  HealthPackage,
  TimeSlot,
  AppointmentDetails,
} from "../types/hospital";
import {
  fetchDoctorSlots,
  holdAppointmentSlot,
  confirmAppointment,
  SEED_DOCTORS,
  SEED_SPECIALTIES,
  SEED_BRANCHES,
} from "../lib/api";

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDoctorId?: string;
  initialSpecialtyId?: string;
  initialPackageId?: string;
  packages?: HealthPackage[];
}

export default function BookingModal({
  isOpen,
  onClose,
  initialDoctorId,
  initialSpecialtyId,
  initialPackageId,
  packages = [],
}: BookingModalProps) {
  // Wizard steps: 1 = Choose Doctor/Specialty, 2 = Choose Slot, 3 = Patient Info, 4 = OTP & Confirmation
  const [step, setStep] = useState<number>(1);

  // Form State
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>(
    initialSpecialtyId || SEED_SPECIALTIES[0].id
  );
  const [selectedDoctor, setSelectedDoctor] = useState<string>(
    initialDoctorId || SEED_DOCTORS[0].id
  );
  const [selectedBranch, setSelectedBranch] = useState<string>(SEED_BRANCHES[0].id);
  const [selectedPackage, setSelectedPackage] = useState<string>(initialPackageId || "");
  
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  });
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);

  // Patient Info
  const [fullName, setFullName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [reasonForVisit, setReasonForVisit] = useState<string>("");

  // Hold & OTP State
  const [bookingCode, setBookingCode] = useState<string>("");
  const [otpCode, setOtpCode] = useState<string>("");
  const [holdExpiresAt, setHoldExpiresAt] = useState<string>("");
  const [secondsRemaining, setSecondsRemaining] = useState<number>(600);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [confirmedAppointment, setConfirmedAppointment] = useState<AppointmentDetails | null>(null);

  // Load doctor slots when doctor or date changes
  useEffect(() => {
    let ignore = false;
    if (selectedDoctor && selectedDate) {
      fetchDoctorSlots(selectedDoctor, selectedDate)
        .then((data) => {
          if (!ignore) {
            setSlots(data);
            const firstAvailable = data.find((s) => s.available);
            if (firstAvailable) {
              setSelectedSlot(firstAvailable.startTime);
            }
            setLoadingSlots(false);
          }
        })
        .catch(() => {
          if (!ignore) {
            setSlots([]);
            setLoadingSlots(false);
          }
        });
    }
    return () => {
      ignore = true;
    };
  }, [selectedDoctor, selectedDate]);

  // Countdown timer for 10-minute hold lock
  useEffect(() => {
    if (step === 4 && !confirmedAppointment && secondsRemaining > 0) {
      const timer = setInterval(() => {
        setSecondsRemaining((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [step, confirmedAppointment, secondsRemaining]);

  if (!isOpen) return null;

  const currentDoctor = SEED_DOCTORS.find((d) => d.id === selectedDoctor) || SEED_DOCTORS[0];
  const currentSpecialty = SEED_SPECIALTIES.find((s) => s.id === selectedSpecialty) || SEED_SPECIALTIES[0];
  const currentBranch = SEED_BRANCHES.find((b) => b.id === selectedBranch) || SEED_BRANCHES[0];

  // Handle Step 3: Hold Slot
  const handleHoldSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !phone) {
      setErrorMessage("Vui lòng nhập đầy đủ họ tên và số điện thoại.");
      return;
    }
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const result = await holdAppointmentSlot({
        doctorId: selectedDoctor,
        specialtyId: selectedSpecialty,
        branchId: selectedBranch,
        packageId: selectedPackage || undefined,
        appointmentDate: selectedDate,
        startTime: selectedSlot || "09:00:00",
        fullName,
        phone,
        email: email || undefined,
        reasonForVisit: reasonForVisit || undefined,
      });

      setBookingCode(result.bookingCode);
      setHoldExpiresAt(result.holdExpiresAt);
      setSecondsRemaining(600); // 10 minutes
      setStep(4);
    } catch (err: any) {
      setErrorMessage(err.message || "Không thể giữ chỗ khung giờ này.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Step 4: Confirm OTP
  const handleConfirmOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode) {
      setErrorMessage("Vui lòng nhập mã OTP xác thực.");
      return;
    }
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const details = await confirmAppointment({
        bookingCode,
        otpCode: otpCode.trim(),
      });
      setConfirmedAppointment(details);
    } catch (err: any) {
      setErrorMessage(err.message || "Mã OTP không chính xác.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${rem.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-modal-title"
    >
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-teal-100 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-teal-800 to-teal-700 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <span className="text-xs uppercase tracking-widest text-teal-200 font-semibold">
              Hệ thống Đặt lịch Khám bệnh
            </span>
            <h2 id="booking-modal-title" className="text-xl font-bold text-white flex items-center gap-2">
              <span>📅</span> Đặt lịch trực tuyến nhanh chóng
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            aria-label="Đóng cửa sổ đặt lịch"
          >
            ✕
          </button>
        </div>

        {/* Wizard Step Progress */}
        {!confirmedAppointment && (
          <div className="px-6 py-3 bg-teal-50/70 border-b border-teal-100/60 flex items-center justify-between text-xs font-semibold text-teal-900">
            <div className={`flex items-center gap-1.5 ${step >= 1 ? "text-teal-700 font-bold" : "text-gray-400"}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center ${step >= 1 ? "bg-teal-700 text-white" : "bg-gray-200"}`}>1</span>
              <span>Chuyên khoa & Bác sĩ</span>
            </div>
            <span>→</span>
            <div className={`flex items-center gap-1.5 ${step >= 2 ? "text-teal-700 font-bold" : "text-gray-400"}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center ${step >= 2 ? "bg-teal-700 text-white" : "bg-gray-200"}`}>2</span>
              <span>Chọn giờ khám</span>
            </div>
            <span>→</span>
            <div className={`flex items-center gap-1.5 ${step >= 3 ? "text-teal-700 font-bold" : "text-gray-400"}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center ${step >= 3 ? "bg-teal-700 text-white" : "bg-gray-200"}`}>3</span>
              <span>Thông tin</span>
            </div>
            <span>→</span>
            <div className={`flex items-center gap-1.5 ${step >= 4 ? "text-teal-700 font-bold" : "text-gray-400"}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center ${step >= 4 ? "bg-teal-700 text-white" : "bg-gray-200"}`}>4</span>
              <span>Xác nhận</span>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* ── STEP 1: Choose Specialty, Doctor, Branch ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Chọn Cơ sở Bệnh viện / Phòng khám
                </label>
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-600 focus:outline-none text-sm text-gray-900"
                >
                  {SEED_BRANCHES.map((br) => (
                    <option key={br.id} value={br.id}>
                      {br.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Chọn Chuyên khoa Thăm khám
                </label>
                <select
                  value={selectedSpecialty}
                  onChange={(e) => setSelectedSpecialty(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-600 focus:outline-none text-sm text-gray-900"
                >
                  {SEED_SPECIALTIES.map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      {sp.icon} {sp.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Chọn Bác sĩ Chuyên gia
                </label>
                <select
                  value={selectedDoctor}
                  onChange={(e) => setSelectedDoctor(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-600 focus:outline-none text-sm text-gray-900 font-medium"
                >
                  {SEED_DOCTORS.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.fullName} ({doc.title || doc.specialtyName})
                    </option>
                  ))}
                </select>
              </div>

              {/* Selected Doctor Summary Card */}
              <div className="p-4 bg-teal-50/50 border border-teal-100 rounded-xl flex items-center gap-4 mt-2">
                <div className="w-14 h-14 rounded-full bg-teal-700 text-white font-bold text-xl flex items-center justify-center flex-shrink-0">
                  👨‍⚕️
                </div>
                <div>
                  <h4 className="font-bold text-teal-900 text-base">{currentDoctor.fullName}</h4>
                  <p className="text-xs text-teal-700">{currentDoctor.title} • {currentDoctor.experienceYears} năm kinh nghiệm</p>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-1">{currentDoctor.bio}</p>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-semibold rounded-full shadow-md hover:shadow-lg transition-all flex items-center gap-2"
                >
                  Tiếp tục: Chọn ngày giờ khám <span>→</span>
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Choose Date & Time Slot ── */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Chọn Ngày khám mong muốn
                </label>
                <input
                  type="date"
                  min={selectedDate}
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-600 focus:outline-none text-sm text-gray-900"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Khung giờ khám còn trống (30 phút/lượt)
                  </label>
                  <span className="text-xs text-teal-700 font-medium">
                    🟢 Còn trống • ⚪ Đã có người giữ
                  </span>
                </div>

                {loadingSlots ? (
                  <div className="py-8 text-center text-sm text-gray-500">
                    <span className="animate-spin inline-block mr-2">⏳</span> Đang tải lịch khám khả dụng...
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto p-1">
                    {slots.map((slot) => {
                      const isSelected = selectedSlot === slot.startTime;
                      return (
                        <button
                          key={slot.startTime}
                          type="button"
                          disabled={!slot.available}
                          onClick={() => setSelectedSlot(slot.startTime)}
                          className={`p-2.5 rounded-lg text-xs font-semibold border transition-all flex flex-col items-center justify-center gap-0.5 ${
                            isSelected
                              ? "bg-teal-700 text-white border-teal-700 shadow-md ring-2 ring-teal-500"
                              : slot.available
                              ? "bg-white text-gray-800 border-teal-200 hover:border-teal-500 hover:bg-teal-50"
                              : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-60"
                          }`}
                        >
                          <span className="text-sm font-bold">
                            {slot.startTime.slice(0, 5)}
                          </span>
                          <span className="text-[10px] opacity-80">
                            {slot.available ? "Còn trống" : "Đã kín"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium text-sm"
                >
                  ← Quay lại
                </button>
                <button
                  type="button"
                  disabled={!selectedSlot}
                  onClick={() => setStep(3)}
                  className="px-6 py-2.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white font-semibold rounded-full shadow-md transition-all flex items-center gap-2"
                >
                  Tiếp tục: Điền thông tin <span>→</span>
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Patient Information Form ── */}
          {step === 3 && (
            <form onSubmit={handleHoldSlot} className="space-y-4">
              <div className="p-3.5 bg-teal-50/60 border border-teal-100 rounded-xl text-xs text-teal-900 space-y-1">
                <div className="flex justify-between font-semibold">
                  <span>Bác sĩ: {currentDoctor.fullName}</span>
                  <span>Ngày: {selectedDate} ({selectedSlot.slice(0, 5)})</span>
                </div>
                <div className="text-teal-700">{currentBranch.name}</div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Họ và tên bệnh nhân <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Văn An"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-600 focus:outline-none text-sm text-gray-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Số điện thoại liên hệ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="0901234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-600 focus:outline-none text-sm text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Địa chỉ Email (Nhận phiếu khám)
                  </label>
                  <input
                    type="email"
                    placeholder="patient@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-600 focus:outline-none text-sm text-gray-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Triệu chứng hoặc lý do khám bệnh
                </label>
                <textarea
                  rows={2}
                  placeholder="Mô tả sơ bộ triệu chứng (đau đầu, sốt, khó thở...) để bác sĩ chuẩn bị trước..."
                  value={reasonForVisit}
                  onChange={(e) => setReasonForVisit(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-600 focus:outline-none text-sm text-gray-900"
                />
              </div>

              <div className="pt-3 flex items-center justify-between border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium text-sm"
                >
                  ← Quay lại
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white font-semibold rounded-full shadow-md transition-all flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <span>⏳ Đang giữ chỗ...</span>
                  ) : (
                    <>
                      <span>Giữ chỗ & Nhận mã OTP</span> <span>→</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ── STEP 4: OTP Verification & Final E-Card ── */}
          {step === 4 && (
            <div>
              {!confirmedAppointment ? (
                <form onSubmit={handleConfirmOtp} className="space-y-4 text-center py-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-full text-xs font-semibold">
                    <span>⏱️</span> Thời gian giữ chỗ còn lại:{" "}
                    <span className="font-mono text-amber-700 font-bold">{formatTimer(secondsRemaining)}</span>
                  </div>

                  <div className="p-4 bg-teal-50/60 border border-teal-100 rounded-xl text-left text-xs space-y-1.5">
                    <p className="font-bold text-teal-950 text-sm">Mã giữ chỗ: {bookingCode}</p>
                    <p className="text-gray-600">Bệnh nhân: <span className="font-semibold text-gray-900">{fullName}</span> ({phone})</p>
                    <p className="text-gray-600">Bác sĩ: <span className="font-semibold text-gray-900">{currentDoctor.fullName}</span></p>
                    <p className="text-gray-600">Thời gian: <span className="font-semibold text-gray-900">{selectedDate} vào lúc {selectedSlot.slice(0, 5)}</span></p>
                  </div>

                  <div className="py-2">
                    <label className="block text-sm font-bold text-gray-800 mb-1.5">
                      Nhập mã OTP 6 số xác thực
                    </label>
                    <p className="text-xs text-gray-500 mb-3">
                      (Môi trường Demo/Test: Sử dụng mã cố định <span className="font-mono font-bold text-teal-700 bg-teal-100 px-1.5 py-0.5 rounded">123456</span>)
                    </p>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      autoFocus
                      placeholder="123456"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      className="w-48 text-center p-3 text-2xl font-mono tracking-widest bg-gray-50 border-2 border-teal-600 rounded-xl focus:ring-4 focus:ring-teal-100 focus:outline-none"
                    />
                  </div>

                  <div className="pt-3 flex items-center justify-between border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium text-sm"
                    >
                      ← Sửa thông tin
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-8 py-2.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white font-bold rounded-full shadow-lg hover:shadow-xl transition-all"
                    >
                      {isSubmitting ? "⏳ Đang xác nhận..." : "Hoàn tất Đặt lịch khám ✅"}
                    </button>
                  </div>
                </form>
              ) : (
                /* Confirmed Electronic Appointment Card (E-Card) */
                <div className="space-y-4 text-center py-2 animate-fadeIn">
                  <div className="w-16 h-16 bg-teal-100 text-teal-700 rounded-full flex items-center justify-center text-3xl mx-auto mb-2">
                    ✓
                  </div>
                  <h3 className="text-2xl font-bold text-teal-900">
                    Đặt Lịch Khám Thành Công!
                  </h3>
                  <p className="text-xs text-gray-600 max-w-md mx-auto">
                    Thông tin lịch hẹn đã được lưu vào hệ thống bệnh viện. Vui lòng xuất trình mã lịch hẹn tại quầy tiếp đón khi đến khám.
                  </p>

                  {/* E-Card Ticket */}
                  <div className="p-5 bg-gradient-to-br from-teal-900 to-teal-800 text-white rounded-2xl text-left shadow-xl relative overflow-hidden">
                    <div className="flex justify-between items-start border-b border-teal-700/60 pb-3 mb-3">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-teal-300 font-bold">PHIẾU KHÁM BỆNH ĐIỆN TỬ</span>
                        <h4 className="text-lg font-extrabold text-white">HealthCare Vietnam</h4>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-teal-300">MÃ LỊCH HẸN</span>
                        <p className="font-mono font-bold text-amber-400 text-base">{confirmedAppointment.bookingCode}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 text-xs">
                      <div>
                        <span className="text-teal-300 text-[11px]">Bệnh nhân:</span>
                        <p className="font-bold text-white text-sm">{confirmedAppointment.patientName}</p>
                      </div>
                      <div>
                        <span className="text-teal-300 text-[11px]">Số điện thoại:</span>
                        <p className="font-bold text-white">{confirmedAppointment.patientPhone}</p>
                      </div>
                      <div>
                        <span className="text-teal-300 text-[11px]">Bác sĩ khám:</span>
                        <p className="font-semibold text-white">{confirmedAppointment.doctorName}</p>
                      </div>
                      <div>
                        <span className="text-teal-300 text-[11px]">Chuyên khoa:</span>
                        <p className="font-semibold text-white">{confirmedAppointment.specialtyName}</p>
                      </div>
                      <div>
                        <span className="text-teal-300 text-[11px]">Ngày khám:</span>
                        <p className="font-bold text-amber-300 text-sm">{confirmedAppointment.appointmentDate}</p>
                      </div>
                      <div>
                        <span className="text-teal-300 text-[11px]">Giờ khám:</span>
                        <p className="font-bold text-amber-300 text-sm">{confirmedAppointment.startTime.slice(0, 5)} - {confirmedAppointment.endTime.slice(0, 5)}</p>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-teal-700/60 flex items-center justify-between text-[11px] text-teal-200">
                      <span>🏥 {confirmedAppointment.branchName || "HealthCare TP.HCM"}</span>
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded font-semibold">
                        ĐÃ XÁC NHẬN
                      </span>
                    </div>
                  </div>

                  <div className="pt-3">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-8 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-full shadow-md transition-all"
                    >
                      Đóng cửa sổ & Về trang chủ
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
