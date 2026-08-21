"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  adminCreateSchedule, adminDeleteSchedule, adminListDoctors, adminListSchedules, adminUpdateSchedule,
  adminCreateScheduleException, adminDeleteScheduleException, adminListScheduleExceptions, adminUpdateScheduleException,
  adminListBranches, type Branch, type Doctor, type DoctorSchedule, type DoctorScheduleException,
} from "../../../lib/api-client";
import AdminState from "../_components/AdminState";
import { describeAdminError } from "../_lib/errors";
import { businessDate } from "../../../lib/business-time";

const today = () => businessDate();
const EMPTY = { doctorId: "", branchId: "", dayOfWeek: "1", startTime: "08:00", endTime: "12:00", slotDurationMinutes: "30", effectiveFrom: today(), effectiveTo: "", active: true };
const EMPTY_EXCEPTION = { doctorId: "", branchId: "", exceptionDate: today(), type: "LEAVE" as "LEAVE" | "BLOCKED" | "CUSTOM_HOURS", customStartTime: "", customEndTime: "", reason: "" };
const inputClass = "mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm";
const dayNames = ["", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy", "Chủ nhật"];

export default function AdminSchedulesPage() {
  const [schedules, setSchedules] = useState<DoctorSchedule[]>([]);
  const [exceptions, setExceptions] = useState<DoctorScheduleException[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [exceptionForm, setExceptionForm] = useState(EMPTY_EXCEPTION);
  const [editingExceptionId, setEditingExceptionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [schedulePage, exceptionPage, doctorPage, branchPage] = await Promise.all([
        adminListSchedules(),
        adminListScheduleExceptions(),
        adminListDoctors(0, 100),
        adminListBranches(0, 100),
      ]);
      setSchedules(schedulePage.content); setExceptions(exceptionPage.content); setDoctors(doctorPage.content); setBranches(branchPage.content);
    } catch (error) { setMessage(describeAdminError(error).description); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const task = Promise.resolve().then(load); return () => void task; }, [load]);

  const save = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage(null);
    const payload = { dayOfWeek: Number(form.dayOfWeek), startTime: form.startTime, endTime: form.endTime, slotDurationMinutes: Number(form.slotDurationMinutes), effectiveFrom: form.effectiveFrom, effectiveTo: form.effectiveTo || null, active: form.active };
    try {
      if (editingId) await adminUpdateSchedule(editingId, payload);
      else await adminCreateSchedule(form.doctorId, form.branchId, payload);
      setMessage("Đã lưu lịch làm việc."); setForm(EMPTY); setEditingId(null); await load();
    } catch (error) { const copy = describeAdminError(error); setMessage(`${copy.title}: ${copy.description}`); }
    finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    if (!window.confirm("Xóa lịch làm việc này?")) return;
    setBusy(true);
    try { await adminDeleteSchedule(id); await load(); setMessage("Đã xóa lịch làm việc."); }
    catch (error) { setMessage(describeAdminError(error).description); }
    finally { setBusy(false); }
  };
  const saveException = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage(null);
    const customHours = exceptionForm.type === "CUSTOM_HOURS";
    const payload = { exceptionDate: exceptionForm.exceptionDate, type: exceptionForm.type, customStartTime: customHours ? exceptionForm.customStartTime : null, customEndTime: customHours ? exceptionForm.customEndTime : null, reason: exceptionForm.reason.trim() || null };
    try {
      if (editingExceptionId) await adminUpdateScheduleException(editingExceptionId, payload);
      else await adminCreateScheduleException(exceptionForm.doctorId, exceptionForm.branchId, payload);
      setMessage("Đã lưu ngoại lệ lịch làm việc."); setExceptionForm(EMPTY_EXCEPTION); setEditingExceptionId(null); await load();
    } catch (error) { setMessage(describeAdminError(error).description); }
    finally { setBusy(false); }
  };
  const removeException = async (id: string) => {
    if (!window.confirm("Xóa ngày nghỉ/ngoại lệ này?")) return;
    setBusy(true);
    try { await adminDeleteScheduleException(id); await load(); setMessage("Đã xóa ngoại lệ lịch."); }
    catch (error) { setMessage(describeAdminError(error).description); }
    finally { setBusy(false); }
  };

  return <div><header className="border-b border-slate-200 pb-6"><p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">SCHEDULING</p><h1 className="mt-2 text-3xl font-bold">Lịch làm việc bác sĩ</h1><p className="mt-2 text-sm text-slate-600">Lịch lặp theo thứ trong tuần, giới hạn hiệu lực và cơ sở được phân công.</p></header>
    {message ? <p className="mt-5 rounded-xl bg-slate-100 p-3 text-sm" role="status">{message}</p> : null}
    {loading ? <div className="mt-6"><AdminState description="Đang tải lịch, bác sĩ và cơ sở." title="Đang tải" tone="loading" /></div> : <div className="mt-6 grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <section className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-xl font-bold">{editingId ? "Sửa lịch" : "Tạo lịch"}</h2><form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={save}><label className="text-sm font-semibold">Bác sĩ<select className={inputClass} disabled={Boolean(editingId)} onChange={(e) => setForm({ ...form, doctorId: e.target.value, branchId: "" })} required value={form.doctorId}><option value="">Chọn bác sĩ</option>{doctors.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select></label><label className="text-sm font-semibold">Cơ sở<select className={inputClass} disabled={Boolean(editingId)} onChange={(e) => setForm({ ...form, branchId: e.target.value })} required value={form.branchId}><option value="">Chọn cơ sở</option>{branches.filter((branch) => !form.doctorId || doctors.find((doctor) => doctor.id === form.doctorId)?.branchIds?.includes(branch.id)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="text-sm font-semibold">Thứ<select className={inputClass} onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value })} value={form.dayOfWeek}>{dayNames.slice(1).map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></label><label className="text-sm font-semibold">Phút mỗi lượt<input className={inputClass} min="1" type="number" value={form.slotDurationMinutes} onChange={(e) => setForm({ ...form, slotDurationMinutes: e.target.value })} /></label><label className="text-sm font-semibold">Bắt đầu<input className={inputClass} type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></label><label className="text-sm font-semibold">Kết thúc<input className={inputClass} type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></label><label className="text-sm font-semibold">Hiệu lực từ<input className={inputClass} type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} /></label><label className="text-sm font-semibold">Hiệu lực đến<input className={inputClass} min={form.effectiveFrom} type="date" value={form.effectiveTo} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} /></label><button className="rounded-xl bg-teal-700 px-4 py-2.5 font-bold text-white disabled:opacity-50 sm:col-span-2" disabled={busy}>Lưu lịch</button></form></section>
      <section><h2 className="mb-3 text-xl font-bold">Lịch hiện có</h2>{schedules.length === 0 ? <AdminState description="Tạo lịch để hệ thống sinh khung giờ đặt khám." title="Chưa có lịch" tone="empty" /> : <div className="space-y-3">{schedules.map((item) => <article className="rounded-2xl border bg-white p-4 shadow-sm" key={item.id}><div className="flex justify-between gap-4"><div><strong>{item.doctorName}</strong><p className="text-sm text-slate-600">{item.branchName} · {dayNames[item.dayOfWeek]} · {item.startTime.slice(0, 5)}–{item.endTime.slice(0, 5)} · {item.slotDurationMinutes} phút</p><small>{item.effectiveFrom} → {item.effectiveTo ?? "không giới hạn"}</small></div><div className="flex gap-3"><button className="text-sm text-teal-800 underline" onClick={() => { setEditingId(item.id); setForm({ doctorId: item.doctorId, branchId: item.branchId, dayOfWeek: String(item.dayOfWeek), startTime: item.startTime.slice(0, 5), endTime: item.endTime.slice(0, 5), slotDurationMinutes: String(item.slotDurationMinutes), effectiveFrom: item.effectiveFrom, effectiveTo: item.effectiveTo ?? "", active: item.active }); }}>Sửa</button><button className="text-sm text-red-700 underline" disabled={busy} onClick={() => void remove(item.id)}>Xóa</button></div></div></article>)}</div>}</section>
    </div>}
    {!loading ? <section className="mt-8 rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-xl font-bold">Ngày nghỉ và giờ làm việc đặc biệt</h2><div className="mt-4 grid gap-6 xl:grid-cols-[0.8fr_1.2fr]"><form className="grid gap-3 sm:grid-cols-2" onSubmit={saveException}><label className="text-sm font-semibold">Bác sĩ<select className={inputClass} disabled={Boolean(editingExceptionId)} onChange={(e) => setExceptionForm({ ...exceptionForm, doctorId: e.target.value, branchId: "" })} required value={exceptionForm.doctorId}><option value="">Chọn bác sĩ</option>{doctors.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select></label><label className="text-sm font-semibold">Cơ sở<select className={inputClass} disabled={Boolean(editingExceptionId)} onChange={(e) => setExceptionForm({ ...exceptionForm, branchId: e.target.value })} required value={exceptionForm.branchId}><option value="">Chọn cơ sở</option>{branches.filter((branch) => !exceptionForm.doctorId || doctors.find((doctor) => doctor.id === exceptionForm.doctorId)?.branchIds?.includes(branch.id)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="text-sm font-semibold">Ngày<input className={inputClass} onChange={(e) => setExceptionForm({ ...exceptionForm, exceptionDate: e.target.value })} required type="date" value={exceptionForm.exceptionDate} /></label><label className="text-sm font-semibold">Loại<select className={inputClass} onChange={(e) => setExceptionForm({ ...exceptionForm, type: e.target.value as typeof exceptionForm.type })} value={exceptionForm.type}><option value="LEAVE">Nghỉ phép</option><option value="BLOCKED">Khóa lịch</option><option value="CUSTOM_HOURS">Giờ đặc biệt</option></select></label>{exceptionForm.type === "CUSTOM_HOURS" ? <><label className="text-sm font-semibold">Bắt đầu<input className={inputClass} onChange={(e) => setExceptionForm({ ...exceptionForm, customStartTime: e.target.value })} required type="time" value={exceptionForm.customStartTime} /></label><label className="text-sm font-semibold">Kết thúc<input className={inputClass} onChange={(e) => setExceptionForm({ ...exceptionForm, customEndTime: e.target.value })} required type="time" value={exceptionForm.customEndTime} /></label></> : null}<label className="text-sm font-semibold sm:col-span-2">Lý do<input className={inputClass} maxLength={255} onChange={(e) => setExceptionForm({ ...exceptionForm, reason: e.target.value })} value={exceptionForm.reason} /></label><button className="rounded-xl bg-teal-700 px-4 py-2.5 font-bold text-white disabled:opacity-50 sm:col-span-2" disabled={busy}>Lưu ngoại lệ</button></form><div className="space-y-3">{exceptions.length === 0 ? <AdminState description="Chưa có ngày nghỉ hoặc giờ làm việc đặc biệt." title="Chưa có ngoại lệ" tone="empty" /> : exceptions.map((item) => <article className="rounded-xl border p-3 text-sm" key={item.id}><strong>{item.doctorName} · {item.exceptionDate}</strong><p>{item.branchName} · {item.type}{item.customStartTime ? ` · ${item.customStartTime.slice(0, 5)}–${item.customEndTime?.slice(0, 5)}` : ""}</p>{item.reason ? <small>{item.reason}</small> : null}<div className="mt-2 flex gap-3"><button className="text-teal-800 underline" onClick={() => { setEditingExceptionId(item.id); setExceptionForm({ doctorId: item.doctorId, branchId: item.branchId, exceptionDate: item.exceptionDate, type: item.type, customStartTime: item.customStartTime?.slice(0, 5) ?? "", customEndTime: item.customEndTime?.slice(0, 5) ?? "", reason: item.reason ?? "" }); }}>Sửa</button><button className="text-red-700 underline" disabled={busy} onClick={() => void removeException(item.id)}>Xóa</button></div></article>)}</div></div></section> : null}</div>;
}
