"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  adminCreateSchedule, adminDeleteSchedule, adminListDoctors, adminListSchedules, adminUpdateSchedule,
  adminCreateScheduleException, adminDeleteScheduleException, adminListScheduleExceptions, adminUpdateScheduleException,
  adminListBranches, type Branch, type Doctor, type DoctorSchedule, type DoctorScheduleException,
} from "../../../lib/api-client";
import AdminState from "../_components/AdminState";
import { describeAdminError } from "../_lib/errors";
import { businessDate, formatBusinessDate } from "../../../lib/business-time";

const today = () => businessDate();
const EMPTY = { doctorId: "", branchId: "", dayOfWeek: "1", startTime: "08:00", endTime: "12:00", slotDurationMinutes: "30", effectiveFrom: today(), effectiveTo: "", active: true };
const EMPTY_EXCEPTION = { doctorId: "", branchId: "", exceptionDate: today(), type: "LEAVE" as "LEAVE" | "BLOCKED" | "CUSTOM_HOURS", customStartTime: "", customEndTime: "", reason: "" };
const inputClass = "mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm";
const dayNames = ["", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy", "Chủ nhật"];
const exceptionTypeLabels = {
  LEAVE: "Nghỉ phép",
  BLOCKED: "Khóa lịch",
  CUSTOM_HOURS: "Giờ đặc biệt",
};

type Feedback = {
  tone: "success" | "error";
  title: string;
  description: string;
};

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [schedulePage, exceptionPage, doctorPage, branchPage] = await Promise.all([
        adminListSchedules(),
        adminListScheduleExceptions(),
        adminListDoctors(0, 100),
        adminListBranches(0, 100),
      ]);
      setSchedules(schedulePage.content);
      setExceptions(exceptionPage.content);
      setDoctors(doctorPage.content);
      setBranches(branchPage.content);
      return true;
    } catch (error) {
      setLoadError(describeAdminError(error).description);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const task = Promise.resolve().then(load);
    return () => void task;
  }, [load]);

  const runMutation = async (action: () => Promise<unknown>, title: string) => {
    setBusy(true);
    setFeedback(null);
    try {
      await action();
      const refreshed = await load();
      setFeedback({
        tone: "success",
        title,
        description: refreshed
          ? "Lịch vận hành đã được cập nhật."
          : "Thay đổi đã được lưu nhưng danh sách chưa thể làm mới. Vui lòng thử lại.",
      });
      return true;
    } catch (error) {
      const copy = describeAdminError(error);
      setFeedback({ tone: "error", title: copy.title, description: copy.description });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const resetScheduleForm = () => {
    setForm(EMPTY);
    setEditingId(null);
  };

  const resetExceptionForm = () => {
    setExceptionForm(EMPTY_EXCEPTION);
    setEditingExceptionId(null);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const payload = {
      dayOfWeek: Number(form.dayOfWeek),
      startTime: form.startTime,
      endTime: form.endTime,
      slotDurationMinutes: Number(form.slotDurationMinutes),
      effectiveFrom: form.effectiveFrom,
      effectiveTo: form.effectiveTo || null,
      active: form.active,
    };
    const saved = await runMutation(
      () => editingId
        ? adminUpdateSchedule(editingId, payload)
        : adminCreateSchedule(form.doctorId, form.branchId, payload),
      editingId ? "Đã cập nhật lịch làm việc" : "Đã tạo lịch làm việc",
    );
    if (saved) resetScheduleForm();
  };

  const remove = async (id: string) => {
    if (!window.confirm("Xóa lịch làm việc này? Hành động này không thể hoàn tác.")) return;
    await runMutation(() => adminDeleteSchedule(id), "Đã xóa lịch làm việc");
  };

  const saveException = async (event: FormEvent) => {
    event.preventDefault();
    const customHours = exceptionForm.type === "CUSTOM_HOURS";
    const payload = {
      exceptionDate: exceptionForm.exceptionDate,
      type: exceptionForm.type,
      customStartTime: customHours ? exceptionForm.customStartTime : null,
      customEndTime: customHours ? exceptionForm.customEndTime : null,
      reason: exceptionForm.reason.trim() || null,
    };
    const saved = await runMutation(
      () => editingExceptionId
        ? adminUpdateScheduleException(editingExceptionId, payload)
        : adminCreateScheduleException(exceptionForm.doctorId, exceptionForm.branchId, payload),
      editingExceptionId ? "Đã cập nhật ngoại lệ" : "Đã tạo ngoại lệ",
    );
    if (saved) resetExceptionForm();
  };

  const removeException = async (id: string) => {
    if (!window.confirm("Xóa ngày nghỉ hoặc giờ làm việc đặc biệt này? Hành động này không thể hoàn tác.")) return;
    await runMutation(() => adminDeleteScheduleException(id), "Đã xóa ngoại lệ");
  };

  return (
    <div>
      <header className="border-b border-slate-200 pb-6">
        <h1 className="text-3xl font-bold">Lịch làm việc bác sĩ</h1>
        <p className="mt-2 text-sm text-slate-600">
          Quản lý lịch lặp hằng tuần, phạm vi hiệu lực và cơ sở được phân công.
        </p>
      </header>

      {feedback ? (
        <div className="mt-5">
          <AdminState description={feedback.description} title={feedback.title} tone={feedback.tone} />
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6">
          <AdminState description="Đang tải lịch, bác sĩ và cơ sở." title="Đang tải lịch vận hành" tone="loading" />
        </div>
      ) : null}

      {!loading && loadError ? (
        <div className="mt-6">
          <AdminState
            action={<button className="rounded-lg border border-slate-300 px-4 py-2.5 font-bold" onClick={() => void load()} type="button">Thử lại</button>}
            description={loadError}
            title="Không thể tải lịch vận hành"
            tone="error"
          />
        </div>
      ) : null}

      {!loading && !loadError ? (
        <>
          <div className="mt-6 grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
            <section aria-labelledby="schedule-form-title" className="border-t border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold" id="schedule-form-title">{editingId ? "Sửa lịch" : "Tạo lịch"}</h2>
                {editingId ? <button className="text-sm font-bold text-slate-700 underline" disabled={busy} onClick={resetScheduleForm} type="button">Hủy sửa</button> : null}
              </div>
              <form aria-busy={busy} className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={save}>
                <label className="text-sm font-semibold">
                  Bác sĩ
                  <select className={inputClass} disabled={Boolean(editingId) || busy} onChange={(event) => setForm({ ...form, doctorId: event.target.value, branchId: "" })} required value={form.doctorId}>
                    <option value="">Chọn bác sĩ</option>
                    {doctors.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}
                  </select>
                </label>
                <label className="text-sm font-semibold">
                  Cơ sở
                  <select className={inputClass} disabled={Boolean(editingId) || busy} onChange={(event) => setForm({ ...form, branchId: event.target.value })} required value={form.branchId}>
                    <option value="">Chọn cơ sở</option>
                    {branches
                      .filter((branch) => !form.doctorId || doctors.find((doctor) => doctor.id === form.doctorId)?.branchIds?.includes(branch.id))
                      .map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
                <label className="text-sm font-semibold">
                  Thứ
                  <select className={inputClass} disabled={busy} onChange={(event) => setForm({ ...form, dayOfWeek: event.target.value })} value={form.dayOfWeek}>
                    {dayNames.slice(1).map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
                  </select>
                </label>
                <label className="text-sm font-semibold">Phút mỗi lượt<input className={inputClass} disabled={busy} min="1" onChange={(event) => setForm({ ...form, slotDurationMinutes: event.target.value })} required type="number" value={form.slotDurationMinutes} /></label>
                <label className="text-sm font-semibold">Bắt đầu<input className={inputClass} disabled={busy} onChange={(event) => setForm({ ...form, startTime: event.target.value })} required type="time" value={form.startTime} /></label>
                <label className="text-sm font-semibold">Kết thúc<input className={inputClass} disabled={busy} onChange={(event) => setForm({ ...form, endTime: event.target.value })} required type="time" value={form.endTime} /></label>
                <label className="text-sm font-semibold">Hiệu lực từ<input className={inputClass} disabled={busy} onChange={(event) => setForm({ ...form, effectiveFrom: event.target.value })} required type="date" value={form.effectiveFrom} /></label>
                <label className="text-sm font-semibold">Hiệu lực đến<input className={inputClass} disabled={busy} min={form.effectiveFrom} onChange={(event) => setForm({ ...form, effectiveTo: event.target.value })} type="date" value={form.effectiveTo} /></label>
                <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2">
                  <input checked={form.active} disabled={busy} onChange={(event) => setForm({ ...form, active: event.target.checked })} type="checkbox" />
                  Đang mở lịch đặt khám
                </label>
                <button className="rounded-lg bg-teal-700 px-4 py-2.5 font-bold text-white disabled:opacity-50 sm:col-span-2" disabled={busy} type="submit">
                  {busy ? "Đang lưu…" : editingId ? "Lưu thay đổi" : "Tạo lịch"}
                </button>
              </form>
            </section>

            <section aria-labelledby="schedule-list-title">
              <h2 className="mb-3 text-xl font-bold" id="schedule-list-title">Lịch hiện có</h2>
              {schedules.length === 0 ? (
                <AdminState description="Tạo lịch để hệ thống sinh khung giờ đặt khám." title="Chưa có lịch" tone="empty" />
              ) : (
                <div className="space-y-3">
                  {schedules.map((item) => (
                    <article className="rounded-lg border border-slate-200 bg-white p-4" key={item.id}>
                      <div className="flex flex-col justify-between gap-4 sm:flex-row">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <strong>{item.doctorName}</strong>
                            <span className={item.active ? "rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700" : "rounded-md bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600"}>
                              {item.active ? "Đang mở" : "Tạm ngưng"}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-slate-600">{item.branchName} · {dayNames[item.dayOfWeek]} · {item.startTime.slice(0, 5)} - {item.endTime.slice(0, 5)} · {item.slotDurationMinutes} phút</p>
                          <p className="mt-1 text-xs text-slate-500">{formatBusinessDate(item.effectiveFrom)} đến {item.effectiveTo ? formatBusinessDate(item.effectiveTo) : "không giới hạn"}</p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <button
                            aria-label={`Sửa lịch của ${item.doctorName}`}
                            className="text-sm font-bold text-teal-800 underline"
                            disabled={busy}
                            onClick={() => {
                              setEditingId(item.id);
                              setFeedback(null);
                              setForm({ doctorId: item.doctorId, branchId: item.branchId, dayOfWeek: String(item.dayOfWeek), startTime: item.startTime.slice(0, 5), endTime: item.endTime.slice(0, 5), slotDurationMinutes: String(item.slotDurationMinutes), effectiveFrom: item.effectiveFrom, effectiveTo: item.effectiveTo ?? "", active: item.active });
                            }}
                            type="button"
                          >
                            Sửa
                          </button>
                          <button aria-label={`Xóa lịch của ${item.doctorName}`} className="text-sm font-bold text-red-700 underline" disabled={busy} onClick={() => void remove(item.id)} type="button">Xóa</button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section aria-labelledby="exception-title" className="mt-8 border-t border-slate-200 bg-white py-6">
            <h2 className="text-xl font-bold" id="exception-title">Ngày nghỉ và giờ làm việc đặc biệt</h2>
            <div className="mt-4 grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
              <form aria-busy={busy} className="grid gap-3 sm:grid-cols-2" onSubmit={saveException}>
                <label className="text-sm font-semibold">
                  Bác sĩ
                  <select className={inputClass} disabled={Boolean(editingExceptionId) || busy} onChange={(event) => setExceptionForm({ ...exceptionForm, doctorId: event.target.value, branchId: "" })} required value={exceptionForm.doctorId}>
                    <option value="">Chọn bác sĩ</option>
                    {doctors.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}
                  </select>
                </label>
                <label className="text-sm font-semibold">
                  Cơ sở
                  <select className={inputClass} disabled={Boolean(editingExceptionId) || busy} onChange={(event) => setExceptionForm({ ...exceptionForm, branchId: event.target.value })} required value={exceptionForm.branchId}>
                    <option value="">Chọn cơ sở</option>
                    {branches
                      .filter((branch) => !exceptionForm.doctorId || doctors.find((doctor) => doctor.id === exceptionForm.doctorId)?.branchIds?.includes(branch.id))
                      .map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
                <label className="text-sm font-semibold">Ngày<input className={inputClass} disabled={busy} onChange={(event) => setExceptionForm({ ...exceptionForm, exceptionDate: event.target.value })} required type="date" value={exceptionForm.exceptionDate} /></label>
                <label className="text-sm font-semibold">
                  Loại
                  <select className={inputClass} disabled={busy} onChange={(event) => setExceptionForm({ ...exceptionForm, type: event.target.value as typeof exceptionForm.type })} value={exceptionForm.type}>
                    <option value="LEAVE">Nghỉ phép</option>
                    <option value="BLOCKED">Khóa lịch</option>
                    <option value="CUSTOM_HOURS">Giờ đặc biệt</option>
                  </select>
                </label>
                {exceptionForm.type === "CUSTOM_HOURS" ? (
                  <>
                    <label className="text-sm font-semibold">Bắt đầu<input className={inputClass} disabled={busy} onChange={(event) => setExceptionForm({ ...exceptionForm, customStartTime: event.target.value })} required type="time" value={exceptionForm.customStartTime} /></label>
                    <label className="text-sm font-semibold">Kết thúc<input className={inputClass} disabled={busy} onChange={(event) => setExceptionForm({ ...exceptionForm, customEndTime: event.target.value })} required type="time" value={exceptionForm.customEndTime} /></label>
                  </>
                ) : null}
                <label className="text-sm font-semibold sm:col-span-2">Lý do<input className={inputClass} disabled={busy} maxLength={255} onChange={(event) => setExceptionForm({ ...exceptionForm, reason: event.target.value })} value={exceptionForm.reason} /></label>
                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  <button className="rounded-lg bg-teal-700 px-4 py-2.5 font-bold text-white disabled:opacity-50" disabled={busy} type="submit">{busy ? "Đang lưu…" : editingExceptionId ? "Lưu thay đổi" : "Tạo ngoại lệ"}</button>
                  {editingExceptionId ? <button className="rounded-lg border border-slate-300 px-4 py-2.5 font-bold text-slate-700" disabled={busy} onClick={resetExceptionForm} type="button">Hủy sửa</button> : null}
                </div>
              </form>

              <div className="space-y-3">
                {exceptions.length === 0 ? (
                  <AdminState description="Chưa có ngày nghỉ hoặc giờ làm việc đặc biệt." title="Chưa có ngoại lệ" tone="empty" />
                ) : exceptions.map((item) => (
                  <article className="rounded-lg border border-slate-200 p-4 text-sm" key={item.id}>
                    <strong>{item.doctorName} · {formatBusinessDate(item.exceptionDate)}</strong>
                    <p className="mt-1 text-slate-600">{item.branchName} · {exceptionTypeLabels[item.type]}{item.customStartTime ? ` · ${item.customStartTime.slice(0, 5)} - ${item.customEndTime?.slice(0, 5)}` : ""}</p>
                    {item.reason ? <p className="mt-1 text-xs text-slate-500">{item.reason}</p> : null}
                    <div className="mt-2 flex flex-wrap gap-3">
                      <button
                        aria-label={`Sửa ngoại lệ của ${item.doctorName}`}
                        className="font-bold text-teal-800 underline"
                        disabled={busy}
                        onClick={() => {
                          setEditingExceptionId(item.id);
                          setFeedback(null);
                          setExceptionForm({ doctorId: item.doctorId, branchId: item.branchId, exceptionDate: item.exceptionDate, type: item.type, customStartTime: item.customStartTime?.slice(0, 5) ?? "", customEndTime: item.customEndTime?.slice(0, 5) ?? "", reason: item.reason ?? "" });
                        }}
                        type="button"
                      >
                        Sửa
                      </button>
                      <button aria-label={`Xóa ngoại lệ của ${item.doctorName}`} className="font-bold text-red-700 underline" disabled={busy} onClick={() => void removeException(item.id)} type="button">Xóa</button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
