"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  adminListBranches,
  adminListDoctors,
  adminCreateDoctor,
  adminDeleteDoctor,
  adminListSpecialties,
  adminListUsers,
  adminUpdateDoctor,
  fetchAllContent,
  type AdminDoctorPayload,
  type AdminUserAccount,
  type Branch,
  type Doctor,
  type Specialty,
} from "../../../lib/api-client";
import AdminState from "../_components/AdminState";
import ConfirmActionDialog from "../../../components/ui/ConfirmActionDialog";
import { describeAdminError } from "../_lib/errors";

type DoctorForm = {
  fullName: string;
  slug: string;
  bio: string;
  photoUrl: string;
  userId: string;
  branchIds: string[];
  specialtyIds: string[];
  active: boolean;
};

const EMPTY_FORM: DoctorForm = {
  fullName: "", slug: "", bio: "", photoUrl: "", userId: "",
  branchIds: [], specialtyIds: [], active: true,
};
const ADMIN_PAGE_SIZE = 100;

function formFromDoctor(doctor: Doctor): DoctorForm {
  return {
    fullName: doctor.fullName,
    slug: doctor.slug,
    bio: doctor.bio ?? "",
    photoUrl: doctor.photoUrl ?? "",
    userId: doctor.linkedUser?.id ?? "",
    branchIds: doctor.branchIds ?? [],
    specialtyIds: doctor.specialtyIds ?? [],
    active: doctor.active ?? true,
  };
}

function toPayload(form: DoctorForm, editingDoctor: Doctor | null): AdminDoctorPayload {
  const userId = form.userId.trim();
  return {
    fullName: form.fullName.trim(),
    slug: form.slug.trim(),
    bio: form.bio.trim() || null,
    photoUrl: form.photoUrl.trim() || null,
    active: form.active,
    ...(userId ? { userId } : {}),
    // Clearing the select on a doctor that has a link is an explicit unlink;
    // on a never-linked doctor the empty select stays a no-op.
    ...(editingDoctor?.linkedUser && !userId ? { unlinkUser: true } : {}),
    branchIds: form.branchIds,
    specialtyIds: form.specialtyIds,
  };
}

function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((value) => value !== id) : [...list, id];
}

export default function AdminDoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [doctorAccounts, setDoctorAccounts] = useState<AdminUserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<DoctorForm>(EMPTY_FORM);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; title: string; description: string } | null>(null);
  const [mutating, setMutating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Doctor | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [content, branchRows, specialtyRows, accountRows] = await Promise.all([
        fetchAllContent(adminListDoctors, ADMIN_PAGE_SIZE),
        fetchAllContent((p, s) => adminListBranches(p, s), ADMIN_PAGE_SIZE),
        fetchAllContent((p, s) => adminListSpecialties(p, s), ADMIN_PAGE_SIZE),
        fetchAllContent((p, s) => adminListUsers({ role: "DOCTOR", status: "ACTIVE", page: p, size: s }), ADMIN_PAGE_SIZE),
      ]);
      setDoctors(content);
      setBranches(branchRows);
      setSpecialties(specialtyRows);
      setDoctorAccounts(accountRows);
    } catch (error) {
      setLoadError(describeAdminError(error).description);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const task = Promise.resolve().then(() => load());
    return () => void task;
  }, [load]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingSlug(null);
    setFormError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMutating(true);
    setFormError(null);
    setFeedback(null);

    try {
      const editingDoctor = editingSlug
        ? (doctors.find((doctor) => doctor.slug === editingSlug) ?? null)
        : null;
      const payload = toPayload(form, editingDoctor);
      if (editingSlug) {
        await adminUpdateDoctor(editingSlug, payload);
      } else {
        await adminCreateDoctor(payload);
      }
      setFeedback({
        tone: "success",
        title: editingSlug ? "Đã cập nhật bác sĩ" : "Đã tạo bác sĩ",
        description: "Thay đổi đã được ghi nhận và danh sách đang được làm mới.",
      });
      resetForm();
      await load();
    } catch (error) {
      const copy = describeAdminError(error);
      setFormError(`${copy.title}: ${copy.description}`);
    } finally {
      setMutating(false);
    }
  };

  const handleDelete = async (slug: string) => {
    setMutating(true);
    setFeedback(null);
    try {
      await adminDeleteDoctor(slug);
      const refreshed = await fetchAllContent(adminListDoctors, ADMIN_PAGE_SIZE);
      setDoctors(refreshed);
      const stillPresent = refreshed.some((doctor) => doctor.slug === slug);
      setFeedback(stillPresent
        ? { tone: "error", title: "Chưa xác nhận được việc xóa", description: "Bác sĩ vẫn còn trong danh sách quản trị. Vui lòng kiểm tra quyền truy cập rồi thử lại." }
        : { tone: "success", title: "Đã xóa bác sĩ", description: "Bác sĩ không còn trong danh sách quản trị." });
    } catch (error) {
      const copy = describeAdminError(error);
      setFeedback({ tone: "error", title: copy.title, description: copy.description });
    } finally {
      setMutating(false);
      setPendingDelete(null);
    }
  };

  return (
    <div>
      <header className="border-b border-slate-200 pb-6">
        <h1 className="text-3xl font-bold text-slate-950">Quản lý bác sĩ</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Cập nhật hồ sơ và trạng thái hiển thị của đội ngũ bác sĩ trong mạng lưới.</p>
      </header>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section aria-labelledby="doctor-form-title" className="border-t border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900" id="doctor-form-title">{editingSlug ? "Sửa hồ sơ" : "Thêm bác sĩ"}</h2>
            </div>
            {editingSlug ? <button className="text-xs font-bold text-slate-600 underline underline-offset-4 disabled:opacity-50" disabled={mutating} onClick={resetForm} type="button">Hủy sửa</button> : null}
          </div>

          <div className="mt-4">
            <AdminState tone="info" title="Quyền quản trị" description="Chỉ tài khoản quản trị được phép tạo hoặc thay đổi hồ sơ bác sĩ." />
          </div>

          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            {formError ? <p aria-live="assertive" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{formError}</p> : null}
            <div>
              <label className="text-sm font-semibold text-slate-700" htmlFor="doctor-full-name">Họ tên</label>
              <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" id="doctor-full-name" maxLength={160} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required value={form.fullName} />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700" htmlFor="doctor-slug">Slug</label>
              <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" id="doctor-slug" maxLength={180} onChange={(event) => setForm({ ...form, slug: event.target.value })} required value={form.slug} />
              <p className="mt-1 text-xs text-slate-500">Slug phải duy nhất trong danh sách bác sĩ.</p>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700" htmlFor="doctor-bio">Tiểu sử</label>
              <textarea className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" id="doctor-bio" maxLength={4000} onChange={(event) => setForm({ ...form, bio: event.target.value })} rows={4} value={form.bio} />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700" htmlFor="doctor-photo-url">Ảnh đại diện URL (tùy chọn)</label>
              <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" id="doctor-photo-url" maxLength={500} onChange={(event) => setForm({ ...form, photoUrl: event.target.value })} type="url" value={form.photoUrl} />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700" htmlFor="doctor-user-id">Tài khoản liên kết (tùy chọn)</label>
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                id="doctor-user-id"
                onChange={(event) => setForm({ ...form, userId: event.target.value })}
                value={form.userId}
              >
                <option value="">Không liên kết tài khoản</option>
                {form.userId && !doctorAccounts.some((account) => account.id === form.userId) ? (
                  <option value={form.userId}>
                    {(() => {
                      const linked = doctors.find((doctor) => doctor.linkedUser?.id === form.userId)?.linkedUser;
                      return linked
                        ? `Tài khoản hiện tại (${linked.email}) — giữ nguyên`
                        : `Tài khoản hiện tại (${form.userId.slice(0, 8)}…) — giữ nguyên`;
                    })()}
                  </option>
                ) : null}
                {doctorAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.displayName || account.email} — {account.email}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Chọn một tài khoản có vai trò Bác sĩ để người đó đăng nhập cổng bác sĩ với hồ sơ này.
                Tạo hoặc cấp vai trò tài khoản tại trang Tài khoản.
              </p>
            </div>
            <fieldset>
              <legend className="text-sm font-semibold text-slate-700">Cơ sở trực thuộc</legend>
              {branches.length === 0 ? (
                <p className="mt-1 text-xs text-slate-500">Chưa có cơ sở nào — tạo cơ sở ở trang Cơ sở trước.</p>
              ) : (
                <div className="mt-1 max-h-36 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                  {branches.map((branch) => (
                    <label className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 text-sm text-slate-700 hover:bg-slate-50" key={branch.id}>
                      <input
                        checked={form.branchIds.includes(branch.id)}
                        className="h-4 w-4 accent-teal-700"
                        onChange={() => setForm({ ...form, branchIds: toggleId(form.branchIds, branch.id) })}
                        type="checkbox"
                      />
                      {branch.name}
                    </label>
                  ))}
                </div>
              )}
              <p className="mt-1 text-xs text-slate-500">Bác sĩ chỉ xuất hiện trong bộ lọc lịch của các cơ sở được gán.</p>
            </fieldset>
            <fieldset>
              <legend className="text-sm font-semibold text-slate-700">Chuyên khoa phụ trách</legend>
              {specialties.length === 0 ? (
                <p className="mt-1 text-xs text-slate-500">Chưa có chuyên khoa nào — tạo ở trang Chuyên khoa trước.</p>
              ) : (
                <div className="mt-1 max-h-36 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                  {specialties.map((specialty) => (
                    <label className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 text-sm text-slate-700 hover:bg-slate-50" key={specialty.id}>
                      <input
                        checked={form.specialtyIds.includes(specialty.id)}
                        className="h-4 w-4 accent-teal-700"
                        onChange={() => setForm({ ...form, specialtyIds: toggleId(form.specialtyIds, specialty.id) })}
                        type="checkbox"
                      />
                      {specialty.name}
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
            <label className="flex items-center gap-2 text-sm text-slate-700" htmlFor="doctor-active">
              <input checked={form.active} className="h-4 w-4 accent-teal-700" id="doctor-active" onChange={(event) => setForm({ ...form, active: event.target.checked })} type="checkbox" />
              Đang hiển thị trong catalog công khai
            </label>
            <button className="w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50" disabled={mutating} type="submit">
              {mutating ? "Đang gửi…" : editingSlug ? "Lưu thay đổi" : "Tạo bác sĩ"}
            </button>
          </form>
        </section>

        <section aria-labelledby="doctor-list-title" className="min-w-0">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900" id="doctor-list-title">Danh sách bác sĩ</h2>
            </div>
            <button className="text-sm font-bold text-teal-800 underline underline-offset-4 disabled:opacity-50" disabled={loading} onClick={() => void load()} type="button">Làm mới</button>
          </div>

          {feedback ? <div className="mb-4"><AdminState description={feedback.description} title={feedback.title} tone={feedback.tone} /></div> : null}
          {loading ? <AdminState tone="loading" title="Đang tải danh sách bác sĩ" description="Vui lòng chờ trong giây lát." /> : null}
          {!loading && loadError ? <AdminState action={<button className="text-sm font-bold underline underline-offset-4" onClick={() => void load()} type="button">Thử lại</button>} description={loadError} title="Không thể tải danh sách bác sĩ" tone="error" /> : null}
          {!loading && !loadError && doctors.length === 0 ? <AdminState tone="empty" title="Chưa có bác sĩ" description="Tạo hồ sơ bác sĩ đầu tiên để bắt đầu quản lý đội ngũ." /> : null}
          {!loading && !loadError && doctors.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div aria-label="Bảng bác sĩ, có thể cuộn ngang" className="overflow-x-auto" role="region" tabIndex={0}>
                <table className="min-w-[920px] w-full text-left text-sm">
                  <caption className="sr-only">Bác sĩ trong admin catalog</caption>
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr><th scope="col" className="px-4 py-3 font-bold">Họ tên</th><th scope="col" className="px-4 py-3 font-bold">Tài khoản</th><th scope="col" className="px-4 py-3 font-bold">Cơ sở</th><th scope="col" className="px-4 py-3 font-bold">Chuyên khoa</th><th scope="col" className="px-4 py-3 font-bold">Trạng thái</th><th scope="col" className="px-4 py-3 text-right font-bold">Thao tác</th></tr>
                  </thead>
                  <tbody>
                    {doctors.map((doctor) => {
                      const branchNames = (doctor.branchIds ?? [])
                        .map((id) => branches.find((branch) => branch.id === id)?.name ?? null)
                        .filter((name): name is string => name !== null);
                      const specialtyNames = (doctor.specialtyIds ?? [])
                        .map((id) => specialties.find((specialty) => specialty.id === id)?.name ?? null)
                        .filter((name): name is string => name !== null);
                      return (
                      <tr className="border-b border-slate-100 last:border-0" key={doctor.id}>
                        <td className="px-4 py-4 font-semibold text-slate-900">{doctor.fullName}<br /><span className="font-mono text-xs font-normal text-slate-500">{doctor.slug}</span></td>
                        <td className="px-4 py-4 text-xs text-slate-700">
                          {doctor.linkedUser ? doctor.linkedUser.email : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-4 py-4 text-xs text-slate-700">
                          {branchNames.length > 0 ? branchNames.join(", ") : <span className="text-amber-800">Chưa gán cơ sở</span>}
                        </td>
                        <td className="px-4 py-4 text-xs text-slate-700">
                          {specialtyNames.length > 0 ? specialtyNames.join(", ") : <span className="text-amber-800">Chưa gán chuyên khoa</span>}
                        </td>
                        <td className="px-4 py-4">
                          <span className={doctor.active ?? true ? "rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700" : "rounded-md bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600"}>
                            {doctor.active ?? true ? "Đang hiển thị" : "Tạm ẩn"}
                          </span>
                        </td>
                        <td className="px-4 py-4"><div className="flex justify-end gap-3"><button aria-label={`Sửa ${doctor.fullName}`} className="text-xs font-bold text-teal-800 underline underline-offset-4 disabled:opacity-50" disabled={mutating} onClick={() => { setEditingSlug(doctor.slug); setForm(formFromDoctor(doctor)); setFormError(null); setFeedback(null); }} type="button">Sửa</button><button aria-label={`Xóa ${doctor.fullName}`} className="text-xs font-bold text-red-700 underline underline-offset-4 disabled:opacity-50" disabled={mutating} onClick={() => setPendingDelete(doctor)} type="button">Xóa</button></div></td>
                      </tr>
                    );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <ConfirmActionDialog
        confirmLabel="Xóa hồ sơ bác sĩ"
        confirmingLabel="Đang xóa…"
        description="Lịch làm việc và liên kết đặt lịch của bác sĩ này sẽ không còn hiển thị công khai. Nếu chỉ nghỉ tạm thời, hãy dùng trạng thái “Tạm ẩn”."
        destructive
        entity={pendingDelete ?? undefined}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void handleDelete(pendingDelete?.slug ?? "")}
        open={pendingDelete !== null}
        pending={mutating}
        summaryItems={pendingDelete ? [
          { label: "Họ tên", value: pendingDelete.fullName },
          { label: "Slug", value: pendingDelete.slug, mono: true },
          { label: "Trạng thái", value: pendingDelete.active ?? true ? "Đang hiển thị" : "Tạm ẩn" },
        ] : []}
        summaryLabel="Hồ sơ sẽ bị xóa vĩnh viễn"
        title="Xóa hồ sơ bác sĩ này?"
      />
    </div>
  );
}
