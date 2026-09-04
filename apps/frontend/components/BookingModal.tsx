"use client";

import React, { useCallback, useRef, useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Doctor,
  Specialty,
  Branch,
  HealthPackage,
  TimeSlot,
  AppointmentDetails,
  HoldSlotResult,
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
  ApiError,
  resendAppointmentOtp,
} from "../lib/api-client";
import { businessDate } from "../lib/business-time";
import { presentApiError } from "../lib/present-api-error";
import Icon from "./UiIcon";
import useDialogFocus from "./useDialogFocus";

const EMPTY_DOCTORS: Doctor[] = [];
const EMPTY_SPECIALTIES: Specialty[] = [];
const EMPTY_BRANCHES: Branch[] = [];
const EMPTY_PACKAGES: HealthPackage[] = [];
const EMPTY_SLOTS: TimeSlot[] = [];
const BOOKING_STEPS = [
  { id: 1, label: "Chuyên khoa" },
  { id: 2, label: "Cơ sở" },
  { id: 3, label: "Bác sĩ" },
  { id: 4, label: "Ngày khám" },
  { id: 5, label: "Khung giờ" },
  { id: 6, label: "Thông tin" },
  { id: 7, label: "Xác nhận" },
] as const;

const BOOKING_STAGES = [
  { ids: [1, 2, 3], title: "1. Chọn nhu cầu khám" },
  { ids: [4, 5], title: "2. Chọn cơ sở và khung giờ" },
  { ids: [6], title: "3. Điền thông tin liên hệ" },
  { ids: [7], title: "4. Xác nhận OTP" },
];

export interface BookingSlotQueryIdentity {
  key: string;
  doctorId: string;
  branchId: string;
  date: string;
}

export interface BookingSlotQueryAttempt {
  active: boolean;
  identityKey: string | null;
  lifecycleEpoch: number;
  attemptSequence: number;
  retryNonce: number;
}

interface BookingSlotQueryRunOptions {
  identity: BookingSlotQueryIdentity | null;
  retryNonce: number;
  load: (signal: AbortSignal) => Promise<TimeSlot[]>;
  onStart: (attempt: BookingSlotQueryAttempt) => void;
  onIdle: (attempt: BookingSlotQueryAttempt) => void;
  onSuccess: (slots: TimeSlot[], attempt: BookingSlotQueryAttempt) => void;
  onError: (error: unknown, attempt: BookingSlotQueryAttempt) => void;
  onFinally: (attempt: BookingSlotQueryAttempt) => void;
}

export interface BookingSlotQueryExecution {
  cancel: () => void;
  settled: Promise<void>;
}

interface InternalBookingSlotQueryAttempt extends BookingSlotQueryAttempt {
  controller: AbortController | null;
}

export interface BookingSlotQueryState {
  identityKey: string | null;
  attemptSequence: number;
  retryNonce: number;
  loading: boolean;
  slots: TimeSlot[];
  error: string;
}

export interface BookingSlotSelectionState {
  identityKey: string | null;
  startTime: string;
}

type BookingSlotQueryStateEvent =
  | { type: "START"; attempt: BookingSlotQueryAttempt }
  | { type: "IDLE"; attempt: BookingSlotQueryAttempt }
  | { type: "SUCCESS"; attempt: BookingSlotQueryAttempt; slots: TimeSlot[] }
  | { type: "ERROR"; attempt: BookingSlotQueryAttempt; message: string }
  | { type: "FINALLY"; attempt: BookingSlotQueryAttempt };

type BookingSlotSelectionEvent =
  | { type: "START"; attempt: BookingSlotQueryAttempt }
  | { type: "IDLE" }
  | { type: "SUCCESS"; attempt: BookingSlotQueryAttempt; slots: TimeSlot[]; branchId: string }
  | { type: "ERROR"; attempt: BookingSlotQueryAttempt };

function ownsBookingSlotState(
  state: BookingSlotQueryState,
  attempt: BookingSlotQueryAttempt,
): boolean {
  return state.identityKey === attempt.identityKey
    && state.attemptSequence === attempt.attemptSequence
    && state.retryNonce === attempt.retryNonce;
}

/**
 * The last successful slot list remains authoritative through transport errors.
 * Only a current successful response (including an empty response) may replace it.
 */
export function reduceBookingSlotQueryState(
  state: BookingSlotQueryState,
  event: BookingSlotQueryStateEvent,
): BookingSlotQueryState {
  if (event.type === "START") {
    return {
      identityKey: event.attempt.identityKey,
      attemptSequence: event.attempt.attemptSequence,
      retryNonce: event.attempt.retryNonce,
      loading: true,
      slots: state.identityKey === event.attempt.identityKey ? state.slots : EMPTY_SLOTS,
      error: "",
    };
  }
  if (event.type === "IDLE") {
    return {
      identityKey: null,
      attemptSequence: event.attempt.attemptSequence,
      retryNonce: event.attempt.retryNonce,
      loading: false,
      slots: EMPTY_SLOTS,
      error: "",
    };
  }
  if (!ownsBookingSlotState(state, event.attempt)) return state;
  if (event.type === "SUCCESS") return { ...state, slots: event.slots, error: "" };
  if (event.type === "ERROR") return { ...state, error: event.message };
  return { ...state, loading: false };
}

/** Keep a user choice until a current authoritative success proves it unavailable. */
export function reduceBookingSlotSelectionState(
  state: BookingSlotSelectionState,
  event: BookingSlotSelectionEvent,
): BookingSlotSelectionState {
  if (event.type === "START") {
    return state.identityKey === event.attempt.identityKey
      ? state
      : { identityKey: event.attempt.identityKey, startTime: "" };
  }
  if (event.type === "IDLE") return { identityKey: null, startTime: "" };
  if (event.type === "ERROR") return state;

  const retained = state.identityKey === event.attempt.identityKey
    && event.slots.some((slot) => (
      slot.available
      && slot.branchId === event.branchId
      && slot.startTime === state.startTime
    ));
  if (retained) return state;
  const firstAvailable = event.slots.find((slot) => (
    slot.available && slot.branchId === event.branchId
  ));
  return {
    identityKey: event.attempt.identityKey,
    startTime: firstAvailable?.startTime ?? "",
  };
}

interface BookingSelectedSlotState {
  identityKey: string | null;
  startTime: string;
}

export function normalizeBookingSlotQueryIdentity(
  doctorId: string,
  branchId: string,
  date: string,
): BookingSlotQueryIdentity | null {
  const normalizedDoctorId = doctorId.trim();
  const normalizedBranchId = branchId.trim();
  const normalizedDate = date.trim();
  if (!normalizedDoctorId || !normalizedBranchId || !normalizedDate) return null;

  return {
    doctorId: normalizedDoctorId,
    branchId: normalizedBranchId,
    date: normalizedDate,
    key: [normalizedDoctorId, normalizedBranchId, normalizedDate]
      .map((part) => encodeURIComponent(part))
      .join("|"),
  };
}

function isAbortError(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === "object"
    && "name" in error
    && (error as { name?: unknown }).name === "AbortError",
  );
}

export class BookingSlotQueryOwner {
  private active = false;
  private lifecycleEpoch = 0;
  private attemptSequence = 0;
  private currentAttempt: InternalBookingSlotQueryAttempt | null = null;

  private abortCurrentAttempt(): void {
    this.currentAttempt?.controller?.abort();
  }

  enterLifecycle(active: boolean): () => void {
    this.abortCurrentAttempt();
    this.lifecycleEpoch += 1;
    this.active = active;
    const enteredEpoch = this.lifecycleEpoch;

    return () => {
      if (this.lifecycleEpoch !== enteredEpoch) return;
      this.abortCurrentAttempt();
      this.active = false;
      this.lifecycleEpoch += 1;
    };
  }

  private beginAttempt(
    identity: BookingSlotQueryIdentity | null,
    retryNonce: number,
  ): InternalBookingSlotQueryAttempt {
    this.abortCurrentAttempt();
    const attempt: InternalBookingSlotQueryAttempt = {
      active: this.active,
      identityKey: identity?.key ?? null,
      lifecycleEpoch: this.lifecycleEpoch,
      attemptSequence: this.attemptSequence + 1,
      retryNonce,
      controller: this.active && identity ? new AbortController() : null,
    };
    this.attemptSequence = attempt.attemptSequence;
    this.currentAttempt = attempt;
    return attempt;
  }

  private owns(attempt: InternalBookingSlotQueryAttempt, requireActive: boolean): boolean {
    const current = this.currentAttempt;
    return Boolean(
      current === attempt
      && current.lifecycleEpoch === this.lifecycleEpoch
      && current.attemptSequence === this.attemptSequence
      && current.retryNonce === attempt.retryNonce
      && current.identityKey === attempt.identityKey
      && current.active === this.active
      && (!requireActive || (this.active && attempt.active))
      && !attempt.controller?.signal.aborted,
    );
  }

  run(options: BookingSlotQueryRunOptions): BookingSlotQueryExecution {
    const attempt = this.beginAttempt(options.identity, options.retryNonce);
    const cancel = (): void => {
      if (this.currentAttempt === attempt) attempt.controller?.abort();
    };

    if (!attempt.active || !options.identity || !attempt.controller) {
      if (this.owns(attempt, false)) options.onIdle(attempt);
      if (this.owns(attempt, false)) options.onFinally(attempt);
      return { cancel, settled: Promise.resolve() };
    }

    if (this.owns(attempt, true)) options.onStart(attempt);
    const settled = Promise.resolve().then(async () => {
      if (!this.owns(attempt, true) || !attempt.controller) return;
      try {
        const slots = await options.load(attempt.controller.signal);
        if (this.owns(attempt, true)) options.onSuccess(slots, attempt);
      } catch (error) {
        if (this.owns(attempt, true) && !isAbortError(error)) {
          options.onError(error, attempt);
        }
      } finally {
        if (this.owns(attempt, true)) options.onFinally(attempt);
      }
    });

    return { cancel, settled };
  }
}

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
  // A selected specialty is a safety boundary: incomplete doctor metadata
  // must not silently turn into an unfiltered choice.
  return Boolean(doctor.specialtyName && doctor.specialtyName === specialty.name);
}

function specialtyIdForDoctor(doctor: Doctor | undefined, specialties: Specialty[]): string {
  if (!doctor) return "";

  const primaryName = doctor.specialtyName?.trim().toLocaleLowerCase("vi-VN");
  if (primaryName) {
    const byName = specialties.find((specialty) => (
      specialty.name.trim().toLocaleLowerCase("vi-VN") === primaryName
    ));
    if (byName) return byName.id;
  }

  return doctor.specialtySlugs?.map((slug) => specialties.find((specialty) => specialty.slug === slug))
    .find((specialty): specialty is Specialty => Boolean(specialty))?.id ?? "";
}

function secondsUntil(value: string): number {
  const expiry = Date.parse(value);
  return Number.isNaN(expiry) ? 0 : Math.max(0, Math.ceil((expiry - Date.now()) / 1000));
}

function isValidBookingEmail(value: string): boolean {
  const normalized = value.trim();
  return (
    normalized.length > 0
    && normalized.length <= 320
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  );
}

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

export interface BookingSelection {
  doctorId?: string;
  specialtyId?: string;
  packageId?: string;
  branchId?: string;
}

interface BookingCatalogProps {
  initialDoctorId?: string;
  initialSpecialtyId?: string;
  initialPackageId?: string;
  initialBranchId?: string;
  packages?: HealthPackage[];
  doctors?: Doctor[];
  specialties?: Specialty[];
  branches?: Branch[];
}

interface BookingModalProps extends BookingCatalogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface BookingInlineExperienceProps extends BookingCatalogProps {
  selection?: BookingSelection;
}

interface BookingExperienceProps extends BookingCatalogProps {
  active: boolean;
  presentation: "modal" | "inline";
  onClose?: () => void;
}

function BookingExperience({
  active,
  presentation,
  onClose,
  initialDoctorId,
  initialSpecialtyId,
  initialPackageId,
  initialBranchId,
  packages = EMPTY_PACKAGES,
  doctors: providedDoctors = EMPTY_DOCTORS,
  specialties: providedSpecialties = EMPTY_SPECIALTIES,
  branches: providedBranches = EMPTY_BRANCHES,
}: BookingExperienceProps) {
  const isModal = presentation === "modal";
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
  const [catalogRequest, setCatalogRequest] = useState<number>(0);
  const [selectionError, setSelectionError] = useState<string>("");
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>(initialSpecialtyId || "");
  const [selectedDoctor, setSelectedDoctor] = useState<string>(initialDoctorId || "");
  const [selectedBranch, setSelectedBranch] = useState<string>(initialBranchId || "");
  const [selectedPackage, setSelectedPackage] = useState<string>(initialPackageId || "");
  
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return businessDate(1);
  });
  const [slotQueryState, setSlotQueryState] = useState<BookingSlotQueryState>({
    identityKey: null,
    attemptSequence: 0,
    retryNonce: 0,
    loading: false,
    slots: EMPTY_SLOTS,
    error: "",
  });
  const [selectedSlotState, setSelectedSlotState] = useState<BookingSelectedSlotState>({
    identityKey: null,
    startTime: "",
  });
  const [slotRefreshNonce, setSlotRefreshNonce] = useState<number>(0);
  const [slotQueryOwner] = useState(() => new BookingSlotQueryOwner());
  const slotQueryIdentity = useMemo(
    () => normalizeBookingSlotQueryIdentity(selectedDoctor, selectedBranch, selectedDate),
    [selectedBranch, selectedDate, selectedDoctor],
  );
  const slotQueryMatchesSelection = Boolean(
    active
    && slotQueryIdentity
    && slotQueryState.identityKey === slotQueryIdentity.key,
  );
  const slots = slotQueryMatchesSelection ? slotQueryState.slots : EMPTY_SLOTS;
  const selectedSlot = slotQueryMatchesSelection
    && selectedSlotState.identityKey === slotQueryIdentity?.key
    ? selectedSlotState.startTime
    : "";
  const loadingSlots = slotQueryMatchesSelection
    ? slotQueryState.loading
    : Boolean(active && slotQueryIdentity);
  const slotError = slotQueryMatchesSelection ? slotQueryState.error : "";

  // Patient Info
  const [fullName, setFullName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [reasonForVisit, setReasonForVisit] = useState<string>("");
  const [hasInsurance, setHasInsurance] = useState<boolean>(false);
  const [privacyConsent, setPrivacyConsent] = useState<boolean>(false);

  // Hold & OTP State
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
  const bookingSessionRef = useRef(0);
  const otpResendAttemptRef = useRef(0);
  const otpResendControllerRef = useRef<AbortController | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closePresentation = useCallback(() => {
    onClose?.();
  }, [onClose]);

  const invalidateBookingSession = useCallback(() => {
    bookingSessionRef.current += 1;
    otpResendAttemptRef.current += 1;
    otpResendControllerRef.current?.abort();
    otpResendControllerRef.current = null;
    setIsResendingOtp(false);
  }, []);

  useDialogFocus(dialogRef, active && isModal, closePresentation);

  useEffect(() => () => {
    otpResendAttemptRef.current += 1;
    otpResendControllerRef.current?.abort();
    otpResendControllerRef.current = null;
  }, []);

  const resetBookingState = useCallback(() => {
    setStep(1);
    setSelectedSpecialty(initialSpecialtyId || "");
    setSelectedDoctor(initialDoctorId || "");
    setSelectedBranch(initialBranchId || "");
    setSelectedPackage(initialPackageId || "");
    setSelectedDate(businessDate(1));
    setFullName("");
    setPhone("");
    setEmail("");
    setReasonForVisit("");
    setHasInsurance(false);
    setPrivacyConsent(false);
    setBookingCode("");
    setOtpCode("");
    setHoldExpiresAt("");
    setOtpExpiresAt("");
    setOtpDeliveryStatus(undefined);
    setSecondsRemaining(600);
    setOtpSecondsRemaining(0);
    setResendCooldownSeconds(0);
    setIsResendingOtp(false);
    setIsSubmitting(false);
    setErrorMessage("");
    setSelectionError("");
    setConfirmedAppointment(null);
  }, [initialBranchId, initialDoctorId, initialPackageId, initialSpecialtyId]);

  const closeBooking = useCallback(() => {
    invalidateBookingSession();
    resetBookingState();
    onClose?.();
  }, [invalidateBookingSession, onClose, resetBookingState]);

  useEffect(() => {
    if (!active) return;

    const needsDoctors = providedDoctors.length === 0;
    const needsSpecialties = providedSpecialties.length === 0;
    const needsBranches = providedBranches.length === 0;
    let cancelled = false;
    const task = Promise.resolve().then(async () => {
      if (cancelled) return;
      if (!needsDoctors && !needsSpecialties && !needsBranches) {
        setCatalogLoading(false);
        setCatalogError("");
        return;
      }
      setCatalogLoading(true);
      setCatalogError("");
      const [doctorResult, specialtyResult, branchResult] = await Promise.allSettled([
        needsDoctors ? fetchDoctors({ page: 0, size: 100 }) : Promise.resolve(null),
        needsSpecialties ? fetchSpecialties(0, 100) : Promise.resolve(null),
        needsBranches ? fetchBranches(0, 100) : Promise.resolve(null),
      ]);
      if (cancelled) return;

      const missing: string[] = [];
      if (needsDoctors) {
        if (doctorResult.status === "fulfilled" && doctorResult.value) {
          setLoadedDoctors(doctorResult.value.content);
          if (doctorResult.value.content.length === 0) missing.push("danh sách bác sĩ");
        } else {
          missing.push("bác sĩ");
        }
      }
      if (needsSpecialties) {
        if (specialtyResult.status === "fulfilled" && specialtyResult.value) {
          setLoadedSpecialties(specialtyResult.value.content);
          if (specialtyResult.value.content.length === 0) missing.push("danh sách chuyên khoa");
        } else {
          missing.push("chuyên khoa");
        }
      }
      if (needsBranches) {
        if (branchResult.status === "fulfilled" && branchResult.value) {
          setLoadedBranches(branchResult.value.content);
          if (branchResult.value.content.length === 0) missing.push("danh sách cơ sở khám");
        } else {
          missing.push("cơ sở khám");
        }
      }

      setCatalogError(missing.length > 0
        ? `Chưa thể tải ${missing.join(", ")}. Vui lòng kiểm tra kết nối và thử lại.`
        : "");
      setCatalogLoading(false);
    });

    return () => {
      cancelled = true;
      void task;
    };
  }, [active, catalogRequest, providedBranches.length, providedDoctors.length, providedSpecialties.length]);

  const syncSelection = useCallback(() => {
    if (!active) return;
    const requestedDoctor = doctors.find((doctor) => doctor.id === initialDoctorId);
    const firstBranch = branches.find((branch) => branch.id === initialBranchId)
      ?? branches.find((branch) => requestedDoctor && doctorMatchesBranch(requestedDoctor, branch.id))
      ?? branches[0];
    const nextBranchId = firstBranch?.id ?? "";
    const requestedSpecialtyId = initialSpecialtyId?.trim()
      || specialtyIdForDoctor(requestedDoctor, specialties);
    const requestedSpecialty = specialties.find((specialty) => specialty.id === requestedSpecialtyId);
    const nextSpecialtyId = requestedSpecialty
      ? requestedSpecialty.id
      : requestedSpecialtyId
        ? ""
        : specialties[0]?.id ?? "";
    setSelectionError(requestedSpecialtyId && !requestedSpecialty
      ? "Chuyên khoa từ trợ lý không còn trong danh mục hiện tại (catalog live). Vui lòng chọn lại trước khi tiếp tục."
      : "");
    const nextSpecialty = specialties.find((specialty) => specialty.id === nextSpecialtyId);
    const firstDoctor = doctors.find((doctor) => doctor.id === initialDoctorId
      && doctorMatchesBranch(doctor, nextBranchId)
      && doctorMatchesSpecialty(doctor, nextSpecialty))
      ?? doctors.find((doctor) => doctorMatchesBranch(doctor, nextBranchId)
        && doctorMatchesSpecialty(doctor, nextSpecialty));
    setSelectedBranch(nextBranchId);
    setSelectedDoctor(firstDoctor?.id ?? "");
    setSelectedSpecialty(nextSpecialtyId);
    setSelectedPackage(packages.some((item) => item.id === initialPackageId) ? initialPackageId ?? "" : "");
  }, [active, branches, doctors, initialBranchId, initialDoctorId, initialPackageId, initialSpecialtyId, packages, specialties]);

  useEffect(() => {
    const task = Promise.resolve().then(syncSelection);
    return () => void task;
  }, [syncSelection]);

  useEffect(() => slotQueryOwner.enterLifecycle(active), [active, slotQueryOwner]);

  // One owner controls slot identity, active lifecycle, retry attempts, aborts,
  // and every response-derived state commit.
  useEffect(() => {
    const execution = slotQueryOwner.run({
      identity: slotQueryIdentity,
      retryNonce: slotRefreshNonce,
      load: (signal) => {
        if (!slotQueryIdentity) return Promise.resolve(EMPTY_SLOTS);
        return fetchDoctorSlots(
          slotQueryIdentity.doctorId,
          slotQueryIdentity.branchId,
          slotQueryIdentity.date,
          signal,
        );
      },
      onStart: (attempt) => {
        setSlotQueryState((previous) => reduceBookingSlotQueryState(previous, { type: "START", attempt }));
        setSelectedSlotState((previous) => reduceBookingSlotSelectionState(previous, { type: "START", attempt }));
      },
      onIdle: (attempt) => {
        setSlotQueryState((previous) => reduceBookingSlotQueryState(previous, { type: "IDLE", attempt }));
        setSelectedSlotState((previous) => reduceBookingSlotSelectionState(previous, { type: "IDLE" }));
      },
      onSuccess: (data, attempt) => {
        setSlotQueryState((previous) => reduceBookingSlotQueryState(previous, {
          type: "SUCCESS",
          attempt,
          slots: data,
        }));
        setSelectedSlotState((previous) => reduceBookingSlotSelectionState(previous, {
          type: "SUCCESS",
          attempt,
          slots: data,
          branchId: slotQueryIdentity?.branchId ?? "",
        }));
      },
      onError: (_error, attempt) => {
        setSlotQueryState((previous) => reduceBookingSlotQueryState(previous, {
          type: "ERROR",
          attempt,
          message: presentApiError(),
        }));
        setSelectedSlotState((previous) => reduceBookingSlotSelectionState(previous, {
          type: "ERROR",
          attempt,
        }));
      },
      onFinally: (attempt) => {
        setSlotQueryState((previous) => reduceBookingSlotQueryState(previous, { type: "FINALLY", attempt }));
      },
    });

    void execution.settled;
    return execution.cancel;
  }, [active, slotQueryIdentity, slotRefreshNonce, slotQueryOwner]);

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

  useEffect(() => {
    if (resendCooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setResendCooldownSeconds((remaining) => Math.max(0, remaining - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldownSeconds]);

  if (!active) return null;

  const minimumAppointmentDate = businessDate(1);
  const currentDoctor = doctors.find((doctor) => doctor.id === selectedDoctor);
  const currentSpecialty = specialties.find((specialty) => specialty.id === selectedSpecialty);
  const currentBranch = branches.find((branch) => branch.id === selectedBranch);
  const availableDoctors = doctors.filter(
    (doctor) => doctorMatchesBranch(doctor, selectedBranch) && doctorMatchesSpecialty(doctor, currentSpecialty),
  );
  const holdExpired = Boolean(bookingCode && holdExpiresAt && !confirmedAppointment && secondsRemaining <= 0);
  const otpExpired = Boolean(bookingCode && otpExpiresAt && !confirmedAppointment && otpSecondsRemaining <= 0);

  const navigateToStep = (nextStep: number): void => {
    if (isSubmitting) return;
    invalidateBookingSession();
    setStep(nextStep);
  };

  const restartSlotSelection = (): void => {
    invalidateBookingSession();
    setStep(5);
    setBookingCode("");
    setHoldExpiresAt("");
    setOtpExpiresAt("");
    setOtpDeliveryStatus(undefined);
    setOtpCode("");
    setSecondsRemaining(0);
    setOtpSecondsRemaining(0);
    setResendCooldownSeconds(0);
    setIsResendingOtp(false);
    setErrorMessage("");
    setSlotRefreshNonce((value) => value + 1);
  };

  const handleSpecialtyChange = (specialtyId: string): void => {
    if (specialtyId === selectedSpecialty) return;
    invalidateBookingSession();
    const nextSpecialty = specialties.find((specialty) => specialty.id === specialtyId);
    const doctorsForSelection = doctors.filter((doctor) =>
      doctorMatchesBranch(doctor, selectedBranch) && doctorMatchesSpecialty(doctor, nextSpecialty),
    );
    setSelectedSpecialty(specialtyId);
    setSelectionError("");
    if (!doctorsForSelection.some((doctor) => doctor.id === selectedDoctor)) {
      setSelectedDoctor(doctorsForSelection[0]?.id ?? "");
    }
  };

  const handleBranchChange = (branchId: string): void => {
    if (branchId === selectedBranch) return;
    invalidateBookingSession();
    setSelectedBranch(branchId);
    const firstDoctorAtBranch = doctors.find((doctor) =>
      doctorMatchesBranch(doctor, branchId) && doctorMatchesSpecialty(doctor, currentSpecialty),
    );
    setSelectedDoctor(firstDoctorAtBranch?.id || "");
  };

  const handleDoctorChange = (doctorId: string): void => {
    if (doctorId === selectedDoctor) return;
    invalidateBookingSession();
    setSelectedDoctor(doctorId);
  };

  const handleDateChange = (date: string): void => {
    if (date === selectedDate) return;
    invalidateBookingSession();
    setSelectedDate(date);
  };

  const handleSlotChange = (slotTime: string): void => {
    if (
      !slotQueryIdentity
      || !slots.some((slot) => (
        slot.available
        && slot.branchId === slotQueryIdentity.branchId
        && slot.startTime === slotTime
      ))
    ) return;
    invalidateBookingSession();
    setSelectedSlotState({ identityKey: slotQueryIdentity.key, startTime: slotTime });
  };

  // Handle Step 3: Hold Slot
  const handleHoldSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSpecialty || !selectedSpecialty) {
      setErrorMessage("Chuyên khoa không còn hợp lệ trong danh mục hiện tại. Vui lòng chọn lại trước khi giữ lịch.");
      navigateToStep(1);
      return;
    }
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
    const normalizedEmail = email.trim();
    if (!fullName.trim() || !phone.trim()) {
      setErrorMessage("Vui lòng nhập đầy đủ họ tên và số điện thoại.");
      return;
    }
    if (!/^[+0-9() .-]{7,20}$/.test(phone.trim())) {
      setErrorMessage("Số điện thoại chưa đúng định dạng. Vui lòng kiểm tra lại.");
      return;
    }
    if (!normalizedEmail) {
      setErrorMessage("Vui lòng nhập email để nhận mã OTP xác nhận lịch hẹn.");
      return;
    }
    if (!isValidBookingEmail(normalizedEmail)) {
      setErrorMessage("Email chưa đúng định dạng. Vui lòng kiểm tra lại.");
      return;
    }
    if (!privacyConsent) {
      setErrorMessage("Vui lòng đồng ý chính sách bảo mật trước khi giữ lịch.");
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
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: normalizedEmail,
        reasonForVisit: reasonForVisit.trim() || undefined,
        hasInsurance,
        privacyConsent,
      });
      if (bookingSession !== bookingSessionRef.current) return;

      setBookingCode(result.bookingCode);
      setHoldExpiresAt(result.holdExpiresAt);
      setOtpExpiresAt(result.otpExpiresAt);
      setOtpDeliveryStatus(result.otpDeliveryStatus ?? "QUEUED");
      // Give the first delivery attempt time to settle before exposing a
      // retry affordance. A failed delivery remains immediately retryable.
      setResendCooldownSeconds(result.otpDeliveryStatus === "FAILED" ? 0 : 60);
      setSecondsRemaining(secondsUntil(result.holdExpiresAt));
      setOtpSecondsRemaining(secondsUntil(result.otpExpiresAt));
      setStep(7);
    } catch (error: unknown) {
      if (bookingSession === bookingSessionRef.current) {
        setErrorMessage("Không thể giữ chỗ khung giờ này. Vui lòng tải lại lịch và thử lại.");
      }
    } finally {
      if (bookingSession === bookingSessionRef.current) setIsSubmitting(false);
    }
  };

  const handleResendOtp = async (): Promise<void> => {
    if (
      !bookingCode
      || holdExpired
      || confirmedAppointment
      || isResendingOtp
      || resendCooldownSeconds > 0
    ) return;

    otpResendControllerRef.current?.abort();
    const controller = new AbortController();
    const attempt = otpResendAttemptRef.current + 1;
    otpResendAttemptRef.current = attempt;
    otpResendControllerRef.current = controller;
    const bookingSession = bookingSessionRef.current;

    setErrorMessage("");
    setIsResendingOtp(true);

    try {
      const result = await resendAppointmentOtp(bookingCode, phone, controller.signal);
      if (
        controller.signal.aborted
        || bookingSession !== bookingSessionRef.current
        || attempt !== otpResendAttemptRef.current
      ) return;
      if (result.bookingCode !== bookingCode) {
        setErrorMessage("Mã giữ chỗ đã thay đổi. Vui lòng tải lại bước xác nhận trước khi thử lại.");
        return;
      }

      setHoldExpiresAt(result.holdExpiresAt);
      setOtpExpiresAt(result.otpExpiresAt);
      setOtpSecondsRemaining(secondsUntil(result.otpExpiresAt));
      setSecondsRemaining(secondsUntil(result.holdExpiresAt));
      setOtpDeliveryStatus(result.otpDeliveryStatus);
      setOtpCode("");
      setResendCooldownSeconds(
        result.otpDeliveryStatus === "FAILED"
          ? 0
          : Math.max(1, Math.min(result.retryAfterSeconds || 60, 900)),
      );
    } catch (error: unknown) {
      if (
        controller.signal.aborted
        || bookingSession !== bookingSessionRef.current
        || attempt !== otpResendAttemptRef.current
        || isAbortError(error)
      ) return;
      if (error instanceof ApiError && error.status === 429) {
        setResendCooldownSeconds(60);
      }
      setErrorMessage(presentApiError(
        error instanceof ApiError ? error.code : undefined,
        error instanceof ApiError ? error.status : undefined,
      ));
    } finally {
      if (attempt === otpResendAttemptRef.current) {
        otpResendControllerRef.current = null;
        setIsResendingOtp(false);
      }
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
      setErrorMessage("Mã OTP đã hết hạn. Hãy bấm Gửi lại mã để dùng cùng khung giờ đang giữ.");
      return;
    }
    if (!/^\d{6}$/.test(otpCode.trim())) {
      setErrorMessage("Mã OTP phải gồm đúng 6 chữ số.");
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
    } catch (error: unknown) {
      if (bookingSession === bookingSessionRef.current) {
        setErrorMessage(presentApiError(
          error instanceof ApiError ? error.code : undefined,
          error instanceof ApiError ? error.status : undefined,
        ));
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

  const panelTitleId = isModal ? "booking-modal-title" : "booking-inline-title";
  const panelClassName = isModal
    ? "booking-panel booking-panel--modal relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-brand-100 flex flex-col max-h-[92vh]"
    : "booking-panel booking-panel--inline relative w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-brand-100 flex flex-col";
  const bodyClassName = isModal ? "booking-panel__body p-6 overflow-y-auto flex-1" : "booking-panel__body p-6 flex-1";
  const completionActionLabel = isModal ? "Đóng và về trang chủ" : "Đặt lịch mới";

  const panel = (
      <div className={panelClassName} ref={dialogRef}>
        <div className="booking-panel__header flex items-center justify-between">
          <div>
            <span className="booking-panel__eyebrow">
              Hệ thống đặt lịch khám
            </span>
            <h2 id={panelTitleId} className="booking-panel__title flex items-center gap-2">
              <Icon name="calendar" size={18} /> Đặt lịch trực tuyến nhanh chóng
            </h2>
          </div>
          {isModal ? (
            <button
              type="button"
              onClick={closeBooking}
              className="booking-panel__close"
              aria-label="Đóng cửa sổ đặt lịch"
            >
              <Icon name="x" size={17} />
            </button>
          ) : (
            <span className="booking-panel__context">
              Đặt lịch khám
            </span>
          )}
        </div>

        {/* Wizard Step Progress */}
        {!confirmedAppointment && (
          <div className="booking-panel__progress border-b border-brand-100/60 bg-brand-50/70 px-6 py-3" aria-label="Tiến trình đặt lịch" role="group">
            <div aria-label="Tiến trình đặt lịch, có thể cuộn ngang" className="flex items-center gap-2 overflow-x-auto text-xs font-semibold text-brand-900" role="region" tabIndex={0}>
              {BOOKING_STAGES.map((stage, index) => {
                const current = stage.ids.includes(step);
                const complete = stage.ids[stage.ids.length - 1] < step;
                return (
                <React.Fragment key={stage.title}>
                  {index > 0 ? <span aria-hidden="true" className="text-brand-300">→</span> : null}
                  <div
                    className={`flex min-w-max items-center gap-1.5 ${current ? "font-bold text-brand-700" : complete ? "text-brand-500" : "text-gray-400"}`}
                    aria-current={current ? "step" : undefined}
                  >
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full ${current || complete ? "bg-brand-700 text-white" : "bg-gray-200 text-gray-500"}`}>
                      {complete ? "✓" : index + 1}
                    </span>
                    <span>{stage.title}</span>
                  </div>
                </React.Fragment>
                );
              })}
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div aria-live="assertive" className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2" role="alert">
            <Icon name="activity" size={18} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Booking body */}
        <div className={bodyClassName}>
          {catalogLoading ? (
            <p className="mb-4 rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-950" role="status">
              Đang tải thông tin bác sĩ, chuyên khoa và cơ sở…
            </p>
          ) : null}
          {catalogError ? (
            <div aria-live="assertive" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900" role="alert">
              <p className="font-semibold">Danh mục đặt lịch chưa tải đầy đủ</p>
              <p className="mt-1">Không thể tải đủ thông tin đặt lịch. Vui lòng thử lại sau.</p>
              <button
                type="button"
                disabled={catalogLoading}
                onClick={() => setCatalogRequest((request) => request + 1)}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 font-semibold text-red-800 transition-colors hover:bg-red-100 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300"
              >
                <Icon name="activity" size={15} /> Thử tải lại
              </button>
            </div>
          ) : null}
          {selectionError ? (
            <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" role="alert">
              {selectionError}
            </p>
          ) : null}
          {/* ── STEP 1: Choose specialty ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-brand-700">01 · Nhu cầu khám</p>
                <h3 className="text-xl font-bold text-gray-900">Bạn muốn được hỗ trợ ở chuyên khoa nào?</h3>
                <p className="mt-1 text-sm leading-6 text-gray-600">Chọn chuyên khoa phù hợp để chúng tôi tìm cơ sở và bác sĩ đang tiếp nhận lịch.</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700" htmlFor="booking-specialty">Chuyên khoa</label>
                <select
                  id="booking-specialty"
                  name="specialty"
                  required
                  value={selectedSpecialty}
                  onChange={(e) => handleSpecialtyChange(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-600"
                >
                  <option value="" disabled>{catalogLoading ? "Đang tải chuyên khoa…" : "Chọn chuyên khoa cần khám"}</option>
                  {specialties.map((sp) => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
                </select>
              </div>
              <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-4 text-sm text-brand-950">
                <strong>{currentSpecialty?.name ?? "Chưa chọn chuyên khoa"}</strong>
                <p className="mt-1 text-xs leading-5 text-brand-700">{currentSpecialty?.description ?? "Chọn một chuyên khoa để tiếp tục."}</p>
              </div>
              <div className="booking-step-actions flex justify-end border-t border-gray-100 pt-4">
                <button type="button" disabled={isSubmitting || catalogLoading || !currentSpecialty} onClick={() => navigateToStep(2)} className="flex items-center gap-2 rounded-lg bg-brand-700 px-6 py-2.5 font-semibold text-white shadow-md transition-colors hover:bg-brand-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 focus-visible:ring-2 focus-visible:ring-brand-600">
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
                <select id="booking-branch" name="branch" required value={selectedBranch} onChange={(e) => handleBranchChange(e.target.value)} disabled={isSubmitting} className="w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-600">
                  {branches.map((br) => <option key={br.id} value={br.id}>{br.name}</option>)}
                </select>
              </div>
              <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-4 text-sm text-brand-950">
                <strong>{currentBranch?.name ?? "Chưa chọn cơ sở"}</strong>
                <p className="mt-1 text-xs text-brand-700">{currentBranch?.address ?? "Địa chỉ đang được cập nhật."}</p>
                <p className="mt-1 text-xs text-brand-700">{currentBranch?.workingHours ?? "Giờ làm việc đang được cập nhật."}</p>
              </div>
              <div className="booking-step-actions flex items-center justify-between border-t border-gray-100 pt-4">
                <button type="button" disabled={isSubmitting} onClick={() => navigateToStep(1)} className="inline-flex min-h-[44px] items-center px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 transition-colors">← Quay lại</button>
                <button type="button" disabled={isSubmitting || catalogLoading || !currentBranch} onClick={() => navigateToStep(3)} className="flex items-center gap-2 rounded-lg bg-brand-700 px-6 py-2.5 font-semibold text-white shadow-md transition-colors hover:bg-brand-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 focus-visible:ring-2 focus-visible:ring-brand-600">
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
                <p className="mt-1 text-sm leading-6 text-gray-600">Danh sách được lọc theo chuyên khoa và cơ sở bạn vừa chọn.</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700" htmlFor="booking-doctor">Bác sĩ chuyên gia</label>
                <select id="booking-doctor" name="doctor" required value={selectedDoctor} onChange={(e) => handleDoctorChange(e.target.value)} disabled={isSubmitting} className="w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-600">
                  <option value="" disabled>Chọn bác sĩ thuộc chuyên khoa đã chọn</option>
                  {availableDoctors.map((doc) => <option key={doc.id} value={doc.id}>{doc.fullName} ({currentSpecialty?.name || doc.title || doc.specialtyName || "Bác sĩ chuyên khoa"})</option>)}
                </select>
                {!catalogLoading && selectedBranch && selectedSpecialty && availableDoctors.length === 0 ? <p className="mt-1.5 text-xs text-amber-800" role="status">Chưa có bác sĩ nhận lịch cho chuyên khoa này tại cơ sở đã chọn.</p> : null}
              </div>
              <div className="flex items-center gap-4 rounded-xl border border-brand-100 bg-brand-50/60 p-4">
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-brand-700 text-xl font-bold text-white"><Icon name="stethoscope" size={26} /></div>
                <div>
                  <h4 className="text-base font-bold text-brand-900">{currentDoctor?.fullName ?? "Chưa chọn bác sĩ"}</h4>
                  <p className="text-xs text-brand-700">{currentSpecialty?.name ?? currentDoctor?.title ?? "Chưa có hồ sơ bác sĩ"}{currentDoctor?.experienceYears ? ` • ${currentDoctor.experienceYears} năm kinh nghiệm` : ""}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-gray-500">{currentDoctor?.bio ?? "Chọn bác sĩ để xem thông tin phù hợp."}</p>
                </div>
              </div>
              <div className="booking-step-actions flex items-center justify-between border-t border-gray-100 pt-4">
                <button type="button" disabled={isSubmitting} onClick={() => navigateToStep(2)} className="inline-flex min-h-[44px] items-center px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 transition-colors">← Quay lại</button>
                <button type="button" disabled={isSubmitting || catalogLoading || !currentDoctor} onClick={() => navigateToStep(4)} className="flex items-center gap-2 rounded-lg bg-brand-700 px-6 py-2.5 font-semibold text-white shadow-md transition-colors hover:bg-brand-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 focus-visible:ring-2 focus-visible:ring-brand-600">
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
                <p className="mt-1 text-sm leading-6 text-gray-600">Bạn có thể chọn lịch từ ngày mai trở đi.</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700" htmlFor="booking-date">Ngày khám mong muốn</label>
                <input id="booking-date" name="appointment-date" type="date" required min={minimumAppointmentDate} value={selectedDate} onChange={(e) => handleDateChange(e.target.value)} disabled={isSubmitting} className="w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-600" />
              </div>
              <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-4 text-xs text-brand-900">
                <p><strong>Bác sĩ:</strong> {currentDoctor?.fullName ?? "Chưa chọn"}</p>
                <p className="mt-1"><strong>Cơ sở:</strong> {currentBranch?.name ?? "Chưa chọn"}</p>
              </div>
              <div className="booking-step-actions flex items-center justify-between border-t border-gray-100 pt-4">
                <button type="button" disabled={isSubmitting} onClick={() => navigateToStep(3)} className="inline-flex min-h-[44px] items-center px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 transition-colors">← Quay lại</button>
                <button type="button" disabled={isSubmitting || !selectedDate || !currentDoctor || !currentBranch} onClick={() => navigateToStep(5)} className="flex items-center gap-2 rounded-lg bg-brand-700 px-6 py-2.5 font-semibold text-white shadow-md transition-colors hover:bg-brand-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 focus-visible:ring-2 focus-visible:ring-brand-600">
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
                  <span className="block text-sm font-semibold text-gray-700" id="booking-slot-label">Khung giờ khám (30 phút/lượt)</span>
                  <span className="flex flex-wrap items-center gap-2 text-xs font-medium text-brand-700" aria-label="Chú giải trạng thái khung giờ">
                    <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-500" />Còn trống</span>
                    <span aria-hidden="true">•</span>
                    <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-slate-300" />Đã có người giữ</span>
                  </span>
                </div>
                {loadingSlots ? <div aria-live="polite" className="py-8 text-center text-sm text-gray-500" role="status"><Icon name="clock" size={15} /> Đang tải lịch khám khả dụng...</div>
                  : slotError ? <div aria-live="assertive" className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700" role="alert"><p>{slotError}</p><button className="mt-2 font-semibold underline underline-offset-2" onClick={() => setSlotRefreshNonce((value) => value + 1)} type="button">Thử tải lại khung giờ</button></div>
                  : slots.length === 0 ? <div aria-live="polite" className="rounded-lg border border-dashed border-gray-300 px-3 py-6 text-center text-sm text-gray-500" role="status">Chưa có khung giờ cho bác sĩ, cơ sở và ngày đã chọn.</div>
                  : <div aria-labelledby="booking-slot-label" className="grid max-h-56 grid-cols-3 gap-2.5 overflow-y-auto p-1 sm:grid-cols-4">{slots.map((slot) => { const isSelected = selectedSlot === slot.startTime; return <button key={`${slot.branchId}-${slot.startTime}`} type="button" disabled={isSubmitting || !slot.available || slot.branchId !== selectedBranch} onClick={() => handleSlotChange(slot.startTime)} className={`flex flex-col items-center justify-center gap-0.5 rounded-lg border p-2.5 text-xs font-semibold transition-colors ${isSelected ? "border-brand-700 bg-brand-700 text-white shadow-md ring-2 ring-brand-500" : slot.available ? "border-brand-200 bg-white text-gray-800 hover:border-brand-500 hover:bg-brand-50" : "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400 opacity-60"}`}><span className="text-sm font-bold">{slot.startTime.slice(0, 5)}</span><span className="text-[10px] opacity-80">{slot.available ? "Còn trống" : "Đã kín"}</span></button>; })}</div>}
              </div>
              <div className="booking-step-actions flex items-center justify-between border-t border-gray-100 pt-4">
                <button type="button" disabled={isSubmitting} onClick={() => navigateToStep(4)} className="inline-flex min-h-[44px] items-center px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 transition-colors">← Quay lại</button>
                <button type="button" disabled={isSubmitting || !selectedSlot || !slots.some((slot) => slot.available && slot.startTime === selectedSlot && slot.branchId === selectedBranch)} onClick={() => navigateToStep(6)} className="flex items-center gap-2 rounded-lg bg-brand-700 px-6 py-2.5 font-semibold text-white shadow-md transition-colors hover:bg-brand-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 focus-visible:ring-2 focus-visible:ring-brand-600">
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
                <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="booking-full-name">
                  Họ và tên bệnh nhân <span className="text-red-500">*</span>
                </label>
                <input
                  id="booking-full-name"
                  name="full-name"
                  autoComplete="name"
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Văn An"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-600 focus:outline-none text-sm text-gray-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="booking-phone">
                    Số điện thoại liên hệ <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="booking-phone"
                    name="phone"
                    autoComplete="tel"
                    inputMode="tel"
                    type="tel"
                    required
                    placeholder="0901234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-600 focus:outline-none text-sm text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="booking-email">
                    Email nhận mã OTP <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="booking-email"
                    name="email"
                    aria-describedby="booking-email-help"
                    autoComplete="email"
                    type="email"
                    required
                    maxLength={320}
                    placeholder="patient@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-600 focus:outline-none text-sm text-gray-900"
                  />
                  <p className="mt-1 text-xs text-gray-500" id="booking-email-help">
                    Mã OTP xác nhận sẽ được gửi đến địa chỉ email này.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="booking-reason">
                  Triệu chứng hoặc lý do khám bệnh
                </label>
                <textarea
                  id="booking-reason"
                  name="reason"
                  maxLength={500}
                  rows={2}
                  placeholder="Mô tả sơ bộ triệu chứng (đau đầu, sốt, khó thở...) để bác sĩ chuẩn bị trước..."
                  value={reasonForVisit}
                  onChange={(e) => setReasonForVisit(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-600 focus:outline-none text-sm text-gray-900"
                />
              </div>

              <div className="space-y-3 rounded-xl border border-brand-100 bg-white p-3.5 text-sm text-gray-700">
                <label className="flex items-start gap-3" htmlFor="booking-has-insurance">
                  <input
                    id="booking-has-insurance"
                    name="has-insurance"
                    type="checkbox"
                    checked={hasInsurance}
                    onChange={(event) => setHasInsurance(event.target.checked)}
                    disabled={isSubmitting}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-brand-700 focus:ring-brand-600"
                  />
                  <span>
                    Tôi có thẻ BHYT hoặc giấy bảo lãnh viện phí cần hỗ trợ khi đến khám.
                  </span>
                </label>

                <label className="flex items-start gap-3" htmlFor="booking-privacy-consent">
                  <input
                    id="booking-privacy-consent"
                    name="privacy-consent"
                    type="checkbox"
                    required
                    checked={privacyConsent}
                    onChange={(event) => setPrivacyConsent(event.target.checked)}
                    disabled={isSubmitting}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-brand-700 focus:ring-brand-600"
                  />
                  <span>
                    Tôi đồng ý để HealthCare xử lý thông tin đặt lịch theo{" "}
                    <a
                      className="font-semibold text-brand-700 underline-offset-4 hover:underline"
                      href="/chinh-sach-bao-mat"
                      target="_blank"
                      rel="noreferrer"
                    >
                      chính sách bảo mật
                    </a>
                    .
                  </span>
                </label>
              </div>

              <div className="booking-step-actions pt-3 flex items-center justify-between border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => navigateToStep(5)}
                  disabled={isSubmitting}
                  className="inline-flex min-h-[44px] items-center px-4 py-2 text-gray-600 hover:text-gray-900 font-medium text-sm disabled:opacity-50 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 transition-colors"
                >
                  ← Quay lại
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-brand-700 hover:bg-brand-800 disabled:opacity-50 text-white font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 focus-visible:ring-2 focus-visible:ring-brand-600"
                >
                  {isSubmitting ? (
                    <span className="inline-flex items-center gap-2"><Icon name="clock" size={15} /> Đang giữ chỗ...</span>
                  ) : (
                    <>
                      <span>Giữ chỗ và nhận mã OTP</span> <span>→</span>
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
                    <span className="inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-900">
                      <Icon name="clock" size={15} />
                      {holdExpired ? "Thời gian giữ chỗ đã hết" : <>Giữ chỗ còn lại:{" "}<span className="font-mono font-bold text-amber-700">{formatTimer(secondsRemaining)}</span></>}
                    </span>
                    <span className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 ${otpExpired ? "border-red-200 bg-red-50 text-red-900" : "border-brand-200 bg-brand-50 text-brand-900"}`}>
                      OTP còn hiệu lực:{" "}<span className="font-mono font-bold">{otpExpired ? "00:00" : formatTimer(otpSecondsRemaining)}</span>
                    </span>
                  </div>

                  {holdExpired ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-left text-sm text-red-900" role="alert" aria-live="assertive">
                      <p className="font-bold">Khung giờ này không còn được giữ.</p>
                      <p className="mt-1 text-xs leading-5">Vui lòng tải lại danh sách và chọn khung giờ khác để tiếp tục.</p>
                      <button type="button" disabled={isSubmitting} onClick={restartSlotSelection} className="mt-3 rounded-lg border border-red-300 bg-white px-4 py-2 text-xs font-bold text-red-800 transition-colors hover:bg-red-100 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400 focus-visible:ring-2 focus-visible:ring-red-500">
                        Tải lại khung giờ
                      </button>
                    </div>
                  ) : null}

                  {otpExpired && !holdExpired ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-left text-sm text-red-900" role="alert" aria-live="assertive">
                      <p className="font-bold">Mã OTP đã hết hiệu lực.</p>
                      <p className="mt-1 text-xs leading-5">Bạn có thể yêu cầu gửi lại mã trong thời gian giữ chỗ vẫn còn hiệu lực.</p>
                      <button type="button" disabled={isSubmitting || isResendingOtp || resendCooldownSeconds > 0} onClick={() => void handleResendOtp()} className="mt-3 min-h-11 rounded-lg border border-red-300 bg-white px-4 py-2 text-xs font-bold text-red-800 transition-colors hover:bg-red-100 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400 focus-visible:ring-2 focus-visible:ring-red-500">
                        {isResendingOtp ? "Đang gửi lại mã..." : resendCooldownSeconds > 0 ? `Thử lại sau ${formatTimer(resendCooldownSeconds)}` : "Gửi lại mã OTP"}
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
                    <label className="block text-sm font-bold text-gray-800 mb-1.5" htmlFor="booking-otp">
                      Nhập mã OTP 6 số xác thực
                    </label>
                    <p className="text-xs text-gray-500 mb-3" id="booking-otp-help">
                      {otpDeliveryStatus === "QUEUED"
                        ? <>Mã OTP đang được gửi đến email <span className="font-semibold text-gray-700">{maskEmail(email)}</span>. Bạn có thể nhập mã ngay khi nhận được.</>
                        : otpDeliveryStatus === "FAILED"
                          ? "Chưa thể gửi mã OTP. Vui lòng thử gửi lại hoặc chọn khung giờ khác."
                          : <>Mã OTP đã được gửi đến email <span className="font-semibold text-gray-700">{maskEmail(email)}</span>.</>}
                    </p>
                    {!holdExpired && !otpExpired ? (
                      <div className="flex flex-col items-center gap-1.5" aria-live="polite">
                        <button
                          type="button"
                          onClick={() => void handleResendOtp()}
                          disabled={isSubmitting || isResendingOtp || resendCooldownSeconds > 0}
                          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-brand-300 bg-white px-4 py-2 text-sm font-bold text-brand-800 transition-colors hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 focus-visible:ring-2 focus-visible:ring-brand-600"
                        >
                          {isResendingOtp
                            ? "Đang gửi lại mã..."
                            : resendCooldownSeconds > 0
                              ? `Gửi lại sau ${formatTimer(resendCooldownSeconds)}`
                              : "Gửi lại mã OTP"}
                        </button>
                        <span className="text-[11px] text-gray-500">
                          {resendCooldownSeconds > 0
                            ? "Mã mới chỉ có thể yêu cầu lại sau khi hết thời gian chờ."
                            : "Không tạo thêm lịch hẹn; mã mới sẽ thay thế mã cũ."}
                        </span>
                      </div>
                    ) : null}
                    <input
                      id="booking-otp"
                      name="otp"
                      aria-describedby="booking-otp-help"
                      type="text"
                      autoComplete="one-time-code"
                      inputMode="numeric"
                      maxLength={6}
                      required
                      autoFocus
                      placeholder="123456"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      disabled={holdExpired || isSubmitting || isResendingOtp}
                      className="w-48 text-center p-3 text-2xl font-mono tracking-widest bg-gray-50 border-2 border-brand-600 rounded-xl focus:ring-4 focus:ring-brand-100 focus:outline-none"
                    />
                  </div>

                  <div className="booking-step-actions pt-3 flex items-center justify-between border-t border-gray-100">
                    <button
                      type="button"
                      onClick={holdExpired ? restartSlotSelection : () => navigateToStep(6)}
                      disabled={isSubmitting || isResendingOtp}
                      className="inline-flex min-h-[44px] items-center px-4 py-2 text-gray-600 hover:text-gray-900 font-medium text-sm disabled:opacity-50 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 transition-colors"
                    >
                      {holdExpired ? "← Chọn lại khung giờ" : "← Sửa thông tin"}
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || isResendingOtp || holdExpired || otpExpired}
                      className="px-8 py-2.5 bg-brand-700 hover:bg-brand-800 disabled:opacity-50 text-white font-bold rounded-lg shadow-sm hover:shadow-xl transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 focus-visible:ring-2 focus-visible:ring-brand-600"
                    >
                      {isSubmitting ? "Đang xác nhận..." : "Hoàn tất đặt lịch khám"}
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
                    Đặt lịch khám thành công!
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
                      <div>
                        <span className="text-brand-300 text-[11px]">BHYT:</span>
                        <p className="font-semibold text-white">{confirmedAppointment.hasInsurance ? "Có hỗ trợ" : "Không đăng ký"}</p>
                      </div>
                    </div>

                    <div className="mt-3 rounded-xl border border-brand-700/70 bg-brand-800/70 p-3 text-[11px] leading-5 text-brand-100">
                      <p className="font-bold text-white">Lưu ý khi đến khám</p>
                      <p>Vui lòng đến trước giờ hẹn khoảng 30 phút và mang CCCD/hộ chiếu cùng mã lịch hẹn.</p>
                      {confirmedAppointment.hasInsurance ? (
                        <p>Mang theo thẻ BHYT hoặc hồ sơ bảo lãnh viện phí để quầy tiếp đón kiểm tra quyền lợi.</p>
                      ) : (
                        <p>Nếu có phát sinh BHYT hoặc bảo lãnh viện phí, hãy báo quầy tiếp đón để được hướng dẫn bổ sung.</p>
                      )}
                    </div>

                    <div className="mt-3 pt-3 border-t border-brand-700/60 flex items-center justify-between text-[11px] text-brand-200">
                      <span className="flex items-center gap-1"><Icon name="building" size={14} /> {confirmedAppointment.branchName || "Cơ sở đang cập nhật"}</span>
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded font-semibold">
                        ĐÃ XÁC NHẬN
                      </span>
                    </div>
                  </div>

                  <div className="pt-3">
                    <Link className="mr-3 inline-flex rounded-lg border border-brand-700 px-6 py-2.5 text-sm font-bold text-brand-800" href={`/patient/dashboard?paymentAppointmentId=${encodeURIComponent(confirmedAppointment.id)}#appointments`}>
                      Thanh toán chuyển khoản
                    </Link>
                    <button
                      type="button"
                      onClick={closeBooking}
                      className="px-8 py-2.5 bg-brand-700 hover:bg-brand-800 text-white font-bold rounded-lg shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 focus-visible:ring-2 focus-visible:ring-brand-600"
                    >
                      {completionActionLabel}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
  );

  if (!isModal) return panel;

  return (
    <div
      className="dialog-layer fixed inset-0 flex items-center justify-center p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby={panelTitleId}
      onMouseDown={(event) => { if (event.target === event.currentTarget) closeBooking(); }}
    >
      {panel}
    </div>
  );
}

export function BookingInlineExperience({
  selection,
  ...props
}: BookingInlineExperienceProps) {
  return (
    <BookingExperience
      {...props}
      active
      initialBranchId={selection?.branchId ?? props.initialBranchId}
      initialDoctorId={selection?.doctorId ?? props.initialDoctorId}
      initialPackageId={selection?.packageId ?? props.initialPackageId}
      initialSpecialtyId={selection?.specialtyId ?? props.initialSpecialtyId}
      presentation="inline"
    />
  );
}

export default function BookingModal({
  isOpen,
  onClose,
  ...props
}: BookingModalProps) {
  return (
    <BookingExperience
      {...props}
      active={isOpen}
      onClose={onClose}
      presentation="modal"
    />
  );
}
