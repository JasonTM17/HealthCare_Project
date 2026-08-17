"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import PortalChrome from "../../../components/PortalChrome";
import {
  ApiError,
  clearAuthSession,
  fetchCurrentUser,
  fetchPatientAppointments,
  fetchNotifications,
  fetchPatientDiagnosticResults,
  fetchPatientMedicalRecords,
  fetchPatientPrescriptions,
  hasRole,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  type Page,
} from "../../../lib/api-client";
import { useAuthSession } from "../../../components/useAuthSession";
import type {
  AuthUser,
  AppointmentDetails,
  DiagnosticResult,
  MedicalRecord,
  Notification,
  Prescription,
} from "../../../types/hospital";
import {
  EmptyState,
  ErrorState,
  ForbiddenState,
  LoadingState,
  LoginRequiredState,
} from "../../../components/PortalStates";
import PortalAppointments from "../../../components/PortalAppointments";

type Loadable<T> =
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; message: string; statusCode?: number };

const initialRecords: Loadable<MedicalRecord[]> = { status: "loading" };
const initialAppointments: Loadable<Page<AppointmentDetails>> = { status: "loading" };
const initialPrescriptions: Loadable<Prescription[]> = { status: "loading" };
const initialDiagnostics: Loadable<DiagnosticResult[]> = { status: "loading" };
const initialNotifications: Loadable<Page<Notification>> = { status: "loading" };

function getErrorStatus(error: unknown): number | undefined {
  return error instanceof ApiError ? error.status : undefined;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Dữ liệu chưa thể tải. Vui lòng thử lại.";
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

function formatDate(value: string | null | undefined): string {
  if (!value) return "Chưa có ngày";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(date);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(date);
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
    return <EmptyState description={emptyDescription ?? "Chưa có dữ liệu được máy chủ trả về."} title={emptyTitle ?? "Chưa có dữ liệu"} />;
  }
  if (
    !Array.isArray(state.data) &&
    ((state.data as Partial<Page<unknown>>).empty ||
      (state.data as Partial<Page<unknown>>).content?.length === 0)
  ) {
    return <EmptyState description={emptyDescription ?? "Chưa có dữ liệu được máy chủ trả về."} title={emptyTitle ?? "Chưa có dữ liệu"} />;
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
  const [appointments, setAppointments] = useState<Loadable<Page<AppointmentDetails>>>(initialAppointments);
  const [prescriptions, setPrescriptions] = useState<Loadable<Prescription[]>>(initialPrescriptions);
  const [diagnostics, setDiagnostics] = useState<Loadable<DiagnosticResult[]>>(initialDiagnostics);
  const [notifications, setNotifications] = useState<Loadable<Page<Notification>>>(initialNotifications);
  const [notificationAction, setNotificationAction] = useState<string | null>(null);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!session || !hasRole(session.user, "PATIENT")) return;
    let cancelled = false;

    Promise.allSettled([
      fetchCurrentUser(),
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

  return (
    <PortalChrome role="PATIENT" user={user}>
      <div className="portal-content">
        <header className="portal-hero">
          <div>
            <p className="section-note">CỔNG BỆNH NHÂN</p>
            <h1>Xin chào, {user.displayName}</h1>
            <p>Thông tin dưới đây được tải từ các API đã xác thực và chỉ thuộc về tài khoản hiện tại.</p>
          </div>
          <div className="portal-hero__actions">
            <Link className="button button--amber" href="/tra-cuu">Tra cứu lịch hẹn</Link>
            <span className="portal-demo-label">Bản demo local · lịch hẹn từ API</span>
          </div>
        </header>

        <section aria-label="Tóm tắt dữ liệu sức khỏe" className="portal-summary-grid">
          <a className="portal-summary-card" href="#appointments"><span>Lịch hẹn</span><strong>{countOf(appointments)}</strong><small>Khung giờ đã ghi nhận</small></a>
          <a className="portal-summary-card" href="#records"><span>Hồ sơ khám</span><strong>{countOf(records)}</strong><small>Thông tin lâm sàng</small></a>
          <a className="portal-summary-card" href="#prescriptions"><span>Đơn thuốc</span><strong>{countOf(prescriptions)}</strong><small>Đơn đã được kê</small></a>
          <a className="portal-summary-card" href="#diagnostics"><span>Kết quả</span><strong>{countOf(diagnostics)}</strong><small>Cận lâm sàng</small></a>
          <a className="portal-summary-card" href="#notifications"><span>Thông báo chưa đọc</span><strong>{unreadCount === null ? "—" : unreadCount}</strong><small>Trạng thái trong ứng dụng</small></a>
        </section>

        <section className="portal-panel" aria-labelledby="appointments-title" id="appointments">
          <div className="portal-panel__heading">
            <div>
              <p className="section-note">LỊCH HẸN ĐÃ XÁC THỰC</p>
              <h2 id="appointments-title">Lịch hẹn của tôi</h2>
            </div>
            <span aria-hidden="true" className="portal-panel__icon">◷</span>
          </div>
          <p className="portal-panel__intro">Lịch hẹn được tải từ endpoint bệnh nhân đã xác thực và chỉ thuộc về tài khoản hiện tại. Nếu backend candidate chưa được tích hợp, giao diện giữ nguyên trạng thái lỗi/không khả dụng và không dựng dữ liệu mẫu.</p>
          <StateContent
            emptyDescription="Khi một lịch hẹn được backend liên kết với tài khoản, thông tin ngày, giờ, bác sĩ và cơ sở sẽ xuất hiện ở đây."
            emptyTitle="Chưa có lịch hẹn"
            retry={retry}
            state={appointments}
          >
            {(page) => <PortalAppointments page={page} viewer="patient" />}
          </StateContent>
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
                      <div className="portal-record__meta"><span>{formatDateTime(record.createdAt)}</span><span>{record.bookingCode ?? "Không có mã lịch hẹn"}</span></div>
                      <h3>{record.diagnosis || "Chưa ghi nhận chẩn đoán"}</h3>
                      <p className="portal-record__doctor">{record.doctorName}{record.doctorTitle ? ` · ${record.doctorTitle}` : ""}</p>
                      {record.symptomsSummary ? <p><strong>Triệu chứng:</strong> {record.symptomsSummary}</p> : null}
                      {record.treatmentPlan ? <p><strong>Hướng điều trị:</strong> {record.treatmentPlan}</p> : null}
                      {record.followUpDate ? <p className="portal-record__followup"><strong>Tái khám:</strong> {formatDate(record.followUpDate)}</p> : null}
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
                      <div className="portal-record__meta"><span>{prescription.prescriptionCode}</span><span>{formatDateTime(prescription.createdAt)}</span></div>
                      <h3>{prescription.diagnosisSummary || "Đơn thuốc theo hồ sơ khám"}</h3>
                      <p className="portal-record__doctor">Bác sĩ: {prescription.doctorName} · Trạng thái: {prescription.status}</p>
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
                    <div className="portal-record__meta"><span>{formatDate(result.testDate)}</span><span>{result.doctorName ?? "Chưa có bác sĩ"}</span></div>
                    <h3>{result.testName}</h3>
                    <p>{result.result}</p>
                    {result.fileUrl ? <a className="text-button" href={result.fileUrl} rel="noreferrer" target="_blank">Mở tệp kết quả ↗</a> : <small>Chưa có tệp đính kèm.</small>}
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
                      <div className="portal-record__meta"><span>{notification.eventType}</span><span>{formatDateTime(notification.createdAt)}</span></div>
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
