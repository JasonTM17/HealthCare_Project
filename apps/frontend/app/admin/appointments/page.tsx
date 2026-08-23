"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { adminListAppointments, type AppointmentDetails } from "../../../lib/api-client";
import { formatBusinessDate } from "../../../lib/business-time";
import AdminState from "../_components/AdminState";
import { describeAdminError } from "../_lib/errors";

const STATUS_OPTIONS = [
  ["PENDING_CONFIRMATION", "Chờ xác nhận"],
  ["CONFIRMED", "Đã xác nhận"],
  ["CHECKED_IN", "Đã tiếp nhận"],
  ["IN_PROGRESS", "Đang khám"],
  ["COMPLETED", "Đã hoàn tất"],
  ["CANCELLED", "Đã hủy"],
  ["NO_SHOW", "Không đến"],
] as const;

type Filters = { date: string; status: string };
const EMPTY_FILTERS: Filters = { date: "", status: "" };

function statusLabel(status: string): string {
  return STATUS_OPTIONS.find(([value]) => value === status)?.[1] ?? status.replaceAll("_", " ");
}

function formatTime(value?: string): string {
  return value ? value.slice(0, 5) : "Chưa cập nhật";
}

export default function AdminAppointmentsPage() {
  const [appointments, setAppointments] = useState<AppointmentDetails[]>([]);
  const [draftFilters, setDraftFilters] = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await adminListAppointments({
        date: appliedFilters.date || undefined,
        status: appliedFilters.status || undefined,
        page,
        size: 20,
      });
      setAppointments(result.content); setTotalPages(result.totalPages); setTotal(result.totalElements);
    } catch (reason) {
      setError(describeAdminError(reason).description);
    } finally { setLoading(false); }
  }, [appliedFilters, page]);

  useEffect(() => {
    const task = Promise.resolve().then(() => load());
    return () => void task;
  }, [load]);

  const applyFilters = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const filtersChanged = draftFilters.date !== appliedFilters.date || draftFilters.status !== appliedFilters.status;
    if (page !== 0) setPage(0);
    if (filtersChanged) setAppliedFilters(draftFilters);
    if (!filtersChanged && page === 0) void load();
  };

  const clearFilters = (): void => {
    setDraftFilters(EMPTY_FILTERS);
    setPage(0);
    setAppliedFilters(EMPTY_FILTERS);
  };

  return (
    <div>
      <header className="border-b border-slate-200 pb-6">
        <h1 className="text-3xl font-bold text-slate-950">Danh sách lịch hẹn</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Theo dõi lịch khám theo ngày, trạng thái, bệnh nhân, bác sĩ và cơ sở phụ trách. Trạng thái lâm sàng do bác sĩ phụ trách cập nhật.</p>
      </header>

      <form aria-busy={loading} className="mt-6 grid gap-3 border-b border-slate-200 bg-white p-4 sm:grid-cols-[1fr_1fr_auto]" onSubmit={applyFilters}>
        <label className="text-sm font-semibold">Ngày khám<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" onChange={(event) => setDraftFilters((current) => ({ ...current, date: event.target.value }))} type="date" value={draftFilters.date} /></label>
        <label className="text-sm font-semibold">Trạng thái<select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" onChange={(event) => setDraftFilters((current) => ({ ...current, status: event.target.value }))} value={draftFilters.status}><option value="">Tất cả trạng thái</option>{STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <div className="flex flex-wrap items-end gap-2">
          <button className="rounded-lg bg-teal-700 px-5 text-sm font-bold text-white disabled:opacity-50" disabled={loading} type="submit">Áp dụng</button>
          {draftFilters.date || draftFilters.status ? <button className="rounded-lg px-3 text-sm font-bold text-teal-800 underline underline-offset-4" disabled={loading} onClick={clearFilters} type="button">Xóa lọc</button> : null}
        </div>
      </form>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-600">Tổng cộng <strong>{total.toLocaleString("vi-VN")}</strong> lịch hẹn</p><button className="text-sm font-bold text-teal-800 underline underline-offset-4 disabled:opacity-50" disabled={loading} onClick={() => void load()} type="button">Làm mới</button></div>
      {loading ? <div className="mt-4"><AdminState tone="loading" title="Đang tải lịch hẹn" description="Danh sách vận hành đang được cập nhật." /></div> : null}
      {!loading && error ? <div className="mt-4"><AdminState action={<button className="text-sm font-bold underline underline-offset-4" onClick={() => void load()} type="button">Thử lại</button>} tone="error" title="Không thể tải lịch hẹn" description={error} /></div> : null}
      {!loading && !error && appointments.length === 0 ? <div className="mt-4"><AdminState tone="empty" title="Không có lịch hẹn" description="Không có bản ghi phù hợp với bộ lọc hiện tại." /></div> : null}
      {!loading && !error && appointments.length > 0 ? (
        <div aria-label="Bảng lịch hẹn, có thể cuộn ngang trên màn hình nhỏ" className="mt-4 max-w-full overflow-x-auto rounded-lg border border-slate-200 bg-white" role="region" tabIndex={0}>
          <table className="w-full min-w-[860px] text-left text-sm">
            <caption className="sr-only">Danh sách lịch hẹn trong khu vực quản trị</caption>
            <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Mã</th><th className="px-4 py-3">Thời gian</th><th className="px-4 py-3">Bệnh nhân</th><th className="px-4 py-3">Bác sĩ</th><th className="px-4 py-3">Cơ sở</th><th className="px-4 py-3">Trạng thái</th></tr></thead>
            <tbody>{appointments.map((item) => <tr className="border-b border-slate-100 last:border-0" key={item.id}><td className="px-4 py-4 font-mono text-xs">{item.bookingCode}</td><td className="px-4 py-4"><strong>{formatBusinessDate(item.appointmentDate)}</strong><br />{formatTime(item.startTime)} - {formatTime(item.endTime)}</td><td className="px-4 py-4"><strong>{item.patientName}</strong><br /><span className="text-xs text-slate-500">{item.patientPhone}</span></td><td className="px-4 py-4">{item.doctorName}</td><td className="px-4 py-4">{item.branchName || "Chưa cập nhật"}</td><td className="px-4 py-4"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{statusLabel(item.status)}</span></td></tr>)}</tbody>
          </table>
        </div>
      ) : null}
      <nav aria-label="Phân trang lịch hẹn" className="admin-pagination mt-5 flex flex-wrap justify-end gap-2"><button className="rounded-lg border px-3 text-sm disabled:opacity-40" disabled={page === 0 || loading} onClick={() => setPage((value) => value - 1)} type="button">Trang trước</button><span aria-live="polite" className="inline-flex min-h-11 items-center px-3 text-sm">{totalPages === 0 ? 0 : page + 1}/{totalPages}</span><button className="rounded-lg border px-3 text-sm disabled:opacity-40" disabled={page + 1 >= totalPages || loading} onClick={() => setPage((value) => value + 1)} type="button">Trang sau</button></nav>
    </div>
  );
}
