"use client";

import React, { useCallback, useState, useEffect } from "react";
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
} from "../lib/api";
import {
  fetchBranches,
  fetchDoctors,
  fetchSpecialties,
} from "../lib/api-client";
import Icon from "./UiIcon";

const EMPTY_DOCTORS: Doctor[] = [];
const EMPTY_SPECIALTIES: Specialty[] = [];
const EMPTY_BRANCHES: Branch[] = [];
const EMPTY_PACKAGES: HealthPackage[] = [];

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDoctorId?: string;
  initialSpecialtyId?: string;
  initialPackageId?: string;
  initialBranchId?: string;
  packages?: HealthPackage[];
  doctors?: Doctor[];
  specialties?: Specialty[];
  branches?: Branch[];
}

export default function BookingModal({
  isOpen,
  onClose,
  initialDoctorId,
  initialSpecialtyId,
  initialPackageId,
  initialBranchId,
  packages = EMPTY_PACKAGES,
  doctors: providedDoctors = EMPTY_DOCTORS,
  specialties: providedSpecialties = EMPTY_SPECIALTIES,
  branches: providedBranches = EMPTY_BRANCHES,
}: BookingModalProps) {
  // Wizard steps: 1 = Choose Doctor/Specialty, 2 = Choose Slot, 3 = Patient Info, 4 = OTP & Confirmation
  const [step, setStep] = useState<number>(1);

  // Form State. Catalog identities always come from the backend or explicitly
  // passed live responses; this modal never creates a booking from fixtures.
  const [loadedDoctors, setLoadedDoctors] = useState<Doctor[]>([]);
  const [loadedSpecialties, setLoadedSpecialties] = useState<Specialty[]>([]);
  const [loadedBranches, setLoadedBranches] = useState<Branch[]>([]);
  const doctors = providedDoctors.length > 0 ? providedDoctors : loadedDoctors;
  const specialties = providedSpecialties.length > 0 ? providedSpecialties : loadedSpecialties;
  const branches = providedBranches.length > 0 ? providedBranches : loadedBranches;
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string>("");
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>(initialSpecialtyId || "");
  const [selectedDoctor, setSelectedDoctor] = useState<string>(initialDoctorId || "");
  const [selectedBranch, setSelectedBranch] = useState<string>(initialBranchId || "");
  const [selectedPackage, setSelectedPackage] = useState<string>(initialPackageId || "");
  
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  });
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [slotError, setSlotError] = useState<string>("");

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

  useEffect(() => {
    if (!isOpen || (doctors.length > 0 && specialties.length > 0 && branches.length > 0)) return;

    let cancelled = false;
    const task = Promise.resolve().then(async () => {
      if (cancelled) return;
      setCatalogLoading(true);
      setCatalogError("");
      try {
        const [doctorPage, specialtyPage, branchPage] = await Promise.all([
          fetchDoctors({ page: 0, size: 100 }),
          fetchSpecialties(0, 100),
          fetchBranches(0, 100),
        ]);
        if (cancelled) return;
        setLoadedDoctors(doctorPage.content);
        setLoadedSpecialties(specialtyPage.content);
        setLoadedBranches(branchPage.content);
      } catch (error: unknown) {
        if (!cancelled) {
          setCatalogError(error instanceof Error ? error.message : "Không thể tải danh mục đặt lịch từ backend.");
        }
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    });

    return () => {
      cancelled = true;
      void task;
    };
  }, [branches.length, doctors.length, isOpen, specialties.length]);

  const syncSelection = useCallback(() => {
    if (!isOpen) return;
    const firstBranch = branches.find((branch) => branch.id === initialBranchId) ?? branches[0];
    const nextBranchId = firstBranch?.id ?? "";
    const firstDoctor = doctors.find((doctor) => doctor.id === initialDoctorId && (!nextBranchId || doctor.branchId === nextBranchId))
      ?? doctors.find((doctor) => doctor.branchId === nextBranchId)
      ?? doctors[0];
    setSelectedBranch(nextBranchId);
    setSelectedDoctor(firstDoctor?.id ?? "");
    setSelectedSpecialty(specialties.some((specialty) => specialty.id === initialSpecialtyId)
      ? initialSpecialtyId ?? ""
      : specialties[0]?.id ?? "");
    setSelectedPackage(packages.some((item) => item.id === initialPackageId) ? initialPackageId ?? "" : "");
  }, [branches, doctors, initialBranchId, initialDoctorId, initialPackageId, initialSpecialtyId, isOpen, packages, specialties]);

  useEffect(() => {
    const task = Promise.resolve().then(syncSelection);
    return () => void task;
  }, [syncSelection]);

  // Load doctor slots when doctor or date changes
  useEffect(() => {
    let ignore = false;

    const loadSlots = async () => {
      setLoadingSlots(true);
      setSlots([]);
      setSelectedSlot("");
      setSlotError("");
      if (!selectedDoctor || !selectedBranch || !selectedDate) {
        setLoadingSlots(false);
        return;
      }

      try {
        const data = await fetchDoctorSlots(selectedDoctor, selectedBranch, selectedDate);
        if (ignore) return;
        const firstAvailable = data.find((slot) => slot.available && slot.branchId === selectedBranch);
        setSlots(data);
        if (firstAvailable) setSelectedSlot(firstAvailable.startTime);
      } catch (error) {
        if (!ignore) {
          setSlots([]);
          setSlotError(error instanceof Error ? error.message : "Không thể tải lịch khám.");
        }
      } finally {
        if (!ignore) setLoadingSlots(false);
      }
    };

    void loadSlots();
    return () => {
      ignore = true;
    };
  }, [selectedDoctor, selectedBranch, selectedDate]);

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

  const currentDoctor = doctors.find((doctor) => doctor.id === selectedDoctor);
  const currentSpecialty = specialties.find((specialty) => specialty.id === selectedSpecialty);
  const currentBranch = branches.find((branch) => branch.id === selectedBranch);
  const availableDoctors = doctors.filter(
    (doctor) => !doctor.branchId || doctor.branchId === selectedBranch,
  );
  const handleBranchChange = (branchId: string): void => {
    setSelectedBranch(branchId);
    setSlots([]);
    setSelectedSlot("");
    setSlotError("");
    const firstDoctorAtBranch = doctors.find((doctor) => doctor.branchId === branchId);
    setSelectedDoctor(firstDoctorAtBranch?.id || "");
  };

  const handleDoctorChange = (doctorId: string): void => {
    setSelectedDoctor(doctorId);
    setSlots([]);
    setSelectedSlot("");
    setSlotError("");
  };

  const handleDateChange = (date: string): void => {
    setSelectedDate(date);
    setSlots([]);
    setSelectedSlot("");
    setSlotError("");
  };

  // Handle Step 3: Hold Slot
  const handleHoldSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    const chosenSlot = slots.find((slot) => slot.startTime === selectedSlot);
    if (!chosenSlot || !chosenSlot.available || chosenSlot.branchId !== selectedBranch) {
      setErrorMessage("Khung giờ không còn thuộc cơ sở đang chọn. Vui lòng tải lại và chọn khung giờ khác.");
      return;
    }
    if (!currentDoctor || (currentDoctor.branchId && currentDoctor.branchId !== selectedBranch)) {
      setErrorMessage("Bác sĩ không thuộc cơ sở đang chọn. Vui lòng chọn lại bác sĩ.");
      return;
    }
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
        startTime: chosenSlot.startTime,
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
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-brand-100 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-brand-800 to-brand-700 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <span className="text-xs uppercase tracking-widest text-brand-200 font-semibold">
              Hệ thống Đặt lịch Khám bệnh
            </span>
            <h2 id="booking-modal-title" className="text-xl font-bold text-white flex items-center gap-2">
              <Icon name="calendar" size={18} /> Đặt lịch trực tuyến nhanh chóng
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 focus-visible:ring-2 focus-visible:ring-brand-200"
            aria-label="Đóng cửa sổ đặt lịch"
          >
            <Icon name="x" size={17} />
          </button>
        </div>

        {/* Wizard Step Progress */}
        {!confirmedAppointment && (
          <div className="px-6 py-3 bg-brand-50/70 border-b border-brand-100/60 flex items-center justify-between text-xs font-semibold text-brand-900">
            <div className={`flex items-center gap-1.5 ${step >= 1 ? "text-brand-700 font-bold" : "text-gray-400"}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center ${step >= 1 ? "bg-brand-700 text-white" : "bg-gray-200"}`}>1</span>
              <span>Chuyên khoa & Bác sĩ</span>
            </div>
            <span>→</span>
            <div className={`flex items-center gap-1.5 ${step >= 2 ? "text-brand-700 font-bold" : "text-gray-400"}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center ${step >= 2 ? "bg-brand-700 text-white" : "bg-gray-200"}`}>2</span>
              <span>Chọn giờ khám</span>
            </div>
            <span>→</span>
            <div className={`flex items-center gap-1.5 ${step >= 3 ? "text-brand-700 font-bold" : "text-gray-400"}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center ${step >= 3 ? "bg-brand-700 text-white" : "bg-gray-200"}`}>3</span>
              <span>Thông tin</span>
            </div>
            <span>→</span>
            <div className={`flex items-center gap-1.5 ${step >= 4 ? "text-brand-700 font-bold" : "text-gray-400"}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center ${step >= 4 ? "bg-brand-700 text-white" : "bg-gray-200"}`}>4</span>
              <span>Xác nhận</span>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
            <Icon name="activity" size={18} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {catalogLoading ? (
            <p className="mb-4 rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-950" role="status">
              Đang tải danh mục bác sĩ, chuyên khoa và cơ sở từ backend…
            </p>
          ) : null}
          {catalogError ? (
            <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900" role="alert">
              {catalogError}
            </p>
          ) : null}
          {/* ── STEP 1: Choose Specialty, Doctor, Branch ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Chọn Cơ sở Bệnh viện / Phòng khám
                </label>
                <select
                  value={selectedBranch}
                  onChange={(e) => handleBranchChange(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-600 focus:outline-none text-sm text-gray-900"
                >
                  {branches.map((br) => (
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
                  className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-600 focus:outline-none text-sm text-gray-900"
                >
                  {specialties.map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      {sp.name}
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
                  onChange={(e) => handleDoctorChange(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-600 focus:outline-none text-sm text-gray-900 font-medium"
                >
                  {availableDoctors.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.fullName} ({doc.title || doc.specialtyName})
                    </option>
                  ))}
                </select>
              </div>

              {/* Selected Doctor Summary Card */}
              <div className="p-4 bg-brand-50/50 border border-brand-100 rounded-xl flex items-center gap-4 mt-2">
                <div className="w-14 h-14 rounded-full bg-brand-700 text-white font-bold text-xl flex items-center justify-center flex-shrink-0">
                  <Icon name="stethoscope" size={26} />
                </div>
                <div>
                  <h4 className="font-bold text-brand-900 text-base">{currentDoctor?.fullName ?? "Chưa chọn bác sĩ"}</h4>
                  <p className="text-xs text-brand-700">{currentDoctor?.title ?? "Chưa có hồ sơ bác sĩ"}{currentDoctor?.experienceYears ? ` • ${currentDoctor.experienceYears} năm kinh nghiệm` : ""}</p>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-1">{currentDoctor?.bio ?? "Chọn cơ sở và bác sĩ từ danh mục live."}</p>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  disabled={catalogLoading || !currentDoctor || !currentSpecialty || !currentBranch}
                  onClick={() => setStep(2)}
                  className="px-6 py-2.5 bg-brand-700 hover:bg-brand-800 text-white font-semibold rounded-full shadow-md hover:shadow-lg transition-colors flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 focus-visible:ring-2 focus-visible:ring-brand-600"
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
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-600 focus:outline-none text-sm text-gray-900"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Khung giờ khám còn trống (30 phút/lượt)
                  </label>
                  <span className="text-xs text-brand-700 font-medium">
                    🟢 Còn trống • ⚪ Đã có người giữ
                  </span>
                </div>
                {loadingSlots ? (
                  <div aria-live="polite" className="py-8 text-center text-sm text-gray-500" role="status">
                    <Icon name="clock" size={15} /> Đang tải lịch khám khả dụng...
                  </div>
                ) : slotError ? (
                  <div aria-live="assertive" className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700" role="alert">
                    {slotError}
                  </div>
                ) : slots.length === 0 ? (
                  <div aria-live="polite" className="rounded-lg border border-dashed border-gray-300 px-3 py-6 text-center text-sm text-gray-500" role="status">
                    Chưa có khung giờ cho bác sĩ, cơ sở và ngày đã chọn.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto p-1">
                    {slots.map((slot) => {
                      const isSelected = selectedSlot === slot.startTime;
                      return (
                        <button
                          key={slot.startTime}
                          type="button"
                          disabled={!slot.available || slot.branchId !== selectedBranch}
                          onClick={() => setSelectedSlot(slot.startTime)}
                          className={`p-2.5 rounded-lg text-xs font-semibold border transition-colors flex flex-col items-center justify-center gap-0.5 ${
                            isSelected
                              ? "bg-brand-700 text-white border-brand-700 shadow-md ring-2 ring-brand-500"
                              : slot.available
                              ? "bg-white text-gray-800 border-brand-200 hover:border-brand-500 hover:bg-brand-50"
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
                  disabled={!selectedSlot || !slots.some((slot) => slot.available && slot.startTime === selectedSlot && slot.branchId === selectedBranch)}
                  onClick={() => setStep(3)}
                  className="px-6 py-2.5 bg-brand-700 hover:bg-brand-800 disabled:opacity-50 text-white font-semibold rounded-full shadow-md transition-colors flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 focus-visible:ring-2 focus-visible:ring-brand-600"
                >
                  Tiếp tục: Điền thông tin <span>→</span>
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Patient Information Form ── */}
          {step === 3 && (
            <form onSubmit={handleHoldSlot} className="space-y-4">
              <div className="p-3.5 bg-brand-50/60 border border-brand-100 rounded-xl text-xs text-brand-900 space-y-1">
                <div className="flex justify-between font-semibold">
                  <span>Bác sĩ: {currentDoctor?.fullName ?? "Chưa chọn"}</span>
                  <span>Ngày: {selectedDate} ({selectedSlot.slice(0, 5)})</span>
                </div>
                <div className="text-brand-700">{currentBranch?.name ?? "Chưa chọn cơ sở"}</div>
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
                  className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-600 focus:outline-none text-sm text-gray-900"
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
                    className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-600 focus:outline-none text-sm text-gray-900"
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
                    className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-600 focus:outline-none text-sm text-gray-900"
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
                  className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-600 focus:outline-none text-sm text-gray-900"
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
                  className="px-6 py-2.5 bg-brand-700 hover:bg-brand-800 disabled:opacity-50 text-white font-semibold rounded-full shadow-md transition-colors flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 focus-visible:ring-2 focus-visible:ring-brand-600"
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
                    <Icon name="clock" size={15} /> Thời gian giữ chỗ còn lại:{" "}
                    <span className="font-mono text-amber-700 font-bold">{formatTimer(secondsRemaining)}</span>
                  </div>

                  <div className="p-4 bg-brand-50/60 border border-brand-100 rounded-xl text-left text-xs space-y-1.5">
                    <p className="font-bold text-brand-950 text-sm">Mã giữ chỗ: {bookingCode}</p>
                    <p className="text-gray-600">Bệnh nhân: <span className="font-semibold text-gray-900">{fullName}</span> ({phone})</p>
                    <p className="text-gray-600">Bác sĩ: <span className="font-semibold text-gray-900">{currentDoctor?.fullName ?? "Chưa chọn"}</span></p>
                    <p className="text-gray-600">Thời gian: <span className="font-semibold text-gray-900">{selectedDate} vào lúc {selectedSlot.slice(0, 5)}</span></p>
                  </div>

                  <div className="py-2">
                    <label className="block text-sm font-bold text-gray-800 mb-1.5">
                      Nhập mã OTP 6 số xác thực
                    </label>
                    <p className="text-xs text-gray-500 mb-3">
                      (Môi trường Demo/Test: Sử dụng mã cố định <span className="font-mono font-bold text-brand-700 bg-brand-100 px-1.5 py-0.5 rounded">123456</span>)
                    </p>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      autoFocus
                      placeholder="123456"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      className="w-48 text-center p-3 text-2xl font-mono tracking-widest bg-gray-50 border-2 border-brand-600 rounded-xl focus:ring-4 focus:ring-brand-100 focus:outline-none"
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
                      className="px-8 py-2.5 bg-brand-700 hover:bg-brand-800 disabled:opacity-50 text-white font-bold rounded-full shadow-lg hover:shadow-xl transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 focus-visible:ring-2 focus-visible:ring-brand-600"
                    >
                      {isSubmitting ? "Đang xác nhận..." : "Hoàn tất Đặt lịch khám"}
                    </button>
                  </div>
                </form>
              ) : (
                /* Confirmed Electronic Appointment Card (E-Card) */
                <div className="space-y-4 text-center py-2 animate-fadeIn">
                  <div className="w-16 h-16 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center text-3xl mx-auto mb-2">
                    ✓
                  </div>
                  <h3 className="text-2xl font-bold text-brand-900">
                    Đặt Lịch Khám Thành Công!
                  </h3>
                  <p className="text-xs text-gray-600 max-w-md mx-auto">
                    Thông tin lịch hẹn đã được lưu vào hệ thống bệnh viện. Vui lòng xuất trình mã lịch hẹn tại quầy tiếp đón khi đến khám.
                  </p>

                  {/* E-Card Ticket */}
                  <div className="p-5 bg-gradient-to-br from-brand-900 to-brand-800 text-white rounded-2xl text-left shadow-xl relative overflow-hidden">
                    <div className="flex justify-between items-start border-b border-brand-700/60 pb-3 mb-3">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-brand-300 font-bold">PHIẾU KHÁM BỆNH ĐIỆN TỬ</span>
                        <h4 className="text-lg font-extrabold text-white">HealthCare Vietnam</h4>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-brand-300">MÃ LỊCH HẸN</span>
                        <p className="font-mono font-bold text-amber-400 text-base">{confirmedAppointment.bookingCode}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 text-xs">
                      <div>
                        <span className="text-brand-300 text-[11px]">Bệnh nhân:</span>
                        <p className="font-bold text-white text-sm">{confirmedAppointment.patientName}</p>
                      </div>
                      <div>
                        <span className="text-brand-300 text-[11px]">Số điện thoại:</span>
                        <p className="font-bold text-white">{confirmedAppointment.patientPhone}</p>
                      </div>
                      <div>
                        <span className="text-brand-300 text-[11px]">Bác sĩ khám:</span>
                        <p className="font-semibold text-white">{confirmedAppointment.doctorName}</p>
                      </div>
                      <div>
                        <span className="text-brand-300 text-[11px]">Chuyên khoa:</span>
                        <p className="font-semibold text-white">{confirmedAppointment.specialtyName}</p>
                      </div>
                      <div>
                        <span className="text-brand-300 text-[11px]">Ngày khám:</span>
                        <p className="font-bold text-amber-300 text-sm">{confirmedAppointment.appointmentDate}</p>
                      </div>
                      <div>
                        <span className="text-brand-300 text-[11px]">Giờ khám:</span>
                        <p className="font-bold text-amber-300 text-sm">{confirmedAppointment.startTime.slice(0, 5)} - {confirmedAppointment.endTime.slice(0, 5)}</p>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-brand-700/60 flex items-center justify-between text-[11px] text-brand-200">
                      <span className="flex items-center gap-1"><Icon name="building" size={14} /> {confirmedAppointment.branchName || "HealthCare TP.HCM"}</span>
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded font-semibold">
                        ĐÃ XÁC NHẬN
                      </span>
                    </div>
                  </div>

                  <div className="pt-3">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-8 py-2.5 bg-brand-700 hover:bg-brand-800 text-white font-bold rounded-full shadow-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 focus-visible:ring-2 focus-visible:ring-brand-600"
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



