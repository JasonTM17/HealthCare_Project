"use client";

import React, { useCallback, useRef, useState, useEffect } from "react";
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
import { businessDate } from "../lib/business-time";
import Icon from "./UiIcon";

const EMPTY_DOCTORS: Doctor[] = [];
const EMPTY_SPECIALTIES: Specialty[] = [];
const EMPTY_BRANCHES: Branch[] = [];
const EMPTY_PACKAGES: HealthPackage[] = [];
const BOOKING_STEPS = [
  { id: 1, label: "Chuyên khoa" },
  { id: 2, label: "Cơ sở" },
  { id: 3, label: "Bác sĩ" },
  { id: 4, label: "Ngày khám" },
  { id: 5, label: "Khung giờ" },
  { id: 6, label: "Thông tin" },
  { id: 7, label: "Xác nhận" },
] as const;

function doctorMatchesBranch(doctor: Doctor, branchId: string): boolean {
  if (!branchId) return true;
  if (doctor.branchIds && doctor.branchIds.length > 0) {
    return doctor.branchIds.includes(branchId);
  }
  return !doctor.branchId || doctor.branchId === branchId;
}

function doctorMatchesSpecialty(doctor: Doctor, specialty?: Specialty): boolean {
  if (!specialty) return true;
  if (doctor.specialtySlugs && doctor.specialtySlugs.length > 0) {
    return doctor.specialtySlugs.includes(specialty.slug);
  }
  return !doctor.specialtyName || doctor.specialtyName === specialty.name;
}

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
  // The public Stitch flow is seven explicit decisions. Backend hold/OTP remain
  // the final two transitions so every selection is visible and reviewable.
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
    return businessDate(1);
  });
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [slotError, setSlotError] = useState<string>("");
  const [slotRefreshNonce, setSlotRefreshNonce] = useState<number>(0);

  // Patient Info
  const [fullName, setFullName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [reasonForVisit, setReasonForVisit] = useState<string>("");

  // Hold & OTP State
  const [bookingCode, setBookingCode] = useState<string>("");
  const [otpCode, setOtpCode] = useState<string>("");
  const [holdExpiresAt, setHoldExpiresAt] = useState<string>("");
  const [otpExpiresAt, setOtpExpiresAt] = useState<string>("");
  const [secondsRemaining, setSecondsRemaining] = useState<number>(600);
  const [otpSecondsRemaining, setOtpSecondsRemaining] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [confirmedAppointment, setConfirmedAppointment] = useState<AppointmentDetails | null>(null);
  const bookingSessionRef = useRef(0);

  const resetBookingState = useCallback(() => {
    setStep(1);
    setSelectedSpecialty(initialSpecialtyId || "");
    setSelectedDoctor(initialDoctorId || "");
    setSelectedBranch(initialBranchId || "");
    setSelectedPackage(initialPackageId || "");
    setSelectedDate(businessDate(1));
    setSlots([]);
    setSelectedSlot("");
    setSlotError("");
    setFullName("");
    setPhone("");
    setEmail("");
    setReasonForVisit("");
    setBookingCode("");
    setOtpCode("");
    setHoldExpiresAt("");
    setOtpExpiresAt("");
    setSecondsRemaining(600);
    setOtpSecondsRemaining(0);
    setIsSubmitting(false);
    setErrorMessage("");
    setConfirmedAppointment(null);
  }, [initialBranchId, initialDoctorId, initialPackageId, initialSpecialtyId]);

  const closeBooking = useCallback(() => {
    bookingSessionRef.current += 1;
    resetBookingState();
    onClose();
  }, [onClose, resetBookingState]);

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
    const nextSpecialtyId = specialties.some((specialty) => specialty.id === initialSpecialtyId)
      ? initialSpecialtyId ?? ""
      : specialties[0]?.id ?? "";
    const nextSpecialty = specialties.find((specialty) => specialty.id === nextSpecialtyId);
    const firstDoctor = doctors.find((doctor) => doctor.id === initialDoctorId
      && doctorMatchesBranch(doctor, nextBranchId)
      && doctorMatchesSpecialty(doctor, nextSpecialty))
      ?? doctors.find((doctor) => doctorMatchesBranch(doctor, nextBranchId)
        && doctorMatchesSpecialty(doctor, nextSpecialty))
      ?? doctors[0];
    setSelectedBranch(nextBranchId);
    setSelectedDoctor(firstDoctor?.id ?? "");
    setSelectedSpecialty(nextSpecialtyId);
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
  }, [selectedDoctor, selectedBranch, selectedDate, slotRefreshNonce]);

  // Count down from the server-authoritative expiry instead of a client-side
  // decrement. Tab suspension and clock drift must not extend a hold.
  useEffect(() => {
    if (step !== 7 || !holdExpiresAt || confirmedAppointment) return;

    const updateRemaining = () => {
      const expiry = Date.parse(holdExpiresAt);
      const remaining = Number.isNaN(expiry)
        ? 0
        : Math.max(0, Math.ceil((expiry - Date.now()) / 1000));
      setSecondsRemaining(remaining);
    };

    updateRemaining();
    const timer = setInterval(updateRemaining, 1000);
    return () => clearInterval(timer);
  }, [step, holdExpiresAt, confirmedAppointment]);

  useEffect(() => {
    if (step !== 7 || !otpExpiresAt || confirmedAppointment) return;

    const updateOtpRemaining = () => {
      const expiry = Date.parse(otpExpiresAt);
      const remaining = Number.isNaN(expiry)
        ? 0
        : Math.max(0, Math.ceil((expiry - Date.now()) / 1000));
      setOtpSecondsRemaining(remaining);
    };

    updateOtpRemaining();
    const timer = setInterval(updateOtpRemaining, 1000);
    return () => clearInterval(timer);
  }, [step, otpExpiresAt, confirmedAppointment]);

  if (!isOpen) return null;

  const currentDoctor = doctors.find((doctor) => doctor.id === selectedDoctor);
  const currentSpecialty = specialties.find((specialty) => specialty.id === selectedSpecialty);
  const currentBranch = branches.find((branch) => branch.id === selectedBranch);
  const availableDoctors = doctors.filter(
    (doctor) => doctorMatchesBranch(doctor, selectedBranch) && doctorMatchesSpecialty(doctor, currentSpecialty),
  );
  const holdExpired = Boolean(bookingCode && holdExpiresAt && !confirmedAppointment && secondsRemaining <= 0);
  const otpExpired = Boolean(bookingCode && otpExpiresAt && !confirmedAppointment && otpSecondsRemaining <= 0);

  const restartSlotSelection = (): void => {
    bookingSessionRef.current += 1;
    setStep(5);
    setBookingCode("");
    setHoldExpiresAt("");
    setOtpExpiresAt("");
    setOtpCode("");
    setSecondsRemaining(0);
    setOtpSecondsRemaining(0);
    setErrorMessage("");
    setSelectedSlot("");
    setSlots([]);
    setSlotRefreshNonce((value) => value + 1);
  };

  const handleSpecialtyChange = (specialtyId: string): void => {
    const nextSpecialty = specialties.find((specialty) => specialty.id === specialtyId);
    const doctorsForSelection = doctors.filter((doctor) =>
      doctorMatchesBranch(doctor, selectedBranch) && doctorMatchesSpecialty(doctor, nextSpecialty),
    );
    setSelectedSpecialty(specialtyId);
    if (!doctorsForSelection.some((doctor) => doctor.id === selectedDoctor)) {
      setSelectedDoctor(doctorsForSelection[0]?.id ?? "");
    }
    setSlots([]);
    setSelectedSlot("");
    setSlotError("");
  };

  const handleBranchChange = (branchId: string): void => {
    setSelectedBranch(branchId);
    setSlots([]);
    setSelectedSlot("");
    setSlotError("");
    const firstDoctorAtBranch = doctors.find((doctor) =>
      doctorMatchesBranch(doctor, branchId) && doctorMatchesSpecialty(doctor, currentSpecialty),
    );
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
    if (!currentDoctor
      || !doctorMatchesBranch(currentDoctor, selectedBranch)
      || !doctorMatchesSpecialty(currentDoctor, currentSpecialty)) {
      setErrorMessage("Bác sĩ không thuộc cơ sở đang chọn. Vui lòng chọn lại bác sĩ.");
      return;
    }
    if (!fullName || !phone) {
      setErrorMessage("Vui lòng nhập đầy đủ họ tên và số điện thoại.");
      return;
    }
    setErrorMessage("");
    setIsSubmitting(true);
    const bookingSession = bookingSessionRef.current;

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
      if (bookingSession !== bookingSessionRef.current) return;

      setBookingCode(result.bookingCode);
      setHoldExpiresAt(result.holdExpiresAt);
      setOtpExpiresAt(result.otpExpiresAt);
      // The expiry effect computes the first value from the server timestamp
      // once step 7 mounts, keeping this event handler side-effect free.
      setSecondsRemaining(0);
      setOtpSecondsRemaining(0);
      setStep(7);
    } catch (err: any) {
      if (bookingSession === bookingSessionRef.current) {
        setErrorMessage(err.message || "Không thể giữ chỗ khung giờ này.");
      }
    } finally {
      if (bookingSession === bookingSessionRef.current) setIsSubmitting(false);
    }
  };

  // Handle Step 4: Confirm OTP
  const handleConfirmOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (holdExpired) {
      setErrorMessage("Thời gian giữ chỗ đã hết. Vui lòng chọn lại khung giờ để tiếp tục.");
      return;
    }
    if (otpExpired) {
      setErrorMessage("Mã OTP đã hết hạn. Vui lòng chọn lại khung giờ để nhận mã mới.");
      return;
    }
    if (!otpCode) {
      setErrorMessage("Vui lòng nhập mã OTP xác thực.");
      return;
    }
    setErrorMessage("");
    setIsSubmitting(true);
    const bookingSession = bookingSessionRef.current;

    try {
      const details = await confirmAppointment({
        bookingCode,
        otpCode: otpCode.trim(),
      });
      if (bookingSession !== bookingSessionRef.current) return;
      setConfirmedAppointment(details);
    } catch (err: any) {
      if (bookingSession === bookingSessionRef.current) {
        setErrorMessage(err.message || "Mã OTP không chính xác.");
      }
    } finally {
      if (bookingSession === bookingSessionRef.current) setIsSubmitting(false);
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
        <div className="bg-brand-800 text-white px-6 py-4 flex items-center justify-between">
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
            onClick={closeBooking}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 focus-visible:ring-2 focus-visible:ring-brand-200"
            aria-label="Đóng cửa sổ đặt lịch"
          >
            <Icon name="x" size={17} />
          </button>
        </div>

        {/* Wizard Step Progress */}
        {!confirmedAppointment && (
          <div className="border-b border-brand-100/60 bg-brand-50/70 px-6 py-3" aria-label="Tiến trình đặt lịch">
            <div className="flex items-center gap-2 overflow-x-auto text-xs font-semibold text-brand-900">
              {BOOKING_STEPS.map(({ id, label }, index) => (
                <React.Fragment key={id}>
                  {index > 0 ? <span aria-hidden="true" className="text-brand-300">→</span> : null}
                  <div
                    className={`flex min-w-max items-center gap-1.5 ${step === id ? "font-bold text-brand-700" : step > id ? "text-brand-500" : "text-gray-400"}`}
                    aria-current={step === id ? "step" : undefined}
                  >
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full ${step >= id ? "bg-brand-700 text-white" : "bg-gray-200 text-gray-500"}`}>
                      {step > id ? "✓" : id}
                    </span>
                    <span>{label}</span>
                  </div>
                </React.Fragment>
              ))}
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
          {/* ── STEP 1: Choose specialty ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-brand-700">01 · Nhu cầu khám</p>
                <h3 className="text-xl font-bold text-gray-900">Bạn muốn được hỗ trợ ở chuyên khoa nào?</h3>
                <p className="mt-1 text-sm leading-6 text-gray-600">Chọn đúng catalog active để lịch hẹn được tạo với identity backend hợp lệ.</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700" htmlFor="booking-specialty">Chuyên khoa</label>
                <select
                  id="booking-specialty"
                  value={selectedSpecialty}
                  onChange={(e) => handleSpecialtyChange(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-600"
                >
                  {specialties.map((sp) => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
                </select>
              </div>
              <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-4 text-sm text-brand-950">
                <strong>{currentSpecialty?.name ?? "Chưa chọn chuyên khoa"}</strong>
                <p className="mt-1 text-xs leading-5 text-brand-700">{currentSpecialty?.description ?? "Chọn một chuyên khoa để tiếp tục."}</p>
              </div>
              <div className="flex justify-end border-t border-gray-100 pt-4">
                <button type="button" disabled={catalogLoading || !currentSpecialty} onClick={() => setStep(2)} className="flex items-center gap-2 rounded-full bg-brand-700 px-6 py-2.5 font-semibold text-white shadow-md transition-colors hover:bg-brand-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 focus-visible:ring-2 focus-visible:ring-brand-600">
                  Tiếp tục: Chọn cơ sở <span>→</span>
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Choose branch ── */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-brand-700">02 · Cơ sở</p>
                <h3 className="text-xl font-bold text-gray-900">Chọn nơi bạn muốn đến khám</h3>
                <p className="mt-1 text-sm leading-6 text-gray-600">Lịch làm việc và khung giờ sẽ được kiểm tra theo đúng cơ sở này.</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700" htmlFor="booking-branch">Cơ sở bệnh viện / phòng khám</label>
                <select id="booking-branch" value={selectedBranch} onChange={(e) => handleBranchChange(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-600">
                  {branches.map((br) => <option key={br.id} value={br.id}>{br.name}</option>)}
                </select>
              </div>
              <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-4 text-sm text-brand-950">
                <strong>{currentBranch?.name ?? "Chưa chọn cơ sở"}</strong>
                <p className="mt-1 text-xs text-brand-700">{currentBranch?.address ?? "Backend chưa cung cấp địa chỉ."}</p>
                <p className="mt-1 text-xs text-brand-700">{currentBranch?.workingHours ?? "Backend chưa cung cấp giờ làm việc."}</p>
              </div>
              <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                <button type="button" onClick={() => setStep(1)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">← Quay lại</button>
                <button type="button" disabled={catalogLoading || !currentBranch} onClick={() => setStep(3)} className="flex items-center gap-2 rounded-full bg-brand-700 px-6 py-2.5 font-semibold text-white shadow-md transition-colors hover:bg-brand-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 focus-visible:ring-2 focus-visible:ring-brand-600">
                  Tiếp tục: Chọn bác sĩ <span>→</span>
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Choose doctor ── */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-brand-700">03 · Chuyên gia</p>
                <h3 className="text-xl font-bold text-gray-900">Chọn bác sĩ đồng hành</h3>
                <p className="mt-1 text-sm leading-6 text-gray-600">Chỉ hiển thị bác sĩ thuộc cơ sở đang được chọn trong catalog live.</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700" htmlFor="booking-doctor">Bác sĩ chuyên gia</label>
                <select id="booking-doctor" value={selectedDoctor} onChange={(e) => handleDoctorChange(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-600">
                  {availableDoctors.map((doc) => <option key={doc.id} value={doc.id}>{doc.fullName} ({doc.title || doc.specialtyName || "Bác sĩ chuyên khoa"})</option>)}
                </select>
              </div>
              <div className="flex items-center gap-4 rounded-xl border border-brand-100 bg-brand-50/60 p-4">
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-brand-700 text-xl font-bold text-white"><Icon name="stethoscope" size={26} /></div>
                <div>
                  <h4 className="text-base font-bold text-brand-900">{currentDoctor?.fullName ?? "Chưa chọn bác sĩ"}</h4>
                  <p className="text-xs text-brand-700">{currentDoctor?.title ?? "Chưa có hồ sơ bác sĩ"}{currentDoctor?.experienceYears ? ` • ${currentDoctor.experienceYears} năm kinh nghiệm` : ""}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-gray-500">{currentDoctor?.bio ?? "Chọn bác sĩ từ danh mục live."}</p>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                <button type="button" onClick={() => setStep(2)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">← Quay lại</button>
                <button type="button" disabled={catalogLoading || !currentDoctor} onClick={() => setStep(4)} className="flex items-center gap-2 rounded-full bg-brand-700 px-6 py-2.5 font-semibold text-white shadow-md transition-colors hover:bg-brand-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 focus-visible:ring-2 focus-visible:ring-brand-600">
                  Tiếp tục: Chọn ngày <span>→</span>
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 4: Choose date ── */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-brand-700">04 · Ngày khám</p>
                <h3 className="text-xl font-bold text-gray-900">Chọn ngày thuận tiện cho bạn</h3>
                <p className="mt-1 text-sm leading-6 text-gray-600">Ngày trong quá khứ sẽ không được gửi tới backend.</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700" htmlFor="booking-date">Ngày khám mong muốn</label>
                <input id="booking-date" type="date" min={selectedDate} value={selectedDate} onChange={(e) => handleDateChange(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-600" />
              </div>
              <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-4 text-xs text-brand-900">
                <p><strong>Bác sĩ:</strong> {currentDoctor?.fullName ?? "Chưa chọn"}</p>
                <p className="mt-1"><strong>Cơ sở:</strong> {currentBranch?.name ?? "Chưa chọn"}</p>
              </div>
              <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                <button type="button" onClick={() => setStep(3)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">← Quay lại</button>
                <button type="button" disabled={!selectedDate || !currentDoctor || !currentBranch} onClick={() => setStep(5)} className="flex items-center gap-2 rounded-full bg-brand-700 px-6 py-2.5 font-semibold text-white shadow-md transition-colors hover:bg-brand-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 focus-visible:ring-2 focus-visible:ring-brand-600">
                  Xem khung giờ <span>→</span>
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 5: Choose time slot ── */}
          {step === 5 && (
            <div className="space-y-5">
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-brand-700">05 · Khung giờ</p>
                <h3 className="text-xl font-bold text-gray-900">Chọn một khung giờ còn trống</h3>
                <p className="mt-1 text-sm leading-6 text-gray-600">Khung giờ được tính từ lịch làm việc thật và sẽ được kiểm tra lại khi giữ chỗ.</p>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-brand-100 bg-brand-50/60 p-3 text-xs text-brand-900">
                <span><strong>Ngày:</strong> {selectedDate}</span>
                <span><strong>Cơ sở:</strong> {currentBranch?.name ?? "Chưa chọn"}</span>
                <span><strong>Bác sĩ:</strong> {currentDoctor?.fullName ?? "Chưa chọn"}</span>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="block text-sm font-semibold text-gray-700">Khung giờ khám (30 phút/lượt)</label>
                  <span className="flex flex-wrap items-center gap-2 text-xs font-medium text-brand-700" aria-label="Chú giải trạng thái khung giờ">
                    <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-500" />Còn trống</span>
                    <span aria-hidden="true">•</span>
                    <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-slate-300" />Đã có người giữ</span>
                  </span>
                </div>
                {loadingSlots ? <div aria-live="polite" className="py-8 text-center text-sm text-gray-500" role="status"><Icon name="clock" size={15} /> Đang tải lịch khám khả dụng...</div>
                  : slotError ? <div aria-live="assertive" className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700" role="alert">{slotError}</div>
                  : slots.length === 0 ? <div aria-live="polite" className="rounded-lg border border-dashed border-gray-300 px-3 py-6 text-center text-sm text-gray-500" role="status">Chưa có khung giờ cho bác sĩ, cơ sở và ngày đã chọn.</div>
                  : <div className="grid max-h-56 grid-cols-3 gap-2.5 overflow-y-auto p-1 sm:grid-cols-4">{slots.map((slot) => { const isSelected = selectedSlot === slot.startTime; return <button key={`${slot.branchId}-${slot.startTime}`} type="button" disabled={!slot.available || slot.branchId !== selectedBranch} onClick={() => setSelectedSlot(slot.startTime)} className={`flex flex-col items-center justify-center gap-0.5 rounded-lg border p-2.5 text-xs font-semibold transition-colors ${isSelected ? "border-brand-700 bg-brand-700 text-white shadow-md ring-2 ring-brand-500" : slot.available ? "border-brand-200 bg-white text-gray-800 hover:border-brand-500 hover:bg-brand-50" : "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400 opacity-60"}`}><span className="text-sm font-bold">{slot.startTime.slice(0, 5)}</span><span className="text-[10px] opacity-80">{slot.available ? "Còn trống" : "Đã kín"}</span></button>; })}</div>}
              </div>
              <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                <button type="button" onClick={() => setStep(4)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">← Quay lại</button>
                <button type="button" disabled={!selectedSlot || !slots.some((slot) => slot.available && slot.startTime === selectedSlot && slot.branchId === selectedBranch)} onClick={() => setStep(6)} className="flex items-center gap-2 rounded-full bg-brand-700 px-6 py-2.5 font-semibold text-white shadow-md transition-colors hover:bg-brand-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 focus-visible:ring-2 focus-visible:ring-brand-600">
                  Tiếp tục: Điền thông tin <span>→</span>
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 6: Patient Information Form ── */}
          {step === 6 && (
            <form onSubmit={handleHoldSlot} className="space-y-4">
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-brand-700">06 · Thông tin bệnh nhân</p>
                <h3 className="text-xl font-bold text-gray-900">Cho chúng tôi biết cách liên hệ với bạn</h3>
                <p className="mt-1 text-sm leading-6 text-gray-600">Thông tin chỉ được gửi khi bạn bấm giữ chỗ và không được đưa vào URL.</p>
              </div>
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
                  onClick={() => setStep(5)}
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
                    <span className="inline-flex items-center gap-2"><Icon name="clock" size={15} /> Đang giữ chỗ...</span>
                  ) : (
                    <>
                      <span>Giữ chỗ & Nhận mã OTP</span> <span>→</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ── STEP 7: OTP Verification & Final E-Card ── */}
          {step === 7 && (
            <div>
              {!confirmedAppointment ? (
                <form onSubmit={handleConfirmOtp} className="space-y-4 text-center py-2">
                  <div>
                    <p className="mb-1 text-xs font-bold uppercase tracking-wider text-brand-700">07 · Xác nhận</p>
                    <h3 className="text-xl font-bold text-gray-900">Xác nhận lịch hẹn bằng OTP</h3>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 text-xs font-semibold">
                    <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-900">
                      <Icon name="clock" size={15} />
                      {holdExpired ? "Thời gian giữ chỗ đã hết" : <>Giữ chỗ còn lại:{" "}<span className="font-mono font-bold text-amber-700">{formatTimer(secondsRemaining)}</span></>}
                    </span>
                    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 ${otpExpired ? "border-red-200 bg-red-50 text-red-900" : "border-brand-200 bg-brand-50 text-brand-900"}`}>
                      OTP còn hiệu lực:{" "}<span className="font-mono font-bold">{otpExpired ? "00:00" : formatTimer(otpSecondsRemaining)}</span>
                    </span>
                  </div>

                  {holdExpired ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-left text-sm text-red-900" role="alert" aria-live="assertive">
                      <p className="font-bold">Khung giờ này không còn được giữ.</p>
                      <p className="mt-1 text-xs leading-5">Thời gian hiển thị được tính từ mốc hết hạn do backend trả về. Hãy tải lại danh sách và chọn khung giờ khác.</p>
                      <button type="button" onClick={restartSlotSelection} className="mt-3 rounded-full border border-red-300 bg-white px-4 py-2 text-xs font-bold text-red-800 transition-colors hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400 focus-visible:ring-2 focus-visible:ring-red-500">
                        Tải lại khung giờ
                      </button>
                    </div>
                  ) : null}

                  {otpExpired && !holdExpired ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-left text-sm text-red-900" role="alert" aria-live="assertive">
                      <p className="font-bold">Mã OTP đã hết hiệu lực.</p>
                      <p className="mt-1 text-xs leading-5">Backend đã tách thời hạn OTP khỏi thời hạn giữ chỗ. Hãy chọn lại một khung giờ để nhận mã mới.</p>
                      <button type="button" onClick={restartSlotSelection} className="mt-3 rounded-full border border-red-300 bg-white px-4 py-2 text-xs font-bold text-red-800 transition-colors hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400 focus-visible:ring-2 focus-visible:ring-red-500">
                        Chọn lại khung giờ
                      </button>
                    </div>
                  ) : null}

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
                      disabled={holdExpired || otpExpired || isSubmitting}
                      className="w-48 text-center p-3 text-2xl font-mono tracking-widest bg-gray-50 border-2 border-brand-600 rounded-xl focus:ring-4 focus:ring-brand-100 focus:outline-none"
                    />
                  </div>

                  <div className="pt-3 flex items-center justify-between border-t border-gray-100">
                    <button
                      type="button"
                      onClick={holdExpired ? restartSlotSelection : () => setStep(6)}
                      className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium text-sm"
                    >
                      {holdExpired ? "← Chọn lại khung giờ" : "← Sửa thông tin"}
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || holdExpired || otpExpired}
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
                  <div className="p-5 bg-brand-900 text-white rounded-2xl text-left shadow-xl relative overflow-hidden">
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
                      onClick={closeBooking}
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



