"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { adminListJobApplications, adminUpdateJobApplicationStatus, type JobApplicationAdminSummary } from "../../../lib/api-client";
import { formatBusinessDateTime } from "../../../lib/business-time";
import AdminState from "../_components/AdminState";
import ConfirmActionDialog from "../../../components/ui/ConfirmActionDialog";
import { describeAdminError } from "../_lib/errors";

const APPLICATION_STATUSES = [
  ["SUBMITTED", "Mới tiếp nhận"],
  ["UNDER_REVIEW", "Đang xem xét"],
  ["INTERVIEW", "Phỏng vấn"],
  ["OFFERED", "Đề nghị nhận việc"],
  ["REJECTED", "Không phù hợp"],
  ["WITHDRAWN", "Ứng viên rút hồ sơ"],
] as const;

type ApplicationStatus = (typeof APPLICATION_STATUSES)[number][0];

function statusLabel(status: string): string {
  return APPLICATION_STATUSES.find(([value]) => value === status)?.[1] ?? status.replaceAll("_", " ");
}

function statusTone(status: string): string {
  if (status === "OFFERED") return "bg-emerald-100 text-emerald-900";
  if (status === "REJECTED" || status === "WITHDRAWN") return "bg-slate-200 text-slate-700";
  if (status === "INTERVIEW") return "bg-amber-100 text-amber-900";
  return "bg-teal-100 text-teal-900";
}

export default function AdminCareersPage() {
  const [items, setItems] = useState<JobApplicationAdminSummary[]>([]);
  const [status, setStatus] = useState("SUBMITTED");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<{ item: JobApplicationAdminSummary; next: ApplicationStatus } | null>(null);
  const [statusPending, setStatusPending] = useState(false);
  const loadRequestRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await adminListJobApplications({ status: status || undefined, page, size: 20 });
      if (requestId !== loadRequestRef.current) return;
      setItems(result.content);
      setTotal(result.totalElements);
      setTotalPages(result.totalPages);
    } catch (reason) {
      if (requestId !== loadRequestRef.current) return;
      setError(describeAdminError(reason).description);
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    void Promise.resolve().then(() => load());
    return () => { loadRequestRef.current += 1; };
  }, [load]);

  const submitStatus = async (): Promise<void> => {
    const current = pendingStatus;
    if (!current || statusPending) return;
    setStatusPending(true);
    setUpdating(current.item.id);
    setError(null);
    try {
      await adminUpdateJobApplicationStatus(current.item.id, current.next);
      setPendingStatus(null);
      await load();
    } catch (reason) {
      setError(describeAdminError(reason).description);
    } finally {
      setUpdating(null);
      setStatusPending(false);
    }
  };

  return (
    <div>
      <header className="border-b border-slate-200 pb-6">
        <h1 className="text-3xl font-bold text-slate-950">Hồ sơ ứng tuyển</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Theo dõi và cập nhật tiến trình hồ sơ từ các ứng viên nộp qua trang tuyển dụng công khai.
        </p>
      </header>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <label className="text-sm font-semibold">Trạng thái<select className="mt-1 block min-h-11 rounded-lg border border-slate-300 px-3" onChange={(event) => { setStatus(event.target.value); setPage(0); }} value={status}><option value="">Tất cả</option>{APPLICATION_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <div className="flex items-center gap-4"><span className="text-sm text-slate-600">Tổng cộng <strong>{total.toLocaleString("vi-VN")}</strong></span><button className="text-sm font-bold text-teal-800 underline" disabled={loading} onClick={() => void load()} type="button">Làm mới</button></div>
      </div>
      {error ? <div className="mt-4"><AdminState tone="error" title="Không thể xử lý hồ sơ" description={error} /></div> : null}
      {loading ? <div className="mt-4"><AdminState tone="loading" title="Đang tải hồ sơ ứng tuyển" description="Đang lấy danh sách hồ sơ mới nhất." /></div> : null}
      {!loading && !error && items.length === 0 ? <div className="mt-4"><AdminState tone="empty" title="Không có hồ sơ" description="Không có hồ sơ ứng tuyển phù hợp với trạng thái đã chọn." /></div> : null}
      {!loading && items.length > 0 ? (
        <div aria-label="Danh sách hồ sơ ứng tuyển, có thể cuộn ngang trên màn hình nhỏ" className="mt-4 max-w-full overflow-x-auto rounded-lg border border-slate-200 bg-white" role="region" tabIndex={0}>
          <table className="w-full min-w-[1050px] text-left text-sm">
            <caption className="sr-only">Danh sách hồ sơ ứng tuyển và tiến trình xử lý</caption>
            <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Hồ sơ</th><th className="px-4 py-3">Ứng viên</th><th className="px-4 py-3">Vị trí</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Chuyển trạng thái</th></tr></thead>
            <tbody>{items.map((item) => <tr className="border-b border-slate-100 align-top last:border-0" key={item.id}>
              <td className="px-4 py-4"><strong className="font-mono text-xs">{item.applicationCode}</strong><br /><span className="text-xs text-slate-500">Gửi {formatBusinessDateTime(item.submittedAt)}</span><br /><button className="mt-1 text-xs font-bold text-teal-800 underline disabled:opacity-50" disabled={updating === item.id} onClick={() => setExpandedId((current) => current === item.id ? null : item.id)} type="button">{expandedId === item.id ? "Ẩn thư giới thiệu" : "Xem thư giới thiệu"}</button>{expandedId === item.id ? <p className="mt-2 max-w-sm whitespace-pre-line rounded-md bg-slate-50 p-2 text-xs text-slate-700">{item.coverLetter || "(Không có thư giới thiệu)"}</p> : null}</td>
              <td className="px-4 py-4">{item.fullName}<br /><span className="text-xs text-slate-500">{item.email}</span><br /><span className="text-xs text-slate-500">{item.phone}</span>{item.yearsExperience != null ? <><br /><span className="text-xs text-slate-500">{item.yearsExperience} năm kinh nghiệm</span></> : null}{item.resumeUrl ? <><br /><a className="text-xs font-bold text-teal-800 underline" href={item.resumeUrl} rel="noopener noreferrer" target="_blank">Hồ sơ đính kèm ↗</a></> : null}</td>
              <td className="px-4 py-4">{item.jobTitle}</td>
              <td className="px-4 py-4"><span className={`rounded-md px-2 py-1 text-xs font-bold ${statusTone(item.status)}`}>{statusLabel(item.status)}</span></td>
              <td className="px-4 py-4"><div className="flex flex-wrap gap-2">{APPLICATION_STATUSES.filter(([value]) => value !== item.status).map(([value, label]) => <button className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50" disabled={updating === item.id} key={value} onClick={() => setPendingStatus({ item, next: value })} type="button">{label}</button>)}</div></td>
            </tr>)}</tbody>
          </table>
        </div>
      ) : null}
      <nav aria-label="Phân trang hồ sơ ứng tuyển" className="mt-5 flex justify-end gap-2"><button className="rounded-lg border px-3 text-sm disabled:opacity-40" disabled={page === 0 || loading} onClick={() => setPage((value) => value - 1)} type="button">Trang trước</button><span className="inline-flex min-h-11 items-center px-3 text-sm">{totalPages === 0 ? 0 : page + 1}/{totalPages}</span><button className="rounded-lg border px-3 text-sm disabled:opacity-40" disabled={page + 1 >= totalPages || loading} onClick={() => setPage((value) => value + 1)} type="button">Trang sau</button></nav>

      <ConfirmActionDialog
        confirmLabel={pendingStatus?.next === "REJECTED" ? "Đánh dấu không phù hợp" : "Chuyển trạng thái"}
        confirmingLabel="Đang cập nhật hồ sơ…"
        description={pendingStatus?.next === "REJECTED"
          ? "Ứng viên sẽ không còn ở vòng xử lý. Hãy chắc chắn đã xem đủ thư giới thiệu và hồ sơ đính kèm."
          : "Trạng thái mới sẽ được ghi vào tiến trình xử lý hồ sơ của ứng viên."}
        destructive={pendingStatus?.next === "REJECTED"}
        dismissOnBackdrop={false}
        entity={pendingStatus?.item}
        onCancel={() => { if (!statusPending) setPendingStatus(null); }}
        onConfirm={() => void submitStatus()}
        open={pendingStatus !== null}
        pending={statusPending}
        summaryItems={pendingStatus ? [
          { label: "Mã hồ sơ", value: pendingStatus.item.applicationCode, mono: true },
          { label: "Ứng viên", value: pendingStatus.item.fullName },
          { label: "Vị trí", value: pendingStatus.item.jobTitle },
          { label: "Trạng thái hiện tại", value: statusLabel(pendingStatus.item.status) },
          { label: "Chuyển sang", value: statusLabel(pendingStatus.next) },
        ] : []}
        summaryLabel="Hồ sơ đang xét"
        title={pendingStatus?.next === "REJECTED" ? "Đánh dấu hồ sơ không phù hợp?" : "Chuyển trạng thái hồ sơ?"}
      />
    </div>
  );
}
