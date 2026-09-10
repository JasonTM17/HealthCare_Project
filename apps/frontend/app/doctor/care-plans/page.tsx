"use client";

import { useEffect, useState } from "react";
import { businessDate } from "../../../lib/business-time";
import PortalChrome from "../../../components/PortalChrome";
import ConfirmActionDialog from "../../../components/ui/ConfirmActionDialog";
import { EmptyState, ErrorState, ForbiddenState, LoadingState, LoginRequiredState } from "../../../components/PortalStates";
import {
  ApiError,
  cancelDoctorCarePlanItem,
  completeDoctorCarePlanItem,
  createDoctorCarePlan,
  deleteDoctorCarePlan,
  fetchDoctorAppointments,
  fetchDoctorCarePlans,
  hasRole,
  updateDoctorCarePlan,
} from "../../../lib/api-client";
import { useAuthSession } from "../../../components/useAuthSession";
import type { CarePlan, CarePlanItem, DoctorPortalAppointment } from "../../../types/hospital";

const ELIGIBLE_APPOINTMENT_STATUSES = ["CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED"];

const PLAN_STATUS_LABELS: Record<string, string> = {
  OPEN: "Đang theo dõi",
  DONE: "Đã hoàn tất",
  CANCELLED: "Đã hủy",
};

const ITEM_STATUS_LABELS: Record<string, string> = {
  OPEN: "Đang mở",
  DONE: "Đã hoàn tất",
  CANCELLED: "Đã hủy",
};

type ItemDraft = {
  localId: string;
  id?: string;
  goal: string;
  reminder: string;
  dueAt: string;
};

function statusLabel(status: string, labels: Record<string, string>): string {
  return labels[status] ?? "Trạng thái chưa xác định";
}

function dateTimeLabel(value?: string | null): string {
  if (!value) return "Chưa đặt hạn";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Chưa đặt hạn"
    : date.toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" });
}

function toDateTimeLocal(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function toApiDateTime(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function newDraft(): ItemDraft {
  return {
    localId: `new-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    goal: "",
    reminder: "",
    dueAt: "",
  };
}

function draftFromItem(item: CarePlanItem): ItemDraft {
  return {
    localId: item.id,
    id: item.id,
    goal: item.goal,
    reminder: item.reminder ?? "",
    dueAt: toDateTimeLocal(item.dueAt),
  };
}

function summarizePlanStatus(items: CarePlanItem[]): CarePlan["status"] {
  if (items.some((item) => item.status === "OPEN")) return "OPEN";
  if (items.some((item) => item.status === "DONE")) return "DONE";
  return "CANCELLED";
}

function replaceItem(plan: CarePlan, updatedItem: CarePlanItem): CarePlan {
  const items = plan.items.map((item) => item.id === updatedItem.id ? updatedItem : item);
  return { ...plan, status: summarizePlanStatus(items), items };
}

export default function DoctorCarePlansPage() {
  const session = useAuthSession();
  const [plans, setPlans] = useState<CarePlan[]>([]);
  const [appointments, setAppointments] = useState<DoctorPortalAppointment[]>([]);
  const [appointmentId, setAppointmentId] = useState("");
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [reminder, setReminder] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editItems, setEditItems] = useState<ItemDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [retry, setRetry] = useState(0);
  const [pendingAction, setPendingAction] = useState<
    { kind: "cancel-item"; planId: string; item: CarePlanItem } | { kind: "delete-plan"; plan: CarePlan } | null
  >(null);

  useEffect(() => {
    if (!session || !hasRole(session.user, "DOCTOR")) return;
    let cancelled = false;
    const today = businessDate();
    void Promise.resolve()
      .then(() => {
        if (cancelled) return undefined;
        setLoading(true);
        setError(null);
        return Promise.all([fetchDoctorCarePlans(), fetchDoctorAppointments(today, undefined, 0, 100)]);
      })
      .then((value) => {
        if (!cancelled && value) {
          setPlans(value[0]);
          setAppointments(value[1].content.filter((item) => ELIGIBLE_APPOINTMENT_STATUSES.includes(item.status)));
        }
      })
      .catch((reason) => {
        if (!cancelled) setError(reason);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [retry, session]);

  if (!session) return <LoginRequiredState nextPath="/doctor/care-plans" />;
  if (!hasRole(session.user, "DOCTOR")) {
    return <ForbiddenState title="Không có quyền tạo kế hoạch" description="Chỉ bác sĩ được phân công mới có thể ghi mục tiêu follow-up." />;
  }

  const resetCreateForm = () => {
    setAppointmentId("");
    setTitle("");
    setGoal("");
    setReminder("");
    setDueAt("");
  };

  const create = async () => {
    if (!appointmentId || !title.trim() || !goal.trim() || creating || busy) return;
    setCreating(true);
    setNotice(null);
    setError(null);
    try {
      const created = await createDoctorCarePlan({
        appointmentId,
        title: title.trim(),
        items: [{ goal: goal.trim(), reminder: reminder.trim() || null, dueAt: toApiDateTime(dueAt) }],
      });
      setPlans((current) => [created, ...current]);
      resetCreateForm();
      setNotice("Đã tạo kế hoạch chăm sóc.");
    } catch (reason) {
      setError(reason);
    } finally {
      setCreating(false);
    }
  };

  const beginEdit = (plan: CarePlan) => {
    setEditingPlanId(plan.id);
    setEditTitle(plan.title);
    setEditItems(plan.items.filter((item) => item.status === "OPEN").map(draftFromItem));
    setNotice(null);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingPlanId(null);
    setEditTitle("");
    setEditItems([]);
  };

  const updateDraft = (localId: string, patch: Partial<ItemDraft>) => {
    setEditItems((current) => current.map((item) => item.localId === localId ? { ...item, ...patch } : item));
  };

  const addEditItem = () => {
    setEditItems((current) => [...current, newDraft()]);
  };

  const removeNewEditItem = (localId: string) => {
    setEditItems((current) => current.filter((item) => item.localId !== localId || item.id));
  };

  const saveEdit = async () => {
    if (!editingPlanId || !editTitle.trim() || busy) return;
    const items = editItems
      .filter((item) => item.goal.trim())
      .map((item) => ({
        id: item.id ?? null,
        goal: item.goal.trim(),
        reminder: item.reminder.trim() || null,
        dueAt: toApiDateTime(item.dueAt),
      }));
    if (items.length !== editItems.length) return;
    setBusy(`edit:${editingPlanId}`);
    setNotice(null);
    setError(null);
    try {
      const updated = await updateDoctorCarePlan(editingPlanId, { title: editTitle.trim(), items });
      setPlans((current) => current.map((plan) => plan.id === updated.id ? updated : plan));
      cancelEdit();
      setNotice("Đã cập nhật kế hoạch chăm sóc.");
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(null);
    }
  };

  const completeItem = async (planId: string, itemId: string) => {
    if (busy) return;
    setBusy(`complete:${itemId}`);
    setNotice(null);
    setError(null);
    try {
      const item = await completeDoctorCarePlanItem(itemId);
      setPlans((current) => current.map((plan) => plan.id === planId ? replaceItem(plan, item) : plan));
      setEditItems((current) => current.filter((draft) => draft.id !== itemId));
      setNotice("Đã đánh dấu mục chăm sóc hoàn tất.");
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(null);
    }
  };

  const cancelItem = async (planId: string, itemId: string) => {
    if (busy) return;
    setBusy(`cancel:${itemId}`);
    setNotice(null);
    setError(null);
    try {
      const item = await cancelDoctorCarePlanItem(itemId);
      setPlans((current) => current.map((plan) => plan.id === planId ? replaceItem(plan, item) : plan));
      setEditItems((current) => current.filter((draft) => draft.id !== itemId));
      setNotice("Đã hủy mục chăm sóc.");
      setPendingAction(null);
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(null);
    }
  };

  const deletePlan = async (planId: string) => {
    if (busy) return;
    setBusy(`delete:${planId}`);
    setNotice(null);
    setError(null);
    try {
      await deleteDoctorCarePlan(planId);
      setPlans((current) => current.filter((plan) => plan.id !== planId));
      if (editingPlanId === planId) cancelEdit();
      setNotice("Đã xóa kế hoạch chăm sóc.");
      setPendingAction(null);
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(null);
    }
  };

  const status = error instanceof ApiError ? error.status : undefined;
  const editHasBlankItem = editItems.some((item) => !item.goal.trim());

  return <PortalChrome role="DOCTOR" user={session.user}>
    <div className="section-inner portal-page">
      <header className="portal-hero">
        <div>
          <p className="section-note">FOLLOW-UP CARE</p>
          <h1>Kế hoạch chăm sóc</h1>
          <p>Tạo checklist mục tiêu và lời nhắc gắn đúng lịch hẹn. Không nhập đơn thuốc, chẩn đoán hay hướng dẫn điều trị tự động.</p>
        </div>
        <button className="outline-button min-h-11" disabled={loading} onClick={() => setRetry((value) => value + 1)} type="button">
          {loading ? "Đang tải..." : "Tải lại"}
        </button>
      </header>

      {loading ? <LoadingState label="Đang tải kế hoạch..." /> : null}
      {error ? <ErrorState message="Không thể tải hoặc ghi kế hoạch." status={status} onRetry={() => setRetry((value) => value + 1)} /> : null}
      {notice ? <p aria-live="polite" className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm font-bold text-teal-950" role="status">{notice}</p> : null}

      {appointments.length > 0 ? (
        <section className="portal-panel grid gap-3" aria-labelledby="create-care-plan-title">
          <h2 id="create-care-plan-title">Tạo mục tiêu theo dõi</h2>
          <label className="grid gap-1 text-sm font-bold" htmlFor="care-appointment">
            Lịch hẹn
            <select id="care-appointment" className="min-h-11 rounded-lg border border-slate-300 px-3" onChange={(event) => setAppointmentId(event.target.value)} value={appointmentId}>
              <option value="">Chọn lịch hẹn</option>
              {appointments.map((item) => (
                <option key={item.id} value={item.id}>{item.appointmentDate} - {item.patientName} - {item.status}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-bold" htmlFor="care-title">
            Tên kế hoạch
            <input id="care-title" className="min-h-11 rounded-lg border border-slate-300 px-3" maxLength={240} onChange={(event) => setTitle(event.target.value)} placeholder="Ví dụ: Theo dõi sau khám" value={title} />
          </label>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <label className="grid gap-1 text-sm font-bold" htmlFor="care-goal">
              Mục tiêu
              <input id="care-goal" className="min-h-11 rounded-lg border border-slate-300 px-3" maxLength={1000} onChange={(event) => setGoal(event.target.value)} placeholder="Mục tiêu theo dõi không kê đơn" value={goal} />
            </label>
            <label className="grid gap-1 text-sm font-bold" htmlFor="care-due-at">
              Hạn nhắc
              <input id="care-due-at" className="min-h-11 rounded-lg border border-slate-300 px-3" onChange={(event) => setDueAt(event.target.value)} type="datetime-local" value={dueAt} />
            </label>
          </div>
          <label className="grid gap-1 text-sm font-bold" htmlFor="care-reminder">
            Lời nhắc
            <input id="care-reminder" className="min-h-11 rounded-lg border border-slate-300 px-3" maxLength={500} onChange={(event) => setReminder(event.target.value)} placeholder="Ví dụ: Ghi lại triệu chứng mỗi tối" value={reminder} />
          </label>
          <button className="button button--primary w-fit" disabled={creating || Boolean(busy) || !appointmentId || !title.trim() || !goal.trim()} onClick={() => void create()} type="button">
            {creating ? "Đang ghi..." : "Tạo kế hoạch"}
          </button>
        </section>
      ) : null}

      {!loading && !error && plans.length === 0 ? <EmptyState title="Chưa có kế hoạch đã tạo" description="Chọn một lịch hẹn đủ điều kiện để tạo mục tiêu follow-up." /> : null}

      <section className="grid gap-4" aria-labelledby="doctor-care-plan-list-title" aria-live="polite">
        <h2 className="sr-only" id="doctor-care-plan-list-title">Danh sách kế hoạch chăm sóc</h2>
        {plans.map((plan) => {
          const isEditing = editingPlanId === plan.id;
          const canEdit = plan.status === "OPEN";
          const saveBusy = busy === `edit:${plan.id}`;
          return (
            <article className="portal-panel grid gap-4" key={plan.id}>
              <div className="portal-panel__heading gap-3">
                <div className="min-w-0">
                  <p className="section-note">{statusLabel(plan.status, PLAN_STATUS_LABELS)}</p>
                  <h2>{plan.title}</h2>
                  <p className="mt-1 text-sm text-slate-600">Lịch hẹn {plan.appointmentId.slice(0, 8)}... - {plan.items.length} mục</p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <button className="outline-button outline-button--small min-h-11" disabled={!canEdit || Boolean(busy)} onClick={() => beginEdit(plan)} type="button">Sửa</button>
                  <button className="outline-button outline-button--small min-h-11" disabled={Boolean(busy)} onClick={() => setPendingAction({ kind: "delete-plan", plan })} type="button">
                    {busy === `delete:${plan.id}` ? "Đang xóa..." : "Xóa"}
                  </button>
                </div>
              </div>

              {isEditing ? (
                <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <label className="grid gap-1 text-sm font-bold" htmlFor={`edit-title-${plan.id}`}>
                    Tên kế hoạch
                    <input id={`edit-title-${plan.id}`} className="min-h-11 rounded-lg border border-slate-300 px-3" maxLength={240} onChange={(event) => setEditTitle(event.target.value)} value={editTitle} />
                  </label>
                  <div className="grid gap-3">
                    {editItems.map((item, index) => (
                      <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3" key={item.localId}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <strong className="text-sm">Mục {index + 1}</strong>
                          {!item.id ? <button className="outline-button outline-button--small min-h-11" onClick={() => removeNewEditItem(item.localId)} type="button">Bỏ</button> : null}
                        </div>
                        <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                          <label className="grid gap-1 text-sm font-bold" htmlFor={`edit-goal-${item.localId}`}>
                            Mục tiêu
                            <input id={`edit-goal-${item.localId}`} className="min-h-11 rounded-lg border border-slate-300 px-3" maxLength={1000} onChange={(event) => updateDraft(item.localId, { goal: event.target.value })} value={item.goal} />
                          </label>
                          <label className="grid gap-1 text-sm font-bold" htmlFor={`edit-due-${item.localId}`}>
                            Hạn nhắc
                            <input id={`edit-due-${item.localId}`} className="min-h-11 rounded-lg border border-slate-300 px-3" onChange={(event) => updateDraft(item.localId, { dueAt: event.target.value })} type="datetime-local" value={item.dueAt} />
                          </label>
                        </div>
                        <label className="grid gap-1 text-sm font-bold" htmlFor={`edit-reminder-${item.localId}`}>
                          Lời nhắc
                          <input id={`edit-reminder-${item.localId}`} className="min-h-11 rounded-lg border border-slate-300 px-3" maxLength={500} onChange={(event) => updateDraft(item.localId, { reminder: event.target.value })} value={item.reminder} />
                        </label>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="outline-button outline-button--small min-h-11" onClick={addEditItem} type="button">Thêm mục</button>
                    <button className="button button--primary min-h-11" disabled={saveBusy || !editTitle.trim() || editHasBlankItem} onClick={() => void saveEdit()} type="button">
                      {saveBusy ? "Đang lưu..." : "Lưu thay đổi"}
                    </button>
                    <button className="outline-button outline-button--small min-h-11" disabled={saveBusy} onClick={cancelEdit} type="button">Hủy sửa</button>
                  </div>
                </div>
              ) : null}

              <ol className="grid gap-2">
                {plan.items.map((item) => {
                  const itemOpen = plan.status === "OPEN" && item.status === "OPEN";
                  return (
                    <li className="grid gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-[minmax(0,1fr)_auto]" key={item.id}>
                      <div className="min-w-0">
                        <strong className="break-words text-slate-950">{item.goal}</strong>
                        <p className="mt-1 text-xs font-bold text-slate-500">{statusLabel(item.status, ITEM_STATUS_LABELS)} - Hạn: {dateTimeLabel(item.dueAt)}</p>
                        {item.reminder ? <p className="mt-1 break-words text-sm text-slate-600">Nhắc: {item.reminder}</p> : null}
                        {item.completedAt ? <p className="mt-1 text-xs text-slate-500">Hoàn tất: {dateTimeLabel(item.completedAt)}</p> : null}
                      </div>
                      <div className="flex flex-wrap items-start justify-end gap-2">
                        <button className="outline-button outline-button--small min-h-11" disabled={!itemOpen || Boolean(busy)} onClick={() => void completeItem(plan.id, item.id)} type="button">
                          {busy === `complete:${item.id}` ? "Đang lưu..." : "Hoàn tất"}
                        </button>
                        <button className="outline-button outline-button--small min-h-11" disabled={!itemOpen || Boolean(busy)} onClick={() => setPendingAction({ kind: "cancel-item", planId: plan.id, item })} type="button">
                          {busy === `cancel:${item.id}` ? "Đang hủy..." : "Hủy mục"}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </article>
          );
        })}
      </section>

      <ConfirmActionDialog
        confirmLabel={pendingAction?.kind === "delete-plan" ? "Xóa kế hoạch" : "Hủy mục chăm sóc"}
        confirmingLabel="Đang ghi nhận…"
        description={pendingAction?.kind === "delete-plan"
          ? "Kế hoạch và toàn bộ mục theo dõi sẽ bị xóa khỏi hồ sơ chăm sóc. Thao tác này không thể hoàn tác."
          : "Mục chăm sóc sẽ chuyển sang “Đã hủy” và không còn nhắc bác sĩ theo dõi. Lịch sử hiển thị vẫn được giữ lại."}
        destructive={pendingAction?.kind === "delete-plan"}
        entity={pendingAction?.kind === "delete-plan" ? pendingAction.plan : pendingAction?.item}
        onCancel={() => { if (!busy) setPendingAction(null); }}
        onConfirm={() => {
          if (pendingAction?.kind === "delete-plan") void deletePlan(pendingAction.plan.id);
          else if (pendingAction?.kind === "cancel-item") void cancelItem(pendingAction.planId, pendingAction.item.id);
        }}
        open={pendingAction !== null}
        pending={Boolean(busy)}
        summaryItems={pendingAction?.kind === "delete-plan" ? [
          { label: "Tên kế hoạch", value: pendingAction.plan.title },
          { label: "Số mục theo dõi", value: String(pendingAction.plan.items.length) },
          { label: "Trạng thái", value: statusLabel(pendingAction.plan.status, PLAN_STATUS_LABELS) },
        ] : pendingAction ? [
          { label: "Mục tiêu", value: pendingAction.item.goal },
          { label: "Hạn nhắc", value: dateTimeLabel(pendingAction.item.dueAt) },
          { label: "Trạng thái", value: statusLabel(pendingAction.item.status, ITEM_STATUS_LABELS) },
        ] : []}
        summaryLabel={pendingAction?.kind === "delete-plan" ? "Kế hoạch sẽ bị xóa vĩnh viễn" : "Mục chăm sóc sẽ bị hủy"}
        title={pendingAction?.kind === "delete-plan" ? "Xóa kế hoạch chăm sóc này?" : "Hủy mục chăm sóc này?"}
      />
    </div>
  </PortalChrome>;
}
