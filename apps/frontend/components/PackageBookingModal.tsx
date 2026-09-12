"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AppointmentDetails,
  Branch,
  Doctor,
  HealthPackage,
  HoldSlotResult,
  TimeSlot,
} from "../types/hospital";
import { confirmAppointment, fetchDoctorSlots, holdAppointmentSlot } from "../lib/api";
import {
  ApiError,
  fetchBranches,
  fetchDoctors,
  resendAppointmentOtp,
} from "../lib/api-client";
import { businessDate, formatBusinessDate } from "../lib/business-time";
import { presentApiError } from "../lib/present-api-error";
import Icon from "./UiIcon";
import useDialogFocus from "./useDialogFocus";

export type PackageItem = HealthPackage;

export interface PackageBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  packageItem: PackageItem;
  branches?: Branch[];
  initialBranchId?: string;
}

const PACKAGE_BOOKING_STEPS = [
  { id: 1, label: "Cơ sở y tế" },
  { id: 2, label: "Ngày & Giờ tiếp nhận" },
  { id: 3, label: "Thông tin người khám" },
  { id: 4, label: "Xác nhận & Phiếu khám" },
] as const;

const DEFAULT_RECEPTION_SLOTS = [
  "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00",
  "13:30", "14:00", "14:30", "15:00", "15:30", "16:00",
] as const;

const currency = (price: number): string => new Intl.NumberFormat("vi-VN").format(price);

function maskEmail(value: string): string {
  const normalized = value.trim();
  const separatorIndex = normalized.lastIndexOf("@");
  if (separatorIndex <= 0 || separatorIndex === normalized.length - 1) return "***";
  const localPart = normalized.slice(0, separatorIndex);
  const domain = normalized.slice(separatorIndex + 1);
  const visiblePrefix = localPart.length > 1 ? localPart.slice(0, 2) : "";
  const hiddenPart = "*".repeat(Math.max(3, localPart.length - visiblePrefix.length));
  return `${visiblePrefix}${hiddenPart}@${domain}`;
}

function isValidBookingEmail(value: string): boolean {
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

function secondsUntil(value: string): number {
  const expiry = Date.parse(value);
  return Number.isNaN(expiry) ? 0 : Math.max(0, Math.ceil((expiry - Date.now()) / 1000));
}

function formatTimer(secs: number): string {
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return `${mins.toString().padStart(2, "0")}:${rem.toString().padStart(2, "0")}`;
}

function doctorMatchesBranch(doctor: Doctor, branchId: string): boolean {
  if (!branchId) return true;
  if (doctor.branchIds && doctor.branchIds.length > 0) {
    return doctor.branchIds.includes(branchId);
  }
  return !doctor.branchId || doctor.branchId === branchId;
}

export default function PackageBookingModal({
  isOpen,
  onClose,
  packageItem,
  branches: providedBranches = [],
  initialBranchId,
}: PackageBookingModalProps) {
  const [step, setStep] = useState<number>(1);
  const [loadedBranches, setLoadedBranches] = useState<Branch[]>([]);
  const [loadedDoctors, setLoadedDoctors] = useState<Doctor[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string>("");

  const effectiveBranches = providedBranches.length > 0 ? providedBranches : loadedBranches;

  // Step 1: Branch Selection
  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId || "");

  // Step 2: Date & Slot Selection
  const [selectedDate, setSelectedDate] = useState<string>(() => businessDate(1));
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string>("");
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [selectedSlotTime, setSelectedSlotTime] = useState<string>("08:00:00");

  // Step 3: Patient Information Form
  const [fullName, setFullName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [dateOfBirth, setDateOfBirth] = useState<string>("");
  const [gender, setGender] = useState<"MALE" | "FEMALE" | "OTHER">("MALE");
  const [notes, setNotes] = useState<string>("");
  const [hasInsurance, setHasInsurance] = useState<boolean>(false);
  const [privacyConsent, setPrivacyConsent] = useState<boolean>(false);

  // Step 4: Hold & OTP Confirmation
  const [bookingCode, setBookingCode] = useState<string>("");
  const [otpCode, setOtpCode] = useState<string>("");
  const [holdExpiresAt, setHoldExpiresAt] = useState<string>("");
  const [otpExpiresAt, setOtpExpiresAt] = useState<string>("");
  const [otpDeliveryStatus, setOtpDeliveryStatus] = useState<HoldSlotResult["otpDeliveryStatus"]>(undefined);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(600);
  const [otpSecondsRemaining, setOtpSecondsRemaining] = useState<number>(0);
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState<number>(0);
  const [isResendingOtp, setIsResendingOtp] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [confirmedAppointment, setConfirmedAppointment] = useState<AppointmentDetails | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const bookingSessionRef = useRef(0);
  const otpResendAttemptRef = useRef(0);
  const otpResendControllerRef = useRef<AbortController | null>(null);

  const minimumAppointmentDate = useMemo(() => businessDate(1), []);

  useDialogFocus(dialogRef, isOpen, onClose);

  // Fetch branches and doctors if needed
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    const loadCatalogs = async () => {
      const needsBranches = providedBranches.length === 0;
      if (!needsBranches && loadedDoctors.length > 0) return;

      setCatalogLoading(true);
      setCatalogError("");
      try {
        const [branchRes, doctorRes] = await Promise.all([
          needsBranches ? fetchBranches(0, 100).catch(() => null) : null,
          fetchDoctors({ page: 0, size: 100 }).catch(() => null),
        ]);

        if (cancelled) return;

        if (branchRes) {
          setLoadedBranches(branchRes.content);
        }
        if (doctorRes) {
          setLoadedDoctors(doctorRes.content);
        }
      } catch {
        if (!cancelled) {
          setCatalogError("Chưa thể tải danh sách cơ sở khám. Vui lòng thử lại sau.");
        }
      } finally {
        if (!cancelled) {
          setCatalogLoading(false);
        }
      }
    };

    void loadCatalogs();
    return () => {
      cancelled = true;
    };
  }, [isOpen, providedBranches.length, loadedDoctors.length]);

  // Resolve active branch
  const activeBranchId = useMemo(() => {
    if (selectedBranchId && effectiveBranches.some((b) => b.id === selectedBranchId)) {
      return selectedBranchId;
    }
    if (initialBranchId && effectiveBranches.some((b) => b.id === initialBranchId)) {
      return initialBranchId;
    }
    return effectiveBranches[0]?.id || "";
  }, [effectiveBranches, initialBranchId, selectedBranchId]);

  // Resolve intake doctor for the selected branch
  const currentBranch = useMemo(
    () => effectiveBranches.find((b) => b.id === activeBranchId) || effectiveBranches[0],
    [effectiveBranches, activeBranchId],
  );

  const intakeDoctor = useMemo(() => {
    if (!currentBranch) return loadedDoctors[0];

    // Check if branch has associated doctors
    if (currentBranch.doctors && currentBranch.doctors.length > 0) {
      const matchingSummary = currentBranch.doctors[0];
      const fullDoc = loadedDoctors.find((d) => d.id === matchingSummary.id);
      if (fullDoc) return fullDoc;
      return {
        id: matchingSummary.id,
        fullName: matchingSummary.fullName,
        slug: matchingSummary.slug,
        bio: "Bác sĩ tiếp nhận và điều phối gói khám",
        branchId: currentBranch.id,
      } as Doctor;
    }

    // Check loaded doctors matching branch
    const matchingDoctor = loadedDoctors.find((d) => doctorMatchesBranch(d, currentBranch.id));
    if (matchingDoctor) return matchingDoctor;

    return loadedDoctors[0];
  }, [currentBranch, loadedDoctors]);

  // Load slots when date or branch changes
  useEffect(() => {
    if (!isOpen || !activeBranchId || !selectedDate) return;

    let cancelled = false;
    const controller = new AbortController();

    const loadSlots = async () => {
      setSlotsLoading(true);
      setSlotsError("");

      try {
        const doctorIdToQuery = intakeDoctor?.id;
        let fetchedSlots: TimeSlot[] = [];

        if (doctorIdToQuery) {
          try {
            fetchedSlots = await fetchDoctorSlots(
              doctorIdToQuery,
              activeBranchId,
              selectedDate,
              controller.signal,
            );
          } catch {
            fetchedSlots = [];
          }
        }

        if (cancelled) return;

        if (fetchedSlots.length > 0) {
          setAvailableSlots(fetchedSlots);
          const firstAvailable = fetchedSlots.find((s) => s.available && s.branchId === activeBranchId);
          if (firstAvailable) {
            setSelectedSlotTime(firstAvailable.startTime);
          }
        } else {
          // Generate standard reception slots for health packages
          const fallbackSlots: TimeSlot[] = DEFAULT_RECEPTION_SLOTS.map((time) => {
            const [hours, minutes] = time.split(":").map(Number);
            const endHours = minutes + 30 >= 60 ? hours + 1 : hours;
            const endMinutes = (minutes + 30) % 60;
            const endTime = `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}:00`;
            return {
              branchId: activeBranchId,
              startTime: `${time}:00`,
              endTime,
              available: true,
              statusNote: "Còn trống",
            };
          });
          setAvailableSlots(fallbackSlots);
          setSelectedSlotTime("08:00:00");
        }
      } catch {
        if (!cancelled && !controller.signal.aborted) {
          setSlotsError("Chưa thể tải khung giờ tiếp nhận. Đang sử dụng khung giờ tiếp nhận tiêu chuẩn.");
        }
      } finally {
        if (!cancelled) {
          setSlotsLoading(false);
        }
      }
    };

    void loadSlots();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isOpen, activeBranchId, selectedDate, intakeDoctor?.id]);

  // Timers for hold & OTP expiration in Step 4
  useEffect(() => {
    if (step !== 4 || !holdExpiresAt || confirmedAppointment) return;

    const updateRemaining = () => {
      const expiry = Date.parse(holdExpiresAt);
      const remaining = Number.isNaN(expiry) ? 0 : Math.max(0, Math.ceil((expiry - Date.now()) / 1000));
      setSecondsRemaining(remaining);
    };

    updateRemaining();
    const timer = setInterval(updateRemaining, 1000);
    return () => clearInterval(timer);
  }, [step, holdExpiresAt, confirmedAppointment]);

  useEffect(() => {
    if (step !== 4 || !otpExpiresAt || confirmedAppointment) return;

    const updateOtpRemaining = () => {
      const expiry = Date.parse(otpExpiresAt);
      const remaining = Number.isNaN(expiry) ? 0 : Math.max(0, Math.ceil((expiry - Date.now()) / 1000));
      setOtpSecondsRemaining(remaining);
    };

    updateOtpRemaining();
    const timer = setInterval(updateOtpRemaining, 1000);
    return () => clearInterval(timer);
  }, [step, otpExpiresAt, confirmedAppointment]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setResendCooldownSeconds((sec) => Math.max(0, sec - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldownSeconds]);

  const handleClose = useCallback(() => {
    otpResendControllerRef.current?.abort();
    otpResendControllerRef.current = null;
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  const holdExpired = secondsRemaining <= 0;
  const otpExpired = otpSecondsRemaining <= 0;

  // Step 3 Submission: Hold Slot
  const handleHoldSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!activeBranchId) {
      setErrorMessage("Vui lòng chọn cơ sở khám bệnh.");
      setStep(1);
      return;
    }

    if (!selectedDate || !selectedSlotTime) {
      setErrorMessage("Vui lòng chọn ngày và khung giờ tiếp nhận.");
      setStep(2);
      return;
    }

    const trimmedName = fullName.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || !trimmedPhone) {
      setErrorMessage("Vui lòng nhập đầy đủ họ tên và số điện thoại người khám.");
      return;
    }

    if (!/^[+0-9() .-]{7,20}$/.test(trimmedPhone)) {
      setErrorMessage("Số điện thoại chưa đúng định dạng. Vui lòng kiểm tra lại.");
      return;
    }

    if (!trimmedEmail) {
      setErrorMessage("Vui lòng nhập email để nhận mã OTP và phiếu khám điện tử.");
      return;
    }

    if (!isValidBookingEmail(trimmedEmail)) {
      setErrorMessage("Email chưa đúng định dạng. Vui lòng kiểm tra lại.");
      return;
    }

    if (!privacyConsent) {
      setErrorMessage("Vui lòng tích chọn đồng ý với chính sách bảo mật.");
      return;
    }

    // Resolve doctor ID (guarantee non-null doctorId for backend)
    const doctorIdToUse = intakeDoctor?.id || "00000000-0000-0000-0000-000000000001";

    // Build structured reason / notes containing DOB & gender
    const noteParts: string[] = [];
    if (dateOfBirth) noteParts.push(`Ngày sinh: ${dateOfBirth}`);
    const genderText = gender === "MALE" ? "Nam" : gender === "FEMALE" ? "Nữ" : "Khác";
    noteParts.push(`Giới tính: ${genderText}`);
    if (notes.trim()) noteParts.push(`Ghi chú: ${notes.trim()}`);
    noteParts.push(`Gói khám: ${packageItem.name}`);

    const structuredReason = noteParts.join(" | ");

    setErrorMessage("");
    setIsSubmitting(true);
    bookingSessionRef.current += 1;
    const currentSession = bookingSessionRef.current;

    try {
      const result = await holdAppointmentSlot({
        doctorId: doctorIdToUse,
        branchId: activeBranchId,
        packageId: packageItem.id,
        appointmentDate: selectedDate,
        startTime: selectedSlotTime.length === 5 ? `${selectedSlotTime}:00` : selectedSlotTime,
        fullName: trimmedName,
        phone: trimmedPhone,
        email: trimmedEmail,
        reasonForVisit: structuredReason,
        hasInsurance,
        privacyConsent: true,
      });

      if (currentSession !== bookingSessionRef.current) return;

      setBookingCode(result.bookingCode);
      setHoldExpiresAt(result.holdExpiresAt);
      setOtpExpiresAt(result.otpExpiresAt);
      setOtpDeliveryStatus(result.otpDeliveryStatus ?? "QUEUED");
      setResendCooldownSeconds(result.otpDeliveryStatus === "FAILED" ? 0 : 60);
      setSecondsRemaining(secondsUntil(result.holdExpiresAt));
      setOtpSecondsRemaining(secondsUntil(result.otpExpiresAt));
      setStep(4);
    } catch (err: unknown) {
      if (currentSession === bookingSessionRef.current) {
        setErrorMessage(
          err instanceof Error && err.message
            ? err.message
            : "Chưa thể giữ khung giờ này. Vui lòng kiểm tra lại thông tin và thử lại.",
        );
      }
    } finally {
      if (currentSession === bookingSessionRef.current) {
        setIsSubmitting(false);
      }
    }
  };

  // Step 4: Resend OTP
  const handleResendOtp = async (): Promise<void> => {
    if (!bookingCode || holdExpired || confirmedAppointment || isResendingOtp || resendCooldownSeconds > 0) return;

    otpResendControllerRef.current?.abort();
    const controller = new AbortController();
    otpResendControllerRef.current = controller;
    const attempt = otpResendAttemptRef.current + 1;
    otpResendAttemptRef.current = attempt;

    setErrorMessage("");
    setIsResendingOtp(true);

    try {
      const result = await resendAppointmentOtp(bookingCode, phone, controller.signal);
      if (controller.signal.aborted || attempt !== otpResendAttemptRef.current) return;

      setHoldExpiresAt(result.holdExpiresAt);
      setOtpExpiresAt(result.otpExpiresAt);
      setSecondsRemaining(secondsUntil(result.holdExpiresAt));
      setOtpSecondsRemaining(secondsUntil(result.otpExpiresAt));
      setOtpDeliveryStatus(result.otpDeliveryStatus);
      setOtpCode("");
      setResendCooldownSeconds(result.otpDeliveryStatus === "FAILED" ? 0 : Math.max(1, result.retryAfterSeconds || 60));
    } catch (err: unknown) {
      if (controller.signal.aborted || attempt !== otpResendAttemptRef.current) return;
      if (err instanceof ApiError && err.status === 429) {
        setResendCooldownSeconds(60);
      }
      setErrorMessage(
        err instanceof Error && err.message
          ? err.message
          : presentApiError(
              err instanceof ApiError ? err.code : undefined,
              err instanceof ApiError ? err.status : undefined,
            ),
      );
    } finally {
      if (attempt === otpResendAttemptRef.current) {
        otpResendControllerRef.current = null;
        setIsResendingOtp(false);
      }
    }
  };

  // Step 4: Confirm OTP
  const handleConfirmOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (holdExpired) {
      setErrorMessage("Thời gian giữ chỗ đã hết. Vui lòng chọn lại khung giờ tiếp nhận.");
      return;
    }

    if (otpExpired) {
      setErrorMessage("Mã OTP đã hết hạn. Hãy bấm 'Gửi lại mã OTP' để tiếp tục.");
      return;
    }

    const trimmedOtp = otpCode.trim();
    if (!/^\d{6}$/.test(trimmedOtp)) {
      setErrorMessage("Mã OTP phải gồm đúng 6 chữ số.");
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);
    bookingSessionRef.current += 1;
    const currentSession = bookingSessionRef.current;

    try {
      const details = await confirmAppointment({
        bookingCode,
        otpCode: trimmedOtp,
      });

      if (currentSession !== bookingSessionRef.current) return;
      setConfirmedAppointment(details);
    } catch (err: unknown) {
      if (currentSession === bookingSessionRef.current) {
        setErrorMessage(
          err instanceof Error && err.message
            ? err.message
            : presentApiError(
                err instanceof ApiError ? err.code : undefined,
                err instanceof ApiError ? err.status : undefined,
              ),
        );
      }
    } finally {
      if (currentSession === bookingSessionRef.current) {
        setIsSubmitting(false);
      }
    }
  };

  const morningSlots = availableSlots.filter((slot) => {
    const hour = Number.parseInt(slot.startTime.slice(0, 2), 10);
    return hour < 12;
  });

  const afternoonSlots = availableSlots.filter((slot) => {
    const hour = Number.parseInt(slot.startTime.slice(0, 2), 10);
    return hour >= 12;
  });

  return (
    <div
      aria-labelledby="package-booking-modal-title"
      aria-modal="true"
      className="dialog-layer fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-fadeIn overflow-y-auto"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
      role="dialog"
    >
      <div
        className="booking-panel booking-panel--modal relative w-full max-w-2xl bg-white rounded-sm shadow-2xl overflow-hidden border border-brand-100 flex flex-col my-auto max-h-[92vh]"
        ref={dialogRef}
      >
        {/* Modal Top Header */}
        <div className="booking-panel__header flex items-center justify-between border-b border-brand-100 bg-white px-5 py-4">
          <div>
            <span className="booking-panel__eyebrow text-xs font-semibold uppercase tracking-wider text-brand-700">
              Đặt lịch trọn gói không chờ đợi
            </span>
            <h2 id="package-booking-modal-title" className="booking-panel__title text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
              <Icon name="calendar" size={20} /> Đặt Lịch Gói Khám Sức Khỏe
            </h2>
          </div>
          <button
            aria-label="Đóng cửa sổ đặt lịch"
            className="booking-panel__close p-1.5 text-gray-500 hover:text-gray-900 rounded-sm hover:bg-gray-100 transition-colors"
            onClick={handleClose}
            type="button"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        {/* 🔒 IMMUTABLE SELECTED PACKAGE BANNER */}
        <div className="bg-gradient-to-r from-teal-800 to-[#003336] text-white px-5 py-3 border-b border-teal-900 shadow-inner flex flex-wrap items-center justify-between gap-3">
          <div className="flex-1 min-w-[240px]">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-teal-600/60 text-teal-100 rounded-xs border border-teal-500/40">
                Gói khám đã chọn
              </span>
              {packageItem.durationDays ? (
                <span className="text-xs text-teal-200">
                  Thời lượng: {packageItem.durationDays} ngày
                </span>
              ) : null}
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
              {packageItem.name}
            </h3>
            {packageItem.targetAudience ? (
              <p className="text-xs text-teal-200/90 line-clamp-1 mt-0.5">
                Đối tượng: {packageItem.targetAudience}
              </p>
            ) : null}
          </div>
          <div className="text-right">
            <span className="text-[11px] uppercase tracking-wider text-teal-200 block">Chi phí trọn gói</span>
            <p className="text-lg sm:text-xl font-extrabold text-amber-300 font-mono">
              {currency(packageItem.price)} <span className="text-xs font-normal text-white">VNĐ</span>
            </p>
          </div>
        </div>

        {/* 4-Step Wizard Progress Bar */}
        {!confirmedAppointment && (
          <div className="border-b border-brand-100/60 bg-brand-50/70 px-5 py-2.5" role="group" aria-label="Tiến trình đặt gói khám">
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto text-xs font-semibold text-brand-900">
              {PACKAGE_BOOKING_STEPS.map((s, index) => {
                const isCurrent = step === s.id;
                const isComplete = step > s.id;
                return (
                  <React.Fragment key={s.id}>
                    {index > 0 ? <span aria-hidden="true" className="text-brand-300">→</span> : null}
                    <div
                      aria-current={isCurrent ? "step" : undefined}
                      className={`flex min-w-max items-center gap-1.5 ${
                        isCurrent ? "font-bold text-brand-800" : isComplete ? "text-brand-600" : "text-gray-500"
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                          isCurrent || isComplete ? "bg-brand-700 text-white font-bold" : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {isComplete ? "✓" : s.id}
                      </span>
                      <span className="hidden sm:inline">{s.label}</span>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}

        {/* Main Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1">
          {errorMessage ? (
            <div aria-live="assertive" className="mb-4 rounded-sm border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
              <p className="font-semibold">{errorMessage}</p>
            </div>
          ) : null}

          {/* ══════════════════════════════════════════════════════════════════════
              STEP 1: Chọn Cơ sở y tế (Select Branch/Facility)
              ══════════════════════════════════════════════════════════════════════ */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Bước 1 / 4</p>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900">Chọn cơ sở y tế thuận tiện nhất</h3>
                <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
                  Tất cả các cơ sở đều được trang bị đầy đủ máy móc xét nghiệm, chẩn đoán hình ảnh chuẩn cho gói khám này.
                </p>
              </div>

              {catalogLoading ? (
                <div className="py-8 text-center text-sm text-gray-500">Đang tải danh sách cơ sở khám…</div>
              ) : catalogError ? (
                <div className="p-3 text-sm text-red-700 bg-red-50 rounded-sm border border-red-200">{catalogError}</div>
              ) : (
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {effectiveBranches.map((branch) => {
                    const isSelected = activeBranchId === branch.id;
                    return (
                      <div
                        key={branch.id}
                        onClick={() => setSelectedBranchId(branch.id)}
                        className={`p-3.5 rounded-sm border cursor-pointer transition-all ${
                          isSelected
                            ? "border-brand-600 bg-brand-50/70 ring-2 ring-brand-500/20 shadow-xs"
                            : "border-gray-200 bg-white hover:border-brand-300 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-3">
                            <input
                              type="radio"
                              name="selected-branch"
                              id={`branch-${branch.id}`}
                              checked={isSelected}
                              onChange={() => setSelectedBranchId(branch.id)}
                              className="mt-1 h-4 w-4 text-brand-700 border-gray-300 focus:ring-brand-600"
                            />
                            <div>
                              <label htmlFor={`branch-${branch.id}`} className="font-bold text-sm text-gray-900 cursor-pointer">
                                {branch.name}
                              </label>
                              <p className="text-xs text-gray-600 mt-0.5 flex items-center gap-1">
                                <Icon name="building" size={13} /> {branch.address}
                              </p>
                              {branch.phone || branch.emergencyHotline ? (
                                <p className="text-xs text-brand-700 mt-1">
                                  Hotline: <span className="font-semibold">{branch.emergencyHotline || branch.phone}</span>
                                  {branch.workingHours ? ` · ${branch.workingHours}` : " · 07:30 - 17:00"}
                                </p>
                              ) : null}
                            </div>
                          </div>
                          {isSelected ? (
                            <span className="text-xs font-bold text-brand-700 bg-brand-100 px-2 py-0.5 rounded-xs">
                              Đã chọn
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end">
                <button
                  type="button"
                  disabled={!activeBranchId || catalogLoading}
                  onClick={() => setStep(2)}
                  className="flex items-center gap-2 rounded-sm bg-brand-700 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-800 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-brand-600"
                >
                  Tiếp tục: Chọn ngày & giờ tiếp nhận <span>→</span>
                </button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              STEP 2: Chọn Ngày & Khung giờ tiếp nhận (Select Date & Reception Slot)
              ══════════════════════════════════════════════════════════════════════ */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Bước 2 / 4</p>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900">Chọn ngày & khung giờ tiếp nhận</h3>
                <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
                  Bệnh viện tiếp đón ưu tiên theo giờ hẹn, giúp bạn hoàn thành các bước khám nhanh chóng và không phải chờ đợi.
                </p>
              </div>

              {/* Facility Summary Chip */}
              <div className="p-3 bg-brand-50/60 border border-brand-100 rounded-sm text-xs text-brand-900 flex items-center justify-between">
                <span>
                  <strong>Cơ sở tiếp nhận:</strong> {currentBranch?.name}
                </span>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-brand-700 font-semibold underline hover:text-brand-900 text-xs"
                >
                  Đổi cơ sở
                </button>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1" htmlFor="package-booking-date">
                  Ngày tiếp nhận khám <span className="text-red-500">*</span>
                </label>
                <input
                  id="package-booking-date"
                  name="package-date"
                  type="date"
                  required
                  min={minimumAppointmentDate}
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full rounded-sm border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-600"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Đã chọn: <strong className="text-brand-800">{formatBusinessDate(selectedDate)}</strong>
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-800">Khung giờ tiếp nhận</span>
                  <span className="text-xs text-gray-500 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-brand-700" /> Đang chọn
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" /> Còn chỗ
                    </span>
                  </span>
                </div>

                {slotsLoading ? (
                  <div className="py-6 text-center text-sm text-gray-500">Đang kiểm tra lịch tiếp nhận khả dụng…</div>
                ) : (
                  <div className="space-y-3">
                    {morningSlots.length > 0 ? (
                      <div>
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                          Buổi sáng (Khuyên dùng cho xét nghiệm máu / nội soi)
                        </span>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {morningSlots.map((slot) => {
                            const isSelected = selectedSlotTime === slot.startTime;
                            return (
                              <button
                                key={slot.startTime}
                                type="button"
                                disabled={!slot.available}
                                onClick={() => setSelectedSlotTime(slot.startTime)}
                                className={`p-2 rounded-sm text-xs font-semibold text-center border transition-all ${
                                  isSelected
                                    ? "bg-brand-700 border-brand-700 text-white shadow-xs"
                                    : slot.available
                                      ? "bg-white border-brand-200 text-gray-800 hover:border-brand-500 hover:bg-brand-50/50"
                                      : "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                                }`}
                              >
                                <span className="block text-sm font-bold">{slot.startTime.slice(0, 5)}</span>
                                <span className="text-[10px] opacity-85">{slot.available ? "Còn chỗ" : "Đã kín"}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    {afternoonSlots.length > 0 ? (
                      <div>
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                          Buổi chiều
                        </span>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {afternoonSlots.map((slot) => {
                            const isSelected = selectedSlotTime === slot.startTime;
                            return (
                              <button
                                key={slot.startTime}
                                type="button"
                                disabled={!slot.available}
                                onClick={() => setSelectedSlotTime(slot.startTime)}
                                className={`p-2 rounded-sm text-xs font-semibold text-center border transition-all ${
                                  isSelected
                                    ? "bg-brand-700 border-brand-700 text-white shadow-xs"
                                    : slot.available
                                      ? "bg-white border-brand-200 text-gray-800 hover:border-brand-500 hover:bg-brand-50/50"
                                      : "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                                }`}
                              >
                                <span className="block text-sm font-bold">{slot.startTime.slice(0, 5)}</span>
                                <span className="text-[10px] opacity-85">{slot.available ? "Còn chỗ" : "Đã kín"}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
                {slotsError ? <p className="text-xs text-amber-700 mt-2">{slotsError}</p> : null}
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-sm"
                >
                  ← Quay lại
                </button>
                <button
                  type="button"
                  disabled={!selectedDate || !selectedSlotTime || slotsLoading}
                  onClick={() => setStep(3)}
                  className="flex items-center gap-2 rounded-sm bg-brand-700 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-800 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-brand-600"
                >
                  Tiếp tục: Điền thông tin người khám <span>→</span>
                </button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              STEP 3: Điền thông tin người khám (Patient Information Form)
              ══════════════════════════════════════════════════════════════════════ */}
          {step === 3 && (
            <form onSubmit={handleHoldSlot} className="space-y-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Bước 3 / 4</p>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900">Thông tin người khám sức khỏe</h3>
                <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
                  Thông tin này sẽ được in trên phiếu khám và hồ sơ bệnh án điện tử tại bệnh viện.
                </p>
              </div>

              {/* Schedule Summary Card */}
              <div className="p-3 bg-brand-50/60 border border-brand-100 rounded-sm text-xs text-brand-900 space-y-1">
                <div className="flex justify-between font-semibold">
                  <span>Cơ sở: {currentBranch?.name}</span>
                  <span className="text-brand-800">
                    {formatBusinessDate(selectedDate)} lúc {selectedSlotTime.slice(0, 5)}
                  </span>
                </div>
                <div className="text-gray-600">{currentBranch?.address}</div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="package-patient-name">
                  Họ và tên người khám <span className="text-red-500">*</span>
                </label>
                <input
                  id="package-patient-name"
                  name="fullName"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="Ví dụ: Trần Thị Mai"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-sm focus:ring-2 focus:ring-brand-600 focus:outline-none text-sm text-gray-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="package-patient-phone">
                    Số điện thoại liên hệ <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="package-patient-phone"
                    name="phone"
                    type="tel"
                    required
                    autoComplete="tel"
                    placeholder="0901234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-sm focus:ring-2 focus:ring-brand-600 focus:outline-none text-sm text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="package-patient-email">
                    Email nhận mã OTP & Phiếu khám <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="package-patient-email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="patient@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-sm focus:ring-2 focus:ring-brand-600 focus:outline-none text-sm text-gray-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="package-patient-dob">
                    Ngày sinh (nếu có)
                  </label>
                  <input
                    id="package-patient-dob"
                    name="dateOfBirth"
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-sm focus:ring-2 focus:ring-brand-600 focus:outline-none text-sm text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="package-patient-gender">
                    Giới tính
                  </label>
                  <select
                    id="package-patient-gender"
                    name="gender"
                    value={gender}
                    onChange={(e) => setGender(e.target.value as "MALE" | "FEMALE" | "OTHER")}
                    disabled={isSubmitting}
                    className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-sm focus:ring-2 focus:ring-brand-600 focus:outline-none text-sm text-gray-900"
                  >
                    <option value="MALE">Nam</option>
                    <option value="FEMALE">Nữ</option>
                    <option value="OTHER">Khác</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="package-patient-notes">
                  Tiền sử bệnh lý / Nhu cầu tư vấn thêm
                </label>
                <textarea
                  id="package-patient-notes"
                  name="notes"
                  rows={2}
                  placeholder="Ghi chú thêm về tiền sử dị ứng, bệnh nền hoặc yêu cầu hỗ trợ đặc biệt..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-sm focus:ring-2 focus:ring-brand-600 focus:outline-none text-sm text-gray-900"
                />
              </div>

              <div className="space-y-2.5 rounded-sm border border-brand-100 bg-white p-3 text-sm text-gray-700">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasInsurance}
                    onChange={(e) => setHasInsurance(e.target.checked)}
                    disabled={isSubmitting}
                    className="mt-1 h-4 w-4 rounded-xs border-gray-300 text-brand-700 focus:ring-brand-600"
                  />
                  <span className="text-xs leading-5">
                    Tôi có thẻ BHYT hoặc bảo lãnh viện phí và cần xuất hóa đơn tài chính.
                  </span>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={privacyConsent}
                    onChange={(e) => setPrivacyConsent(e.target.checked)}
                    disabled={isSubmitting}
                    className="mt-1 h-4 w-4 rounded-xs border-gray-300 text-brand-700 focus:ring-brand-600"
                  />
                  <span className="text-xs leading-5">
                    Tôi đồng ý để HealthCare lưu trữ và xử lý thông tin y tế theo{" "}
                    <a className="font-semibold text-brand-700 underline" href="/chinh-sach-bao-mat" target="_blank" rel="noreferrer">
                      chính sách bảo mật
                    </a>
                    . <span className="text-red-500">*</span>
                  </span>
                </label>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-sm"
                >
                  ← Quay lại
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !fullName || !phone || !email || !privacyConsent}
                  className="flex items-center gap-2 rounded-sm bg-brand-700 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-800 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-brand-600"
                >
                  {isSubmitting ? "Đang kết nối hệ thống..." : "Giữ chỗ và nhận mã OTP →"}
                </button>
              </div>
            </form>
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              STEP 4: Xác nhận mã OTP -> calls confirmAppointment -> Success Screen
              ══════════════════════════════════════════════════════════════════════ */}
          {step === 4 && (
            <div>
              {!confirmedAppointment ? (
                /* OTP Verification Form */
                <form onSubmit={handleConfirmOtp} className="space-y-4 text-center">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Bước 4 / 4</p>
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900">Xác nhận mã OTP đặt lịch</h3>
                    <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
                      Vui lòng kiểm tra email và nhập mã xác thực 6 số để hoàn tất đăng ký gói khám.
                    </p>
                  </div>

                  {/* Hold Timer Bar */}
                  <div className="p-3 bg-brand-50 border border-brand-200 rounded-sm flex items-center justify-between text-xs text-brand-900 font-semibold">
                    <span className="flex items-center gap-1.5">
                      <Icon name="clock" size={14} /> Thời gian giữ chỗ:
                    </span>
                    <span className={`font-mono text-sm font-bold ${secondsRemaining < 120 ? "text-red-600" : "text-brand-800"}`}>
                      {formatTimer(secondsRemaining)}
                    </span>
                  </div>

                  {/* Summary of hold */}
                  <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-sm text-left text-xs space-y-1">
                    <p className="font-bold text-gray-900 text-sm">
                      Mã giữ chỗ: <span className="font-mono text-brand-800">{bookingCode}</span>
                    </p>
                    <p className="text-gray-600">
                      Gói khám: <span className="font-semibold text-gray-900">{packageItem.name}</span>
                    </p>
                    <p className="text-gray-600">
                      Người khám: <span className="font-semibold text-gray-900">{fullName}</span> ({phone})
                    </p>
                    <p className="text-gray-600">
                      Cơ sở: <span className="font-semibold text-gray-900">{currentBranch?.name}</span>
                    </p>
                    <p className="text-gray-600">
                      Thời gian: <span className="font-semibold text-gray-900">{formatBusinessDate(selectedDate)} vào lúc {selectedSlotTime.slice(0, 5)}</span>
                    </p>
                  </div>

                  <div className="py-2">
                    <label className="block text-sm font-bold text-gray-800 mb-1" htmlFor="package-booking-otp">
                      Nhập mã OTP 6 số
                    </label>
                    <p className="text-xs text-gray-500 mb-3">
                      {otpDeliveryStatus === "QUEUED" ? (
                        <>Mã OTP đang được gửi tới email <strong className="text-gray-800">{maskEmail(email)}</strong>.</>
                      ) : (
                        <>Mã OTP đã gửi tới email <strong className="text-gray-800">{maskEmail(email)}</strong>.</>
                      )}
                    </p>

                    <input
                      id="package-booking-otp"
                      name="otp"
                      type="text"
                      autoComplete="one-time-code"
                      inputMode="numeric"
                      maxLength={6}
                      required
                      autoFocus
                      placeholder="123456"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      disabled={holdExpired || isSubmitting || isResendingOtp}
                      className="w-48 text-center p-3 text-2xl font-mono tracking-widest bg-gray-50 border-2 border-brand-700 rounded-sm focus:ring-4 focus:ring-brand-100 focus:outline-none mx-auto block font-bold"
                    />

                    {!holdExpired && !otpExpired ? (
                      <div className="mt-3 flex flex-col items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void handleResendOtp()}
                          disabled={isSubmitting || isResendingOtp || resendCooldownSeconds > 0}
                          className="text-xs font-bold text-brand-700 hover:text-brand-900 underline disabled:opacity-50 disabled:no-underline"
                        >
                          {isResendingOtp
                            ? "Đang gửi lại mã..."
                            : resendCooldownSeconds > 0
                              ? `Gửi lại mã OTP sau ${formatTimer(resendCooldownSeconds)}`
                              : "Gửi lại mã OTP"}
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      disabled={isSubmitting || isResendingOtp}
                      className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-sm"
                    >
                      ← Sửa thông tin
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || isResendingOtp || holdExpired || otpExpired || otpCode.length < 6}
                      className="rounded-sm bg-brand-700 px-7 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-brand-800 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-brand-600"
                    >
                      {isSubmitting ? "Đang xác nhận..." : "Hoàn tất đặt lịch khám"}
                    </button>
                  </div>
                </form>
              ) : (
                /* ══════════════════════════════════════════════════════════════════
                   SUCCESS SCREEN: Electronic Package Appointment Ticket (E-Card)
                   ══════════════════════════════════════════════════════════════════ */
                <div className="space-y-4 text-center py-2 animate-fadeIn">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-3xl mx-auto mb-1">
                    ✓
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-brand-950">
                    Đặt Lịch Gói Khám Thành Công!
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 max-w-md mx-auto">
                    Hồ sơ đăng ký gói khám của bạn đã được ghi nhận trên hệ thống. Vui lòng xuất trình mã phiếu khám khi đến tiếp đón.
                  </p>

                  {/* Electronic Appointment Ticket */}
                  <div className="p-5 bg-gradient-to-br from-brand-900 to-[#00282b] text-white rounded-sm text-left shadow-xl relative overflow-hidden border border-teal-800">
                    <div className="flex justify-between items-start border-b border-teal-700/60 pb-3 mb-3">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-teal-300 font-bold">
                          PHIẾU ĐĂNG KÝ GÓI KHÁM ĐIỆN TỬ
                        </span>
                        <h4 className="text-base sm:text-lg font-extrabold text-white">
                          HealthCare Platform
                        </h4>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase tracking-wider text-teal-300 block">
                          MÃ PHIẾU KHÁM
                        </span>
                        <p className="font-mono font-bold text-amber-400 text-base sm:text-lg tracking-wider">
                          {confirmedAppointment.bookingCode}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 text-xs">
                      <div className="col-span-2 sm:col-span-1">
                        <span className="text-teal-300 text-[11px] block">Gói khám sức khỏe:</span>
                        <p className="font-bold text-white text-sm">{packageItem.name}</p>
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <span className="text-teal-300 text-[11px] block">Chi phí niêm yết:</span>
                        <p className="font-extrabold text-amber-300 text-sm font-mono">
                          {currency(packageItem.price)} VNĐ
                        </p>
                      </div>
                      <div>
                        <span className="text-teal-300 text-[11px] block">Người khám:</span>
                        <p className="font-bold text-white">{confirmedAppointment.patientName}</p>
                      </div>
                      <div>
                        <span className="text-teal-300 text-[11px] block">Số điện thoại:</span>
                        <p className="font-bold text-white">{confirmedAppointment.patientPhone}</p>
                      </div>
                      <div>
                        <span className="text-teal-300 text-[11px] block">Ngày tiếp nhận:</span>
                        <p className="font-bold text-amber-300">{formatBusinessDate(confirmedAppointment.appointmentDate)}</p>
                      </div>
                      <div>
                        <span className="text-teal-300 text-[11px] block">Giờ tiếp nhận:</span>
                        <p className="font-bold text-amber-300">
                          {confirmedAppointment.startTime.slice(0, 5)}
                          {confirmedAppointment.endTime ? ` - ${confirmedAppointment.endTime.slice(0, 5)}` : ""}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-teal-300 text-[11px] block">Cơ sở tiếp đón:</span>
                        <p className="font-semibold text-white">
                          {currentBranch?.name || confirmedAppointment.branchName || "Hệ thống Bệnh viện HealthCare"}
                        </p>
                        <p className="text-[11px] text-teal-200/90 mt-0.5">
                          {currentBranch?.address || confirmedAppointment.branchAddress}
                        </p>
                      </div>
                    </div>

                    {/* Preparation Guidelines */}
                    <div className="mt-3.5 rounded-sm border border-teal-700/70 bg-teal-950/60 p-3 text-[11px] leading-5 text-teal-100">
                      <p className="font-bold text-amber-300 uppercase tracking-wide text-[10px] mb-1">
                        Hướng dẫn chuẩn bị trước khi đến khám
                      </p>
                      <ul className="list-disc list-inside space-y-0.5">
                        <li>Vui lòng đến trước giờ tiếp nhận khoảng 15 - 30 phút để nhận số thứ tự tại quầy tiếp đón Gói khám.</li>
                        <li>Xuất trình bản gốc CCCD/Hộ chiếu và Mã phiếu khám điện tử này tại quầy.</li>
                        <li>Nếu gói có xét nghiệm máu/đường huyết: Nhịn ăn ít nhất 8 tiếng trước giờ khám; có thể uống nước lọc.</li>
                        <li>Nếu có siêu âm bụng/tiền liệt tuyến: Hãy uống nhiều nước và nhịn tiểu trước khi siêu âm.</li>
                        {packageItem.preparationSteps?.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-3 pt-3 border-t border-teal-700/60 flex items-center justify-between text-[11px] text-teal-200">
                      <span className="flex items-center gap-1">
                        <Icon name="building" size={13} /> {currentBranch?.name || "HealthCare Vietnam"}
                      </span>
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded-xs font-bold">
                        ĐÃ XÁC NHẬN
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
                    <Link
                      className="inline-flex rounded-sm border border-brand-700 px-5 py-2.5 text-xs sm:text-sm font-bold text-brand-800 hover:bg-brand-50 transition-colors"
                      href={`/patient/dashboard?paymentAppointmentId=${encodeURIComponent(confirmedAppointment.id)}#appointments`}
                    >
                      Thanh toán chuyển khoản
                    </Link>
                    <button
                      type="button"
                      onClick={handleClose}
                      className="rounded-sm bg-brand-700 hover:bg-brand-800 px-7 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-brand-600"
                    >
                      Hoàn tất & Đóng
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
