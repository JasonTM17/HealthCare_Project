"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import PortalChrome from "../../../components/PortalChrome";
import {
  ApiError,
  clearAuthSession,
  createDoctorDiagnosticResult,
  createMedicalRecord,
  downloadProtectedFile,
  fetchDoctorAppointments,
  fetchDoctorProfile,
  fetchDoctorPatientDiagnosticResults,
  fetchDoctorPatientMedicalRecords,
  hasRole,
  updateDoctorAppointmentStatus,
  uploadDiagnosticFile,
  type Page,
} from "../../../lib/api-client";
import type { Doctor, DoctorPortalAppointment, AuthUser, DiagnosticResult, MedicalRecord } from "../../../types/hospital";
import { EmptyState, ErrorState, ForbiddenState, LoadingState, LoginRequiredState } from "../../../components/PortalStates";
import PortalAppointments from "../../../components/PortalAppointments";
import { useAuthSession } from "../../../components/useAuthSession";
import { businessDate, businessDateTimeIso, formatBusinessDate, formatBusinessDateTime } from "../../../lib/business-time";
import UiIcon from "../../../components/UiIcon";

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
  const status = getErrorStatus(error);
  if (status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (status === 403) return "Tài khoản hiện tại chưa được phép thực hiện thao tác này.";
  if (status === 404) return "Không tìm thấy hồ sơ hoặc lịch hẹn phù hợp.";
  if (status === 409) return "Thông tin đã thay đổi hoặc đã được ghi nhận. Vui lòng tải lại và kiểm tra.";
  if (status === 400 || status === 422) return "Thông tin chưa hợp lệ. Vui lòng kiểm tra và thử lại.";
  if (status === 413) return "Tệp đính kèm vượt quá dung lượng cho phép.";
  if (status === 429) return "Bạn đang thao tác quá nhanh. Vui lòng chờ một lát rồi thử lại.";
  return "Kết nối đang bị gián đoạn. Vui lòng thử lại sau ít phút.";
}

function getTodayIsoDate(): string {
  return businessDate();
}

function createPatientLookupFence() {
  let latestRequestId = 0;
  return {
    begin(): number {
      latestRequestId += 1;
      return latestRequestId;
    },
    invalidate(): void {
      latestRequestId += 1;
    },
    isCurrent(requestId: number): boolean {
      return requestId === latestRequestId;
    },
  };
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
  onUpdateStatus?: (appointment: DoctorPortalAppointment, status: "CHECKED_IN" | "IN_PROGRESS" | "NO_SHOW") => void,
) {
  if (state.status === "idle") {
    return <EmptyState description="Chọn ngày để xem lịch hẹn được phân công." title="Chưa chọn lịch" />;
  }
  if (state.status === "loading") return <LoadingState label="Đang tải lịch hẹn trong ngày..." />;
  if (state.status === "error") {
    return <ErrorState message={state.message} onRetry={retry} status={state.statusCode} />;
  }
  if (state.data.empty || state.data.content.length === 0) {
    return <EmptyState description="Không có lịch hẹn thuộc ngày và trạng thái đã chọn." title="Ngày này chưa có lịch hẹn" />;
  }
  return <PortalAppointments onSelectAppointment={onSelectAppointment} onUpdateStatus={onUpdateStatus} page={state.data} viewer="doctor" />;
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
  const [appointmentAction, setAppointmentAction] = useState<string | null>(null);
  const [appointmentError, setAppointmentError] = useState<string | null>(null);
  const [appointmentNotice, setAppointmentNotice] = useState<string | null>(null);
  const [diagnosticName, setDiagnosticName] = useState("");
  const [diagnosticValue, setDiagnosticValue] = useState("");
  const [diagnosticDate, setDiagnosticDate] = useState(getTodayIsoDate);
  const [diagnosticFile, setDiagnosticFile] = useState<File | null>(null);
  const [diagnosticOperation, setDiagnosticOperation] = useState<"idle" | "saving">("idle");
  const [diagnosticNotice, setDiagnosticNotice] = useState<string | null>(null);
  const [patientLookupFence] = useState(createPatientLookupFence);

  useEffect(() => () => patientLookupFence.invalidate(), [patientLookupFence]);

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
    const requestId = patientLookupFence.begin();
    setLookupError(null);
    setActivePatientId(requestedPatientId);
    setRecords({ status: "loading" });
    setDiagnostics({ status: "loading" });

    const [recordsResult, diagnosticsResult] = await Promise.allSettled([
      fetchDoctorPatientMedicalRecords(requestedPatientId),
      fetchDoctorPatientDiagnosticResults(requestedPatientId),
    ]);
    if (!patientLookupFence.isCurrent(requestId)) return;

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
      setLookupError("Mã hồ sơ chưa đúng định dạng. Vui lòng kiểm tra mã được phân công.");
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
    window.setTimeout(() => {
      const target = document.getElementById("clinical-entry");
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: "start" });
    }, 0);
  };

  const handleUpdateAppointmentStatus = async (
    appointment: DoctorPortalAppointment,
    status: "CHECKED_IN" | "IN_PROGRESS" | "NO_SHOW",
  ): Promise<void> => {
    if (appointmentAction) return;
    setAppointmentAction(appointment.id);
    setAppointmentError(null);
    setAppointmentNotice(null);
    try {
      await updateDoctorAppointmentStatus(appointment.id, status);
      setAppointmentNotice(`Đã cập nhật lịch ${appointment.bookingCode}.`);
      setDailyReloadKey((value) => value + 1);
    } catch (error: unknown) {
      setAppointmentError(getErrorMessage(error));
    } finally {
      setAppointmentAction(null);
    }
  };

  const handleDownload = async (result: DiagnosticResult): Promise<void> => {
    if (!result.fileUrl) return;
    try {
      await downloadProtectedFile(result.fileUrl, result.testName);
    } catch (error: unknown) {
      setLookupError(getErrorMessage(error));
    }
  };

  const handleCreateDiagnostic = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!activePatientId) return;
    setDiagnosticOperation("saving");
    setLookupError(null);
    setDiagnosticNotice(null);
    try {
      const storedFile = diagnosticFile ? await uploadDiagnosticFile(diagnosticFile, activePatientId) : null;
      await createDoctorDiagnosticResult(activePatientId, {
        testName: diagnosticName.trim(),
        result: diagnosticValue.trim() || undefined,
        fileId: storedFile?.id,
        testDate: businessDateTimeIso(diagnosticDate),
      });
      setDiagnosticName("");
      setDiagnosticValue("");
      setDiagnosticFile(null);
      await loadPatient(activePatientId);
      setDiagnosticNotice("Đã công bố kết quả chẩn đoán cho hồ sơ đang mở.");
    } catch (error: unknown) {
      setLookupError(getErrorMessage(error));
    } finally {
      setDiagnosticOperation("idle");
    }
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
      setClinicalNotice("Đã ghi nhận kết quả khám và hoàn tất lịch hẹn. Người bệnh có thể xem thông tin mới trong cổng cá nhân.");
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
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="mb-0">Không gian làm việc lâm sàng</h1>
              {doctorProfile.status === "success" && (
                <span className="px-3 py-1.5 rounded-md text-xs font-bold bg-teal-50 text-teal-950 border border-teal-200">
                  {doctorProfile.data.aiCredits ?? 150} lượt AI khả dụng
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-600">Quản lý lịch làm việc và hồ sơ của những người bệnh được phân công cho tài khoản này.</p>
          </div>
          <div className="portal-hero__actions flex flex-wrap items-center gap-2.5">
            <Link className="min-h-11 px-5 rounded-md bg-teal-950 text-white text-xs font-bold hover:bg-teal-900 transition flex items-center justify-center shadow-xs" href="/doctor/articles">
              Đăng bài viết y khoa
            </Link>
            <Link className="min-h-11 px-5 rounded-md bg-white text-teal-950 border border-slate-300 hover:border-teal-700 hover:bg-slate-50 text-xs font-bold transition flex items-center justify-center" href="/doctor/consultations">
              Tư vấn bệnh nhân
            </Link>
            <Link className="min-h-11 px-5 rounded-md bg-white text-teal-950 border border-slate-300 hover:border-teal-700 hover:bg-slate-50 text-xs font-bold transition flex items-center justify-center" href="/doctor/health-questions">
              Hỏi đáp sức khỏe
            </Link>
          </div>
        </header>

        <section aria-busy={Boolean(appointmentAction)} aria-labelledby="daily-title" className="portal-panel" id="daily-appointments">
          <div className="portal-panel__heading">
            <div><p className="section-note">LỊCH HẸN ĐÃ XÁC THỰC</p><h2 id="daily-title">Lịch làm việc theo ngày</h2></div>
            <span aria-hidden="true" className="portal-panel__icon"><UiIcon name="calendar" size={20} /></span>
          </div>
          <p className="portal-panel__intro">Danh sách chỉ gồm các lịch hẹn được phân công cho hồ sơ bác sĩ hiện tại.</p>
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
            <button className="outline-button" disabled={dailyAppointments.status === "loading"} type="submit">Làm mới lịch</button>
          </form>
          {appointmentAction ? <p aria-live="polite" className="portal-handoff-note">Đang cập nhật trạng thái lịch hẹn…</p> : null}
          {appointmentError ? <p aria-live="assertive" className="portal-inline-error" role="alert">{appointmentError}</p> : null}
          {appointmentNotice ? <p aria-live="polite" className="portal-inline-success" role="status">{appointmentNotice}</p> : null}
          {renderDailyAppointments(dailyAppointments, retryDailyAppointments, handleSelectAppointment, handleUpdateAppointmentStatus)}
        </section>

        <section aria-labelledby="clinical-entry-title" className="portal-panel" id="clinical-entry" tabIndex={-1}>
          <div className="portal-panel__heading">
            <div><h2 id="clinical-entry-title">Ghi nhận kết quả khám</h2></div>
            <span aria-hidden="true" className="portal-panel__icon"><UiIcon name="stethoscope" size={20} /></span>
          </div>
          <p className="portal-panel__intro">Chọn một lịch hẹn trong danh sách phía trên trước khi ghi chẩn đoán, kế hoạch điều trị và đơn thuốc.</p>
          {doctorProfile.status === "loading" ? <LoadingState label="Đang tải hồ sơ bác sĩ…" /> : null}
          {doctorProfile.status === "error" ? <ErrorState message={doctorProfile.message} status={doctorProfile.statusCode} /> : null}
          {doctorProfile.status === "success" ? (
            <form className="portal-clinical-form" onSubmit={handleCreateClinicalRecord}>
              <div className="portal-clinical-form__context">
                <label>Mã hồ sơ bệnh nhân<input readOnly value={clinicalForm.patientId} /></label>
                <label>Mã lịch hẹn<input readOnly value={clinicalForm.appointmentId} /></label>
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
            <div><h2 id="lookup-title">Tra cứu bệnh nhân đã được phân công</h2></div>
            <span aria-hidden="true" className="portal-panel__icon"><UiIcon name="search" size={20} /></span>
          </div>
          <p className="portal-panel__intro">Nhập mã hồ sơ được cung cấp trong quy trình phân công để xem thông tin phù hợp với quyền của bạn.</p>
          <form className="portal-lookup-form" onSubmit={handleLookup}>
            <div className="portal-lookup-form__group">
              <label htmlFor="patient-id">Mã hồ sơ bệnh nhân</label>
              <div className="portal-lookup-form__row">
                <input
                  aria-describedby="patient-id-help"
                  id="patient-id"
                  onChange={(event) => setPatientId(event.target.value)}
                  placeholder="Nhập mã hồ sơ được phân công (hoặc chọn từ lịch khám ở trên)"
                  spellCheck={false}
                  value={patientId}
                />
                <button className="button button--primary" type="submit">Mở hồ sơ</button>
              </div>
              <small id="patient-id-help">Dữ liệu chỉ được yêu cầu khi đã có cơ sở truy cập hợp lệ.</small>
            </div>
          </form>
          {lookupError ? <p aria-live="assertive" className="portal-inline-error" role="alert">{lookupError}</p> : null}
        </section>

        {activePatientId ? (
          <div className="portal-grid portal-grid--main">
            <section aria-labelledby="doctor-records-title" className="portal-panel">
              <div className="portal-panel__heading">
                <div><h2 id="doctor-records-title">Lịch sử khám</h2></div>
                <span aria-hidden="true" className="portal-panel__icon"><UiIcon name="activity" size={20} /></span>
              </div>
              {renderLookupState(
                records,
                "Chưa có hồ sơ khám",
                "Người bệnh này chưa có hồ sơ khám phù hợp hoặc thông tin đang được cập nhật.",
                retry,
                (items) => (
                  <div className="portal-record-list">
                    {items.map((record) => (
                      <article className="portal-record" key={record.id}>
                        <div className="portal-record__meta"><span>{formatBusinessDateTime(record.createdAt)}</span><span>{record.bookingCode ?? "Không có mã lịch hẹn"}</span></div>
                        <h3>{record.diagnosis || "Chưa ghi nhận chẩn đoán"}</h3>
                        <p className="portal-record__doctor">Bệnh nhân: {record.patientName} · Bác sĩ: {record.doctorName}</p>
                        {record.symptomsSummary ? <p><strong>Triệu chứng:</strong> {record.symptomsSummary}</p> : null}
                        {record.doctorNotes ? <p><strong>Ghi chú:</strong> {record.doctorNotes}</p> : null}
                        {record.treatmentPlan ? <p><strong>Kế hoạch:</strong> {record.treatmentPlan}</p> : null}
                        {record.followUpDate ? <p className="portal-record__followup"><strong>Tái khám:</strong> {formatBusinessDate(record.followUpDate)}</p> : null}
                      </article>
                    ))}
                  </div>
                ),
              )}
            </section>

            <section aria-labelledby="doctor-diagnostics-title" className="portal-panel">
              <div className="portal-panel__heading">
                <div><h2 id="doctor-diagnostics-title">Kết quả chẩn đoán</h2></div>
                <span aria-hidden="true" className="portal-panel__icon"><UiIcon name="activity" size={20} /></span>
              </div>
              <form className="portal-clinical-form" onSubmit={handleCreateDiagnostic}>
                <div className="portal-clinical-form__grid">
                  <label>Tên xét nghiệm *<input maxLength={200} onChange={(event) => setDiagnosticName(event.target.value)} required value={diagnosticName} /></label>
                  <label>Ngày thực hiện<input max={getTodayIsoDate()} onChange={(event) => setDiagnosticDate(event.target.value)} required type="date" value={diagnosticDate} /></label>
                </div>
                <label>Kết quả<textarea maxLength={4000} onChange={(event) => setDiagnosticValue(event.target.value)} value={diagnosticValue} /></label>
                <label>Tệp đính kèm (tuỳ chọn)<input accept="application/pdf,image/jpeg,image/png" onChange={(event) => setDiagnosticFile(event.target.files?.[0] ?? null)} type="file" /></label>
                {diagnosticNotice ? <p aria-live="polite" className="portal-inline-success" role="status">{diagnosticNotice}</p> : null}
                <button className="button button--primary" disabled={diagnosticOperation === "saving"} type="submit">{diagnosticOperation === "saving" ? "Đang công bố…" : "Công bố kết quả"}</button>
              </form>
              {renderLookupState(
                diagnostics,
                "Chưa có kết quả chẩn đoán",
                "Kết quả sẽ xuất hiện sau khi được ghi nhận cho người bệnh đang phụ trách.",
                retry,
                (items) => (
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
                ),
              )}
            </section>
          </div>
        ) : null}

        <p className="portal-disclaimer">Thông tin lâm sàng chỉ được hiển thị và cập nhật trong phạm vi người bệnh được phân công. Hãy kiểm tra đúng hồ sơ và lịch hẹn trước khi lưu.</p>
      </div>
    </PortalChrome>
  );
}
