"use client";

import { useCallback, useEffect, useState } from "react";
import { adminListAppointments, type AppointmentDetails } from "../../../lib/api-client";
import AdminState from "../_components/AdminState";
import { describeAdminError } from "../_lib/errors";

const STATUS_OPTIONS = [
  "PENDING_CONFIRMATION", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW",
];

export default function AdminAppointmentsPage() {
  const [appointments, setAppointments] = useState<AppointmentDetails[]>([]);
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await adminListAppointments({ date: date || undefined, status: status || undefined, page, size: 20 });
      setAppointments(result.content); setTotalPages(result.totalPages); setTotal(result.totalElements);
    } catch (reason) {
      setError(describeAdminError(reason).description);
    } finally { setLoading(false); }
  }, [date, status, page]);

  useEffect(() => {
    const task = Promise.resolve().then(() => load());
    return () => void task;
  }, [load]);

  const applyFilters = (event: React.FormEvent) => { event.preventDefault(); setPage(0); void load(); };

  return <div>
    <header className="border-b border-slate-200 pb-6">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">VẬN HÀNH KHÁM BỆNH</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Danh sách lịch hẹn</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">Dữ liệu thật từ backend, chỉ đọc cho ADMIN. Trạng thái lâm sàng được bác sĩ cập nhật trong cổng bác sĩ.</p>
    </header>

    <form className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_1fr_auto]" onSubmit={applyFilters}>
      <label className="text-sm font-semibold">Ngày khám<input className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" onChange={(e) => setDate(e.target.value)} type="date" value={date} /></label>
      <label className="text-sm font-semibold">Trạng thái<select className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" onChange={(e) => setStatus(e.target.value)} value={status}><option value="">Tất cả</option>{STATUS_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <button className="self-end rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-bold text-white" type="submit">Lọc</button>
    </form>

    <div className="mt-5 flex items-center justify-between"><p className="text-sm text-slate-600">Tổng cộng <strong>{total.toLocaleString("vi-VN")}</strong> lịch hẹn</p><button className="text-sm font-bold text-teal-800 underline" onClick={() => void load()} type="button">Làm mới</button></div>
    {loading ? <div className="mt-4"><AdminState tone="loading" title="Đang tải lịch hẹn" description="Đang đọc dữ liệu vận hành từ backend." /></div> : null}
    {!loading && error ? <div className="mt-4"><AdminState tone="error" title="Không thể tải lịch hẹn" description={error} /></div> : null}
    {!loading && !error && appointments.length === 0 ? <div className="mt-4"><AdminState tone="empty" title="Không có lịch hẹn" description="Không có bản ghi phù hợp với bộ lọc hiện tại." /></div> : null}
    {!loading && !error && appointments.length > 0 ? <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"><table className="min-w-[980px] w-full text-left text-sm"><thead className="border-b bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Mã</th><th className="px-4 py-3">Thời gian</th><th className="px-4 py-3">Bệnh nhân</th><th className="px-4 py-3">Bác sĩ</th><th className="px-4 py-3">Cơ sở</th><th className="px-4 py-3">Trạng thái</th></tr></thead><tbody>{appointments.map((item) => <tr className="border-b border-slate-100 last:border-0" key={item.id}><td className="px-4 py-4 font-mono text-xs">{item.bookingCode}</td><td className="px-4 py-4"><strong>{item.appointmentDate}</strong><br />{item.startTime.slice(0, 5)}–{item.endTime?.slice(0, 5)}</td><td className="px-4 py-4"><strong>{item.patientName}</strong><br /><span className="text-xs text-slate-500">{item.patientPhone}</span></td><td className="px-4 py-4">{item.doctorName}</td><td className="px-4 py-4">{item.branchName || "—"}</td><td className="px-4 py-4"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{item.status}</span></td></tr>)}</tbody></table></div> : null}
    <div className="mt-5 flex justify-end gap-2"><button className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40" disabled={page === 0 || loading} onClick={() => setPage((value) => value - 1)} type="button">Trang trước</button><span className="px-3 py-2 text-sm">{totalPages === 0 ? 0 : page + 1}/{totalPages}</span><button className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40" disabled={page + 1 >= totalPages || loading} onClick={() => setPage((value) => value + 1)} type="button">Trang sau</button></div>
  </div>;
}
