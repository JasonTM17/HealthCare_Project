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
  fetchAllContent,
  fetchDoctorAppointments,
  fetchDoctorProfile,
  fetchDoctorPatientDiagnosticResults,
  fetchDoctorDiagnosticOrders,
  fetchDoctorScheduleExceptions,
  fetchDoctorSchedules,
  createDoctorDiagnosticOrder,
  fetchDoctorPatientMedicalRecords,
  hasRole,
  updateDoctorAppointmentStatus,
  uploadDiagnosticFile,
  type DoctorRosterEntry,
  type DoctorRosterException,
  type Page,
} from "../../../lib/api-client";
import type {
  Doctor,
  DoctorPortalAppointment,
  AuthUser,
  DiagnosticResult,
  DiagnosticOrder,
  MedicalRecord,
} from "../../../types/hospital";
import { EmptyState, ErrorState, ForbiddenState, LoadingState, LoginRequiredState } from "../../../components/PortalStates";
import PortalAppointments from "../../../components/PortalAppointments";
import { useAuthSession } from "../../../components/useAuthSession";
import { businessDate, businessDateTimeIso, businessTimeNow, formatBusinessDate, formatBusinessDateTime } from "../../../lib/business-time";
import UiIcon from "../../../components/UiIcon";

type LookupState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; message: string; statusCode?: number };

// Shape-only, matching lib/api-client.ts: the seeded and factory records this
// project ships (for example 70000000-0000-…, 10000000-0000-…) are not
// RFC-4122 version-stamped, so requiring a version nibble rejected real
// patient ids while every other validator accepted them.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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

/** Week-day labels for the read-only roster table, indexed by dayOfWeek (1 = Monday). */
const ROSTER_DAY_LABELS = ["", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "CN"] as const;

const ROSTER_EXCEPTION_LABELS: Record<string, string> = {
  LEAVE: "Nghỉ phép",
  BLOCKED: "Khóa lịch",
  CUSTOM_HOURS: "Giờ đặc biệt",
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Calendar-day arithmetic on an ISO date string. Uses the same UTC-parts
 * approach as lib/business-time.ts so a DST shift can never turn "+7 ngày"
 * into a different calendar day.
 */
function addDaysIso(value: string, days: number): string {
  const parts = value.split("-").map(Number);
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + days));
  return Number.isNaN(date.valueOf()) ? value : date.toISOString().slice(0, 10);
}

function rosterDayLabel(dayOfWeek: number): string {
  return ROSTER_DAY_LABELS[dayOfWeek] ?? `Thứ ${dayOfWeek}`;
}

function formatClock(value?: string | null): string {
  return value ? value.slice(0, 5) : "—";
}

/** One day of the range view, shaped as a Page so PortalAppointments can render it. */
function toDayPage(date: string, items: DoctorPortalAppointment[]): Page<DoctorPortalAppointment> {
  return {
    content: items,
    totalElements: items.length,
    totalPages: 1,
    size: items.length,
    number: 0,
    first: true,
    last: true,
    empty: items.length === 0,
  };
}

/**
 * Groups a range response by appointment date. The backend orders by date then
 * start time, so insertion order is already the display order; sorting the keys
 * keeps the view correct even if a caller hands us an unordered list.
 */
function groupAppointmentsByDate(items: DoctorPortalAppointment[]): { date: string; page: Page<DoctorPortalAppointment> }[] {
  const byDate = new Map<string, DoctorPortalAppointment[]>();
  for (const item of items) {
    const bucket = byDate.get(item.appointmentDate);
    if (bucket) bucket.push(item);
    else byDate.set(item.appointmentDate, [item]);
  }
  return [...byDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, dayItems]) => ({ date, page: toDayPage(date, dayItems) }));
}

interface ClinicalFormValues {
  appointmentId: string;
  patientId: string;
  diagnosis: string;
  symptomsSummary: string;
  treatmentPlan: string;
  doctorNotes: string;
  followUpDate: string;
  prescriptionItems: PrescriptionItemDraft[];
  prescriptionAdvice: string;
}

interface PrescriptionItemDraft {
  /**
   * Stable identity for this draft line. Keys must not be the array index: a
   * removed middle row would otherwise re-attribute the typed values of the
   * rows below it to the wrong DOM inputs.
   */
  rowId: string;
  medicationName: string;
  dosage: string;
  unit: string;
  frequency: string;
  durationDays: string;
  totalQuantity: string;
  usageNote: string;
}

let prescriptionRowSequence = 0;

function nextPrescriptionRowId(): string {
  prescriptionRowSequence += 1;
  return `rx-draft-${prescriptionRowSequence}`;
}

function emptyPrescriptionItem(): PrescriptionItemDraft {
  return {
    rowId: nextPrescriptionRowId(),
    medicationName: "",
    dosage: "",
    unit: "Viên",
    frequency: "",
    durationDays: "",
    totalQuantity: "",
    usageNote: "",
  };
}

function emptyClinicalForm(): ClinicalFormValues {
  return {
    appointmentId: "",
    patientId: "",
    diagnosis: "",
    symptomsSummary: "",
    treatmentPlan: "",
    doctorNotes: "",
    followUpDate: "",
    prescriptionItems: [emptyPrescriptionItem()],
    prescriptionAdvice: "",
  };
}

function getErrorStatus(error: unknown): number | undefined {
  return error instanceof ApiError ? error.status : undefined;
}

// The backend answers an actionable 400/409 with a Vietnamese reason the doctor
// can act on (e.g. a "check in today only" booking conflict). Surface that copy
// instead of the vague generic line; a blank, English or oversized body is not
// user-facing text, so it returns null and the table below wins. This mirrors
// the pass-through guard in lib/api.ts bookingErrorMessage.
function backendMessage(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  if (error.status !== 400 && error.status !== 409) return null;
  const normalized = error.message?.trim();
  if (!normalized || normalized.length > 240) return null;
  const VIETNAMESE_TEXT = /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i;
  return VIETNAMESE_TEXT.test(normalized) ? normalized : null;
}

function getErrorMessage(error: unknown): string {
  const authored = backendMessage(error);
  if (authored) return authored;
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

function renderRangeAppointments(
  state: LookupState<DoctorPortalAppointment[]>,
  retry: () => void,
  onSelectAppointment?: (appointment: DoctorPortalAppointment) => void,
  onUpdateStatus?: (appointment: DoctorPortalAppointment, status: "CHECKED_IN" | "IN_PROGRESS" | "NO_SHOW") => void,
) {
  if (state.status === "idle") {
    return <EmptyState description="Chọn khoảng ngày để xem lịch hẹn được phân công." title="Chưa chọn khoảng ngày" />;
  }
  if (state.status === "loading") return <LoadingState label="Đang tải lịch hẹn 7 ngày tới..." />;
  if (state.status === "error") {
    return <ErrorState message={state.message} onRetry={retry} status={state.statusCode} />;
  }
  if (state.data.length === 0) {
    return <EmptyState description="Không có lịch hẹn nào thuộc khoảng ngày và trạng thái đã chọn." title="Khoảng ngày này chưa có lịch hẹn" />;
  }
  return (
    <div className="mt-3 space-y-6">
      {groupAppointmentsByDate(state.data).map((group) => (
        <section aria-label={`Lịch hẹn ngày ${formatBusinessDate(group.date)}`} className="space-y-2" key={group.date}>
          <p className="section-note">{formatBusinessDate(group.date)} · {group.page.content.length} lịch hẹn</p>
          <PortalAppointments onSelectAppointment={onSelectAppointment} onUpdateStatus={onUpdateStatus} page={group.page} viewer="doctor" />
        </section>
      ))}
    </div>
  );
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
  const [orders, setOrders] = useState<LookupState<DiagnosticOrder[]>>({ status: "idle" });
  const [orderName, setOrderName] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [orderOperation, setOrderOperation] = useState<"idle" | "saving">("idle");
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [dailyDate, setDailyDate] = useState(getTodayIsoDate);
  const [dailyStatus, setDailyStatus] = useState("");
  const [appointmentView, setAppointmentView] = useState<"day" | "range">("day");
  const [dailyAppointments, setDailyAppointments] = useState<LookupState<Page<DoctorPortalAppointment>>>({ status: "loading" });
  const [rangeAppointments, setRangeAppointments] = useState<LookupState<DoctorPortalAppointment[]>>({ status: "idle" });
  const [dailyReloadKey, setDailyReloadKey] = useState(0);
  const [roster, setRoster] = useState<LookupState<{ schedules: DoctorRosterEntry[]; exceptions: DoctorRosterException[] }>>({ status: "loading" });
  const [rosterReloadKey, setRosterReloadKey] = useState(0);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [doctorProfile, setDoctorProfile] = useState<LookupState<Doctor>>({ status: "loading" });
  const [clinicalForm, setClinicalForm] = useState<ClinicalFormValues>(emptyClinicalForm);
  const [clinicalOperation, setClinicalOperation] = useState<"idle" | "saving">("idle");
  const [clinicalError, setClinicalError] = useState<string | null>(null);
  const [clinicalNotice, setClinicalNotice] = useState<string | null>(null);
  const [appointmentAction, setAppointmentAction] = useState<string | null>(null);
  const [appointmentError, setAppointmentError] = useState<string | null>(null);
  const [appointmentNotice, setAppointmentNotice] = useState<string | null>(null);
  const [diagnosticName, setDiagnosticName] = useState("");
  const [diagnosticValue, setDiagnosticValue] = useState("");
  const [diagnosticDate, setDiagnosticDate] = useState(getTodayIsoDate);
  const [diagnosticTime, setDiagnosticTime] = useState(businessTimeNow);
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

  useEffect(() => {
    if (!session || !hasRole(session.user, "DOCTOR") || appointmentView !== "range") return;
    let cancelled = false;
    const anchor = ISO_DATE_PATTERN.test(dailyDate) ? dailyDate : getTodayIsoDate();

    // Every page of the bounded window is loaded so the grouped view cannot
    // silently drop the tail of a busy week behind the backend page size.
    fetchAllContent(
      (page, size) => fetchDoctorAppointments({
        from: anchor,
        to: addDaysIso(anchor, 7),
        status: dailyStatus || undefined,
        page,
        size,
      }),
      100,
    ).then((items) => {
      if (!cancelled) setRangeAppointments({ status: "success", data: items });
    }).catch((error: unknown) => {
      if (cancelled) return;
      if (getErrorStatus(error) === 401) {
        clearAuthSession();
        return;
      }
      setRangeAppointments({
        status: "error",
        message: getErrorMessage(error),
        statusCode: getErrorStatus(error),
      });
    });

    return () => {
      cancelled = true;
    };
  }, [appointmentView, dailyDate, dailyReloadKey, dailyStatus, session]);

  useEffect(() => {
    if (!session || !hasRole(session.user, "DOCTOR")) return;
    let cancelled = false;
    Promise.all([fetchDoctorSchedules(), fetchDoctorScheduleExceptions()])
      .then(([schedules, exceptions]) => {
        if (!cancelled) setRoster({ status: "success", data: { schedules, exceptions } });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (getErrorStatus(error) === 401) {
          clearAuthSession();
          return;
        }
        setRoster({ status: "error", message: getErrorMessage(error), statusCode: getErrorStatus(error) });
      });
    return () => { cancelled = true; };
  }, [rosterReloadKey, session]);

  const loadPatient = async (requestedPatientId: string) => {
    const requestId = patientLookupFence.begin();
    setLookupError(null);
    setActivePatientId(requestedPatientId);
    setRecords({ status: "loading" });
    setDiagnostics({ status: "loading" });

    const [recordsResult, diagnosticsResult, ordersResult] = await Promise.allSettled([
      fetchDoctorPatientMedicalRecords(requestedPatientId),
      fetchDoctorPatientDiagnosticResults(requestedPatientId),
      fetchDoctorDiagnosticOrders(requestedPatientId),
    ]);
    if (!patientLookupFence.isCurrent(requestId)) return;

    const results = [recordsResult, diagnosticsResult];
    setSelectedOrderId("");
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
    setOrders(ordersResult.status === "fulfilled"
      ? { status: "success", data: ordersResult.value }
      : { status: "error", message: getErrorMessage(ordersResult.reason), statusCode: getErrorStatus(ordersResult.reason) });
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
    // Selecting a row is the authorization event for this patient context: the
    // appointment already carries the patient id the doctor is allowed to see,
    // so the panels load from it instead of asking for a copied UUID.
    setPatientId(appointment.patientId);
    void loadPatient(appointment.patientId);
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

  const handleCreateOrder = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!activePatientId) return;
    setOrderOperation("saving");
    setLookupError(null);
    try {
      const order = await createDoctorDiagnosticOrder(activePatientId, {
        testName: orderName.trim(),
        notes: orderNotes.trim() || undefined,
      });
      setOrders((current) => current.status === "success"
        ? { status: "success", data: [order, ...current.data] }
        : { status: "success", data: [order] });
      setOrderName("");
      setOrderNotes("");
      setDiagnosticName(order.testName);
      setSelectedOrderId(order.id);
    } catch (error: unknown) {
      setLookupError(getErrorMessage(error));
    } finally {
      setOrderOperation("idle");
    }
  };

  const handleCreateDiagnostic = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!activePatientId || !selectedOrderId) return;
    setDiagnosticOperation("saving");
    setLookupError(null);
    setDiagnosticNotice(null);
    try {
      const storedFile = diagnosticFile ? await uploadDiagnosticFile(diagnosticFile, activePatientId) : null;
      await createDoctorDiagnosticResult(activePatientId, {
        orderId: selectedOrderId,
        testName: diagnosticName.trim(),
        result: diagnosticValue.trim() || undefined,
        fileId: storedFile?.id,
        testDate: businessDateTimeIso(diagnosticDate, diagnosticTime || undefined),
      });
      setDiagnosticName("");
      setDiagnosticValue("");
      setDiagnosticFile(null);
      setOrders((current) => current.status === "success"
        ? { status: "success", data: current.data.map((order) => order.id === selectedOrderId ? { ...order, status: "COMPLETED" as const } : order) }
        : current);
      setSelectedOrderId("");
      await loadPatient(activePatientId);
      setDiagnosticNotice("Đã công bố kết quả và hoàn tất chỉ định.");
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

  const updatePrescriptionItem = (rowId: string, field: keyof PrescriptionItemDraft, value: string): void => {
    setClinicalForm((current) => ({
      ...current,
      prescriptionItems: current.prescriptionItems.map((item) => (
        item.rowId === rowId ? { ...item, [field]: value } : item
      )),
    }));
    setClinicalError(null);
  };

  const addPrescriptionItem = (): void => {
    setClinicalForm((current) => ({
      ...current,
      prescriptionItems: [...current.prescriptionItems, emptyPrescriptionItem()],
    }));
  };

  const removePrescriptionItem = (rowId: string): void => {
    setClinicalForm((current) => ({
      ...current,
      prescriptionItems: current.prescriptionItems.filter((item) => item.rowId !== rowId),
    }));
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
    const startedItems = clinicalForm.prescriptionItems.filter((item) =>
      [item.medicationName, item.dosage, item.frequency, item.durationDays, item.totalQuantity]
        .some((value) => value.trim().length > 0));
    const incompleteItems = startedItems.filter((item) =>
      [item.medicationName, item.dosage, item.frequency, item.durationDays, item.totalQuantity]
        .some((value) => value.trim().length === 0));
    if (incompleteItems.length > 0) {
      setClinicalError("Nếu kê thuốc, mỗi dòng thuốc cần đủ tên thuốc, liều dùng, tần suất, số ngày và tổng số lượng.");
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
        prescriptionItems: startedItems.length > 0 ? startedItems.map((item) => ({
          medicationName: item.medicationName.trim(),
          dosage: item.dosage.trim(),
          unit: item.unit.trim() || "Viên",
          frequency: item.frequency.trim(),
          durationDays: Number(item.durationDays),
          totalQuantity: Number(item.totalQuantity),
          usageNote: item.usageNote.trim() || undefined,
        })) : undefined,
        prescriptionAdvice: clinicalForm.prescriptionAdvice.trim() || undefined,
      });
      setClinicalForm(emptyClinicalForm());
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

  const reloadAppointments = () => {
    setDailyAppointments({ status: "loading" });
    if (appointmentView === "range") setRangeAppointments({ status: "loading" });
    setDailyReloadKey((value) => value + 1);
  };

  const retryRoster = () => {
    setRoster({ status: "loading" });
    setRosterReloadKey((value) => value + 1);
  };

  /**
   * Switching scope (or changing the date/status the scope is anchored on)
   * marks the incoming view as loading here rather than inside the effect, so
   * the effect only ever reports what the request returned.
   */
  const selectAppointmentView = (view: "day" | "range") => {
    if (view === appointmentView) return;
    setAppointmentView(view);
    if (view === "range") setRangeAppointments({ status: "loading" });
  };

  const changeScheduleAnchor = (mutate: () => void) => {
    setDailyAppointments({ status: "loading" });
    if (appointmentView === "range") setRangeAppointments({ status: "loading" });
    mutate();
  };

  const appointmentsLoading = appointmentView === "day"
    ? dailyAppointments.status === "loading"
    : rangeAppointments.status === "loading";

  return (
    <PortalChrome role="DOCTOR" user={user}>
      <div className="portal-content">
        <header className="portal-hero">
          <div>
            <p className="section-note">CỔNG BÁC SĨ</p>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="mb-0">Không gian làm việc lâm sàng</h1>
            </div>
            <p className="mt-1 text-sm text-slate-600">Quản lý lịch làm việc và hồ sơ của những người bệnh được phân công cho tài khoản này.</p>
          </div>
          <div className="portal-hero__actions flex flex-wrap items-center gap-2.5">
            <Link className="min-h-11 px-5 rounded-md bg-teal-700 text-white text-xs font-bold hover:bg-teal-800 transition flex items-center justify-center" href="/doctor/articles">
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
            <div><p className="section-note">LỊCH HẸN TRONG NGÀY</p><h2 id="daily-title">Lịch làm việc theo ngày</h2></div>
            <span aria-hidden="true" className="portal-panel__icon"><UiIcon name="calendar" size={20} /></span>
          </div>
          <p className="portal-panel__intro">Danh sách gồm mọi lịch hẹn trong ngày được phân công cho bác sĩ, kể cả lịch đang chờ bệnh nhân xác nhận — dùng bộ lọc trạng thái để thu hẹp.</p>
          <div aria-label="Phạm vi xem lịch hẹn" className="mt-1 inline-flex rounded-sm border border-slate-300 bg-white p-0.5" role="group">
            <button
              aria-pressed={appointmentView === "day"}
              className={appointmentView === "day" ? "min-h-11 rounded-sm bg-teal-700 px-3 text-xs font-bold text-white" : "min-h-11 rounded-sm px-3 text-xs font-bold text-slate-700 hover:bg-slate-100"}
              onClick={() => selectAppointmentView("day")}
              type="button"
            >
              Hôm nay
            </button>
            <button
              aria-pressed={appointmentView === "range"}
              className={appointmentView === "range" ? "min-h-11 rounded-sm bg-teal-700 px-3 text-xs font-bold text-white" : "min-h-11 rounded-sm px-3 text-xs font-bold text-slate-700 hover:bg-slate-100"}
              onClick={() => selectAppointmentView("range")}
              type="button"
            >
              7 ngày tới
            </button>
          </div>
          <p className="portal-handoff-note">
            {appointmentView === "day"
              ? "Đang xem một ngày theo ngày đã chọn."
              : "Đang xem từ ngày đã chọn đến 7 ngày sau, nhóm theo từng ngày."}
          </p>
          <form className="portal-lookup-form" onSubmit={(event) => { event.preventDefault(); reloadAppointments(); }}>
            <div>
              <label htmlFor="daily-appointment-date">Ngày xem lịch</label>
              <input id="daily-appointment-date" onChange={(event) => changeScheduleAnchor(() => setDailyDate(event.target.value))} required type="date" value={dailyDate} />
            </div>
            <div>
              <label htmlFor="daily-appointment-status">Trạng thái</label>
              <select id="daily-appointment-status" onChange={(event) => changeScheduleAnchor(() => setDailyStatus(event.target.value))} value={dailyStatus}>
                {APPOINTMENT_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <button className="outline-button" disabled={appointmentsLoading} type="submit">Làm mới lịch</button>
          </form>
          {appointmentAction ? <p aria-live="polite" className="portal-handoff-note">Đang cập nhật trạng thái lịch hẹn…</p> : null}
          {appointmentError ? <p aria-live="assertive" className="portal-inline-error" role="alert">{appointmentError}</p> : null}
          {appointmentNotice ? <p aria-live="polite" className="portal-inline-success" role="status">{appointmentNotice}</p> : null}
          {appointmentView === "day"
            ? renderDailyAppointments(dailyAppointments, reloadAppointments, handleSelectAppointment, handleUpdateAppointmentStatus)
            : renderRangeAppointments(rangeAppointments, reloadAppointments, handleSelectAppointment, handleUpdateAppointmentStatus)}
        </section>

        <div className="portal-grid">
        <section aria-labelledby="roster-title" className="portal-panel portal-panel--span-7" id="my-roster">
          <div className="portal-panel__heading">
            <div><p className="section-note">LỊCH LÀM VIỆC CỦA TÔI</p><h2 id="roster-title">Lịch làm việc và ngoại lệ</h2></div>
            <span aria-hidden="true" className="portal-panel__icon"><UiIcon name="calendar" size={20} /></span>
          </div>
          <details className="mt-2 rounded-sm border border-slate-200 bg-white p-3">
            <summary className="min-h-11 cursor-pointer text-sm font-bold text-teal-900">Xem lịch cố định theo tuần và các ngày nghỉ, khóa lịch (chỉ đọc — do quản trị viên thiết lập)</summary>
            <div className="mt-3">
              {roster.status === "loading" ? <LoadingState label="Đang tải lịch làm việc…" /> : null}
              {roster.status === "error" ? <ErrorState message={roster.message} onRetry={retryRoster} status={roster.statusCode} /> : null}
              {roster.status === "success" ? (
                <>
                  {roster.data.schedules.length === 0 ? (
                    <EmptyState description="Chưa có lịch làm việc — liên hệ quản trị viên." title="Chưa có lịch làm việc" />
                  ) : (
                    <div className="max-w-full overflow-x-auto rounded-sm border border-slate-200">
                      <table className="w-full min-w-[560px] text-left text-sm">
                        <caption className="sr-only">Lịch làm việc cố định theo tuần của bác sĩ đang đăng nhập</caption>
                        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                          <tr>
                            <th className="px-3 py-2" scope="col">Thứ</th>
                            <th className="px-3 py-2" scope="col">Cơ sở</th>
                            <th className="px-3 py-2" scope="col">Khung giờ</th>
                            <th className="px-3 py-2" scope="col">Mỗi lượt</th>
                            <th className="px-3 py-2" scope="col">Hiệu lực</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...roster.data.schedules]
                            .sort((left, right) => left.dayOfWeek - right.dayOfWeek || left.startTime.localeCompare(right.startTime))
                            .map((entry) => (
                              <tr className="border-b border-slate-100 last:border-0" key={entry.id}>
                                <th className="px-3 py-2 font-bold text-slate-900" scope="row">{rosterDayLabel(entry.dayOfWeek)}</th>
                                <td className="px-3 py-2">{entry.branchName || "Chưa cập nhật"}</td>
                                <td className="px-3 py-2">{formatClock(entry.startTime)} – {formatClock(entry.endTime)}{entry.active ? "" : " (tạm ngưng)"}</td>
                                <td className="px-3 py-2">{entry.slotDurationMinutes} phút</td>
                                <td className="px-3 py-2">{formatBusinessDate(entry.effectiveFrom)} đến {entry.effectiveTo ? formatBusinessDate(entry.effectiveTo) : "không giới hạn"}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <h3 className="mt-4 text-sm font-bold text-teal-900">Ngoại lệ</h3>
                  {roster.data.exceptions.length === 0 ? (
                    <p className="portal-handoff-note">Chưa có ngoại lệ nào được ghi nhận.</p>
                  ) : (
                    <ul className="portal-record-list">
                      {roster.data.exceptions.map((exception) => (
                        <li className="portal-record" key={exception.id}>
                          <div className="portal-record__meta">
                            <span>{formatBusinessDate(exception.exceptionDate)}</span>
                            <span>{ROSTER_EXCEPTION_LABELS[exception.type] ?? exception.type}</span>
                          </div>
                          <p>
                            {exception.branchName || "Chưa cập nhật"}
                            {exception.startTime && exception.endTime ? ` · ${formatClock(exception.startTime)} – ${formatClock(exception.endTime)}` : ""}
                          </p>
                          {exception.note ? <p><strong>Ghi chú:</strong> {exception.note}</p> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : null}
            </div>
          </details>
        </section>

        <section aria-labelledby="clinical-entry-title" className="portal-panel portal-panel--span-5" id="clinical-entry" tabIndex={-1}>
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
                <label htmlFor="clinical-context-patient-id">Mã hồ sơ bệnh nhân<input aria-describedby="clinical-context-help" id="clinical-context-patient-id" name="patientId" readOnly value={clinicalForm.patientId} /></label>
                <label htmlFor="clinical-context-appointment-id">Mã lịch hẹn<input aria-describedby="clinical-context-help" id="clinical-context-appointment-id" name="appointmentId" readOnly value={clinicalForm.appointmentId} /></label>
                <small className="col-span-2" id="clinical-context-help">Hai mã này do hệ thống điền khi bạn chọn một lịch hẹn ở trên — không cần dán thủ công.</small>
              </div>
              {!clinicalForm.appointmentId ? <p className="portal-handoff-note">Chưa chọn lịch hẹn. Hãy bấm “Ghi nhận kết quả khám” trên một lịch hợp lệ.</p> : null}
              <label>Chẩn đoán *<input required maxLength={2000} onChange={(event) => updateClinicalForm("diagnosis", event.target.value)} value={clinicalForm.diagnosis} /></label>
              <label>Triệu chứng<textarea maxLength={2000} onChange={(event) => updateClinicalForm("symptomsSummary", event.target.value)} value={clinicalForm.symptomsSummary} /></label>
              <div className="portal-clinical-form__grid">
                <label>Kế hoạch điều trị<textarea maxLength={3000} onChange={(event) => updateClinicalForm("treatmentPlan", event.target.value)} value={clinicalForm.treatmentPlan} /></label>
                <label>Ghi chú bác sĩ<textarea maxLength={2000} onChange={(event) => updateClinicalForm("doctorNotes", event.target.value)} value={clinicalForm.doctorNotes} /></label>
              </div>
              <label>Ngày tái khám<input onChange={(event) => updateClinicalForm("followUpDate", event.target.value)} placeholder="dd/mm/yyyy" type="date" value={clinicalForm.followUpDate} /></label>
              <fieldset className="portal-clinical-form__fieldset">
                <legend>Kê đơn thuốc (tuỳ chọn, nhiều dòng)</legend>
                {clinicalForm.prescriptionItems.map((item, itemIndex) => (
                  <div className="portal-clinical-form__fieldset" key={item.rowId}>
                    <legend>Thuốc {itemIndex + 1}</legend>
                    <div className="portal-clinical-form__grid">
                      <label>Tên thuốc *<input onChange={(event) => updatePrescriptionItem(item.rowId, "medicationName", event.target.value)} value={item.medicationName} /></label>
                      <label>Liều dùng *<input onChange={(event) => updatePrescriptionItem(item.rowId, "dosage", event.target.value)} value={item.dosage} /></label>
                      <label>Tần suất *<input onChange={(event) => updatePrescriptionItem(item.rowId, "frequency", event.target.value)} placeholder="Ví dụ: 2 lần/ngày" value={item.frequency} /></label>
                      <label>Đơn vị<input onChange={(event) => updatePrescriptionItem(item.rowId, "unit", event.target.value)} placeholder="Viên" value={item.unit} /></label>
                      <label>Số ngày *<input min="1" onChange={(event) => updatePrescriptionItem(item.rowId, "durationDays", event.target.value)} type="number" value={item.durationDays} /></label>
                      <label>Tổng số lượng *<input min="1" onChange={(event) => updatePrescriptionItem(item.rowId, "totalQuantity", event.target.value)} type="number" value={item.totalQuantity} /></label>
                    </div>
                    <label>Dặn dò dùng thuốc<textarea onChange={(event) => updatePrescriptionItem(item.rowId, "usageNote", event.target.value)} value={item.usageNote} /></label>
                    {clinicalForm.prescriptionItems.length > 1 ? (
                      <button
                        className="outline-button outline-button--small"
                        onClick={() => removePrescriptionItem(item.rowId)}
                        type="button"
                      >
                        Xóa thuốc {itemIndex + 1}
                      </button>
                    ) : null}
                  </div>
                ))}
                <button className="outline-button outline-button--small" onClick={() => addPrescriptionItem()} type="button">+ Thêm thuốc</button>
                <label>Dặn dò chung<textarea maxLength={2000} onChange={(event) => updateClinicalForm("prescriptionAdvice", event.target.value)} value={clinicalForm.prescriptionAdvice} /></label>
              </fieldset>
              {clinicalError ? <p aria-live="assertive" className="portal-inline-error" role="alert">{clinicalError}</p> : null}
              {clinicalNotice ? <p aria-live="polite" className="portal-inline-success" role="status">{clinicalNotice}</p> : null}
              <button className="button button--primary" disabled={clinicalOperation === "saving" || !clinicalForm.appointmentId} type="submit">{clinicalOperation === "saving" ? "Đang gửi…" : "Lưu kết quả và hoàn tất lịch"}</button>
            </form>
          ) : null}
        </section>
        </div>

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
                "Chưa có hồ sơ khám phù hợp cho người bệnh này. Kiểm tra mã hồ sơ hoặc chọn lại từ lịch khám ở trên.",
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
              <form className="portal-clinical-form" onSubmit={handleCreateOrder}>
                <p className="portal-panel__intro"><strong>Bước 1 — Chỉ định xét nghiệm:</strong> lập chỉ định trước khi có kết quả.</p>
                <div className="portal-clinical-form__grid">
                  <label>Tên xét nghiệm *<input maxLength={200} onChange={(event) => setOrderName(event.target.value)} required value={orderName} /></label>
                  <label>Ghi chú chỉ định<input maxLength={1000} onChange={(event) => setOrderNotes(event.target.value)} value={orderNotes} /></label>
                </div>
                <button className="button button--primary" disabled={orderOperation === "saving" || !activePatientId} type="submit">{orderOperation === "saving" ? "Đang lập chỉ định…" : "Lập chỉ định xét nghiệm"}</button>
              </form>

              {renderLookupState(
                orders,
                "Chưa có chỉ định xét nghiệm",
                "Chưa có chỉ định nào cho người bệnh này. Hãy lập chỉ định ở trên trước khi công bố kết quả.",
                () => activePatientId && void loadPatient(activePatientId),
                (items) => (
                  <div className="portal-record-list">
                    {items.map((order) => (
                      <label className="portal-record" key={order.id}>
                        <input
                          checked={selectedOrderId === order.id}
                          disabled={order.status !== "REQUESTED" && order.status !== "COLLECTED"}
                          onChange={() => { setSelectedOrderId(order.id); setDiagnosticName(order.testName); }}
                          type="radio"
                          name="diagnostic-order"
                        />
                        <span>
                          <strong>{order.testName}</strong> · <span>{order.status === "REQUESTED" ? "Đã chỉ định" : order.status === "COLLECTED" ? "Đã lấy mẫu" : order.status === "COMPLETED" ? "Đã có kết quả" : "Đã hủy"}</span>
                          {order.notes ? <><br /><small>{order.notes}</small></> : null}
                        </span>
                      </label>
                    ))}
                  </div>
                ),
              )}

              <form className="portal-clinical-form" onSubmit={handleCreateDiagnostic}>
                <p className="portal-panel__intro"><strong>Bước 2 — Công bố kết quả:</strong> chọn một chỉ định đang mở ở trên.</p>
                <div className="portal-clinical-form__grid">
                  <label>Tên xét nghiệm *<input maxLength={200} onChange={(event) => setDiagnosticName(event.target.value)} required value={diagnosticName} /></label>
                  <label>Ngày thực hiện<input max={getTodayIsoDate()} onChange={(event) => setDiagnosticDate(event.target.value)} required type="date" value={diagnosticDate} /></label>
                  <label>Giờ thực hiện<input onChange={(event) => setDiagnosticTime(event.target.value)} type="time" value={diagnosticTime} /></label>
                </div>
                <p className="portal-handoff-note">Chỉ có thể công bố kết quả cho bệnh nhân đang có lịch khám hôm nay với bạn (đã xác nhận, đã tiếp nhận hoặc đang khám) và phải chọn một chỉ định đang mở.</p>
                <label>Kết quả<textarea maxLength={4000} onChange={(event) => setDiagnosticValue(event.target.value)} value={diagnosticValue} /></label>
                <label>Tệp đính kèm (tuỳ chọn)<input accept="application/pdf,image/jpeg,image/png" onChange={(event) => setDiagnosticFile(event.target.files?.[0] ?? null)} type="file" /></label>
                {diagnosticNotice ? <p aria-live="polite" className="portal-inline-success" role="status">{diagnosticNotice}</p> : null}
                <button className="button button--primary" disabled={diagnosticOperation === "saving" || !selectedOrderId} type="submit" title={selectedOrderId ? undefined : "Hãy chọn một chỉ định đang mở"}>{diagnosticOperation === "saving" ? "Đang công bố…" : "Công bố kết quả"}</button>
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
