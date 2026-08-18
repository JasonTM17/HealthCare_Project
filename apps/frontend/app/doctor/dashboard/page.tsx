"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import PortalChrome from "../../../components/PortalChrome";
import {
  ApiError,
  clearAuthSession,
  createMedicalRecord,
  fetchDoctorAppointments,
  fetchDoctorProfile,
  fetchDoctorPatientDiagnosticResults,
  fetchDoctorPatientMedicalRecords,
  hasRole,
  type Page,
} from "../../../lib/api-client";
import type { Doctor, DoctorPortalAppointment, AuthUser, DiagnosticResult, MedicalRecord } from "../../../types/hospital";
import { EmptyState, ErrorState, ForbiddenState, LoadingState, LoginRequiredState } from "../../../components/PortalStates";
import PortalAppointments from "../../../components/PortalAppointments";
import { useAuthSession } from "../../../components/useAuthSession";

type LookupState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; message: string; statusCode?: number };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const APPOINTMENT_STATUSES = [
  ["", "Tất cả trạng thái"],
  ["PENDING_CONFIRMATION", "Chờ xác nhận"],
  ["CONFIRMED", "Đã xác nhận"],
  ["CHECKED_IN", "Đã tiếp nhận"],
  ["IN_PROGRESS", "Đang khám"],
  ["COMPLETED", "Đã hoàn tất"],
  ["CANCELLED", "Đã hủy"],
  ["NO_SHOW", "Không đến"],
] as const;

interface ClinicalFormValues {
  appointmentId: string;
  patientId: string;
  diagnosis: string;
  symptomsSummary: string;
  treatmentPlan: string;
  doctorNotes: string;
  followUpDate: string;
  medicationName: string;
  dosage: string;
  unit: string;
  frequency: string;
  durationDays: string;
  totalQuantity: string;
  usageNote: string;
  prescriptionAdvice: string;
}

const EMPTY_CLINICAL_FORM: ClinicalFormValues = {
  appointmentId: "",
  patientId: "",
  diagnosis: "",
  symptomsSummary: "",
  treatmentPlan: "",
  doctorNotes: "",
  followUpDate: "",
  medicationName: "",
  dosage: "",
  unit: "",
  frequency: "",
  durationDays: "",
  totalQuantity: "",
  usageNote: "",
  prescriptionAdvice: "",
};

function getErrorStatus(error: unknown): number | undefined {
  return error instanceof ApiError ? error.status : undefined;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Dữ liệu chưa thể tải. Vui lòng thử lại.";
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Chưa có ngày";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(date);
}

function getTodayIsoDate(): string {
  const now = new Date();
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localNow.toISOString().slice(0, 10);
}

function renderLookupState<T>(
  state: LookupState<T[]>,
  emptyTitle: string,
  emptyDescription: string,
  retry: () => void,
  children: (data: T[]) => ReactNode,
) {
  if (state.status === "idle") return <EmptyState description={emptyDescription} title={emptyTitle} />;
  if (state.status === "loading") return <LoadingState />;
  if (state.status === "error") return <ErrorState message={state.message} onRetry={retry} status={state.statusCode} />;
  if (state.data.length === 0) return <EmptyState description={emptyDescription} title={emptyTitle} />;
  return children(state.data);
}

function renderDailyAppointments(
  state: LookupState<Page<DoctorPortalAppointment>>,
  retry: () => void,
  onSelectAppointment?: (appointment: DoctorPortalAppointment) => void,
) {
  if (state.status === "idle") {
    return <EmptyState description="Chọn ngày để tải lịch hẹn được backend cho phép xem." title="Chưa chọn lịch" />;
  }
  if (state.status === "loading") return <LoadingState label="Đang tải lịch hẹn trong ngày..." />;
  if (state.status === "error") {
    return <ErrorState message={state.message} onRetry={retry} status={state.statusCode} />;
  }
  if (state.data.empty || state.data.content.length === 0) {
    return <EmptyState description="Không có lịch hẹn thuộc ngày và trạng thái đã chọn." title="Ngày này chưa có lịch hẹn" />;
  }
  return <PortalAppointments onSelectAppointment={onSelectAppointment} page={state.data} viewer="doctor" />;
}

export default function DoctorDashboardPage() {
  const session = useAuthSession();
  const user: AuthUser | null = session?.user ?? null;
  const authState: "ready" | "unauthenticated" | "forbidden" = !session
    ? "unauthenticated"
    : hasRole(session.user, "DOCTOR")
      ? "ready"
      : "forbidden";
  const [patientId, setPatientId] = useState("");
  const [activePatientId, setActivePatientId] = useState<string | null>(null);
  const [records, setRecords] = useState<LookupState<MedicalRecord[]>>({ status: "idle" });
  const [diagnostics, setDiagnostics] = useState<LookupState<DiagnosticResult[]>>({ status: "idle" });
  const [dailyDate, setDailyDate] = useState(getTodayIsoDate);
  const [dailyStatus, setDailyStatus] = useState("");
  const [dailyAppointments, setDailyAppointments] = useState<LookupState<Page<DoctorPortalAppointment>>>({ status: "loading" });
  const [dailyReloadKey, setDailyReloadKey] = useState(0);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [doctorProfile, setDoctorProfile] = useState<LookupState<Doctor>>({ status: "loading" });
  const [clinicalForm, setClinicalForm] = useState<ClinicalFormValues>(EMPTY_CLINICAL_FORM);
  const [clinicalOperation, setClinicalOperation] = useState<"idle" | "saving">("idle");
  const [clinicalError, setClinicalError] = useState<string | null>(null);
  const [clinicalNotice, setClinicalNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!session || !hasRole(session.user, "DOCTOR")) return;
    let cancelled = false;

    fetchDoctorAppointments(dailyDate, dailyStatus || undefined).then((page) => {
      if (!cancelled) setDailyAppointments({ status: "success", data: page });
    }).catch((error: unknown) => {
      if (cancelled) return;
      if (getErrorStatus(error) === 401) {
        clearAuthSession();
        return;
      }
      setDailyAppointments({
        status: "error",
        message: getErrorMessage(error),
        statusCode: getErrorStatus(error),
      });
    });

    return () => {
      cancelled = true;
    };
  }, [dailyDate, dailyReloadKey, dailyStatus, session]);

  useEffect(() => {
    if (!session || !hasRole(session.user, "DOCTOR")) return;
    let cancelled = false;
    fetchDoctorProfile().then((profile) => {
      if (!cancelled) setDoctorProfile({ status: "success", data: profile });
    }).catch((error: unknown) => {
      if (!cancelled) setDoctorProfile({ status: "error", message: getErrorMessage(error), statusCode: getErrorStatus(error) });
    });
    return () => { cancelled = true; };
  }, [session]);

  const loadPatient = async (requestedPatientId: string) => {
    setLookupError(null);
    setActivePatientId(requestedPatientId);
    setRecords({ status: "loading" });
    setDiagnostics({ status: "loading" });

    const [recordsResult, diagnosticsResult] = await Promise.allSettled([
      fetchDoctorPatientMedicalRecords(requestedPatientId),
      fetchDoctorPatientDiagnosticResults(requestedPatientId),
    ]);
    const results = [recordsResult, diagnosticsResult];
    const unauthorized = results.some((result) => result.status === "rejected" && getErrorStatus(result.reason) === 401);
    if (unauthorized) {
      clearAuthSession();
      return;
    }

    setRecords(recordsResult.status === "fulfilled"
      ? { status: "success", data: recordsResult.value }
      : { status: "error", message: getErrorMessage(recordsResult.reason), statusCode: getErrorStatus(recordsResult.reason) });
    setDiagnostics(diagnosticsResult.status === "fulfilled"
      ? { status: "success", data: diagnosticsResult.value }
      : { status: "error", message: getErrorMessage(diagnosticsResult.reason), statusCode: getErrorStatus(diagnosticsResult.reason) });
  };

  const handleLookup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const requestedPatientId = patientId.trim();
    if (!UUID_PATTERN.test(requestedPatientId)) {
      setLookupError("Nhập đúng patient ID dạng UUID do quy trình được cấp quyền cung cấp.");
      return;
    }
    await loadPatient(requestedPatientId);
  };

  const handleSelectAppointment = (appointment: DoctorPortalAppointment): void => {
    setClinicalForm((current) => ({
      ...current,
      appointmentId: appointment.id,
      patientId: appointment.patientId,
    }));
    setClinicalError(null);
    setClinicalNotice(`Đã chọn lịch ${appointment.bookingCode} của ${appointment.patientName}.`);
    window.setTimeout(() => document.getElementById("clinical-entry")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  const updateClinicalForm = (field: keyof ClinicalFormValues, value: string): void => {
    setClinicalForm((current) => ({ ...current, [field]: value }));
    setClinicalError(null);
  };

  const handleCreateClinicalRecord = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setClinicalError(null);
    setClinicalNotice(null);
    if (doctorProfile.status !== "success") {
      setClinicalError("Chưa tải được hồ sơ bác sĩ; chưa thể gửi kết quả khám.");
      return;
    }
    if (!clinicalForm.appointmentId || !clinicalForm.patientId) {
      setClinicalError("Hãy chọn một lịch hẹn từ danh sách đã xác thực trước khi ghi nhận kết quả.");
      return;
    }
    const medicationFields = [clinicalForm.medicationName, clinicalForm.dosage, clinicalForm.frequency, clinicalForm.durationDays, clinicalForm.totalQuantity];
    const hasMedication = medicationFields.some((value) => value.trim().length > 0);
    if (hasMedication && medicationFields.some((value) => value.trim().length === 0)) {
      setClinicalError("Nếu kê thuốc, hãy điền đủ tên thuốc, liều dùng, tần suất, số ngày và tổng số lượng.");
      return;
    }
    setClinicalOperation("saving");
    try {
      await createMedicalRecord({
        appointmentId: clinicalForm.appointmentId,
        patientId: clinicalForm.patientId,
        doctorId: doctorProfile.data.id,
        diagnosis: clinicalForm.diagnosis.trim(),
        symptomsSummary: clinicalForm.symptomsSummary.trim() || undefined,
        treatmentPlan: clinicalForm.treatmentPlan.trim() || undefined,
        doctorNotes: clinicalForm.doctorNotes.trim() || undefined,
        followUpDate: clinicalForm.followUpDate || undefined,
        prescriptionItems: hasMedication ? [{
          medicationName: clinicalForm.medicationName.trim(),
          dosage: clinicalForm.dosage.trim(),
          unit: clinicalForm.unit.trim() || "Viên",
          frequency: clinicalForm.frequency.trim(),
          durationDays: Number(clinicalForm.durationDays),
          totalQuantity: Number(clinicalForm.totalQuantity),
          usageNote: clinicalForm.usageNote.trim() || undefined,
        }] : undefined,
        prescriptionAdvice: clinicalForm.prescriptionAdvice.trim() || undefined,
      });
      setClinicalForm(EMPTY_CLINICAL_FORM);
      setClinicalNotice("Đã ghi nhận kết quả khám. Lịch hẹn đã được backend chuyển sang hoàn tất; cổng bệnh nhân sẽ đọc bản cập nhật từ API.");
      setDailyReloadKey((value) => value + 1);
      await loadPatient(clinicalForm.patientId);
    } catch (error: unknown) {
      setClinicalError(getErrorMessage(error));
    } finally {
      setClinicalOperation("idle");
    }
  };

  if (authState === "unauthenticated") {
    return <main className="portal-entry"><LoginRequiredState nextPath="/doctor/dashboard" /></main>;
  }
  if (authState === "forbidden" || !user) {
    return (
      <main className="portal-entry">
        <ForbiddenState description="Tài khoản hiện tại không có vai trò bác sĩ." title="Không thể mở cổng bác sĩ">
          <Link className="outline-button outline-button--small" href="/">Về trang chính</Link>
        </ForbiddenState>
      </main>
    );
  }

  const retry = () => {
    if (activePatientId) void loadPatient(activePatientId);
  };

  const retryDailyAppointments = () => {
    setDailyAppointments({ status: "loading" });
    setDailyReloadKey((value) => value + 1);
  };

  return (
    <PortalChrome role="DOCTOR" user={user}>
      <div className="portal-content">
        <header className="portal-hero">
          <div>
            <p className="section-note">CỔNG BÁC SĨ</p>
            <h1>Không gian làm việc lâm sàng</h1>
            <p>Chỉ dữ liệu bệnh nhân mà backend xác nhận có quan hệ lâm sàng với tài khoản này mới được hiển thị.</p>
          </div>
          <span className="portal-demo-label">Bản demo local · lịch hẹn từ API</span>
        </header>

        <section aria-labelledby="daily-title" className="portal-panel" id="daily-appointments">
          <div className="portal-panel__heading">
            <div><p className="section-note">LỊCH HẸN ĐÃ XÁC THỰC</p><h2 id="daily-title">Lịch làm việc theo ngày</h2></div>
            <span aria-hidden="true" className="portal-panel__icon">◷</span>
          </div>
          <p className="portal-panel__intro">Chỉ lịch hẹn được backend xác nhận thuộc hồ sơ bác sĩ hiện tại mới được hiển thị. Khi candidate chưa được tích hợp, giao diện giữ trạng thái lỗi/không khả dụng và không tạo lịch giả.</p>
          <form className="portal-lookup-form" onSubmit={(event) => { event.preventDefault(); retryDailyAppointments(); }}>
            <div>
              <label htmlFor="daily-appointment-date">Ngày xem lịch</label>
              <input id="daily-appointment-date" onChange={(event) => { setDailyAppointments({ status: "loading" }); setDailyDate(event.target.value); }} required type="date" value={dailyDate} />
            </div>
            <div>
              <label htmlFor="daily-appointment-status">Trạng thái</label>
              <select id="daily-appointment-status" onChange={(event) => { setDailyAppointments({ status: "loading" }); setDailyStatus(event.target.value); }} value={dailyStatus}>
                {APPOINTMENT_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <button className="button button--primary" type="submit">Tải lịch</button>
          </form>
          {renderDailyAppointments(dailyAppointments, retryDailyAppointments, handleSelectAppointment)}
        </section>

        <section aria-labelledby="clinical-entry-title" className="portal-panel" id="clinical-entry">
          <div className="portal-panel__heading">
            <div><p className="section-note">DOCTOR WRITE CONTRACT</p><h2 id="clinical-entry-title">Ghi nhận kết quả khám</h2></div>
            <span aria-hidden="true" className="portal-panel__icon">+</span>
          </div>
          <p className="portal-panel__intro">Chọn lịch hẹn từ danh sách phía trên để liên kết patient, appointment và bác sĩ. Backend vẫn kiểm tra vai trò, quan hệ lâm sàng, trạng thái lịch và chống ghi trùng.</p>
          {doctorProfile.status === "loading" ? <LoadingState label="Đang tải hồ sơ bác sĩ…" /> : null}
          {doctorProfile.status === "error" ? <ErrorState message={doctorProfile.message} status={doctorProfile.statusCode} /> : null}
          {doctorProfile.status === "success" ? (
            <form className="portal-clinical-form" onSubmit={handleCreateClinicalRecord}>
              <div className="portal-clinical-form__context">
                <label>Patient ID<input readOnly value={clinicalForm.patientId} /></label>
                <label>Appointment ID<input readOnly value={clinicalForm.appointmentId} /></label>
              </div>
              {!clinicalForm.appointmentId ? <p className="portal-handoff-note">Chưa chọn lịch hẹn. Hãy bấm “Ghi nhận kết quả khám” trên một lịch hợp lệ.</p> : null}
              <label>Chẩn đoán *<input required maxLength={4000} onChange={(event) => updateClinicalForm("diagnosis", event.target.value)} value={clinicalForm.diagnosis} /></label>
              <label>Triệu chứng<textarea maxLength={4000} onChange={(event) => updateClinicalForm("symptomsSummary", event.target.value)} value={clinicalForm.symptomsSummary} /></label>
              <div className="portal-clinical-form__grid">
                <label>Kế hoạch điều trị<textarea maxLength={4000} onChange={(event) => updateClinicalForm("treatmentPlan", event.target.value)} value={clinicalForm.treatmentPlan} /></label>
                <label>Ghi chú bác sĩ<textarea maxLength={4000} onChange={(event) => updateClinicalForm("doctorNotes", event.target.value)} value={clinicalForm.doctorNotes} /></label>
              </div>
              <label>Ngày tái khám<input onChange={(event) => updateClinicalForm("followUpDate", event.target.value)} type="date" value={clinicalForm.followUpDate} /></label>
              <fieldset className="portal-clinical-form__fieldset">
                <legend>Kê một thuốc (tuỳ chọn)</legend>
                <div className="portal-clinical-form__grid">
                  <label>Tên thuốc<input onChange={(event) => updateClinicalForm("medicationName", event.target.value)} value={clinicalForm.medicationName} /></label>
                  <label>Liều dùng<input onChange={(event) => updateClinicalForm("dosage", event.target.value)} value={clinicalForm.dosage} /></label>
                  <label>Tần suất<input onChange={(event) => updateClinicalForm("frequency", event.target.value)} placeholder="Ví dụ: 2 lần/ngày" value={clinicalForm.frequency} /></label>
                  <label>Đơn vị<input onChange={(event) => updateClinicalForm("unit", event.target.value)} placeholder="Viên" value={clinicalForm.unit} /></label>
                  <label>Số ngày<input min="1" onChange={(event) => updateClinicalForm("durationDays", event.target.value)} type="number" value={clinicalForm.durationDays} /></label>
                  <label>Tổng số lượng<input min="1" onChange={(event) => updateClinicalForm("totalQuantity", event.target.value)} type="number" value={clinicalForm.totalQuantity} /></label>
                </div>
                <label>Dặn dò dùng thuốc<textarea onChange={(event) => updateClinicalForm("usageNote", event.target.value)} value={clinicalForm.usageNote} /></label>
                <label>Dặn dò chung<textarea onChange={(event) => updateClinicalForm("prescriptionAdvice", event.target.value)} value={clinicalForm.prescriptionAdvice} /></label>
              </fieldset>
              {clinicalError ? <p aria-live="assertive" className="portal-inline-error" role="alert">{clinicalError}</p> : null}
              {clinicalNotice ? <p aria-live="polite" className="portal-inline-success" role="status">{clinicalNotice}</p> : null}
              <button className="button button--primary" disabled={clinicalOperation === "saving" || !clinicalForm.appointmentId} type="submit">{clinicalOperation === "saving" ? "Đang gửi…" : "Lưu kết quả và hoàn tất lịch"}</button>
            </form>
          ) : null}
        </section>

        <section aria-labelledby="lookup-title" className="portal-panel">
          <div className="portal-panel__heading">
            <div><p className="section-note">QUYỀN TRUY CẬP LÂM SÀNG</p><h2 id="lookup-title">Tra cứu bệnh nhân đã được phân công</h2></div>
            <span aria-hidden="true" className="portal-panel__icon">⌕</span>
          </div>
          <p className="portal-panel__intro">Nhập patient ID từ quy trình được cấp quyền. API sẽ tự kiểm tra quan hệ bác sĩ - bệnh nhân; không dùng tên, số điện thoại hoặc dữ liệu đoán.</p>
          <form className="portal-lookup-form" onSubmit={handleLookup}>
            <div>
              <label htmlFor="patient-id">Patient ID (UUID)</label>
              <input
                aria-describedby="patient-id-help"
                id="patient-id"
                onChange={(event) => setPatientId(event.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                spellCheck={false}
                value={patientId}
              />
              <small id="patient-id-help">Dữ liệu chỉ được yêu cầu khi đã có cơ sở truy cập hợp lệ.</small>
            </div>
            <button className="button button--primary" type="submit">Tải hồ sơ được phép xem</button>
          </form>
          {lookupError ? <p aria-live="assertive" className="portal-inline-error" role="alert">{lookupError}</p> : null}
        </section>

        {activePatientId ? (
          <div className="portal-grid portal-grid--main">
            <section aria-labelledby="doctor-records-title" className="portal-panel">
              <div className="portal-panel__heading">
                <div><p className="section-note">HỒ SƠ ĐƯỢC CẤP QUYỀN</p><h2 id="doctor-records-title">Lịch sử khám</h2></div>
                <span aria-hidden="true" className="portal-panel__icon">+</span>
              </div>
              {renderLookupState(
                records,
                "Chưa có hồ sơ được trả về",
                "Không có hồ sơ thuộc quan hệ lâm sàng này hoặc dữ liệu chưa được cập nhật.",
                retry,
                (items) => (
                  <div className="portal-record-list">
                    {items.map((record) => (
                      <article className="portal-record" key={record.id}>
                        <div className="portal-record__meta"><span>{formatDateTime(record.createdAt)}</span><span>{record.bookingCode ?? "Không có mã lịch hẹn"}</span></div>
                        <h3>{record.diagnosis || "Chưa ghi nhận chẩn đoán"}</h3>
                        <p className="portal-record__doctor">Bệnh nhân: {record.patientName} · Bác sĩ: {record.doctorName}</p>
                        {record.symptomsSummary ? <p><strong>Triệu chứng:</strong> {record.symptomsSummary}</p> : null}
                        {record.doctorNotes ? <p><strong>Ghi chú:</strong> {record.doctorNotes}</p> : null}
                        {record.treatmentPlan ? <p><strong>Kế hoạch:</strong> {record.treatmentPlan}</p> : null}
                        {record.followUpDate ? <p className="portal-record__followup"><strong>Tái khám:</strong> {formatDate(record.followUpDate)}</p> : null}
                      </article>
                    ))}
                  </div>
                ),
              )}
            </section>

            <section aria-labelledby="doctor-diagnostics-title" className="portal-panel">
              <div className="portal-panel__heading">
                <div><p className="section-note">CẬN LÂM SÀNG</p><h2 id="doctor-diagnostics-title">Kết quả chẩn đoán</h2></div>
                <span aria-hidden="true" className="portal-panel__icon">⌁</span>
              </div>
              {renderLookupState(
                diagnostics,
                "Chưa có kết quả được trả về",
                "Kết quả chỉ xuất hiện khi thuộc quan hệ bác sĩ - bệnh nhân được backend cho phép.",
                retry,
                (items) => (
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
                ),
              )}
            </section>
          </div>
        ) : null}

        <p className="portal-disclaimer">Giao diện ghi nhận chỉ gửi payload typed tới backend. Không dùng tên bệnh nhân để đoán quyền; mọi liên kết patient/appointment/doctor và chuyển trạng thái đều do backend xác nhận.</p>
      </div>
    </PortalChrome>
  );
}
