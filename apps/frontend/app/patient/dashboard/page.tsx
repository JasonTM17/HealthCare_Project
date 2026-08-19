"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import PortalChrome from "../../../components/PortalChrome";
import {
  ApiError,
  clearAuthSession,
  downloadProtectedFile,
  fetchDoctorSlots,
  fetchPatientProfile,
  fetchPatientAppointments,
  fetchNotifications,
  fetchPatientDiagnosticResults,
  fetchPatientMedicalRecords,
  fetchPatientPrescriptions,
  hasRole,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  rescheduleAppointment,
  updatePatientProfile,
  type Page,
} from "../../../lib/api-client";
import { useAuthSession } from "../../../components/useAuthSession";
import type {
  AuthUser,
  PatientPortalAppointment,
  DiagnosticResult,
  MedicalRecord,
  Notification,
  Prescription,
  PatientProfile,
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
import { businessDate, formatBusinessDate, formatBusinessDateTime } from "../../../lib/business-time";

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
  };
  return labels[eventType] ?? "Thông báo mới";
}

function countOf<T>(state: Loadable<T[]> | Loadable<Page<T>>): string {
  if (state.status === "success") {
    return String(Array.isArray(state.data) ? state.data.length : state.data.totalElements);
  }
  return "—";
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

export default function PatientDashboardPage() {
  const session = useAuthSession();
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
  const [profileForm, setProfileForm] = useState<ProfileForm>(EMPTY_PROFILE_FORM);
  const [profileOperation, setProfileOperation] = useState<"idle" | "saving">("idle");
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<PatientPortalAppointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [slots, setSlots] = useState<Loadable<TimeSlot[]> | null>(null);
  const [selectedStartTime, setSelectedStartTime] = useState("");
  const [rescheduleNotice, setRescheduleNotice] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [notificationAction, setNotificationAction] = useState<string | null>(null);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!session || !hasRole(session.user, "PATIENT")) return;
    let cancelled = false;

    Promise.allSettled([
      fetchPatientProfile(),
      fetchPatientAppointments(),
      fetchPatientMedicalRecords(),
      fetchPatientPrescriptions(),
      fetchPatientDiagnosticResults(),
      fetchNotifications(),
    ]).then(([profileResult, appointmentsResult, recordsResult, prescriptionsResult, diagnosticsResult, notificationsResult]) => {
      if (cancelled) return;

      const results = [profileResult, appointmentsResult, recordsResult, prescriptionsResult, diagnosticsResult, notificationsResult];
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
    });

    return () => {
      cancelled = true;
    };
  }, [reloadKey, session]);

  const retry = () => {
    setAppointments(initialAppointments);
    setRecords(initialRecords);
    setPrescriptions(initialPrescriptions);
    setDiagnostics(initialDiagnostics);
    setNotifications(initialNotifications);
    setProfile(initialProfile);
    setReloadKey((value) => value + 1);
  };

  if (authState === "unauthenticated") {
    return <main className="portal-entry"><LoginRequiredState nextPath="/patient/dashboard" /></main>;
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

  const handleChooseReschedule = (appointment: PatientPortalAppointment) => {
    setSelectedAppointment(appointment);
    setRescheduleDate(appointment.appointmentDate);
    setSelectedStartTime("");
    setSlots(null);
    setRescheduleNotice(null);
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
            <span className="portal-demo-label">Thông tin cá nhân được bảo vệ</span>
          </div>
        </header>

        <section aria-label="Tóm tắt dữ liệu sức khỏe" className="portal-summary-grid">
          <a className="portal-summary-card" href="#appointments"><span>Lịch hẹn</span><strong>{countOf(appointments)}</strong><small>Khung giờ đã ghi nhận</small></a>
          <a className="portal-summary-card" href="#records"><span>Hồ sơ khám</span><strong>{countOf(records)}</strong><small>Thông tin lâm sàng</small></a>
          <a className="portal-summary-card" href="#prescriptions"><span>Đơn thuốc</span><strong>{countOf(prescriptions)}</strong><small>Đơn đã được kê</small></a>
          <a className="portal-summary-card" href="#diagnostics"><span>Kết quả</span><strong>{countOf(diagnostics)}</strong><small>Cận lâm sàng</small></a>
          <a className="portal-summary-card" href="#notifications"><span>Thông báo chưa đọc</span><strong>{unreadCount === null ? "—" : unreadCount}</strong><small>Cập nhật dành cho bạn</small></a>
        </section>

        <section aria-labelledby="profile-title" className="portal-panel" id="profile">
          <div className="portal-panel__heading"><div><p className="section-note">THÔNG TIN CÁ NHÂN</p><h2 id="profile-title">Hồ sơ bệnh nhân</h2></div></div>
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

        <section className="portal-panel" aria-labelledby="appointments-title" id="appointments">
          <div className="portal-panel__heading">
            <div>
              <p className="section-note">LỊCH HẸN ĐÃ XÁC THỰC</p>
              <h2 id="appointments-title">Lịch hẹn của tôi</h2>
            </div>
            <span aria-hidden="true" className="portal-panel__icon">◷</span>
          </div>
          <p className="portal-panel__intro">Xem ngày, giờ, bác sĩ và cơ sở của các cuộc hẹn đã đặt bằng tài khoản này.</p>
          <StateContent
            emptyDescription="Khi bạn đặt lịch thành công, thông tin ngày, giờ, bác sĩ và cơ sở sẽ xuất hiện ở đây."
            emptyTitle="Chưa có lịch hẹn"
            retry={retry}
            state={appointments}
          >
            {(page) => <PortalAppointments onReschedule={handleChooseReschedule} page={page} viewer="patient" />}
          </StateContent>
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
              <span aria-hidden="true" className="portal-panel__icon">+</span>
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
              <span aria-hidden="true" className="portal-panel__icon">Rx</span>
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
            <span aria-hidden="true" className="portal-panel__icon">⌁</span>
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
                    {result.fileUrl ? <button className="text-button" onClick={() => handleDownload(result)} type="button">Tải tệp kết quả ↓</button> : <small>Chưa có tệp đính kèm.</small>}
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

        <p className="portal-disclaimer">Thông tin trong cổng là dữ liệu do cơ sở y tế trả về. Không tự thay đổi thuốc hoặc kế hoạch điều trị dựa trên giao diện này; hãy liên hệ cơ sở y tế khi cần giải thích.</p>
      </div>
    </PortalChrome>
  );
}
