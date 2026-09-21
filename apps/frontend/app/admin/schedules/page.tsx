"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ApiError,
  adminCreateSchedule, adminDeleteSchedule, adminListDoctors, adminListSchedules, adminUpdateSchedule,
  adminCreateScheduleException, adminDeleteScheduleException, adminListScheduleExceptions, adminUpdateScheduleException,
  fetchAllContent,
  adminListBranches, type Branch, type Doctor, type DoctorSchedule, type DoctorScheduleException,
} from "../../../lib/api-client";
import AdminState from "../_components/AdminState";
import ConfirmActionDialog from "../../../components/ui/ConfirmActionDialog";
import { describeAdminError } from "../_lib/errors";
import { businessDate, formatBusinessDate } from "../../../lib/business-time";

/**
 * Forms are built from functions rather than module-level constants: a tab left
 * open past midnight must default to the new business day, and an object
 * created once at import time would keep offering yesterday.
 */
const emptyScheduleForm = () => ({
  doctorId: "",
  branchId: "",
  dayOfWeek: "1",
  startTime: "08:00",
  endTime: "12:00",
  slotDurationMinutes: "30",
  effectiveFrom: businessDate(),
  effectiveTo: "",
  active: true,
});

const emptyExceptionForm = () => ({
  doctorId: "",
  branchId: "",
  exceptionDate: businessDate(),
  type: "LEAVE" as "LEAVE" | "BLOCKED" | "CUSTOM_HOURS",
  customStartTime: "",
  customEndTime: "",
  reason: "",
});

const inputClass = "mt-1 w-full rounded-sm border border-slate-300 px-3 py-2.5 text-sm";
const dayNames = ["", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy", "Chủ nhật"];
const exceptionTypeLabels = {
  LEAVE: "Nghỉ phép",
  BLOCKED: "Khóa lịch",
  CUSTOM_HOURS: "Giờ đặc biệt",
};
const ADMIN_PAGE_SIZE = 100;
const SCHEDULE_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;

function toMinutes(value: string): number | null {
  const match = SCHEDULE_TIME_PATTERN.exec(value.trim());
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

interface SlotPlan {
  slotCount: number;
  leftoverMinutes: number;
  windowLabel: string;
  error: string | null;
}

/**
 * What the create form will actually produce, mirroring the backend's slot
 * generator: full slots only, and the remainder of a window that is not a
 * multiple of the slot length stays unbooked. `message` is the same invariant
 * the server enforces, so the operator sees the reason before the 400.
 */
function planSlots(startTime: string, endTime: string, slotDurationMinutes: string): SlotPlan {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  const duration = Number(slotDurationMinutes);
  const windowLabel = `${startTime || "--:--"}–${endTime || "--:--"}`;

  if (start === null || end === null) {
    return { slotCount: 0, leftoverMinutes: 0, windowLabel, error: "Giờ bắt đầu và giờ kết thúc phải theo định dạng HH:mm." };
  }
  if (end <= start) {
    return { slotCount: 0, leftoverMinutes: 0, windowLabel, error: "Giờ bắt đầu phải trước giờ kết thúc." };
  }
  if (!Number.isInteger(duration) || duration <= 0) {
    return { slotCount: 0, leftoverMinutes: 0, windowLabel, error: "Số phút mỗi lượt phải là số nguyên lớn hơn 0." };
  }

  const windowMinutes = end - start;
  return {
    slotCount: Math.floor(windowMinutes / duration),
    leftoverMinutes: windowMinutes % duration,
    windowLabel,
    error: null,
  };
}

/** Case- and accent-insensitive folding so "nguyen" matches "Nguyễn". */
function foldForFilter(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

const FORCE_CONFLICT_CODE = "SCHEDULE_HAS_ACTIVE_BOOKINGS";

function isForceableConflict(error: unknown): boolean {
  return error instanceof ApiError && error.code === FORCE_CONFLICT_CODE;
}

type Feedback = {
  tone: "success" | "error";
  title: string;
  description: string;
};

type MutationOptions = {
  /** Short description of the operation, shown in the force confirmation. */
  forceLabel?: string;
  /** Form cleanup, run only after the write landed and the list was reloaded. */
  onSuccess?: () => void;
};

/** A write the backend refused because live appointments would be stranded. */
type ForceCandidate = {
  action: (force: boolean) => Promise<unknown>;
  title: string;
  options: MutationOptions;
};

export default function AdminSchedulesPage() {
  const [schedules, setSchedules] = useState<DoctorSchedule[]>([]);
  const [exceptions, setExceptions] = useState<DoctorScheduleException[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [form, setForm] = useState(emptyScheduleForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [exceptionForm, setExceptionForm] = useState(emptyExceptionForm);
  const [editingExceptionId, setEditingExceptionId] = useState<string | null>(null);
  const [exceptionFormError, setExceptionFormError] = useState<string | null>(null);
  const [scheduleFilter, setScheduleFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [forceCandidate, setForceCandidate] = useState<ForceCandidate | null>(null);
  const [forceConfirmOpen, setForceConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<
    { kind: "schedule"; item: DoctorSchedule } | { kind: "exception"; item: DoctorScheduleException } | null
  >(null);

  const slotPlan = useMemo(
    () => planSlots(form.startTime, form.endTime, form.slotDurationMinutes),
    [form.endTime, form.slotDurationMinutes, form.startTime],
  );

  const sortedSchedules = useMemo(() => {
    const needle = foldForFilter(scheduleFilter.trim());
    return schedules
      .filter((item) => !needle
        || foldForFilter(item.doctorName).includes(needle)
        || foldForFilter(item.branchName ?? "").includes(needle))
      .sort((left, right) => left.doctorName.localeCompare(right.doctorName, "vi")
        || left.dayOfWeek - right.dayOfWeek
        || left.startTime.localeCompare(right.startTime));
  }, [scheduleFilter, schedules]);

  /**
   * Branches the selected doctor is actually assigned to. With no doctor picked
   * every branch is offered; with one picked, an empty result is a real
   * configuration gap and is surfaced instead of leaving a silent empty select.
   */
  const branchesForDoctor = useCallback((doctorId: string) => (
    branches.filter((branch) => !doctorId || doctors.find((doctor) => doctor.id === doctorId)?.branchIds?.includes(branch.id))
  ), [branches, doctors]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [schedulePage, exceptionPage, doctorPage, branchPage] = await Promise.all([
        fetchAllContent(adminListSchedules, ADMIN_PAGE_SIZE),
        fetchAllContent(adminListScheduleExceptions, ADMIN_PAGE_SIZE),
        fetchAllContent(adminListDoctors, ADMIN_PAGE_SIZE),
        fetchAllContent(adminListBranches, ADMIN_PAGE_SIZE),
      ]);
      setSchedules(schedulePage);
      setExceptions(exceptionPage);
      setDoctors(doctorPage);
      setBranches(branchPage);
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

  /**
   * Every mutation reports through one path so a guard rejection cannot be
   * swallowed: the server's 409 message is shown verbatim, and the same write
   * is offered again with `force=true` only when the endpoint reads the flag
   * (`forceLabel` is what opts an operation into that retry).
   */
  const runMutation = async (
    action: (force: boolean) => Promise<unknown>,
    title: string,
    options: MutationOptions = {},
  ) => {
    setBusy(true);
    setFeedback(null);
    try {
      await action(false);
      setForceCandidate(null);
      const refreshed = await load();
      setFeedback({
        tone: "success",
        title,
        description: refreshed
          ? "Lịch vận hành đã được cập nhật."
          : "Thay đổi đã được lưu nhưng danh sách chưa thể làm mới. Vui lòng thử lại.",
      });
      options.onSuccess?.();
      return true;
    } catch (error) {
      const copy = describeAdminError(error);
      setFeedback({ tone: "error", title: copy.title, description: copy.description });
      setForceCandidate(isForceableConflict(error) && options.forceLabel ? { action, title, options } : null);
      return false;
    } finally {
      setBusy(false);
    }
  };

  /**
   * Re-runs the blocked write with force after the operator confirmed it in the
   * dialog. The candidate carries the original cleanup so a forced create
   * resets its form exactly like an unforced one.
   */
  const confirmForce = async () => {
    const candidate = forceCandidate;
    setForceConfirmOpen(false);
    if (!candidate) return;
    await runMutation(candidate.action, `Ghi đè: ${candidate.title}`, candidate.options);
  };

  const resetScheduleForm = () => {
    setForm(emptyScheduleForm());
    setEditingId(null);
    setFormError(null);
  };

  const resetExceptionForm = () => {
    setExceptionForm(emptyExceptionForm());
    setEditingExceptionId(null);
    setExceptionFormError(null);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (slotPlan.error) {
      setFormError(slotPlan.error);
      return;
    }
    if (slotPlan.leftoverMinutes > 0) {
      setFormError(`Khoảng thời gian ${slotPlan.windowLabel} không chia hết cho ${form.slotDurationMinutes} phút mỗi lượt (còn dư ${slotPlan.leftoverMinutes} phút). Hãy chỉnh giờ hoặc số phút mỗi lượt.`);
      return;
    }
    setFormError(null);
    const payload = {
      dayOfWeek: Number(form.dayOfWeek),
      startTime: form.startTime,
      endTime: form.endTime,
      slotDurationMinutes: Number(form.slotDurationMinutes),
      effectiveFrom: form.effectiveFrom,
      effectiveTo: form.effectiveTo || null,
      active: form.active,
    };
    await runMutation(
      (force) => editingId
        ? adminUpdateSchedule(editingId, payload, force)
        : adminCreateSchedule(form.doctorId, form.branchId, payload),
      editingId ? "Đã cập nhật lịch làm việc" : "Đã tạo lịch làm việc",
      {
        forceLabel: editingId
          ? `Cập nhật lịch ${dayNames[Number(form.dayOfWeek)]} ${form.startTime}–${form.endTime} của bác sĩ đang sửa`
          : undefined,
        onSuccess: resetScheduleForm,
      },
    );
  };

  const remove = async (id: string) => {
    const target = schedules.find((item) => item.id === id);
    await runMutation(
      (force) => adminDeleteSchedule(id, force),
      "Đã xóa lịch làm việc",
      {
        forceLabel: target
          ? `Xóa lịch ${dayNames[target.dayOfWeek]} ${target.startTime.slice(0, 5)}–${target.endTime.slice(0, 5)} của ${target.doctorName}`
          : "Xóa lịch làm việc",
      },
    );
    setPendingDelete(null);
  };

  const saveException = async (event: FormEvent) => {
    event.preventDefault();
    if (exceptionForm.type === "CUSTOM_HOURS") {
      const customStart = toMinutes(exceptionForm.customStartTime);
      const customEnd = toMinutes(exceptionForm.customEndTime);
      if (customStart === null || customEnd === null || customEnd <= customStart) {
        setExceptionFormError("Giờ đặc biệt cần giờ bắt đầu và giờ kết thúc hợp lệ, giờ bắt đầu phải trước giờ kết thúc.");
        return;
      }
    }
    setExceptionFormError(null);
    const customHours = exceptionForm.type === "CUSTOM_HOURS";
    const payload = {
      exceptionDate: exceptionForm.exceptionDate,
      type: exceptionForm.type,
      customStartTime: customHours ? exceptionForm.customStartTime : null,
      customEndTime: customHours ? exceptionForm.customEndTime : null,
      reason: exceptionForm.reason.trim() || null,
    };
    await runMutation(
      (force) => editingExceptionId
        ? adminUpdateScheduleException(editingExceptionId, payload, force)
        : adminCreateScheduleException(exceptionForm.doctorId, exceptionForm.branchId, payload, force),
      editingExceptionId ? "Đã cập nhật ngoại lệ" : "Đã tạo ngoại lệ",
      {
        forceLabel: `${editingExceptionId ? "Cập nhật" : "Tạo"} ${exceptionTypeLabels[exceptionForm.type]} ngày ${exceptionForm.exceptionDate}`,
        onSuccess: resetExceptionForm,
      },
    );
  };

  const removeException = async (id: string) => {
    // The delete-exception endpoint takes no force flag, so a guard rejection
    // here is reported verbatim and cannot be retried as-is.
    await runMutation(() => adminDeleteScheduleException(id), "Đã xóa ngoại lệ");
    setPendingDelete(null);
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
          <AdminState
            action={forceCandidate ? <button className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold" disabled={busy} onClick={() => setForceConfirmOpen(true)} type="button">Vẫn tiếp tục (force)</button> : undefined}
            description={feedback.description}
            title={feedback.title}
            tone={feedback.tone}
          />
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
                <div className="text-sm font-semibold">
                  <label className="block" htmlFor="schedule-branch">Cơ sở</label>
                  <select className={inputClass} disabled={Boolean(editingId) || busy} id="schedule-branch" onChange={(event) => setForm({ ...form, branchId: event.target.value })} required value={form.branchId}>
                    <option value="">Chọn cơ sở</option>
                    {branchesForDoctor(form.doctorId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                  {form.doctorId && branchesForDoctor(form.doctorId).length === 0 ? (
                    <p className="mt-1.5 text-xs font-semibold text-amber-800" role="status">
                      Bác sĩ này chưa được gán cơ sở nào nên chưa thể tạo lịch.{" "}
                      <Link className="underline underline-offset-4" href="/admin/doctors">Gán cơ sở cho bác sĩ trong trang quản lý bác sĩ</Link> rồi quay lại.
                    </p>
                  ) : null}
                </div>
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
                <div className="sm:col-span-2" role="status" aria-live="polite">
                  {slotPlan.error ? (
                    <p className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">{slotPlan.error}</p>
                  ) : (
                    <>
                      <p className="text-sm text-slate-700">
                        Sẽ tạo <strong>{slotPlan.slotCount}</strong> khung giờ ({slotPlan.windowLabel} cho mỗi bác sĩ).
                      </p>
                      {slotPlan.leftoverMinutes > 0 ? (
                        <p className="mt-1 text-xs font-semibold text-amber-800">
                          Không chia hết cho {form.slotDurationMinutes} phút mỗi lượt — bỏ trống {slotPlan.leftoverMinutes} phút cuối.
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
                {formError ? <p aria-live="assertive" className="sm:col-span-2 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800" role="alert">{formError}</p> : null}
                <button className="rounded-lg bg-teal-700 px-4 py-2.5 font-bold text-white disabled:opacity-50 sm:col-span-2" disabled={busy || slotPlan.error !== null || slotPlan.leftoverMinutes > 0} type="submit">
                  {busy ? "Đang lưu…" : editingId ? "Lưu thay đổi" : "Tạo lịch"}
                </button>
              </form>
            </section>

            <section aria-labelledby="schedule-list-title">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <h2 className="text-xl font-bold" id="schedule-list-title">Lịch hiện có</h2>
                {schedules.length > 0 ? (
                  <label className="text-sm font-semibold">
                    Lọc theo bác sĩ hoặc cơ sở
                    <input
                      className={inputClass}
                      onChange={(event) => setScheduleFilter(event.target.value)}
                      placeholder="Ví dụ: Nguyễn Minh hoặc Quận 1"
                      spellCheck={false}
                      type="search"
                      value={scheduleFilter}
                    />
                  </label>
                ) : null}
              </div>
              {schedules.length > 0 ? (
                <p className="mb-3 text-sm text-slate-600" role="status" aria-live="polite">
                  Tổng cộng <strong>{sortedSchedules.length}</strong> lịch
                  {scheduleFilter.trim() ? ` khớp bộ lọc (trên ${schedules.length} lịch)` : ""}.
                </p>
              ) : null}
              {schedules.length === 0 ? (
                <AdminState description="Tạo lịch để hệ thống sinh khung giờ đặt khám." title="Chưa có lịch" tone="empty" />
              ) : sortedSchedules.length === 0 ? (
                <AdminState description="Không có lịch nào khớp bộ lọc hiện tại. Hãy xóa hoặc chỉnh lại từ khóa." title="Không có lịch phù hợp" tone="empty" />
              ) : (
                <div className="space-y-3">
                  {sortedSchedules.map((item) => (
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
                              setForceCandidate(null);
                              setFormError(null);
                              setForm({ doctorId: item.doctorId, branchId: item.branchId, dayOfWeek: String(item.dayOfWeek), startTime: item.startTime.slice(0, 5), endTime: item.endTime.slice(0, 5), slotDurationMinutes: String(item.slotDurationMinutes), effectiveFrom: item.effectiveFrom, effectiveTo: item.effectiveTo ?? "", active: item.active });
                            }}
                            type="button"
                          >
                            Sửa
                          </button>
                          <button aria-label={`Xóa lịch của ${item.doctorName}`} className="text-sm font-bold text-red-700 underline" disabled={busy} onClick={() => setPendingDelete({ kind: "schedule", item })} type="button">Xóa</button>
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
                <div className="text-sm font-semibold">
                  <label className="block" htmlFor="exception-branch">Cơ sở</label>
                  <select className={inputClass} disabled={Boolean(editingExceptionId) || busy} id="exception-branch" onChange={(event) => setExceptionForm({ ...exceptionForm, branchId: event.target.value })} required value={exceptionForm.branchId}>
                    <option value="">Chọn cơ sở</option>
                    {branchesForDoctor(exceptionForm.doctorId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                  {exceptionForm.doctorId && branchesForDoctor(exceptionForm.doctorId).length === 0 ? (
                    <p className="mt-1.5 text-xs font-semibold text-amber-800" role="status">
                      Bác sĩ này chưa được gán cơ sở nào nên chưa thể tạo ngoại lệ.{" "}
                      <Link className="underline underline-offset-4" href="/admin/doctors">Gán cơ sở cho bác sĩ trong trang quản lý bác sĩ</Link> rồi quay lại.
                    </p>
                  ) : null}
                </div>
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
                {exceptionFormError ? <p aria-live="assertive" className="sm:col-span-2 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800" role="alert">{exceptionFormError}</p> : null}
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
                          setForceCandidate(null);
                          setExceptionFormError(null);
                          setExceptionForm({ doctorId: item.doctorId, branchId: item.branchId, exceptionDate: item.exceptionDate, type: item.type, customStartTime: item.customStartTime?.slice(0, 5) ?? "", customEndTime: item.customEndTime?.slice(0, 5) ?? "", reason: item.reason ?? "" });
                        }}
                        type="button"
                      >
                        Sửa
                      </button>
                      <button aria-label={`Xóa ngoại lệ của ${item.doctorName}`} className="font-bold text-red-700 underline" disabled={busy} onClick={() => setPendingDelete({ kind: "exception", item })} type="button">Xóa</button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </>
      ) : null}

      <ConfirmActionDialog
        confirmLabel={pendingDelete?.kind === "schedule" ? "Xóa lịch làm việc" : "Xóa ngoại lệ"}
        confirmingLabel="Đang xóa…"
        description="Lịch đã xóa không thể khôi phục. Khung giờ đặt khám sinh từ lịch này sẽ ngừng mở cho người bệnh."
        destructive
        entity={pendingDelete?.item}
        onCancel={() => { if (!busy) setPendingDelete(null); }}
        onConfirm={() => {
          if (pendingDelete?.kind === "schedule") void remove(pendingDelete.item.id);
          else if (pendingDelete?.kind === "exception") void removeException(pendingDelete.item.id);
        }}
        open={pendingDelete !== null}
        pending={busy}
        summaryItems={pendingDelete?.kind === "schedule" ? [
          { label: "Bác sĩ", value: pendingDelete.item.doctorName },
          { label: "Cơ sở", value: pendingDelete.item.branchName },
          { label: "Khung giờ", value: `${dayNames[pendingDelete.item.dayOfWeek]} · ${pendingDelete.item.startTime.slice(0, 5)} - ${pendingDelete.item.endTime.slice(0, 5)}` },
          { label: "Hiệu lực", value: `${formatBusinessDate(pendingDelete.item.effectiveFrom)} đến ${pendingDelete.item.effectiveTo ? formatBusinessDate(pendingDelete.item.effectiveTo) : "không giới hạn"}` },
        ] : pendingDelete ? [
          { label: "Bác sĩ", value: pendingDelete.item.doctorName },
          { label: "Cơ sở", value: pendingDelete.item.branchName },
          { label: "Ngày", value: formatBusinessDate(pendingDelete.item.exceptionDate) },
          { label: "Loại", value: exceptionTypeLabels[pendingDelete.item.type] },
        ] : []}
        summaryLabel="Bản ghi sẽ bị xóa vĩnh viễn"
        title={pendingDelete?.kind === "schedule" ? "Xóa lịch làm việc này?" : "Xóa ngày nghỉ / giờ đặc biệt này?"}
      />

      {/*
        Second, separate confirmation for a write the live-booking guard refused.
        It is a different decision from deleting a record — it deliberately
        strands appointments that are already booked — so it never shares the
        delete dialog's copy or its destructive default.
      */}
      <ConfirmActionDialog
        confirmLabel="Vẫn tiếp tục (force)"
        confirmingLabel="Đang gửi lại…"
        description="Hệ thống sẽ gửi lại yêu cầu với tham số force=true. Các lịch hẹn đã đặt trong khung giờ bị đóng hoặc thu hẹp sẽ nằm ngoài lịch làm việc — hãy chắc chắn đã liên hệ với người bệnh trước khi tiếp tục."
        destructive
        onCancel={() => { if (!busy) setForceConfirmOpen(false); }}
        onConfirm={() => { void confirmForce(); }}
        open={forceConfirmOpen}
        pending={busy}
        summaryItems={[{ label: "Thao tác bị chặn", value: forceCandidate?.options.forceLabel ?? "Không xác định" }]}
        summaryLabel="Yêu cầu đã bị hệ thống từ chối"
        title="Ghi đè và vẫn tiếp tục?"
      />
    </div>
  );
}
