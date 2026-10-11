"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import PortalChrome from "../../../components/PortalChrome";
import {
  ApiError,
  clearAuthSession,
  downloadPatientDocument,
  fetchPatientDocumentCapabilities,
  fetchPatientDocuments,
  fetchPatientMedicalRecords,
  fetchPatientPrescriptions,
  fetchPatientProfile,
  generatePatientDocument,
  regeneratePatientDocument,
  hasRole,
  readAuthSession,
  type AuthSession,
  type PatientDocument,
  type PatientDocumentCapabilities,
  type PatientDocumentSourceType,
} from "../../../lib/api-client";
import {
  EmptyState,
  ErrorState,
  ForbiddenState,
  LoadingState,
  LoginRequiredState,
} from "../../../components/PortalStates";
import { useAuthSession, useAuthSessionStatus } from "../../../components/useAuthSession";
import { formatBusinessDateTime } from "../../../lib/business-time";
import { DOCUMENT_GENERATION_DISABLED_MESSAGE } from "../../../lib/media-uploads";
import { presentApiError } from "../../../lib/present-api-error";
import type { MedicalRecord, PatientProfile, Prescription } from "../../../types/hospital";
import UiIcon from "../../../components/UiIcon";

type Loadable<T> =
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; message: string; statusCode?: number };

type Notice = { tone: "success" | "error"; message: string };
type DownloadIssue = { recoverable: boolean; message: string; refreshRequired?: boolean };

const PDF_RECOVERY_MESSAGE = "Tệp PDF này đang thiếu hoặc không khớp dữ liệu lưu trữ. Bạn có thể tạo lại PDF từ hồ sơ hiện tại. Bản cũ vẫn được giữ trong lịch sử.";

function downloadIssue(error: unknown): DownloadIssue {
  const recoverable = error instanceof ApiError && [
    "DOCUMENT_CONTENT_UNAVAILABLE", "DOWNLOAD_HASH_MISMATCH", "DOWNLOAD_SIZE_MISMATCH",
  ].includes(error.code ?? "");
  return {
    recoverable,
    message: recoverable ? PDF_RECOVERY_MESSAGE : getErrorMessage(error),
  };
}

const LOADING: Loadable<never> = { status: "loading" };

const SOURCE_LABEL: Record<PatientDocumentSourceType, string> = {
  VISIT_SUMMARY: "Tổng kết lần khám",
  PRESCRIPTION: "Đơn thuốc",
  APPOINTMENT_REMINDER: "Giấy nhắc hẹn",
};

const STATUS_LABEL: Record<PatientDocument["status"], string> = {
  AVAILABLE: "Sẵn sàng tải",
  FAILED: "Tạo thất bại",
  PENDING: "Đang tạo",
  SUPERSEDED: "Đã thay thế",
  REVOKED: "Đã thu hồi",
};

function documentStatusLabel(document: PatientDocument): string {
  if (
    document.sourceType === "APPOINTMENT_REMINDER"
    && document.status === "AVAILABLE"
    && document.sourceCurrent === false
  ) {
    return document.sourceEligible === true
      ? "Cần tạo giấy nhắc mới"
      : "Giấy nhắc không còn hiệu lực";
  }
  return STATUS_LABEL[document.status];
}

function getErrorStatus(error: unknown): number | undefined {
  return error instanceof ApiError ? error.status : undefined;
}

function getErrorMessage(error: unknown): string {
  return error instanceof ApiError
    ? presentApiError(error.code, error.status)
    : "Chưa thể hoàn tất yêu cầu. Vui lòng thử lại.";
}

function isUnauthorized(result: PromiseSettledResult<unknown>): boolean {
  return result.status === "rejected" && getErrorStatus(result.reason) === 401;
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

function sortDocuments(documents: PatientDocument[]): PatientDocument[] {
  return [...documents].sort((left, right) => Date.parse(right.generatedAt) - Date.parse(left.generatedAt));
}

function upsertDocument(documents: PatientDocument[], next: PatientDocument): PatientDocument[] {
  return sortDocuments([
    next,
    ...documents.filter((document) => document.id !== next.id),
  ]);
}

function formatBytes(value: number | null | undefined): string {
  if (!value || value <= 0) return "Chưa có dung lượng";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function documentFilename(document: PatientDocument): string {
  // The file lands in the patient's own downloads folder; a "demo" stamp there
  // undercuts a clinical record. Synthetic/beta status is stated in-app instead.
  const slug = document.sourceType === "PRESCRIPTION"
    ? "don-thuoc"
    : document.sourceType === "APPOINTMENT_REMINDER"
      ? "nhac-lich-hen"
      : "ho-so-kham";
  return `${slug}-${document.id.slice(0, 8)}.pdf`;
}

function documentSourceTitle(
  document: PatientDocument,
  recordsById: Map<string, MedicalRecord>,
  prescriptionsById: Map<string, Prescription>,
): string {
  if (document.sourceType === "PRESCRIPTION") {
    const prescription = prescriptionsById.get(document.sourceRecordId);
    return prescription?.prescriptionCode
      ? `${prescription.prescriptionCode} · ${prescription.diagnosisSummary || "Đơn thuốc"}`
      : "Đơn thuốc đã kết xuất";
  }
  if (document.sourceType === "APPOINTMENT_REMINDER") {
    return "Giấy nhắc lịch hẹn đã kết xuất";
  }
  const record = recordsById.get(document.sourceRecordId);
  return record?.diagnosis || record?.bookingCode || "Hồ sơ khám đã kết xuất";
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
  emptyTitle: string;
  emptyDescription: string;
  retry: () => void;
}) {
  if (state.status === "loading") return <LoadingState />;
  if (state.status === "error") return <ErrorState message={state.message} onRetry={retry} status={state.statusCode} />;
  if (Array.isArray(state.data) && state.data.length === 0) {
    return <EmptyState description={emptyDescription} title={emptyTitle} />;
  }
  return children(state.data);
}

export default function PatientDocumentsPage() {
  const session = useAuthSession();
  const authStatus = useAuthSessionStatus();
  const loadRun = useRef(0);
  const actionInFlight = useRef(false);
  const [profile, setProfile] = useState<Loadable<PatientProfile | null>>(LOADING);
  const [documents, setDocuments] = useState<Loadable<PatientDocument[]>>(LOADING);
  const [records, setRecords] = useState<Loadable<MedicalRecord[]>>(LOADING);
  const [prescriptions, setPrescriptions] = useState<Loadable<Prescription[]>>(LOADING);
  const [capabilities, setCapabilities] = useState<Loadable<PatientDocumentCapabilities>>(LOADING);
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [downloadIssues, setDownloadIssues] = useState<Record<string, DownloadIssue>>({});

  const retry = useCallback(async () => {
    if (!session?.user || !hasRole(session.user, "PATIENT")) return;
    const expectedSession = readAuthSession();
    const runId = loadRun.current + 1;
    loadRun.current = runId;
    const isCurrent = () =>
      expectedSession !== null
      && readAuthSession() === expectedSession
      && loadRun.current === runId;
    setGeneratingKey(null);
    setDownloadingId(null);
    setProfile(LOADING);
    setDocuments(LOADING);
    setRecords(LOADING);
    setPrescriptions(LOADING);
    setCapabilities(LOADING);
    setNotice(null);
    setDownloadIssues({});
    actionInFlight.current = false;

    try {
      const patient = await fetchPatientProfile();
      if (!isCurrent()) return;
      setProfile({ status: "success", data: patient });

      const [documentResult, recordResult, prescriptionResult, capabilityResult] = await Promise.allSettled([
        fetchPatientDocuments(patient.id),
        fetchPatientMedicalRecords(),
        fetchPatientPrescriptions(),
        fetchPatientDocumentCapabilities(patient.id),
      ]);
      if (!isCurrent()) return;
      if ([documentResult, recordResult, prescriptionResult, capabilityResult].some(isUnauthorized)) clearAuthSession();
      setDocuments(toLoadable(documentResult));
      setRecords(toLoadable(recordResult));
      setPrescriptions(toLoadable(prescriptionResult));
      setCapabilities(toLoadable(capabilityResult));
    } catch (error) {
      if (!isCurrent()) return;
      if (getErrorStatus(error) === 401) clearAuthSession();
      if (getErrorStatus(error) === 403) {
        // Account without a patient profile (Google sign-in / phone-less
        // registration): the vault is legitimately empty — render the setup
        // state instead of five generic failure tiles.
        setProfile({ status: "success", data: null });
        setDocuments({ status: "success", data: [] });
        setRecords({ status: "success", data: [] });
        setPrescriptions({ status: "success", data: [] });
        setCapabilities({ status: "success", data: { generationConfigured: false } });
        return;
      }
      const failed = {
        status: "error" as const,
        message: getErrorMessage(error),
        statusCode: getErrorStatus(error),
      };
      setProfile(failed);
      setDocuments(failed);
      setRecords(failed);
      setPrescriptions(failed);
      setCapabilities(failed);
    }
  }, [session]);

  useEffect(() => {
    if (authStatus === "settled" && session?.user && hasRole(session.user, "PATIENT")) {
      const timeoutId = window.setTimeout(() => {
        void retry();
      }, 0);
      return () => {
        loadRun.current += 1;
        window.clearTimeout(timeoutId);
      };
    }
    return () => {
      loadRun.current += 1;
    };
  }, [authStatus, retry, session]);

  const recordsById = useMemo(() => {
    if (records.status !== "success") return new Map<string, MedicalRecord>();
    return new Map(records.data.map((record) => [record.id, record]));
  }, [records]);

  const prescriptionsById = useMemo(() => {
    if (prescriptions.status !== "success") return new Map<string, Prescription>();
    return new Map(prescriptions.data.map((prescription) => [prescription.id, prescription]));
  }, [prescriptions]);

  const DOCUMENT_GENERATION_ENABLED =
    capabilities.status === "success" && capabilities.data.generationConfigured;

  const replacementsByOriginal = useMemo(() => {
    const replacements = new Map<string, PatientDocument>();
    if (documents.status === "success") {
      for (const document of sortDocuments(documents.data)) {
        if (document.regeneratedFromDocumentId && document.status === "AVAILABLE"
          && document.sourceCurrent !== false && !replacements.has(document.regeneratedFromDocumentId)) {
          replacements.set(document.regeneratedFromDocumentId, document);
        }
      }
    }
    return replacements;
  }, [documents]);

  const availableDocumentCount = documents.status === "success"
    ? documents.data.filter((document) => (
      document.status === "AVAILABLE" && document.sourceCurrent !== false && !replacementsByOriginal.has(document.id)
    )).length
    : 0;
  const activePrescriptionCount = prescriptions.status === "success"
    ? prescriptions.data.filter((prescription) => prescription.status === "ACTIVE").length
    : 0;

  const isStale = (expectedSession: AuthSession | null, runId: number) =>
    expectedSession === null
    || readAuthSession() !== expectedSession
    || loadRun.current !== runId;

  const handleGenerate = async (sourceType: PatientDocumentSourceType, sourceRecordId: string) => {
    if (profile.status !== "success" || profile.data === null || actionInFlight.current || !DOCUMENT_GENERATION_ENABLED) return;
    actionInFlight.current = true;
    const expectedSession = readAuthSession();
    const runId = loadRun.current;
    const actionKey = `${sourceType}:${sourceRecordId}`;
    setGeneratingKey(actionKey);
    setNotice(null);
    try {
      const generated = await generatePatientDocument(profile.data.id, { sourceType, sourceRecordId });
      if (isStale(expectedSession, runId)) return;
      setDocuments((current) => (
        current.status === "success"
          ? { status: "success", data: upsertDocument(current.data, generated) }
          : { status: "success", data: [generated] }
      ));
      try {
        const refreshed = await fetchPatientDocuments(profile.data.id);
        if (isStale(expectedSession, runId)) return;
        setDocuments({ status: "success", data: refreshed });
      } catch (refreshError) {
        if (isStale(expectedSession, runId)) return;
        if (getErrorStatus(refreshError) === 401) {
          clearAuthSession();
          return;
        }
        setNotice({
          tone: "error",
          message: "Tài liệu đã được tạo nhưng chưa cập nhật được danh sách. Vui lòng tải lại.",
        });
        return;
      }
      setNotice({ tone: "success", message: "Đã tạo tài liệu PDF. Bạn có thể tải về khi trạng thái chuyển sang “Sẵn sàng tải”." });
    } catch (error) {
      if (isStale(expectedSession, runId)) return;
      if (getErrorStatus(error) === 401) {
        clearAuthSession();
        setNotice({ tone: "error", message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." });
      } else {
        setNotice({ tone: "error", message: getErrorMessage(error) });
      }
    } finally {
      if (!isStale(expectedSession, runId)) {
        setGeneratingKey(null);
        actionInFlight.current = false;
      }
    }
  };

  const handleRegenerate = async (document: PatientDocument) => {
    if (profile.status !== "success" || profile.data === null || actionInFlight.current
      || !DOCUMENT_GENERATION_ENABLED || document.sourceEligible === false
      || !["AVAILABLE", "FAILED"].includes(document.status)) return;
    actionInFlight.current = true;
    const expectedSession = readAuthSession();
    const runId = loadRun.current;
    setGeneratingKey(`RECOVERY:${document.id}`);
    setNotice(null);
    try {
      const generated = await regeneratePatientDocument(profile.data.id, document.id);
      if (isStale(expectedSession, runId)) return;
      setDocuments((current) => ({ status: "success", data: upsertDocument(current.status === "success" ? current.data : [], generated) }));
      setDownloadIssues((current) => {
        const next = { ...current };
        delete next[document.id];
        return next;
      });
      setNotice({ tone: "success", message: "Đã tạo bản PDF mới từ hồ sơ hiện tại. Bản cũ vẫn được giữ trong lịch sử; hãy tải bản mới ở danh sách bên dưới." });
    } catch (error) {
      if (isStale(expectedSession, runId)) return;
      if (getErrorStatus(error) === 401) {
        clearAuthSession();
        setNotice({ tone: "error", message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." });
      } else {
        setDownloadIssues((current) => ({ ...current, [document.id]: {
          recoverable: true,
          refreshRequired: [403, 404, 409].includes(getErrorStatus(error) ?? 0),
          message: `Chưa tạo được bản PDF mới. ${getErrorMessage(error)} Bản cũ vẫn được giữ trong lịch sử.`,
        } }));
      }
    } finally {
      if (!isStale(expectedSession, runId)) {
        setGeneratingKey(null);
        actionInFlight.current = false;
      }
    }
  };

  const handleDownload = async (document: PatientDocument) => {
    if (profile.status !== "success" || profile.data === null || document.status !== "AVAILABLE" || document.sourceCurrent === false || actionInFlight.current) return;
    actionInFlight.current = true;
    const expectedSession = readAuthSession();
    const runId = loadRun.current;
    setDownloadingId(document.id);
    setNotice(null);
    try {
      await downloadPatientDocument(profile.data.id, document.id, documentFilename(document), { byteSize: document.byteSize, sha256: document.sha256 });
      if (isStale(expectedSession, runId)) return;
      setDownloadIssues((current) => {
        const next = { ...current };
        delete next[document.id];
        return next;
      });
      setNotice({ tone: "success", message: "Đã bắt đầu tải PDF về máy." });
    } catch (error) {
      if (isStale(expectedSession, runId)) return;
      if (getErrorStatus(error) === 401) {
        clearAuthSession();
        setNotice({ tone: "error", message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." });
      } else {
        setDownloadIssues((current) => ({ ...current, [document.id]: downloadIssue(error) }));
      }
    } finally {
      if (!isStale(expectedSession, runId)) {
        setDownloadingId(null);
        actionInFlight.current = false;
      }
    }
  };

  if (authStatus !== "settled") {
    return <main className="portal-entry"><LoadingState label="Đang kiểm tra phiên đăng nhập..." /></main>;
  }

  if (!session?.user) {
    return <main className="portal-entry"><LoginRequiredState nextPath="/patient/documents" /></main>;
  }

  if (!hasRole(session.user, "PATIENT")) {
    return (
      <main className="portal-entry">
        <ForbiddenState
          description="Khu vực tài liệu PDF chỉ dành cho bệnh nhân sở hữu hồ sơ."
          title="Không thể mở tài liệu bệnh nhân"
        />
      </main>
    );
  }

  return (
    <PortalChrome
      avatarUrl={profile.status === "success" ? profile.data?.avatarUrl ?? null : null}
      role="PATIENT"
      user={session.user}
    >
      <div className="section-inner portal-page">
        <header className="portal-hero">
          <div>
            <p className="section-note">TÀI LIỆU KHÁM CỦA BẠN</p>
            <h1>Trung tâm tài liệu lâm sàng</h1>
            <p>Tạo bản PDF từ hồ sơ khám hoặc đơn thuốc của bạn. Tài liệu đang ở giai đoạn thử nghiệm và chưa có chữ ký số, nên không thay thế giấy tờ chính thức của cơ sở y tế.</p>
          </div>
        </header>

        <div className="portal-summary-grid" aria-label="Tổng quan tài liệu">
          <article className="portal-summary-card">
            <span>PDF sẵn sàng</span>
            <strong>{availableDocumentCount}</strong>
            <small>Có thể tải qua phiên đăng nhập hiện tại.</small>
          </article>
          <article className="portal-summary-card">
            <span>Nguồn hồ sơ</span>
            <strong>{records.status === "success" ? records.data.length : "--"}</strong>
            <small>Lượt khám có thể kết xuất tổng kết.</small>
          </article>
          <article className="portal-summary-card">
            <span>Đơn thuốc hiệu lực</span>
            <strong>{prescriptions.status === "success" ? activePrescriptionCount : "--"}</strong>
            <small>Chỉ đơn đang sử dụng mới được tạo PDF.</small>
          </article>
          <article className="portal-summary-card">
            <span>Pháp lý</span>
            <strong>Thử nghiệm</strong>
            <small>Chưa ký số, chỉ tải qua tài khoản của bạn.</small>
          </article>
        </div>

        {profile.status === "success" && profile.data === null && (
          <section className="portal-panel" aria-label="Tạo hồ sơ bệnh nhân">
            <p className="info-banner" role="status">
              Tài khoản của bạn chưa có hồ sơ bệnh nhân — chưa có tài liệu nào để hiển thị.
              {" "}
              <Link href="/patient/profile">Tạo hồ sơ ngay</Link>
            </p>
          </section>
        )}

        {capabilities.status === "error" ? (
          <ErrorState
            message={capabilities.message}
            onRetry={() => void retry()}
            status={capabilities.statusCode}
          />
        ) : capabilities.status === "success" && !capabilities.data.generationConfigured ? (
          <p className="info-banner" role="status">{DOCUMENT_GENERATION_DISABLED_MESSAGE}</p>
        ) : null}

        {notice ? (
          <p
            aria-live={notice.tone === "error" ? "assertive" : "polite"}
            className={notice.tone === "error" ? "portal-inline-error" : "portal-inline-success"}
            role={notice.tone === "error" ? "alert" : "status"}
          >
            {notice.message}
          </p>
        ) : null}

        <section aria-labelledby="generated-documents-title" className="portal-panel">
          <div className="portal-panel__heading">
            <div>
              <p className="section-note">KHO PDF RIÊNG TƯ</p>
              <h2 id="generated-documents-title">Tài liệu đã tạo</h2>
            </div>
            <span aria-hidden="true" className="portal-panel__icon"><UiIcon name="printer" size={20} /></span>
          </div>
          <StateContent
            emptyDescription="Bạn có thể tạo tài liệu PDF từ hồ sơ khám hoặc đơn thuốc ở các mục bên dưới."
            emptyTitle="Chưa có tài liệu PDF"
            retry={retry}
            state={documents}
          >
            {(items) => (
              <div className="portal-record-list">
                {sortDocuments(items).map((document) => (
                  <article className="portal-record" id={`document-${document.id}`} key={document.id}>
                    <div className="portal-record__meta">
                      <span>{SOURCE_LABEL[document.sourceType]}</span>
                      <span>{replacementsByOriginal.has(document.id) ? "Đã tạo bản mới · Giữ lịch sử" : documentStatusLabel(document)}</span>
                    </div>
                    <h3>{documentSourceTitle(document, recordsById, prescriptionsById)}</h3>
                    <p className="portal-record__doctor">Tạo lúc {formatBusinessDateTime(document.generatedAt)} · {formatBytes(document.byteSize)}</p>
                    {document.sha256 ? <p>Mã đối chiếu tài liệu: {document.sha256.slice(0, 12)}…</p> : null}
                    {document.regeneratedFromDocumentId ? (
                      <p className="portal-record__followup">Bản tạo lại từ hồ sơ hiện tại · <a href={`#document-${document.regeneratedFromDocumentId}`}>Xem bản cũ trong lịch sử</a></p>
                    ) : null}
                    {replacementsByOriginal.has(document.id) ? (
                      <p className="portal-record__followup"><a href={`#document-${replacementsByOriginal.get(document.id)!.id}`}>Xem bản PDF mới</a>. Bản cũ được giữ để đối chiếu.</p>
                    ) : null}
                    {downloadIssues[document.id] ? (
                      <p className="portal-inline-error" role="alert">{downloadIssues[document.id].message}</p>
                    ) : null}
                    {document.status === "FAILED" && !replacementsByOriginal.has(document.id)
                      && !(document.sourceType === "APPOINTMENT_REMINDER" && document.sourceEligible === false)
                      ? <p className="portal-record__followup">Bản cũ chưa tạo thành công. Bạn có thể tạo lại từ hồ sơ hiện tại; lịch sử bản cũ vẫn được giữ.</p>
                      : null}
                    {document.sourceType === "APPOINTMENT_REMINDER" && document.sourceEligible === false
                      ? <p className="portal-record__followup">Giấy nhắc không còn hiệu lực vì lịch hẹn đã thay đổi hoặc bị hủy.</p>
                      : null}
                    <div className="portal-appointment__actions">
                      {!replacementsByOriginal.has(document.id) ? <button
                        className="button button--primary"
                        disabled={document.status !== "AVAILABLE" || document.sourceCurrent === false || downloadingId !== null || generatingKey !== null}
                        onClick={() => void handleDownload(document)}
                        type="button"
                      >
                        {downloadingId === document.id ? "Đang tải..." : downloadIssues[document.id] && !downloadIssues[document.id].recoverable ? "Thử tải lại" : "Tải PDF"}
                      </button> : null}
                      {document.sourceType === "APPOINTMENT_REMINDER"
                        && document.status === "AVAILABLE"
                        && document.sourceCurrent === false
                        && document.sourceEligible === true ? (
                        <button
                          className="outline-button outline-button--small"
                          disabled={!DOCUMENT_GENERATION_ENABLED || generatingKey !== null || downloadingId !== null}
                          onClick={() => void handleGenerate(document.sourceType, document.sourceRecordId)}
                          type="button"
                        >
                          {generatingKey === `${document.sourceType}:${document.sourceRecordId}` ? "Đang tạo…" : "Tạo giấy nhắc mới"}
                        </button>
                        ) : null}
                      {!replacementsByOriginal.has(document.id) && (document.status === "FAILED" || downloadIssues[document.id]?.recoverable)
                        && ["AVAILABLE", "FAILED"].includes(document.status) && document.sourceEligible !== false
                        && !downloadIssues[document.id]?.refreshRequired ? (
                        <button
                          className="outline-button outline-button--small"
                          disabled={!DOCUMENT_GENERATION_ENABLED || generatingKey !== null || downloadingId !== null}
                          onClick={() => void handleRegenerate(document)}
                          type="button"
                        >
                          {generatingKey === `RECOVERY:${document.id}` ? "Đang tạo lại…" : "Tạo lại PDF"}
                        </button>
                      ) : null}
                      {downloadIssues[document.id]?.refreshRequired ? (
                        <button className="outline-button outline-button--small" onClick={() => void retry()} type="button">
                          Cập nhật danh sách
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </StateContent>
        </section>

        <div className="portal-grid portal-grid--main">
          <section aria-labelledby="visit-summary-title" className="portal-panel">
            <div className="portal-panel__heading">
              <div>
                <p className="section-note">TỪ HỒ SƠ KHÁM</p>
                <h2 id="visit-summary-title">Tạo tổng kết lần khám</h2>
              </div>
              <span aria-hidden="true" className="portal-panel__icon"><UiIcon name="activity" size={20} /></span>
            </div>
            <StateContent
              emptyDescription="Khi bác sĩ hoàn tất hồ sơ khám, nút tạo PDF sẽ xuất hiện ở đây."
              emptyTitle="Chưa có hồ sơ khám"
              retry={retry}
              state={records}
            >
              {(items) => (
                <div className="portal-record-list">
                  {items.map((record) => {
                    const actionKey = `VISIT_SUMMARY:${record.id}`;
                    return (
                      <article className="portal-record" key={record.id}>
                        <div className="portal-record__meta">
                          <span>{formatBusinessDateTime(record.createdAt)}</span>
                          <span>{record.bookingCode ?? "Không có mã lịch"}</span>
                        </div>
                        <h3>{record.diagnosis || "Tổng kết lần khám"}</h3>
                        <p className="portal-record__doctor">{record.doctorName}{record.doctorTitle ? ` · ${record.doctorTitle}` : ""}</p>
                        <div className="portal-appointment__actions">
                          <button
                            className="outline-button outline-button--small"
                            disabled={!DOCUMENT_GENERATION_ENABLED || generatingKey !== null || downloadingId !== null}
                            onClick={() => void handleGenerate("VISIT_SUMMARY", record.id)}
                            type="button"
                          >
                            {generatingKey === actionKey ? "Đang tạo..." : "Tạo PDF tổng kết"}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </StateContent>
          </section>

          <section aria-labelledby="prescription-pdf-title" className="portal-panel">
            <div className="portal-panel__heading">
              <div>
                <p className="section-note">TỪ ĐƠN THUỐC</p>
                <h2 id="prescription-pdf-title">Tạo PDF đơn thuốc</h2>
              </div>
              <span aria-hidden="true" className="portal-panel__icon"><UiIcon name="book-open" size={20} /></span>
            </div>
            <StateContent
              emptyDescription="Chỉ đơn thuốc còn hiệu lực mới được kết xuất tài liệu PDF."
              emptyTitle="Chưa có đơn thuốc"
              retry={retry}
              state={prescriptions}
            >
              {(items) => (
                <div className="portal-record-list">
                  {items.map((prescription) => {
                    const actionKey = `PRESCRIPTION:${prescription.id}`;
                    const isActive = prescription.status === "ACTIVE";
                    return (
                      <article className="portal-record" key={prescription.id}>
                        <div className="portal-record__meta">
                          <span>{prescription.prescriptionCode}</span>
                          <span>{formatBusinessDateTime(prescription.createdAt)}</span>
                        </div>
                        <h3>{prescription.diagnosisSummary || "Đơn thuốc theo hồ sơ khám"}</h3>
                        <p className="portal-record__doctor">Bác sĩ: {prescription.doctorName} · {isActive ? "Đang sử dụng" : "Không còn hiệu lực"}</p>
                        <div className="portal-appointment__actions">
                          <button
                            className="outline-button outline-button--small"
                            disabled={!DOCUMENT_GENERATION_ENABLED || !isActive || generatingKey !== null || downloadingId !== null}
                            onClick={() => void handleGenerate("PRESCRIPTION", prescription.id)}
                            type="button"
                          >
                            {generatingKey === actionKey ? "Đang tạo..." : "Tạo PDF đơn thuốc"}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </StateContent>
          </section>
        </div>

        <p className="portal-disclaimer">
          Tài liệu PDF phản ánh dữ liệu tại thời điểm tạo, đang ở giai đoạn thử nghiệm và chưa có chữ ký số. Không dùng thay thế chỉ định trực tiếp hoặc giấy tờ chính thức của cơ sở y tế.
        </p>
      </div>
    </PortalChrome>
  );
}
