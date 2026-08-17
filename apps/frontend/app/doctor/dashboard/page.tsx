"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import PortalChrome from "../../../components/PortalChrome";
import {
  ApiError,
  clearAuthSession,
  fetchDoctorPatientDiagnosticResults,
  fetchDoctorPatientMedicalRecords,
  hasRole,
} from "../../../lib/api-client";
import type { AuthUser, DiagnosticResult, MedicalRecord } from "../../../types/hospital";
import { EmptyState, ErrorState, ForbiddenState, LoadingState, LoginRequiredState } from "../../../components/PortalStates";
import { useAuthSession } from "../../../components/useAuthSession";

type LookupState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; message: string; statusCode?: number };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  const [lookupError, setLookupError] = useState<string | null>(null);

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

  return (
    <PortalChrome role="DOCTOR" user={user}>
      <div className="portal-content">
        <header className="portal-hero">
          <div>
            <p className="section-note">CỔNG BÁC SĨ</p>
            <h1>Không gian làm việc lâm sàng</h1>
            <p>Chỉ dữ liệu bệnh nhân mà backend xác nhận có quan hệ lâm sàng với tài khoản này mới được hiển thị.</p>
          </div>
          <span className="portal-demo-label">Bản demo local</span>
        </header>

        <section aria-labelledby="daily-title" className="portal-panel portal-panel--notice">
          <div className="portal-panel__heading">
            <div><p className="section-note">ĐANG CHỜ KẾT NỐI CONTRACT</p><h2 id="daily-title">Lịch làm việc hôm nay</h2></div>
            <span aria-hidden="true" className="portal-panel__icon">◷</span>
          </div>
          <p>Backend hiện chưa có endpoint danh sách lịch hẹn trong ngày cho bác sĩ. Giao diện không hiển thị lịch giả hoặc số liệu suy đoán.</p>
          <p className="portal-handoff-note">Handoff cần thiết: API truy vấn lịch hẹn theo doctor hiện tại, ngày, trạng thái và phân trang.</p>
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

        <p className="portal-disclaimer">Giao diện này chỉ đọc dữ liệu clinical portal đã có contract. Tạo/cập nhật hồ sơ khám, đơn thuốc và luồng hoàn tất lượt khám cần một delivery riêng với endpoint và quyền tương ứng.</p>
      </div>
    </PortalChrome>
  );
}
