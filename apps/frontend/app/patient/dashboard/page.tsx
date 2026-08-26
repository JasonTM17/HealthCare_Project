"use client";

import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import PortalChrome from "../../../components/PortalChrome";
import {
  ApiError,
  clearAuthSession,
  downloadProtectedFile,
  fetchDoctorSlots,
  fetchBankTransferPayment,
  fetchPatientProfile,
  fetchPatientAppointments,
  fetchNotifications,
  fetchPatientDiagnosticResults,
  fetchPatientCarePlans,
  fetchPatientMedicalRecords,
  fetchPatientPrescriptions,
  fetchPatientOverview,
  hasRole,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  rescheduleAppointment,
  submitBankTransfer,
  updatePatientProfile,
  type Page,
} from "../../../lib/api-client";
import { useAuthSession } from "../../../components/useAuthSession";
import type {
  AuthUser,
  BankTransferPayment,
  CarePlan,
  PatientPortalAppointment,
  DiagnosticResult,
  MedicalRecord,
  Notification,
  Prescription,
  PatientProfile,
  PaymentStatus,
  PatientOverview,
  TimeSlot,
} from "../../../types/hospital";
import {
  EmptyState,
  ErrorState,
  ForbiddenState,
  LoadingState,
  LoginRequiredState,
} from "../../../components/PortalStates";
import PortalAppointments from "../../../components/PortalAppointments";
import { BUSINESS_TIME_ZONE, businessDate, formatBusinessDate, formatBusinessDateTime } from "../../../lib/business-time";
import UiIcon, { type IconName } from "../../../components/UiIcon";
import careHubStyles from "./CareHub.module.css";
import paymentStyles from "./PaymentPanel.module.css";

type Loadable<T> =
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; message: string; statusCode?: number };

const initialRecords: Loadable<MedicalRecord[]> = { status: "loading" };
const initialAppointments: Loadable<Page<PatientPortalAppointment>> = { status: "loading" };
const initialPrescriptions: Loadable<Prescription[]> = { status: "loading" };
const initialDiagnostics: Loadable<DiagnosticResult[]> = { status: "loading" };
const initialNotifications: Loadable<Page<Notification>> = { status: "loading" };
const initialProfile: Loadable<PatientProfile> = { status: "loading" };
const initialOverview: Loadable<PatientOverview> = { status: "loading" };
const initialCarePlans: Loadable<CarePlan[]> = { status: "loading" };

interface DashboardLoadSnapshot {
  userId: string;
  records: Loadable<MedicalRecord[]>;
  appointments: Loadable<Page<PatientPortalAppointment>>;
  prescriptions: Loadable<Prescription[]>;
  diagnostics: Loadable<DiagnosticResult[]>;
  notifications: Loadable<Page<Notification>>;
  profile: Loadable<PatientProfile>;
  overview: Loadable<PatientOverview>;
  carePlans: Loadable<CarePlan[]>;
}

interface ProfileForm {
  fullName: string;
  dateOfBirth: string;
  gender: "" | "MALE" | "FEMALE" | "OTHER" | "UNSPECIFIED";
  address: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
}

const EMPTY_PROFILE_FORM: ProfileForm = { fullName: "", dateOfBirth: "", gender: "", address: "", emergencyContactName: "", emergencyContactPhone: "" };

function getErrorStatus(error: unknown): number | undefined {
  return error instanceof ApiError ? error.status : undefined;
}

function getErrorMessage(error: unknown): string {
  const status = getErrorStatus(error);
  if (status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (status === 403) return "Tài khoản của bạn chưa được phép thực hiện thao tác này.";
  if (status === 404) return "Không tìm thấy thông tin bạn yêu cầu.";
  if (status === 409) return "Thông tin đã thay đổi. Vui lòng tải lại trang và thử lại.";
  if (status === 400 || status === 422) return "Thông tin chưa hợp lệ. Vui lòng kiểm tra và thử lại.";
  if (status === 429) return "Bạn đang thao tác quá nhanh. Vui lòng chờ một lát rồi thử lại.";
  return "Kết nối đang bị gián đoạn. Vui lòng thử lại sau ít phút.";
}

function toLoadable<T>(result: PromiseSettledResult<T>): Loadable<T> {
  return result.status === "fulfilled"
    ? { status: "success", data: result.value }
    : {
        status: "error",
        message: getErrorMessage(result.reason),
        statusCode: getErrorStatus(result.reason),
      };
}

function prepareRetry<T>(state: Loadable<T>): Loadable<T> {
  return state.status === "error" ? { status: "loading" } : state;
}

function loadOrReuse<T>(state: Loadable<T> | undefined, load: () => Promise<T>): Promise<T> {
  return state?.status === "success" ? Promise.resolve(state.data) : load();
}

function isUnauthorized(result: PromiseSettledResult<unknown>): boolean {
  return result.status === "rejected" && getErrorStatus(result.reason) === 401;
}

function formatPrescriptionStatus(status: string): string {
  const labels: Record<string, string> = {
    ACTIVE: "Đang sử dụng",
    COMPLETED: "Đã hoàn tất",
    CANCELLED: "Đã ngừng",
  };
  return labels[status] ?? "Đã kê";
}

function formatNotificationType(eventType: string): string {
  const labels: Record<string, string> = {
    APPOINTMENT_CREATED: "Đã tạo lịch hẹn",
    APPOINTMENT_CONFIRMED: "Lịch hẹn đã xác nhận",
    APPOINTMENT_RESCHEDULED: "Lịch hẹn đã thay đổi",
    APPOINTMENT_CANCELLED: "Lịch hẹn đã hủy",
    APPOINTMENT_REMINDER: "Nhắc lịch khám",
    DIAGNOSTIC_RESULT_AVAILABLE: "Có kết quả mới",
    PAYMENT_SUBMITTED: "Đã gửi thông tin chuyển khoản",
    PAYMENT_CONFIRMED: "Thanh toán đã xác nhận",
    PAYMENT_REJECTED: "Thanh toán cần kiểm tra lại",
    PAYMENT_REFUNDED: "Thanh toán đã hoàn tiền",
  };
  return labels[eventType] ?? "Thông báo mới";
}

function formatPaymentStatus(status: string): string {
  const labels: Record<string, string> = {
    UNPAID: "Chưa thanh toán",
    PENDING_VERIFICATION: "Đang chờ đối soát",
    PAID: "Đã thanh toán",
    REJECTED: "Cần kiểm tra lại",
    REFUND_PENDING: "Đang chờ hoàn tiền",
    REFUNDED: "Đã hoàn tiền",
  };
  return labels[status] ?? "Đang cập nhật";
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(amount);
}

type PaymentNotice = {
  kind: "success" | "error" | "info";
  message: string;
};

const PAYMENT_POLL_DELAYS: Record<"UNPAID" | "PENDING_VERIFICATION", readonly number[]> = {
  UNPAID: [20_000, 30_000, 45_000, 60_000],
  PENDING_VERIFICATION: [8_000, 12_000, 20_000, 30_000, 45_000, 60_000],
};
const MAX_QR_DOWNLOAD_BYTES = 5 * 1024 * 1024;

function isPollablePaymentStatus(status: PaymentStatus): status is "UNPAID" | "PENDING_VERIFICATION" {
  return status === "UNPAID" || status === "PENDING_VERIFICATION";
}

function paymentTransitionNotice(status: PaymentStatus): PaymentNotice | null {
  if (status === "PAID") {
    return { kind: "success", message: "Giao dịch đã được xác nhận. Trạng thái lịch hẹn cũng đã cập nhật." };
  }
  if (status === "REJECTED") {
    return { kind: "error", message: "Giao dịch cần kiểm tra lại. Xem lý do và hướng dẫn ngay bên dưới." };
  }
  if (status === "REFUND_PENDING") {
    return { kind: "info", message: "Khoản thanh toán đang được xử lý hoàn tiền." };
  }
  if (status === "REFUNDED") {
    return { kind: "success", message: "Khoản thanh toán đã được hoàn tiền." };
  }
  return null;
}

function safePaymentQrUrl(value: string): URL {
  const url = new URL(value, window.location.origin);
  const isSameOrigin = url.origin === window.location.origin;
  const isTrustedVietQr = url.protocol === "https:" && url.hostname === "img.vietqr.io";
  if (url.username || url.password || (!isSameOrigin && !isTrustedVietQr)) {
    throw new Error("Untrusted payment QR URL");
  }
  return url;
}

async function downloadPaymentQrImage(paymentDetails: BankTransferPayment): Promise<void> {
  const qrUrl = safePaymentQrUrl(paymentDetails.qrCodeUrl);
  const response = await fetch(qrUrl, {
    cache: "no-store",
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  if (!response.ok) throw new Error("Unable to download payment QR");

  const declaredSize = Number(response.headers.get("content-length") ?? 0);
  if (declaredSize > MAX_QR_DOWNLOAD_BYTES) throw new Error("Payment QR is too large");

  const blob = await response.blob();
  if (!blob.type.startsWith("image/") || blob.size > MAX_QR_DOWNLOAD_BYTES) {
    throw new Error("Invalid payment QR response");
  }

  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const safeBookingCode = paymentDetails.bookingCode.replace(/[^A-Za-z0-9_-]/g, "-");
  anchor.href = blobUrl;
  anchor.download = `vietqr-${safeBookingCode || "thanh-toan"}.png`;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
}

async function writeClipboard(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.readOnly = true;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  document.body.append(textarea);
  textarea.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } finally {
    textarea.remove();
    previousFocus?.focus();
  }
  if (!copied) throw new Error("Clipboard is unavailable");
}

function countOf<T>(state: Loadable<T[]> | Loadable<Page<T>>): string {
  if (state.status === "success") {
    return String(Array.isArray(state.data) ? state.data.length : state.data.totalElements);
  }
  return "--";
}

function StateContent<T>({
  state,
  children,
  emptyTitle,
  emptyDescription,
  retry,
}: {
  state: Loadable<T>;
  children: (data: T) => ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  retry?: () => void;
}) {
  if (state.status === "loading") return <LoadingState />;
  if (state.status === "error") return <ErrorState message={state.message} onRetry={retry} status={state.statusCode} />;
  if (Array.isArray(state.data) && state.data.length === 0) {
    return <EmptyState description={emptyDescription ?? "Hiện chưa có thông tin để hiển thị."} title={emptyTitle ?? "Chưa có dữ liệu"} />;
  }
  if (
    !Array.isArray(state.data) &&
    ((state.data as Partial<Page<unknown>>).empty ||
      (state.data as Partial<Page<unknown>>).content?.length === 0)
  ) {
    return <EmptyState description={emptyDescription ?? "Hiện chưa có thông tin để hiển thị."} title={emptyTitle ?? "Chưa có dữ liệu"} />;
  }
  return children(state.data);
}

const ACTIVE_APPOINTMENT_STATUSES = new Set([
  "PENDING_CONFIRMATION",
  "CONFIRMED",
  "CHECKED_IN",
  "IN_PROGRESS",
]);

type PatientOverviewWireCompatibility = PatientOverview & {
  newDiagnosticResult?: boolean;
  newPrescription?: boolean;
};

interface CareHubTask {
  action: string;
  description: string;
  href: string;
  icon: IconName;
  id: string;
  title: string;
  tone: "attention" | "default" | "new";
}

function overviewHasNewDiagnosticResult(value: PatientOverview): boolean {
  const compatibleValue = value as PatientOverviewWireCompatibility;
  return compatibleValue.hasNewDiagnosticResult ?? compatibleValue.newDiagnosticResult ?? false;
}

function overviewHasNewPrescription(value: PatientOverview): boolean {
  const compatibleValue = value as PatientOverviewWireCompatibility;
  return compatibleValue.hasNewPrescription ?? compatibleValue.newPrescription ?? false;
}

function formatPortalTime(value: string): string {
  return value.length >= 5 ? value.slice(0, 5) : value;
}

function currentBusinessDateTimeKey(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

function appointmentDateTimeKey(appointment: PatientPortalAppointment): string {
  return `${appointment.appointmentDate}T${formatPortalTime(appointment.startTime)}`;
}

function findUpcomingAppointment(page: Page<PatientPortalAppointment>): PatientPortalAppointment | null {
  const nowKey = currentBusinessDateTimeKey();
  return [...page.content]
    .filter((appointment) => (
      ACTIVE_APPOINTMENT_STATUSES.has(appointment.status)
      && appointmentDateTimeKey(appointment) >= nowKey
    ))
    .sort((left, right) => appointmentDateTimeKey(left).localeCompare(appointmentDateTimeKey(right)))[0] ?? null;
}

function isOverdueCarePlanItem(item: CarePlan["items"][number]): boolean {
  return item.status === "OPEN" && Boolean(item.dueAt) && Date.parse(item.dueAt ?? "") < Date.now();
}

function CareHubSkeleton({ announce = true }: { announce?: boolean }) {
  return (
    <div aria-live={announce ? "polite" : undefined} className={careHubStyles.loading} role={announce ? "status" : undefined}>
      <span className={careHubStyles.skeletonLine} aria-hidden="true" />
      <span className={careHubStyles.skeletonLineShort} aria-hidden="true" />
      {announce ? <span>Đang tổng hợp lịch hẹn và tiến trình chăm sóc…</span> : null}
    </div>
  );
}

function PatientCareHub({
  appointments,
  carePlans,
  overview,
  retry,
}: {
  appointments: Loadable<Page<PatientPortalAppointment>>;
  carePlans: Loadable<CarePlan[]>;
  overview: Loadable<PatientOverview>;
  retry: () => void;
}) {
  const sourceStatuses = [appointments.status, carePlans.status, overview.status];
  const loadingCount = sourceStatuses.filter((status) => status === "loading").length;
  const errorCount = sourceStatuses.filter((status) => status === "error").length;
  const isLoading = loadingCount > 0;
  const isInitialLoading = loadingCount === sourceStatuses.length;
  const isUnavailable = errorCount === sourceStatuses.length;
  const hasPartialError = errorCount > 0 && !isUnavailable;

  const upcomingAppointment = appointments.status === "success"
    ? findUpcomingAppointment(appointments.data)
    : null;
  const pendingVerificationAppointments = appointments.status === "success"
    ? appointments.data.content.filter((appointment) => appointment.paymentStatus === "PENDING_VERIFICATION")
    : [];
  const firstPendingVerification = pendingVerificationAppointments[0] ?? null;

  const openCarePlanItems = carePlans.status === "success"
    ? carePlans.data.flatMap((plan) => plan.items).filter((item) => item.status === "OPEN")
    : [];
  const overdueCarePlanItems = openCarePlanItems.filter(isOverdueCarePlanItem);
  const fallbackOpenCarePlanCount = overview.status === "success" ? overview.data.openCarePlanTaskCount : 0;
  const openCarePlanCount = carePlans.status === "success" ? openCarePlanItems.length : fallbackOpenCarePlanCount;
  const unreadConsultationCount = overview.status === "success" ? overview.data.unreadConsultationCount : 0;
  const hasNewDiagnosticResult = overview.status === "success" && overviewHasNewDiagnosticResult(overview.data);
  const hasNewPrescription = overview.status === "success" && overviewHasNewPrescription(overview.data);

  const careTasks: CareHubTask[] = [];
  if (firstPendingVerification) {
    careTasks.push({
      action: "Xem trạng thái",
      description: pendingVerificationAppointments.length > 1
        ? `${pendingVerificationAppointments.length} giao dịch đã gửi, đang chờ thu ngân kiểm tra sao kê.`
        : "Mã giao dịch đã gửi, đang chờ thu ngân kiểm tra sao kê.",
      href: `/patient/dashboard?paymentAppointmentId=${encodeURIComponent(firstPendingVerification.bookingCode)}#appointments`,
      icon: "clock",
      id: "payment-verification",
      title: "Chờ thu ngân đối soát",
      tone: "attention",
    });
  }
  if (openCarePlanCount > 0) {
    const overdueCount = overdueCarePlanItems.length;
    careTasks.push({
      action: "Mở kế hoạch",
      description: overdueCount > 0
        ? `${overdueCount} trong ${openCarePlanCount} việc đang mở đã quá hạn.`
        : carePlans.status === "error"
          ? `${openCarePlanCount} việc đang mở. Chưa thể xác định mục quá hạn ở bản tóm tắt.`
          : carePlans.status === "loading"
            ? `${openCarePlanCount} việc đang mở. Đang kiểm tra thời hạn từng mục.`
            : `${openCarePlanCount} việc đang mở theo hướng dẫn của bác sĩ.`,
      href: "/patient/care-plan",
      icon: overdueCount > 0 ? "alert-triangle" : "check",
      id: "care-plan",
      title: overdueCount > 0 ? "Kế hoạch có việc quá hạn" : "Tiếp tục kế hoạch chăm sóc",
      tone: overdueCount > 0 || carePlans.status === "error" ? "attention" : "default",
    });
  }
  if (unreadConsultationCount > 0) {
    careTasks.push({
      action: "Đọc tư vấn",
      description: `${unreadConsultationCount} tin mới trong kênh trao đổi riêng với bác sĩ.`,
      href: "/patient/consultations",
      icon: "message-square",
      id: "consultation",
      title: "Có tin tư vấn chưa đọc",
      tone: "new",
    });
  }

  const newClinicalUpdates: CareHubTask[] = [];
  if (hasNewDiagnosticResult) {
    newClinicalUpdates.push({
      action: "Xem kết quả",
      description: "Kết quả cận lâm sàng mới đã được ghi nhận trong hồ sơ.",
      href: "#diagnostics",
      icon: "activity",
      id: "diagnostic-result",
      title: "Có kết quả mới",
      tone: "new",
    });
  }
  if (hasNewPrescription) {
    newClinicalUpdates.push({
      action: "Xem đơn thuốc",
      description: "Đơn thuốc mới đã được bác sĩ cập nhật.",
      href: "#prescriptions",
      icon: "book-open",
      id: "prescription",
      title: "Có đơn thuốc mới",
      tone: "new",
    });
  }

  const hasRecordedData = (
    appointments.status === "success" && appointments.data.totalElements > 0
  ) || (
    carePlans.status === "success" && carePlans.data.length > 0
  ) || (
    overview.status === "success" && (
      overview.data.appointmentCount > 0
      || overview.data.diagnosticResultCount > 0
      || overview.data.prescriptionCount > 0
    )
  );
  const attentionGroupCount = careTasks.length + newClinicalUpdates.length;
  const hasAttentionTask = careTasks.some((task) => task.tone === "attention");
  const statusLabel = isInitialLoading
    ? "Đang tổng hợp"
    : isUnavailable
      ? "Tạm gián đoạn"
      : attentionGroupCount > 0
        ? `${attentionGroupCount} nhóm cần xem`
        : hasPartialError
          ? "Một phần chưa tải"
          : hasRecordedData
            ? "Đang đúng tiến độ"
            : "Chưa có dữ liệu";
  const statusTone = isUnavailable || hasPartialError || hasAttentionTask
    ? "attention"
    : attentionGroupCount > 0
      ? "active"
      : "healthy";

  return (
    <section
      aria-busy={isLoading}
      aria-describedby="care-hub-description"
      aria-labelledby="care-hub-title"
      className={careHubStyles.careHub}
    >
      <header className={careHubStyles.header}>
        <div>
          <h2 id="care-hub-title">Việc cần làm hôm nay</h2>
          <p id="care-hub-description">Một nơi để kiểm tra lịch khám, đối soát và cập nhật chăm sóc mới nhất.</p>
        </div>
        <span aria-live="polite" className={careHubStyles.status} data-tone={statusTone}>{statusLabel}</span>
      </header>

      {isUnavailable ? (
        <div className={careHubStyles.unavailable} role="alert">
          <span aria-hidden="true" className={careHubStyles.noticeIcon}><UiIcon name="alert-triangle" size={20} /></span>
          <div>
            <strong>Chưa thể tải trung tâm chăm sóc</strong>
            <p>Kết nối đang bị gián đoạn. Các khu vực chi tiết bên dưới vẫn có thể được mở riêng.</p>
          </div>
          <button className={careHubStyles.retryButton} onClick={retry} type="button">Thử tải lại</button>
        </div>
      ) : isInitialLoading ? (
        <div className={careHubStyles.initialLoading}>
          <CareHubSkeleton />
          <CareHubSkeleton announce={false} />
          <CareHubSkeleton announce={false} />
        </div>
      ) : (
        <>
          {hasPartialError ? (
            <div className={careHubStyles.partialError} role="status">
              <span aria-hidden="true" className={careHubStyles.noticeIcon}><UiIcon name="alert-triangle" size={20} /></span>
              <p>Một phần thông tin chưa tải được. Chỉ phần chưa tải sẽ được thử lại; dữ liệu đã tải vẫn được giữ trên màn hình.</p>
              <button className={careHubStyles.retryButton} onClick={retry} type="button">Thử tải lại phần thiếu</button>
            </div>
          ) : null}

          <div className={careHubStyles.body}>
            <section aria-labelledby="care-hub-appointment-title" className={`${careHubStyles.lane} ${careHubStyles.appointmentLane}`}>
              <div className={careHubStyles.laneHeading}>
                <span aria-hidden="true" className={careHubStyles.laneIcon}><UiIcon name="calendar" size={20} /></span>
                <h3 id="care-hub-appointment-title">Lịch khám sắp tới</h3>
              </div>
              {appointments.status === "loading" ? <CareHubSkeleton /> : null}
              {appointments.status === "error" ? (
                <p className={careHubStyles.inlineUnavailable}>Chưa thể xác định lịch sắp tới. Hãy tải lại hoặc mở danh sách lịch hẹn bên dưới.</p>
              ) : null}
              {appointments.status === "success" && upcomingAppointment ? (
                <div className={careHubStyles.appointmentDetail}>
                  <time dateTime={`${upcomingAppointment.appointmentDate}T${formatPortalTime(upcomingAppointment.startTime)}`}>
                    <strong>{formatBusinessDate(upcomingAppointment.appointmentDate)}</strong>
                    <span>{formatPortalTime(upcomingAppointment.startTime)} đến {formatPortalTime(upcomingAppointment.endTime)}</span>
                  </time>
                  <p className={careHubStyles.doctorName}>Bác sĩ {upcomingAppointment.doctorName}</p>
                  <p className={careHubStyles.appointmentMeta}>
                    {upcomingAppointment.specialtyName ?? "Chuyên khoa đang cập nhật"}
                    {upcomingAppointment.branchName ? ` · ${upcomingAppointment.branchName}` : ""}
                  </p>
                  <a className={careHubStyles.inlineAction} href="#appointments">Xem lịch hẹn <UiIcon name="arrow-right" size={18} /></a>
                </div>
              ) : null}
              {appointments.status === "success" && !upcomingAppointment ? (
                <div className={careHubStyles.emptyState}>
                  <strong>Chưa có lịch khám sắp tới</strong>
                  <p>Khi lịch được xác nhận, ngày khám và bác sĩ sẽ xuất hiện tại đây.</p>
                  <Link className={careHubStyles.inlineAction} href="/dat-lich">Đặt lịch khám <UiIcon name="arrow-right" size={18} /></Link>
                </div>
              ) : null}
            </section>

            <section aria-labelledby="care-hub-priority-title" className={careHubStyles.lane}>
              <div className={careHubStyles.laneHeading}>
                <span aria-hidden="true" className={careHubStyles.laneIcon}><UiIcon name="check" size={20} /></span>
                <h3 id="care-hub-priority-title">Cần bạn kiểm tra</h3>
              </div>
              {careTasks.length > 0 ? (
                <ul className={careHubStyles.taskList}>
                  {careTasks.map((task) => (
                    <li key={task.id}>
                      <Link aria-label={`${task.title}. ${task.action}`} className={careHubStyles.taskLink} data-tone={task.tone} href={task.href}>
                        <span aria-hidden="true" className={careHubStyles.taskIcon}><UiIcon name={task.icon} size={19} /></span>
                        <span className={careHubStyles.taskCopy}>
                          <strong>{task.title}</strong>
                          <span>{task.description}</span>
                          <small>{task.action}</small>
                        </span>
                        <UiIcon className={careHubStyles.chevron} name="chevron-right" size={18} />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : isLoading ? (
                <CareHubSkeleton />
              ) : hasPartialError ? (
                <p className={careHubStyles.inlineUnavailable}>Chưa thể xác định đầy đủ việc cần xử lý.</p>
              ) : hasRecordedData ? (
                <div className={careHubStyles.healthyState}>
                  <span aria-hidden="true"><UiIcon name="shield-check" size={22} /></span>
                  <div><strong>Bạn đang theo dõi đúng tiến độ</strong><p>Hiện không có đối soát, tin tư vấn hoặc việc chăm sóc cần ưu tiên.</p></div>
                </div>
              ) : (
                <div className={careHubStyles.emptyState}>
                  <strong>Chưa có việc chăm sóc được ghi nhận</strong>
                  <p>Thông tin sẽ xuất hiện sau khi bạn có lịch khám hoặc kế hoạch từ bác sĩ.</p>
                </div>
              )}
            </section>

            <section aria-labelledby="care-hub-update-title" className={careHubStyles.lane}>
              <div className={careHubStyles.laneHeading}>
                <span aria-hidden="true" className={careHubStyles.laneIcon}><UiIcon name="activity" size={20} /></span>
                <h3 id="care-hub-update-title">Hồ sơ mới</h3>
              </div>
              {overview.status === "loading" ? <CareHubSkeleton /> : null}
              {overview.status === "error" ? (
                <p className={careHubStyles.inlineUnavailable}>Chưa thể kiểm tra kết quả và đơn thuốc mới.</p>
              ) : null}
              {overview.status === "success" && newClinicalUpdates.length > 0 ? (
                <ul className={careHubStyles.taskList}>
                  {newClinicalUpdates.map((task) => (
                    <li key={task.id}>
                      <a aria-label={`${task.title}. ${task.action}`} className={careHubStyles.taskLink} data-tone={task.tone} href={task.href}>
                        <span aria-hidden="true" className={careHubStyles.taskIcon}><UiIcon name={task.icon} size={19} /></span>
                        <span className={careHubStyles.taskCopy}>
                          <strong>{task.title}</strong>
                          <span>{task.description}</span>
                          <small>{task.action}</small>
                        </span>
                        <UiIcon className={careHubStyles.chevron} name="chevron-right" size={18} />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
              {overview.status === "success" && newClinicalUpdates.length === 0 ? (
                <div className={careHubStyles.emptyState}>
                  <strong>Chưa có cập nhật lâm sàng mới</strong>
                  <p>Kết quả và đơn thuốc mới sẽ được báo tại đây khi bác sĩ ghi nhận.</p>
                </div>
              ) : null}
            </section>
          </div>
        </>
      )}
    </section>
  );
}

export default function PatientDashboardPage() {
  const session = useAuthSession();
  const searchParams = useSearchParams();
  const user: AuthUser | null = session?.user ?? null;
  const authState: "ready" | "unauthenticated" | "forbidden" = !session
    ? "unauthenticated"
    : hasRole(session.user, "PATIENT")
      ? "ready"
      : "forbidden";
  const [records, setRecords] = useState<Loadable<MedicalRecord[]>>(initialRecords);
  const [appointments, setAppointments] = useState<Loadable<Page<PatientPortalAppointment>>>(initialAppointments);
  const [prescriptions, setPrescriptions] = useState<Loadable<Prescription[]>>(initialPrescriptions);
  const [diagnostics, setDiagnostics] = useState<Loadable<DiagnosticResult[]>>(initialDiagnostics);
  const [notifications, setNotifications] = useState<Loadable<Page<Notification>>>(initialNotifications);
  const [profile, setProfile] = useState<Loadable<PatientProfile>>(initialProfile);
  const [overview, setOverview] = useState<Loadable<PatientOverview>>(initialOverview);
  const [carePlans, setCarePlans] = useState<Loadable<CarePlan[]>>(initialCarePlans);
  const [profileForm, setProfileForm] = useState<ProfileForm>(EMPTY_PROFILE_FORM);
  const [profileOperation, setProfileOperation] = useState<"idle" | "saving">("idle");
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<PatientPortalAppointment | null>(null);
  const [selectedPaymentAppointmentId, setSelectedPaymentAppointmentId] = useState<string | null>(null);
  const [payment, setPayment] = useState<Loadable<BankTransferPayment> | null>(null);
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentRefreshing, setPaymentRefreshing] = useState(false);
  const [paymentQrDownloading, setPaymentQrDownloading] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState<PaymentNotice | null>(null);
  const [copiedPaymentField, setCopiedPaymentField] = useState<string | null>(null);
  const [copyAnnouncement, setCopyAnnouncement] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [slots, setSlots] = useState<Loadable<TimeSlot[]> | null>(null);
  const [selectedStartTime, setSelectedStartTime] = useState("");
  const [rescheduleNotice, setRescheduleNotice] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [notificationAction, setNotificationAction] = useState<string | null>(null);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const retrySnapshotRef = useRef<DashboardLoadSnapshot | null>(null);
  const handledAppointmentIdRef = useRef<string | null>(null);
  const handledPaymentAppointmentIdRef = useRef<string | null>(null);
  const paymentHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const copyFeedbackTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!session || !hasRole(session.user, "PATIENT")) return;
    let cancelled = false;
    const retrySnapshot = retrySnapshotRef.current?.userId === session.user.id
      ? retrySnapshotRef.current
      : null;
    retrySnapshotRef.current = null;

    Promise.allSettled([
      loadOrReuse(retrySnapshot?.profile, () => fetchPatientProfile()),
      loadOrReuse(retrySnapshot?.appointments, () => fetchPatientAppointments()),
      loadOrReuse(retrySnapshot?.records, () => fetchPatientMedicalRecords()),
      loadOrReuse(retrySnapshot?.prescriptions, () => fetchPatientPrescriptions()),
      loadOrReuse(retrySnapshot?.diagnostics, () => fetchPatientDiagnosticResults()),
      loadOrReuse(retrySnapshot?.notifications, () => fetchNotifications()),
      loadOrReuse(retrySnapshot?.overview, () => fetchPatientOverview()),
      loadOrReuse(retrySnapshot?.carePlans, () => fetchPatientCarePlans()),
    ]).then(([profileResult, appointmentsResult, recordsResult, prescriptionsResult, diagnosticsResult, notificationsResult, overviewResult, carePlansResult]) => {
      if (cancelled) return;

      const results = [profileResult, appointmentsResult, recordsResult, prescriptionsResult, diagnosticsResult, notificationsResult, overviewResult, carePlansResult];
      if (results.some(isUnauthorized)) {
        clearAuthSession();
        return;
      }

      setAppointments(toLoadable(appointmentsResult));
      setProfile(toLoadable(profileResult));
      if (profileResult.status === "fulfilled") {
        const value = profileResult.value;
        setProfileForm({
          fullName: value.fullName,
          dateOfBirth: value.dateOfBirth ?? "",
          gender: value.gender ?? "",
          address: value.address ?? "",
          emergencyContactName: value.emergencyContactName ?? "",
          emergencyContactPhone: value.emergencyContactPhone ?? "",
        });
      }
      setRecords(toLoadable(recordsResult));
      setPrescriptions(toLoadable(prescriptionsResult));
      setDiagnostics(toLoadable(diagnosticsResult));
      setNotifications(toLoadable(notificationsResult));
      setOverview(toLoadable(overviewResult));
      setCarePlans(toLoadable(carePlansResult));
    });

    return () => {
      cancelled = true;
    };
  }, [reloadKey, session]);

  const retry = () => {
    retrySnapshotRef.current = session ? {
      userId: session.user.id,
      appointments,
      records,
      prescriptions,
      diagnostics,
      notifications,
      profile,
      overview,
      carePlans,
    } : null;
    setAppointments((current) => prepareRetry(current));
    setRecords((current) => prepareRetry(current));
    setPrescriptions((current) => prepareRetry(current));
    setDiagnostics((current) => prepareRetry(current));
    setNotifications((current) => prepareRetry(current));
    setProfile((current) => prepareRetry(current));
    setOverview((current) => prepareRetry(current));
    setCarePlans((current) => prepareRetry(current));
    setReloadKey((value) => value + 1);
  };

  const handleChooseReschedule = useCallback((appointment: PatientPortalAppointment) => {
    setSelectedAppointment(appointment);
    setRescheduleDate(appointment.appointmentDate);
    setSelectedStartTime("");
    setSlots(null);
    setRescheduleNotice(null);
  }, []);

  const syncAppointmentPaymentStatus = useCallback((appointmentIdToUpdate: string, status: PaymentStatus) => {
    setAppointments((current) => {
      if (current.status !== "success") return current;
      let changed = false;
      const content = current.data.content.map((appointment) => {
        if (appointment.id !== appointmentIdToUpdate || appointment.paymentStatus === status) return appointment;
        changed = true;
        return { ...appointment, paymentStatus: status };
      });
      return changed ? { status: "success", data: { ...current.data, content } } : current;
    });
  }, []);

  const handleChoosePayment = useCallback(async (appointment: PatientPortalAppointment) => {
    setSelectedPaymentAppointmentId(appointment.id);
    setPayment({ status: "loading" });
    setPaymentReference("");
    setPaymentNotice(null);
    try {
      const details = await fetchBankTransferPayment(appointment.id);
      setPayment({ status: "success", data: details });
      setPaymentReference(details.transactionReference ?? "");
      syncAppointmentPaymentStatus(details.appointmentId, details.status);
    } catch (error) {
      setPayment({ status: "error", message: getErrorMessage(error), statusCode: getErrorStatus(error) });
    }
  }, [syncAppointmentPaymentStatus]);

  const handleSubmitPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (payment?.status !== "success" || paymentSubmitting) return;
    setPaymentSubmitting(true);
    setPaymentNotice(null);
    try {
      const saved = await submitBankTransfer(payment.data.appointmentId, paymentReference.trim());
      setPayment({ status: "success", data: saved });
      syncAppointmentPaymentStatus(saved.appointmentId, saved.status);
      setPaymentNotice({ kind: "success", message: "Đã gửi mã giao dịch. Bộ phận thu ngân sẽ đối soát trước khi xác nhận." });
      setReloadKey((value) => value + 1);
    } catch (error) {
      setPaymentNotice({ kind: "error", message: getErrorMessage(error) });
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const copyPaymentValue = async (field: string, accessibleLabel: string, value: string) => {
    try {
      await writeClipboard(value);
      setCopiedPaymentField(field);
      setCopyAnnouncement(`Đã sao chép ${accessibleLabel}.`);
      if (copyFeedbackTimerRef.current !== null) window.clearTimeout(copyFeedbackTimerRef.current);
      copyFeedbackTimerRef.current = window.setTimeout(() => {
        setCopiedPaymentField(null);
        setCopyAnnouncement("");
        copyFeedbackTimerRef.current = null;
      }, 2_500);
    } catch {
      setCopyAnnouncement("");
      setPaymentNotice({ kind: "error", message: "Không thể sao chép tự động. Vui lòng chọn và sao chép thủ công." });
    }
  };

  const handleDownloadPaymentQr = async () => {
    if (payment?.status !== "success" || paymentQrDownloading) return;
    setPaymentQrDownloading(true);
    setPaymentNotice(null);
    try {
      await downloadPaymentQrImage(payment.data);
      setPaymentNotice({ kind: "success", message: "Đã tải mã VietQR về thiết bị." });
    } catch {
      setPaymentNotice({ kind: "error", message: "Không thể tải mã QR lúc này. Bạn vẫn có thể quét mã đang hiển thị trên màn hình." });
    } finally {
      setPaymentQrDownloading(false);
    }
  };

  const handleRefreshPayment = async () => {
    if (payment?.status !== "success" || paymentRefreshing) return;
    const current = payment.data;
    setPaymentRefreshing(true);
    setPaymentNotice(null);
    try {
      const latest = await fetchBankTransferPayment(current.appointmentId);
      setPayment({ status: "success", data: latest });
      setPaymentReference((currentReference) => latest.transactionReference ?? currentReference);
      syncAppointmentPaymentStatus(latest.appointmentId, latest.status);
      setPaymentNotice(paymentTransitionNotice(latest.status) ?? { kind: "info", message: "Đã kiểm tra: trạng thái thanh toán chưa thay đổi." });
      if (latest.status !== current.status) setReloadKey((value) => value + 1);
    } catch (error) {
      setPaymentNotice({ kind: "error", message: getErrorMessage(error) });
    } finally {
      setPaymentRefreshing(false);
    }
  };

  const closePaymentPanel = () => {
    const triggerId = selectedPaymentAppointmentId ? `payment-action-${selectedPaymentAppointmentId}` : null;
    setPayment(null);
    setSelectedPaymentAppointmentId(null);
    setPaymentNotice(null);
    setCopyAnnouncement("");
    window.setTimeout(() => {
      const trigger = triggerId ? document.getElementById(triggerId) : null;
      (trigger ?? document.getElementById("appointments-title"))?.focus();
    }, 0);
  };

  const activePayment = payment?.status === "success" ? payment.data : null;
  const activePaymentAppointmentId = activePayment?.appointmentId ?? null;
  const pollablePaymentStatus = activePayment && isPollablePaymentStatus(activePayment.status)
    ? activePayment.status
    : null;

  useEffect(() => {
    if (!activePaymentAppointmentId || !pollablePaymentStatus) return;
    const appointmentIdToRefresh = activePaymentAppointmentId;
    let cancelled = false;
    let attempt = 0;
    let timer: number | null = null;

    const poll = async () => {
      let shouldContinue = true;
      try {
        const latest = await fetchBankTransferPayment(appointmentIdToRefresh);
        if (cancelled) return;
        setPayment((current) => current?.status === "success" && current.data.appointmentId === appointmentIdToRefresh
          ? { status: "success", data: latest }
          : current);
        syncAppointmentPaymentStatus(latest.appointmentId, latest.status);

        if (latest.status !== pollablePaymentStatus) {
          shouldContinue = false;
          setPaymentNotice(paymentTransitionNotice(latest.status));
          setReloadKey((value) => value + 1);
        } else {
          attempt += 1;
        }
      } catch {
        if (cancelled) return;
        attempt += 1;
      }

      if (!cancelled && shouldContinue) {
        const delays = PAYMENT_POLL_DELAYS[pollablePaymentStatus];
        const baseDelay = delays[Math.min(attempt, delays.length - 1)];
        const delay = document.visibilityState === "hidden" ? Math.max(baseDelay, 60_000) : baseDelay;
        timer = window.setTimeout(() => void poll(), delay);
      }
    };

    const delays = PAYMENT_POLL_DELAYS[pollablePaymentStatus];
    timer = window.setTimeout(() => void poll(), delays[0]);
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [activePaymentAppointmentId, pollablePaymentStatus, syncAppointmentPaymentStatus]);

  useEffect(() => {
    if (!activePaymentAppointmentId) return;
    const timer = window.setTimeout(() => paymentHeadingRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [activePaymentAppointmentId]);

  useEffect(() => () => {
    if (copyFeedbackTimerRef.current !== null) window.clearTimeout(copyFeedbackTimerRef.current);
  }, []);

  const appointmentId = searchParams.get("appointmentId");
  const paymentAppointmentId = searchParams.get("paymentAppointmentId");

  useEffect(() => {
    if (appointments.status !== "success" || !paymentAppointmentId) return;
    if (handledPaymentAppointmentIdRef.current === paymentAppointmentId) return;
    const target = appointments.data.content.find(
      (appointment) => appointment.id === paymentAppointmentId || appointment.bookingCode === paymentAppointmentId,
    );
    if (!target) return;
    handledPaymentAppointmentIdRef.current = paymentAppointmentId;
    const timer = window.setTimeout(() => void handleChoosePayment(target), 0);
    return () => window.clearTimeout(timer);
  }, [appointments, handleChoosePayment, paymentAppointmentId]);

  const requestedPaymentMissing = Boolean(
    paymentAppointmentId
      && appointments.status === "success"
      && !appointments.data.content.some(
        (appointment) => appointment.id === paymentAppointmentId || appointment.bookingCode === paymentAppointmentId,
      ),
  );
  const visiblePaymentNotice = paymentNotice
    ?? (requestedPaymentMissing
      ? { kind: "error" as const, message: "Lịch hẹn chưa được liên kết với tài khoản này. Hãy đăng nhập bằng đúng email đã nhận OTP." }
      : null);

  useEffect(() => {
    if (appointments.status !== "success") return;
    if (!appointmentId || handledAppointmentIdRef.current === appointmentId || selectedAppointment) return;

    const targetAppointment = appointments.data.content.find(
      (appointment) => appointment.id === appointmentId || appointment.bookingCode === appointmentId,
    );
    if (!targetAppointment) return;

    handledAppointmentIdRef.current = appointmentId;
    // The route alias should open the inline reschedule panel once the
    // target appointment has been resolved.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    handleChooseReschedule(targetAppointment);
  }, [appointmentId, appointments, handleChooseReschedule, selectedAppointment]);

  if (authState === "unauthenticated") {
    const nextPath = paymentAppointmentId
      ? `/patient/dashboard?paymentAppointmentId=${encodeURIComponent(paymentAppointmentId)}#appointments`
      : "/patient/dashboard";
    return <main className="portal-entry"><LoginRequiredState nextPath={nextPath} /></main>;
  }
  if (authState === "forbidden" || !user) {
    return (
      <main className="portal-entry">
        <ForbiddenState description="Tài khoản hiện tại không có vai trò bệnh nhân." title="Không thể mở cổng bệnh nhân">
          <Link className="outline-button outline-button--small" href="/">Về trang chính</Link>
        </ForbiddenState>
      </main>
    );
  }

  const unreadCount = notifications.status === "success"
    ? notifications.data.content.filter((notification) => !notification.read).length
    : null;

  const handleMarkAsRead = async (notification: Notification) => {
    if (notification.read) return;
    setNotificationAction(notification.id);
    setNotificationError(null);
    try {
      await markNotificationAsRead(notification.id);
      setNotifications((current) => current.status === "success"
        ? {
            status: "success",
            data: {
              ...current.data,
              content: current.data.content.map((item) => item.id === notification.id ? { ...item, read: true } : item),
            },
          }
        : current);
    } catch (error) {
      setNotificationError(getErrorMessage(error));
    } finally {
      setNotificationAction(null);
    }
  };

  const handleMarkAllAsRead = async () => {
    setNotificationAction("all");
    setNotificationError(null);
    try {
      await markAllNotificationsAsRead();
      setNotifications((current) => current.status === "success"
        ? {
            status: "success",
            data: { ...current.data, content: current.data.content.map((item) => ({ ...item, read: true })) },
          }
        : current);
    } catch (error) {
      setNotificationError(getErrorMessage(error));
    } finally {
      setNotificationAction(null);
    }
  };

  const handleSaveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileOperation("saving");
    setProfileNotice(null);
    try {
      const saved = await updatePatientProfile({
        fullName: profileForm.fullName.trim(),
        dateOfBirth: profileForm.dateOfBirth || undefined,
        gender: profileForm.gender || undefined,
        address: profileForm.address.trim() || undefined,
        emergencyContactName: profileForm.emergencyContactName.trim() || undefined,
        emergencyContactPhone: profileForm.emergencyContactPhone.trim() || undefined,
      });
      setProfile({ status: "success", data: saved });
      setProfileNotice("Đã cập nhật hồ sơ cá nhân.");
    } catch (error) {
      setProfileNotice(getErrorMessage(error));
    } finally {
      setProfileOperation("idle");
    }
  };

  const handleLoadSlots = async () => {
    if (!selectedAppointment || !rescheduleDate) return;
    setSlots({ status: "loading" });
    try {
      setSlots({ status: "success", data: await fetchDoctorSlots(selectedAppointment.doctorId, rescheduleDate, selectedAppointment.branchId) });
    } catch (error) {
      setSlots({ status: "error", message: getErrorMessage(error), statusCode: getErrorStatus(error) });
    }
  };

  const handleReschedule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedAppointment || !selectedStartTime) return;
    setRescheduleNotice(null);
    try {
      await rescheduleAppointment(selectedAppointment.bookingCode, {
        appointmentDate: rescheduleDate,
        startTime: selectedStartTime,
        branchId: selectedAppointment.branchId,
      });
      setRescheduleNotice("Đã đổi lịch hẹn thành công.");
      setSelectedAppointment(null);
      setReloadKey((value) => value + 1);
    } catch (error) {
      setRescheduleNotice(getErrorMessage(error));
    }
  };

  const handleDownload = async (result: DiagnosticResult) => {
    if (!result.fileUrl) return;
    setDownloadError(null);
    try {
      await downloadProtectedFile(result.fileUrl, result.testName);
    } catch (error) {
      setDownloadError(getErrorMessage(error));
    }
  };

  // Static regression marker: không dựng dữ liệu mẫu.
  return (
    <PortalChrome role="PATIENT" user={user}>
      <div className="portal-content">
        <header className="portal-hero">
          <div>
            <p className="section-note">CỔNG BỆNH NHÂN</p>
            <h1>Xin chào, {user.displayName}</h1>
            <p>Theo dõi lịch hẹn, hồ sơ khám, đơn thuốc và kết quả của riêng bạn tại một nơi.</p>
          </div>
          <div className="portal-hero__actions">
            <Link className="button button--amber" href="/tra-cuu">Tra cứu lịch hẹn</Link>
            <a className="portal-context-link" href="#notifications">
              <span aria-hidden="true"><UiIcon name="message-square" size={17} /></span>
              <span>{unreadCount === null ? "Thông báo" : `${unreadCount} thông báo chưa đọc`}</span>
            </a>
          </div>
        </header>

        <section aria-label="Tóm tắt dữ liệu sức khỏe" className="portal-summary-grid">
          <a className="portal-summary-card" href="#appointments"><span>Lịch hẹn</span><strong>{countOf(appointments)}</strong><small>Khung giờ đã ghi nhận</small></a>
          <a className="portal-summary-card" href="#records"><span>Hồ sơ khám</span><strong>{countOf(records)}</strong><small>Thông tin lâm sàng</small></a>
          <a className="portal-summary-card" href="#prescriptions"><span>Đơn thuốc</span><strong>{countOf(prescriptions)}</strong><small>Đơn đã được kê</small></a>
          <a className="portal-summary-card" href="#diagnostics"><span>Kết quả</span><strong>{countOf(diagnostics)}</strong><small>Cận lâm sàng</small></a>
        </section>

        <PatientCareHub appointments={appointments} carePlans={carePlans} overview={overview} retry={retry} />

        <section className="portal-panel" aria-labelledby="appointments-title" id="appointments">
          <div className="portal-panel__heading">
            <div>
              <p className="section-note">LỊCH HẸN ĐÃ XÁC THỰC</p>
              <h2 id="appointments-title" tabIndex={-1}>Lịch hẹn của tôi</h2>
            </div>
            <span aria-hidden="true" className="portal-panel__icon"><UiIcon name="calendar" size={20} /></span>
          </div>
          <p className="portal-panel__intro">Xem ngày, giờ, bác sĩ và cơ sở của các cuộc hẹn đã đặt bằng tài khoản này.</p>
          <StateContent
            emptyDescription="Khi bạn đặt lịch thành công, thông tin ngày, giờ, bác sĩ và cơ sở sẽ xuất hiện ở đây."
            emptyTitle="Chưa có lịch hẹn"
            retry={retry}
            state={appointments}
          >
            {(page) => <PortalAppointments activePaymentAppointmentId={selectedPaymentAppointmentId ?? undefined} onPayment={(appointment) => void handleChoosePayment(appointment)} onReschedule={handleChooseReschedule} page={page} viewer="patient" />}
          </StateContent>
          {visiblePaymentNotice ? (
            <p
              aria-live={visiblePaymentNotice.kind === "error" ? "assertive" : "polite"}
              className={`${paymentStyles.notice} ${paymentStyles[visiblePaymentNotice.kind]}`}
              role={visiblePaymentNotice.kind === "error" ? "alert" : "status"}
            >
              {visiblePaymentNotice.message}
            </p>
          ) : null}
          <p aria-live="polite" className={paymentStyles.srOnly} role="status">{copyAnnouncement}</p>
          {payment ? (
            <section aria-label="Thanh toán chuyển khoản" className={paymentStyles.panel} id="patient-payment-panel">
              {payment.status === "loading" ? <LoadingState label="Đang chuẩn bị thông tin chuyển khoản…" /> : null}
              {payment.status === "error" ? <ErrorState message={payment.message} status={payment.statusCode} /> : null}
              {payment.status === "success" ? (
                <>
                  <div className={paymentStyles.heading}>
                    <div>
                      <p className="section-note">CHUYỂN KHOẢN NGÂN HÀNG</p>
                      <h3 id="patient-payment-title" ref={paymentHeadingRef} tabIndex={-1}>Thanh toán lịch {payment.data.bookingCode}</h3>
                    </div>
                    <button aria-label={`Đóng thanh toán lịch ${payment.data.bookingCode}`} className={paymentStyles.closeButton} onClick={closePaymentPanel} type="button">
                      <UiIcon name="x" size={18} />
                      <span>Đóng</span>
                    </button>
                  </div>
                  <div className={paymentStyles.securityNote}>
                    <UiIcon name="shield-check" size={22} />
                    <p>Chỉ chuyển đúng số tiền và nội dung bên dưới. Hệ thống không bao giờ yêu cầu mã OTP ngân hàng hoặc mật khẩu.</p>
                  </div>
                  <div className={paymentStyles.layout}>
                    <figure className={paymentStyles.qrCard}>
                      <div className={paymentStyles.qrFrame}>
                        <Image
                          alt={`VietQR thanh toán ${formatMoney(payment.data.amount)} cho lịch ${payment.data.bookingCode}`}
                          className={paymentStyles.qrImage}
                          draggable={false}
                          height={360}
                          sizes="(max-width: 720px) 82vw, 360px"
                          src={payment.data.qrCodeUrl}
                          unoptimized
                          width={360}
                        />
                      </div>
                      <figcaption>Quét bằng ứng dụng ngân hàng và kiểm tra đúng tên người nhận trước khi xác nhận.</figcaption>
                      <button className={`outline-button outline-button--small ${paymentStyles.downloadButton}`} disabled={paymentQrDownloading} onClick={() => void handleDownloadPaymentQr()} type="button">
                        {paymentQrDownloading ? "Đang tải…" : "Tải mã VietQR"}
                      </button>
                    </figure>

                    <dl className={paymentStyles.details}>
                      <div><dt>Ngân hàng</dt><dd>{payment.data.bankName}</dd></div>
                      <div>
                        <dt>Số tài khoản</dt>
                        <dd className={paymentStyles.valueRow}>
                          <code>{payment.data.bankAccount}</code>
                          <button aria-label={`Sao chép số tài khoản ${payment.data.bankAccount}`} className={paymentStyles.copyButton} onClick={() => void copyPaymentValue("account", "số tài khoản", payment.data.bankAccount)} type="button">{copiedPaymentField === "account" ? "Đã chép" : "Sao chép"}</button>
                        </dd>
                      </div>
                      <div><dt>Chủ tài khoản</dt><dd>{payment.data.accountHolder || "Kiểm tra tên hiển thị trong ứng dụng ngân hàng"}</dd></div>
                      <div>
                        <dt>Số tiền</dt>
                        <dd className={`${paymentStyles.valueRow} ${paymentStyles.amount}`}>
                          <strong>{formatMoney(payment.data.amount)}</strong>
                          <button aria-label={`Sao chép số tiền ${payment.data.amount} đồng`} className={paymentStyles.copyButton} onClick={() => void copyPaymentValue("amount", "số tiền", String(payment.data.amount))} type="button">{copiedPaymentField === "amount" ? "Đã chép" : "Sao chép"}</button>
                        </dd>
                      </div>
                      <div className={paymentStyles.detailWide}>
                        <dt>Nội dung chuyển khoản</dt>
                        <dd className={paymentStyles.valueRow}>
                          <code>{payment.data.transferContent}</code>
                          <button aria-label={`Sao chép nội dung chuyển khoản ${payment.data.transferContent}`} className={paymentStyles.copyButton} onClick={() => void copyPaymentValue("content", "nội dung chuyển khoản", payment.data.transferContent)} type="button">{copiedPaymentField === "content" ? "Đã chép" : "Sao chép"}</button>
                        </dd>
                      </div>
                      {payment.data.transactionReference ? <div><dt>Mã giao dịch đã gửi</dt><dd><code>{payment.data.transactionReference}</code></dd></div> : null}
                      <div>
                        <dt>Trạng thái</dt>
                        <dd><span aria-label={`Trạng thái thanh toán: ${formatPaymentStatus(payment.data.status)}`} className={paymentStyles.status} data-status={payment.data.status}>{formatPaymentStatus(payment.data.status)}</span></dd>
                      </div>
                    </dl>
                  </div>

                  {isPollablePaymentStatus(payment.data.status) ? (
                    <div aria-live="polite" className={paymentStyles.polling} role="status">
                      <UiIcon name="clock" size={19} />
                      <span>{payment.data.status === "PENDING_VERIFICATION" ? "Giao dịch đã được ghi nhận và đang chờ admin kiểm tra, phê duyệt." : "Sau khi bạn gửi mã giao dịch, giao dịch sẽ chờ admin đối soát trước khi được xác nhận."}</span>
                      <button className={paymentStyles.refreshButton} disabled={paymentRefreshing} onClick={() => void handleRefreshPayment()} type="button">{paymentRefreshing ? "Đang kiểm tra…" : "Kiểm tra ngay"}</button>
                    </div>
                  ) : null}

                  {payment.data.status === "PAID" ? <p className={paymentStyles.successCard}><UiIcon name="check" size={20} /> Khoản thanh toán đã được xác nhận.</p> : null}

                  {payment.data.status === "REJECTED" ? (
                    <div aria-labelledby="payment-rejected-title" className={paymentStyles.rejectedGuide} role="alert">
                      <h4 id="payment-rejected-title"><UiIcon name="alert-triangle" size={20} /> Thanh toán cần kiểm tra lại</h4>
                      {payment.data.rejectionReason ? <p><strong>Lý do:</strong> {payment.data.rejectionReason}</p> : null}
                      <ol>
                        <li>Đối chiếu số tiền, nội dung chuyển khoản và mã giao dịch với ứng dụng ngân hàng.</li>
                        <li>Nếu tài khoản đã bị trừ tiền, không chuyển lần thứ hai; nhập lại đúng mã giao dịch hoặc liên hệ cơ sở y tế.</li>
                        <li>Nếu chưa chuyển tiền, quét lại VietQR và dùng chính xác nội dung được hiển thị.</li>
                      </ol>
                    </div>
                  ) : null}

                  {payment.data.status === "UNPAID" || payment.data.status === "REJECTED" ? (
                    <form className={paymentStyles.form} onSubmit={handleSubmitPayment}>
                      <label htmlFor="payment-reference">Mã giao dịch từ ứng dụng ngân hàng</label>
                      <p id="payment-reference-help">Chỉ nhập mã giao dịch sau khi ngân hàng báo chuyển khoản thành công.</p>
                      <input aria-describedby="payment-reference-help" autoComplete="off" id="payment-reference" maxLength={100} minLength={6} onChange={(event) => setPaymentReference(event.target.value)} pattern="[A-Za-z0-9._\-/ ]+" placeholder="Ví dụ: FT123456789" required spellCheck={false} type="text" value={paymentReference} />
                      <button className="button button--primary" disabled={paymentSubmitting} type="submit">{paymentSubmitting ? "Đang gửi…" : payment.data.status === "REJECTED" ? "Gửi lại để đối soát" : "Tôi đã chuyển khoản"}</button>
                    </form>
                  ) : null}

                  {payment.data.status === "PENDING_VERIFICATION" ? <p className={paymentStyles.infoCard}>Bạn có thể rời trang. Trạng thái chỉ chuyển thành “Đã thanh toán” sau khi admin kiểm tra sao kê và phê duyệt.</p> : null}
                  {payment.data.refundReference ? <p className={paymentStyles.successCard}><strong>Mã hoàn tiền:</strong> {payment.data.refundReference}</p> : null}
                </>
              ) : null}
            </section>
          ) : null}
          {selectedAppointment ? (
            <form className="portal-lookup-form" onSubmit={handleReschedule}>
              <div><label htmlFor="reschedule-date">Ngày mới</label><input id="reschedule-date" min={businessDate()} onChange={(event) => { setRescheduleDate(event.target.value); setSlots(null); setSelectedStartTime(""); }} required type="date" value={rescheduleDate} /></div>
              <button className="outline-button outline-button--small" onClick={handleLoadSlots} type="button">Xem giờ trống</button>
              {slots?.status === "loading" ? <LoadingState label="Đang tải giờ trống…" /> : null}
              {slots?.status === "error" ? <ErrorState message={slots.message} status={slots.statusCode} /> : null}
              {slots?.status === "success" ? <div><label htmlFor="reschedule-time">Giờ mới</label><select id="reschedule-time" onChange={(event) => setSelectedStartTime(event.target.value)} required value={selectedStartTime}><option value="">Chọn giờ</option>{slots.data.filter((slot) => slot.available).map((slot) => <option key={`${slot.branchId}-${slot.startTime}`} value={slot.startTime}>{slot.startTime.slice(0, 5)} – {slot.endTime.slice(0, 5)}</option>)}</select></div> : null}
              <button className="button button--primary" disabled={!selectedStartTime} type="submit">Xác nhận đổi lịch</button>
              <button className="text-button" onClick={() => setSelectedAppointment(null)} type="button">Đóng</button>
            </form>
          ) : null}
          {rescheduleNotice ? <p aria-live="polite" className={rescheduleNotice.startsWith("Đã") ? "portal-inline-success" : "portal-inline-error"}>{rescheduleNotice}</p> : null}
        </section>

        <div className="portal-grid portal-grid--main">
          <section aria-labelledby="records-title" className="portal-panel" id="records">
            <div className="portal-panel__heading">
              <div><p className="section-note">HỒ SƠ LÂM SÀNG</p><h2 id="records-title">Lịch sử khám</h2></div>
              <span aria-hidden="true" className="portal-panel__icon"><UiIcon name="activity" size={20} /></span>
            </div>
            <StateContent
              emptyDescription="Khi bác sĩ hoàn tất một lượt khám được liên kết với tài khoản, hồ sơ sẽ xuất hiện ở đây."
              emptyTitle="Chưa có hồ sơ khám"
              retry={retry}
              state={records}
            >
              {(items) => (
                <div className="portal-record-list">
                  {items.map((record) => (
                    <article className="portal-record" key={record.id}>
                      <div className="portal-record__meta"><span>{formatBusinessDateTime(record.createdAt)}</span><span>{record.bookingCode ?? "Không có mã lịch hẹn"}</span></div>
                      <h3>{record.diagnosis || "Chưa ghi nhận chẩn đoán"}</h3>
                      <p className="portal-record__doctor">{record.doctorName}{record.doctorTitle ? ` · ${record.doctorTitle}` : ""}</p>
                      {record.symptomsSummary ? <p><strong>Triệu chứng:</strong> {record.symptomsSummary}</p> : null}
                      {record.treatmentPlan ? <p><strong>Hướng điều trị:</strong> {record.treatmentPlan}</p> : null}
                      {record.followUpDate ? <p className="portal-record__followup"><strong>Tái khám:</strong> {formatBusinessDate(record.followUpDate)}</p> : null}
                    </article>
                  ))}
                </div>
              )}
            </StateContent>
          </section>

          <section aria-labelledby="prescriptions-title" className="portal-panel" id="prescriptions">
            <div className="portal-panel__heading">
              <div><p className="section-note">ĐIỀU TRỊ</p><h2 id="prescriptions-title">Đơn thuốc</h2></div>
              <span aria-hidden="true" className="portal-panel__icon"><UiIcon name="book-open" size={20} /></span>
            </div>
            <StateContent
              emptyDescription="Đơn thuốc được kê trong hồ sơ khám sẽ hiển thị ở đây."
              emptyTitle="Chưa có đơn thuốc"
              retry={retry}
              state={prescriptions}
            >
              {(items) => (
                <div className="portal-record-list">
                  {items.map((prescription) => (
                    <article className="portal-record" key={prescription.id}>
                      <div className="portal-record__meta"><span>{prescription.prescriptionCode}</span><span>{formatBusinessDateTime(prescription.createdAt)}</span></div>
                      <h3>{prescription.diagnosisSummary || "Đơn thuốc theo hồ sơ khám"}</h3>
                      <p className="portal-record__doctor">Bác sĩ: {prescription.doctorName} · {formatPrescriptionStatus(prescription.status)}</p>
                      <ul className="portal-medication-list">
                        {prescription.items.map((item) => (
                          <li key={`${prescription.id}-${item.medicationName}`}>
                            <strong>{item.medicationName}</strong>
                            <span>{item.dosage} · {item.frequency} · {item.durationDays} ngày · {item.totalQuantity} {item.unit ?? "đơn vị"}</span>
                            {item.usageNote ? <small>{item.usageNote}</small> : null}
                          </li>
                        ))}
                      </ul>
                      {prescription.generalAdvice ? <p><strong>Dặn dò:</strong> {prescription.generalAdvice}</p> : null}
                    </article>
                  ))}
                </div>
              )}
            </StateContent>
          </section>
        </div>

        <section aria-labelledby="diagnostics-title" className="portal-panel" id="diagnostics">
          <div className="portal-panel__heading">
            <div><p className="section-note">CẬN LÂM SÀNG</p><h2 id="diagnostics-title">Kết quả chẩn đoán</h2></div>
            <span aria-hidden="true" className="portal-panel__icon"><UiIcon name="activity" size={20} /></span>
          </div>
          {downloadError ? <p aria-live="assertive" className="portal-inline-error" role="alert">{downloadError}</p> : null}
          <StateContent
            emptyDescription="Kết quả được liên kết với hồ sơ bệnh nhân sẽ hiển thị sau khi cơ sở y tế cập nhật."
            emptyTitle="Chưa có kết quả chẩn đoán"
            retry={retry}
            state={diagnostics}
          >
            {(items) => (
              <div className="portal-diagnostic-grid">
                {items.map((result) => (
                  <article className="portal-diagnostic" key={result.id}>
                    <div className="portal-record__meta"><span>{formatBusinessDate(result.testDate)}</span><span>{result.doctorName ?? "Chưa có bác sĩ"}</span></div>
                    <h3>{result.testName}</h3>
                    <p>{result.result}</p>
                    {result.fileUrl ? <button className="text-button" onClick={() => handleDownload(result)} type="button">Tải tệp kết quả</button> : <small>Chưa có tệp đính kèm.</small>}
                  </article>
                ))}
              </div>
            )}
          </StateContent>
        </section>

        <section aria-labelledby="notifications-title" className="portal-panel" id="notifications">
          <div className="portal-panel__heading">
            <div><p className="section-note">CẬP NHẬT</p><h2 id="notifications-title">Thông báo</h2></div>
            {unreadCount ? <button className="text-button" disabled={notificationAction === "all"} onClick={handleMarkAllAsRead} type="button">Đánh dấu đã đọc</button> : null}
          </div>
          {notificationError ? <p aria-live="assertive" className="portal-inline-error" role="alert">{notificationError}</p> : null}
          <StateContent
            emptyDescription="Thông báo xác nhận, nhắc lịch hoặc cập nhật kết quả sẽ xuất hiện ở đây."
            emptyTitle="Chưa có thông báo"
            retry={retry}
            state={notifications}
          >
            {(page) => (
              <div className="portal-notification-list">
                {page.content.map((notification) => (
                  <article className={notification.read ? "portal-notification" : "portal-notification portal-notification--unread"} key={notification.id}>
                    <div className="portal-notification__copy">
                      <div className="portal-record__meta"><span>{formatNotificationType(notification.eventType)}</span><span>{formatBusinessDateTime(notification.createdAt)}</span></div>
                      <h3>{notification.title}</h3>
                      <p>{notification.message}</p>
                    </div>
                    {!notification.read ? <button className="outline-button outline-button--small" disabled={notificationAction === notification.id} onClick={() => handleMarkAsRead(notification)} type="button">{notificationAction === notification.id ? "Đang lưu..." : "Đã đọc"}</button> : <span className="portal-read-label">Đã đọc</span>}
                  </article>
                ))}
              </div>
            )}
          </StateContent>
        </section>

        <section aria-labelledby="profile-title" className="portal-panel portal-panel--secondary" id="profile">
          <div className="portal-panel__heading"><div><h2 id="profile-title">Hồ sơ bệnh nhân</h2></div></div>
          <StateContent retry={retry} state={profile}>
            {() => (
              <form className="portal-clinical-form" onSubmit={handleSaveProfile}>
                <div className="portal-clinical-form__grid">
                  <label>Họ và tên *<input required maxLength={160} onChange={(event) => setProfileForm((value) => ({ ...value, fullName: event.target.value }))} value={profileForm.fullName} /></label>
                  <label>Ngày sinh<input onChange={(event) => setProfileForm((value) => ({ ...value, dateOfBirth: event.target.value }))} type="date" value={profileForm.dateOfBirth} /></label>
                  <label>Giới tính<select onChange={(event) => setProfileForm((value) => ({ ...value, gender: event.target.value as ProfileForm["gender"] }))} value={profileForm.gender}><option value="">Chưa chọn</option><option value="MALE">Nam</option><option value="FEMALE">Nữ</option><option value="OTHER">Khác</option><option value="UNSPECIFIED">Không xác định</option></select></label>
                  <label>Địa chỉ<input maxLength={500} onChange={(event) => setProfileForm((value) => ({ ...value, address: event.target.value }))} value={profileForm.address} /></label>
                  <label>Người liên hệ khẩn cấp<input maxLength={160} onChange={(event) => setProfileForm((value) => ({ ...value, emergencyContactName: event.target.value }))} value={profileForm.emergencyContactName} /></label>
                  <label>Số điện thoại khẩn cấp<input maxLength={20} onChange={(event) => setProfileForm((value) => ({ ...value, emergencyContactPhone: event.target.value }))} value={profileForm.emergencyContactPhone} /></label>
                </div>
                {profileNotice ? <p aria-live="polite" className={profileNotice.startsWith("Đã") ? "portal-inline-success" : "portal-inline-error"}>{profileNotice}</p> : null}
                <button className="button button--primary" disabled={profileOperation === "saving"} type="submit">{profileOperation === "saving" ? "Đang lưu…" : "Lưu hồ sơ"}</button>
              </form>
            )}
          </StateContent>
        </section>

        <p className="portal-disclaimer">Thông tin trong cổng là dữ liệu do cơ sở y tế trả về. Không tự thay đổi thuốc hoặc kế hoạch điều trị dựa trên giao diện này; hãy liên hệ cơ sở y tế khi cần giải thích.</p>
      </div>
    </PortalChrome>
  );
}
