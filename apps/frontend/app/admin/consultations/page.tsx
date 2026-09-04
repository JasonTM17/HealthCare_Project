"use client";

import { useEffect, useMemo, useState } from "react";
import { ForbiddenState, LoadingState, LoginRequiredState } from "../../../components/PortalStates";
import { useAuthSession } from "../../../components/useAuthSession";
import {
  ApiError,
  adminListDoctors,
  assignAdminConsultation,
  fetchAdminConsultationQueue,
  hasRole,
} from "../../../lib/api-client";
import { presentApiError } from "../../../lib/present-api-error";
import type { ConsultationAdminQueueItem, Doctor } from "../../../types/hospital";

const STATUS_OPTIONS: Array<[string, string]> = [
  ["OPEN", "Đang mở"],
  ["WAITING_FOR_DOCTOR", "Chờ bác sĩ"],
  ["WAITING_FOR_PATIENT", "Chờ bệnh nhân"],
  ["RESOLVED", "Đã xử lý"],
  ["CLOSED", "Đã đóng"],
  ["EXPIRED", "Đã hết hạn"],
];

const STATUS_LABELS = Object.fromEntries(STATUS_OPTIONS) as Record<string, string>;
const ROLE_LABELS: Record<string, string> = {
  ASSIGNED_DOCTOR: "Bác sĩ phụ trách",
  HANDOFF_DOCTOR: "Bác sĩ nhận bàn giao",
};

const SPECIALTY_LABELS: Record<string, string> = {
  cardiology: "Tim mạch",
  dermatology: "Da liễu",
  endocrinology: "Nội tiết",
  gastroenterology: "Tiêu hóa",
  neurology: "Thần kinh",
  oncology: "Ung bướu",
  orthopedics: "Cơ xương khớp",
  pediatrics: "Nhi khoa",
  respiratory: "Hô hấp",
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? "Đang cập nhật";
}

function statusTone(status: string): string {
  if (status === "RESOLVED" || status === "CLOSED") return "bg-slate-200 text-slate-700";
  if (status === "EXPIRED") return "bg-rose-100 text-rose-900";
  if (status === "WAITING_FOR_DOCTOR") return "bg-amber-100 text-amber-900";
  return "bg-teal-100 text-teal-900";
}

function specialtyLabel(value?: string | null): string {
  if (!value) return "Chuyên khoa đang cập nhật";
  return SPECIALTY_LABELS[value.toLowerCase()] ?? "Chuyên khoa đã phân loại";
}

function dateLabel(value?: string | null): string {
  if (!value) return "Chưa có";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Chưa có"
    : date.toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" });
}

function isClosed(status: string): boolean {
  return status === "RESOLVED" || status === "CLOSED" || status === "EXPIRED";
}

function isDue(item: ConsultationAdminQueueItem, now = Date.now()): boolean {
  if (isClosed(item.status) || item.firstRespondedAt || !item.firstResponseDueAt) return false;
  const due = Date.parse(item.firstResponseDueAt);
  return Number.isFinite(due) && due < now;
}

function slaLabel(item: ConsultationAdminQueueItem): string {
  if (item.firstRespondedAt) return `Đã phản hồi ${dateLabel(item.firstRespondedAt)}`;
  if (isDue(item)) return `Đã quá hạn từ ${dateLabel(item.firstResponseDueAt)}`;
  return `Hạn phản hồi ${dateLabel(item.firstResponseDueAt)}`;
}

function StateBadge({ status }: { status: string }) {
  return (
    <span aria-label={`Trạng thái: ${statusLabel(status)}`} className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusTone(status)}`}>
      {statusLabel(status)}
    </span>
  );
}

export default function AdminConsultationsPage() {
  const session = useAuthSession();
  const [items, setItems] = useState<ConsultationAdminQueueItem[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [doctorsLoading, setDoctorsLoading] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [doctorsError, setDoctorsError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [slaFilter, setSlaFilter] = useState<"ALL" | "DUE" | "ON_TRACK">("ALL");
  const [assigning, setAssigning] = useState<string | null>(null);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!session || !hasRole(session.user, "ADMIN")) return;
    let cancelled = false;
    void Promise.resolve()
      .then(() => {
        if (cancelled) return undefined;
        setQueueLoading(true);
        setQueueError(null);
        return fetchAdminConsultationQueue();
      })
      .then((value) => {
        if (!cancelled && value) setItems(value);
      })
      .catch((reason) => {
        if (!cancelled) setQueueError(presentApiError(reason instanceof ApiError ? reason.code : undefined, reason instanceof ApiError ? reason.status : undefined));
      })
      .finally(() => {
        if (!cancelled) setQueueLoading(false);
      });

    void Promise.resolve()
      .then(() => {
        if (cancelled) return undefined;
        setDoctorsLoading(true);
        setDoctorsError(null);
        return adminListDoctors(0, 100);
      })
      .then((value) => {
        if (!cancelled && value) setDoctors(value.content.filter((doctor) => doctor.active !== false));
      })
      .catch((reason) => {
        if (!cancelled) setDoctorsError(presentApiError(reason instanceof ApiError ? reason.code : undefined, reason instanceof ApiError ? reason.status : undefined));
      })
      .finally(() => {
        if (!cancelled) setDoctorsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [retry, session]);

  const filteredItems = useMemo(() => items.filter((item) => {
    if (statusFilter && item.status !== statusFilter) return false;
    if (slaFilter === "DUE" && !isDue(item)) return false;
    if (slaFilter === "ON_TRACK" && isDue(item)) return false;
    return true;
  }), [items, slaFilter, statusFilter]);

  const openCount = useMemo(() => items.filter((item) => !isClosed(item.status)).length, [items]);
  const dueCount = useMemo(() => items.filter((item) => isDue(item)).length, [items]);
  const activeFilterCount = Number(Boolean(statusFilter)) + Number(slaFilter !== "ALL");
  const hasFilters = activeFilterCount > 0;

  const resetFilters = (): void => {
    setStatusFilter("");
    setSlaFilter("ALL");
  };

  const assign = async (item: ConsultationAdminQueueItem): Promise<void> => {
    const doctorId = selection[item.threadId];
    if (!doctorId || assigning || doctorsLoading || doctorsError) return;
    setAssigning(item.threadId);
    setQueueError(null);
    setNotice(null);
    try {
      await assignAdminConsultation(item.threadId, doctorId);
      setNotice("Đã cập nhật phân công. Hàng đợi sẽ được tải lại.");
      setRetry((value) => value + 1);
    } catch (reason) {
      setQueueError(presentApiError(reason instanceof ApiError ? reason.code : undefined, reason instanceof ApiError ? reason.status : undefined));
    } finally {
      setAssigning(null);
    }
  };

  if (!session) return <main className="portal-entry"><LoginRequiredState nextPath="/admin/consultations" /></main>;
  if (!hasRole(session.user, "ADMIN")) return <main className="portal-entry"><ForbiddenState title="Không có quyền điều phối" description="Hàng đợi tư vấn chỉ dành cho ADMIN và chỉ hiển thị metadata vận hành." /></main>;

  return (
    <div className="section-inner portal-page admin-page grid gap-6">
      <header className="portal-hero">
        <div>
          <p className="section-note">CONSULTATION OPERATIONS</p>
          <h1>Hàng đợi tư vấn riêng</h1>
          <p>Điều phối SLA và phân công bác sĩ mà không đọc chủ đề, nội dung tin nhắn, tệp hoặc danh tính bệnh nhân.</p>
          <div aria-label="Tóm tắt hàng đợi" className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-teal-900">
            <span className="rounded-full bg-teal-50 px-3 py-1.5">{openCount} kênh đang mở</span>
            <span className="rounded-full bg-amber-50 px-3 py-1.5">{dueCount} kênh quá SLA</span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5">{items.length} kênh metadata</span>
          </div>
        </div>
        <button aria-label="Tải lại hàng đợi tư vấn" className="outline-button min-h-11" disabled={queueLoading || doctorsLoading} onClick={() => setRetry((value) => value + 1)} type="button">
          {queueLoading || doctorsLoading ? "Đang tải…" : "Tải lại"}
        </button>
      </header>

      <section aria-label="Phạm vi quyền" className="portal-panel grid gap-3">
        <p className="section-note">METADATA-ONLY</p>
        <p className="portal-panel__intro">ADMIN chỉ thấy trạng thái, SLA, chuyên khoa và assignment. Không có subject, transcript, attachment, patient name, contact hay profile identifier trong projection này.</p>
        <p className="text-sm font-bold text-teal-900">Mã kênh nội bộ được giữ kín trên giao diện; chỉ số thứ tự dùng để điều phối.</p>
      </section>

      <section aria-labelledby="consultation-filter-title" className="grid gap-4 rounded-2xl border border-teal-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="section-note">QUEUE FILTERS</p>
            <h2 className="text-lg font-black text-teal-950" id="consultation-filter-title">Lọc ưu tiên vận hành</h2>
            <p className="mt-1 text-sm text-slate-600">Lọc cục bộ theo trạng thái và SLA; không tải thêm dữ liệu nhạy cảm.</p>
          </div>
          <button className="outline-button outline-button--small min-h-11" disabled={!hasFilters} onClick={resetFilters} type="button">Xóa bộ lọc{hasFilters ? ` (${activeFilterCount})` : ""}</button>
        </div>
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="sr-only">Bộ lọc hàng đợi tư vấn</legend>
          <label className="grid gap-1 text-sm font-bold text-slate-800" htmlFor="consultation-status-filter">
            Trạng thái
            <select className="min-h-11 rounded-lg border border-slate-300 px-3" id="consultation-status-filter" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
              <option value="">Tất cả trạng thái</option>
              {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-bold text-slate-800" htmlFor="consultation-sla-filter">
            Ưu tiên SLA
            <select className="min-h-11 rounded-lg border border-slate-300 px-3" id="consultation-sla-filter" onChange={(event) => setSlaFilter(event.target.value as "ALL" | "DUE" | "ON_TRACK")} value={slaFilter}>
              <option value="ALL">Tất cả kênh</option>
              <option value="DUE">Quá SLA trước</option>
              <option value="ON_TRACK">Còn trong hạn</option>
            </select>
          </label>
        </fieldset>
      </section>

      {notice ? <p aria-live="polite" className="notice" role="status">{notice}</p> : null}
      {queueError ? <div aria-live="assertive" className="error-banner" role="alert"><span>{queueError}{items.length ? " Đang hiển thị metadata lần tải trước ở chế độ chỉ đọc." : ""}</span><button className="outline-button outline-button--small min-h-11" onClick={() => setRetry((value) => value + 1)} type="button">Tải lại hàng đợi</button></div> : null}
      {doctorsError ? <div aria-live="polite" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="status"><span>Chưa tải được danh sách bác sĩ đủ quyền. Bạn vẫn có thể xem SLA; thử tải lại để cập nhật phân công.</span><button className="outline-button outline-button--small min-h-11 ml-3" onClick={() => setRetry((value) => value + 1)} type="button">Tải lại bác sĩ</button></div> : null}
      {queueLoading ? <LoadingState label="Đang tải hàng đợi tư vấn…" /> : null}
      {!queueLoading && !queueError && filteredItems.length === 0 ? <div className="portal-empty-state grid gap-2" role="status"><p>{hasFilters ? "Không có kênh phù hợp với bộ lọc hiện tại." : "Hiện chưa có kênh cần điều phối."}</p>{hasFilters ? <button className="outline-button outline-button--small min-h-11 w-fit" onClick={resetFilters} type="button">Xem toàn bộ hàng đợi</button> : null}</div> : null}

      {!queueLoading && filteredItems.length > 0 ? (
        <section aria-busy={queueLoading} aria-label="Danh sách kênh tư vấn metadata-only" className="grid gap-4" aria-live="polite">
          <p className="text-sm font-bold text-teal-950" role="status">{filteredItems.length} kênh phù hợp · {dueCount} kênh quá SLA toàn hàng đợi</p>
          {filteredItems.map((item, index) => {
            const due = isDue(item);
            const doctorSelection = selection[item.threadId] ?? "";
            const controlId = `consultation-assignment-${index}`;
            return (
              <article className={`portal-panel grid gap-3 ${due ? "border-amber-300 bg-amber-50" : ""}`} key={item.threadId}>
                <div className="portal-panel__heading">
                  <div>
                    <p className="section-note">Kênh #{index + 1}</p>
                    <h2>{specialtyLabel(item.specialtySlug)}</h2>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2"><StateBadge status={item.status} /><span className={due ? "inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900" : "inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-900"}>{due ? "Quá SLA" : "Theo dõi SLA"}</span></div>
                </div>
                <dl className="grid gap-3 text-sm sm:grid-cols-3">
                  <div><dt className="font-bold text-slate-600">Phản hồi đầu tiên</dt><dd>{slaLabel(item)}</dd></div>
                  <div><dt className="font-bold text-slate-600">Cửa sổ tư vấn</dt><dd>{dateLabel(item.consultationOpenUntil)}</dd></div>
                  <div><dt className="font-bold text-slate-600">Cập nhật gần nhất</dt><dd>{dateLabel(item.updatedAt)}</dd></div>
                </dl>
                <p className="text-xs text-slate-600">Phân công: {ROLE_LABELS[item.assignmentRole ?? ""] ?? "Chưa phân công"} · Quyền: Chỉ metadata vận hành</p>
                <div className="flex flex-wrap items-end gap-2 border-t border-slate-200 pt-3">
                  <label className="grid min-w-64 flex-1 gap-1 text-sm font-bold" htmlFor={controlId}>
                    Bác sĩ nhận bàn giao
                    <select aria-describedby={`${controlId}-help`} className="min-h-11 rounded-lg border border-slate-300 px-3" disabled={doctorsLoading || Boolean(doctorsError) || assigning === item.threadId} id={controlId} onChange={(event) => setSelection((current) => ({ ...current, [item.threadId]: event.target.value }))} value={doctorSelection}>
                      <option value="">Chọn bác sĩ đủ quyền</option>
                      {doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.fullName}{doctor.specialtyName ? ` · ${doctor.specialtyName}` : ""}</option>)}
                    </select>
                  </label>
                  <button aria-describedby={`${controlId}-help`} className="outline-button min-h-11" disabled={assigning === item.threadId || doctorsLoading || Boolean(doctorsError) || !doctorSelection} onClick={() => void assign(item)} type="button">{assigning === item.threadId ? "Đang lưu…" : "Cập nhật phân công"}</button>
                  <p className="w-full text-xs text-slate-600" id={`${controlId}-help`}>{doctorsError ? "Danh sách bác sĩ chưa sẵn sàng." : "Chọn bác sĩ được hệ thống cho phép; nội dung tư vấn không mở trong màn hình điều phối."}</p>
                </div>
              </article>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
