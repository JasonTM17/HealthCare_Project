"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PortalChrome from "../../../components/PortalChrome";
import { EmptyState, ErrorState, ForbiddenState, LoadingState, LoginRequiredState } from "../../../components/PortalStates";
import { useAuthSession } from "../../../components/useAuthSession";
import {
  ApiError,
  createPatientConsultation,
  fetchPatientAppointments,
  fetchPatientConsultations,
  hasRole,
} from "../../../lib/api-client";
import { presentApiError } from "../../../lib/present-api-error";
import type { ConsultationSummary, PatientPortalAppointment } from "../../../types/hospital";

const ELIGIBLE_APPOINTMENT_STATUSES = new Set(["CONFIRMED", "CHECKED_IN", "COMPLETED"]);

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Đang mở",
  WAITING_FOR_DOCTOR: "Chờ bác sĩ",
  WAITING_FOR_PATIENT: "Chờ bạn",
  RESOLVED: "Đã xử lý",
  CLOSED: "Đã đóng",
  EXPIRED: "Đã hết hạn",
};

const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  CONFIRMED: "Đã xác nhận",
  CHECKED_IN: "Đã tiếp nhận",
  COMPLETED: "Đã hoàn tất",
};

function errorStatus(error: unknown): number | undefined {
  return error instanceof ApiError ? error.status : undefined;
}

function safeDate(value: string | null | undefined, options: Intl.DateTimeFormatOptions = {}): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("vi-VN", options);
}

function statusLabel(value: string): string {
  return STATUS_LABELS[value] ?? "Đang cập nhật";
}

function windowLabel(openUntil: string): string {
  const end = new Date(openUntil);
  if (Number.isNaN(end.getTime())) return "Cửa sổ đang được xác minh";
  const remaining = end.getTime() - Date.now();
  if (remaining <= 0) return `Đã kết thúc · ${safeDate(openUntil)}`;
  const days = Math.ceil(remaining / 86_400_000);
  return days === 1 ? "Còn khoảng 1 ngày" : `Còn khoảng ${days} ngày`;
}

export default function PatientConsultationsPage() {
  const session = useAuthSession();
  const [items, setItems] = useState<ConsultationSummary[]>([]);
  const [consultationsLoading, setConsultationsLoading] = useState(true);
  const [consultationsError, setConsultationsError] = useState<unknown>(null);
  const [consultationsRetry, setConsultationsRetry] = useState(0);
  const [appointments, setAppointments] = useState<PatientPortalAppointment[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(true);
  const [appointmentsError, setAppointmentsError] = useState<unknown>(null);
  const [appointmentsRetry, setAppointmentsRetry] = useState(0);
  const [appointmentId, setAppointmentId] = useState("");
  const [subject, setSubject] = useState("");
  const [consent, setConsent] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<unknown>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!session || !hasRole(session.user, "PATIENT")) return;
    let cancelled = false;
    void Promise.resolve()
      .then(() => {
        if (cancelled) return undefined;
        setConsultationsLoading(true);
        setConsultationsError(null);
        return fetchPatientConsultations();
      })
      .then((value) => {
        if (!cancelled && value) setItems(value);
      })
      .catch((reason) => {
        if (!cancelled) setConsultationsError(reason);
      })
      .finally(() => {
        if (!cancelled) setConsultationsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [consultationsRetry, session]);

  useEffect(() => {
    if (!session || !hasRole(session.user, "PATIENT")) return;
    let cancelled = false;
    void Promise.resolve()
      .then(() => {
        if (cancelled) return undefined;
        setAppointmentsLoading(true);
        setAppointmentsError(null);
        return fetchPatientAppointments(0, 50);
      })
      .then((value) => {
        if (cancelled || !value) return;
        const eligible = value.content.filter((appointment) => ELIGIBLE_APPOINTMENT_STATUSES.has(appointment.status));
        setAppointments(eligible);
        setAppointmentId((current) => eligible.some((appointment) => appointment.id === current) ? current : "");
      })
      .catch((reason) => {
        if (!cancelled) setAppointmentsError(reason);
      })
      .finally(() => {
        if (!cancelled) setAppointmentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [appointmentsRetry, session]);

  const availableAppointments = useMemo(
    () => appointments.filter((appointment) => !items.some((item) => item.appointmentId === appointment.id)),
    [appointments, items],
  );
  const selectedAppointmentId = availableAppointments.some((appointment) => appointment.id === appointmentId)
    ? appointmentId
    : "";

  const create = async () => {
    if (!selectedAppointmentId || !subject.trim() || !consent || creating) return;
    setCreating(true);
    setCreateError(null);
    setNotice("");
    try {
      const created = await createPatientConsultation({
        appointmentId: selectedAppointmentId,
        subject: subject.trim(),
        consentAccepted: true,
        consentVersion: "consultation-v1",
      });
      setItems((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setAppointments((current) => current.filter((appointment) => appointment.id !== selectedAppointmentId));
      setAppointmentId("");
      setSubject("");
      setConsent(false);
      setNotice("Kênh tư vấn đã mở. Bạn có thể gửi câu hỏi cho bác sĩ ngay bây giờ.");
    } catch (reason) {
      setCreateError(reason);
    } finally {
      setCreating(false);
    }
  };

  if (!session) return <LoginRequiredState nextPath="/patient/consultations" />;
  if (!hasRole(session.user, "PATIENT")) {
    return <ForbiddenState title="Không thể mở tư vấn" description="Kênh tư vấn riêng chỉ dành cho bệnh nhân đã đăng nhập." />;
  }

  return (
    <PortalChrome role="PATIENT" user={session.user}>
      <div className="section-inner portal-page">
        <header className="portal-hero">
          <div>
            <p className="section-note">KÊNH TRAO ĐỔI RIÊNG</p>
            <h1>Tư vấn cùng bác sĩ</h1>
            <p>
              Hỏi thêm sau lịch hẹn trong cửa sổ được bệnh viện cấp. Đây là kênh người–bác sĩ,
              không phải chatbot và không dùng cho cấp cứu.
            </p>
          </div>
          <div className="portal-hero__actions">
            <Link className="button button--primary" href="/patient/dashboard#appointments">Mở lịch hẹn</Link>
            <span className="portal-demo-label">Nội dung giữ tối đa 90 ngày</span>
          </div>
        </header>

        <section className="portal-panel portal-panel--notice" aria-label="Lưu ý an toàn">
          <p className="section-note">AN TOÀN VÀ RIÊNG TƯ</p>
          <p className="portal-panel__intro">
            Chỉ bạn và bác sĩ được phân công/handoff hợp lệ có thể đọc nội dung. Không gửi thông tin cấp cứu;
            nếu nguy hiểm tức thời, hãy gọi <a href="tel:115">115</a>.
          </p>
        </section>

        <section className="portal-panel" aria-labelledby="new-consultation-title">
          <div className="portal-panel__heading">
            <div>
              <p className="section-note">MỞ KÊNH MỚI</p>
              <h2 id="new-consultation-title">Tư vấn sau lịch hẹn</h2>
            </div>
            <span className="portal-panel__icon" aria-hidden="true">+</span>
          </div>
          <p className="portal-panel__intro">
            Chọn một lịch đã xác nhận, đã tiếp nhận hoặc đã hoàn tất. Mỗi lịch hẹn chỉ mở được một kênh; cửa sổ trao đổi kéo dài đến 30 ngày sau buổi khám.
          </p>
          {appointmentsLoading ? <LoadingState label="Đang tải lịch hẹn đủ điều kiện…" /> : null}
          {appointmentsError ? (
            <ErrorState
              message="Không thể tải lịch hẹn đủ điều kiện."
              status={errorStatus(appointmentsError)}
              onRetry={() => setAppointmentsRetry((value) => value + 1)}
            />
          ) : null}
          {!appointmentsLoading && !appointmentsError && availableAppointments.length > 0 ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-1 text-sm font-bold" htmlFor="consultation-appointment">
                  Lịch hẹn
                  <select
                    id="consultation-appointment"
                    className="min-h-11 rounded-lg border border-slate-300 px-3"
                    onChange={(event) => setAppointmentId(event.target.value)}
                    value={selectedAppointmentId}
                  >
                    <option value="">Chọn lịch hẹn</option>
                    {availableAppointments.map((appointment) => (
                      <option key={appointment.id} value={appointment.id}>
                        {safeDate(appointment.appointmentDate)} · {appointment.doctorName} · {APPOINTMENT_STATUS_LABELS[appointment.status] ?? "Đủ điều kiện"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-bold" htmlFor="consultation-subject">
                  Chủ đề
                  <input
                    id="consultation-subject"
                    className="min-h-11 rounded-lg border border-slate-300 px-3"
                    maxLength={240}
                    onChange={(event) => setSubject(event.target.value)}
                    placeholder="Ví dụ: Hỏi thêm sau buổi khám"
                    value={subject}
                  />
                </label>
              </div>
              <label className="mt-4 flex min-h-11 items-start gap-3 text-sm text-slate-700" htmlFor="consultation-consent">
                <input
                  id="consultation-consent"
                  checked={consent}
                  className="mt-1 h-5 w-5"
                  onChange={(event) => setConsent(event.target.checked)}
                  type="checkbox"
                />
                <span>Tôi đồng ý lưu nội dung tư vấn trong 90 ngày để bác sĩ xử lý. Đây không phải kênh cấp cứu hay chatbot chẩn đoán.</span>
              </label>
              {createError ? (
                <p aria-live="assertive" className="error-banner mt-4" role="alert">
                  {presentApiError(createError instanceof ApiError ? createError.code : null, errorStatus(createError))}
                </p>
              ) : null}
              {notice ? <p aria-live="polite" className="catalog-status mt-4" role="status">{notice}</p> : null}
              <button
                className="button button--primary mt-4"
                disabled={creating || !selectedAppointmentId || !subject.trim() || !consent}
                onClick={() => void create()}
                type="button"
              >
                {creating ? "Đang mở kênh…" : "Mở tư vấn riêng"}
              </button>
            </>
          ) : null}
          {!appointmentsLoading && !appointmentsError && availableAppointments.length === 0 ? (
            <EmptyState
              title="Chưa có lịch đủ điều kiện"
              description="Kênh mới chỉ mở từ lịch đã xác nhận, đã tiếp nhận hoặc đã hoàn tất."
              action={{ href: "/patient/dashboard#appointments", label: "Xem lịch hẹn" }}
            />
          ) : null}
        </section>

        <section aria-labelledby="consultation-list-title">
          <div className="portal-panel__heading">
            <div>
              <p className="section-note">KÊNH CỦA BẠN</p>
              <h2 id="consultation-list-title">Các cuộc trao đổi</h2>
            </div>
            {!consultationsLoading && !consultationsError ? <span className="section-note">{items.length} kênh</span> : null}
          </div>
          {consultationsLoading ? <LoadingState label="Đang tải danh sách tư vấn…" /> : null}
          {consultationsError ? (
            <ErrorState
              message="Không thể tải danh sách tư vấn."
              status={errorStatus(consultationsError)}
              onRetry={() => setConsultationsRetry((value) => value + 1)}
            />
          ) : null}
          {!consultationsLoading && !consultationsError && items.length === 0 ? (
            <EmptyState
              title="Chưa có cuộc trao đổi"
              description="Kênh tư vấn sẽ xuất hiện tại đây sau khi bạn mở từ một lịch đủ điều kiện."
            />
          ) : null}
          {!consultationsLoading && !consultationsError && items.length > 0 ? (
            <div className="portal-grid portal-grid--main" aria-live="polite">
              {items.map((item) => (
                <Link
                  className="portal-panel"
                  href={`/patient/consultations/${item.id}`}
                  key={item.id}
                  aria-label={`Mở tư vấn ${item.subject}`}
                >
                  <div className="portal-panel__heading">
                    <div>
                      <p className="section-note">{statusLabel(item.status)}</p>
                      <h3>{item.subject}</h3>
                    </div>
                    <span className="portal-panel__icon" aria-hidden="true">↗</span>
                  </div>
                  <p>Bác sĩ {item.doctorName ?? "được phân công"}</p>
                  <p className="portal-panel__intro">
                    Cửa sổ đến {safeDate(item.openUntil)} · {windowLabel(item.openUntil)}
                  </p>
                  <p className="portal-panel__intro" aria-label={item.unreadCount ? `${item.unreadCount} tin chưa đọc` : "Đã đọc hết tin nhắn"}>
                    {item.unreadCount > 0 ? <strong>{item.unreadCount} tin chưa đọc</strong> : "Đã đọc hết tin nhắn"}
                    {item.updatedAt ? ` · Cập nhật ${safeDate(item.updatedAt)}` : ""}
                  </p>
                </Link>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </PortalChrome>
  );
}
