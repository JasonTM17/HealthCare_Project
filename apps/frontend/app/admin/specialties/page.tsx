"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  adminListSpecialties,
  adminCreateSpecialty,
  adminDeleteSpecialty,
  adminUpdateSpecialty,
  fetchAllContent,
  type AdminSpecialtyPayload,
  type Specialty,
} from "../../../lib/api-client";
import AdminState from "../_components/AdminState";
import { describeAdminError } from "../_lib/errors";

type SpecialtyForm = { name: string; slug: string; description: string; active: boolean };
const EMPTY_FORM: SpecialtyForm = { name: "", slug: "", description: "", active: true };
const ADMIN_PAGE_SIZE = 100;

function formFromSpecialty(specialty: Specialty): SpecialtyForm {
  return { name: specialty.name, slug: specialty.slug, description: specialty.description ?? "", active: specialty.active ?? true };
}

function toPayload(form: SpecialtyForm): AdminSpecialtyPayload {
  return { name: form.name.trim(), slug: form.slug.trim(), description: form.description.trim() || null, active: form.active };
}

export default function AdminSpecialtiesPage() {
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<SpecialtyForm>(EMPTY_FORM);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; title: string; description: string } | null>(null);
  const [mutating, setMutating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const content = await fetchAllContent(adminListSpecialties, ADMIN_PAGE_SIZE);
      setSpecialties(content);
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
      const payload = toPayload(form);
      if (editingSlug) await adminUpdateSpecialty(editingSlug, payload);
      else await adminCreateSpecialty(payload);
      setFeedback({ tone: "success", title: editingSlug ? "Đã cập nhật chuyên khoa" : "Đã tạo chuyên khoa", description: "Thay đổi đã được ghi nhận và danh sách đang được làm mới." });
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
    if (!window.confirm(`Xóa chuyên khoa "${slug}"? Hành động này không thể hoàn tác.`)) return;
    setMutating(true);
    setFeedback(null);
    try {
      await adminDeleteSpecialty(slug);
      const refreshed = await fetchAllContent(adminListSpecialties, ADMIN_PAGE_SIZE);
      setSpecialties(refreshed);
      const stillVisible = refreshed.some((specialty) => specialty.slug === slug);
      setFeedback(stillVisible
        ? { tone: "error", title: "Chưa xác nhận được việc xóa", description: "Chuyên khoa vẫn còn trong danh sách quản trị. Vui lòng kiểm tra quyền truy cập rồi thử lại." }
        : { tone: "success", title: "Đã xóa chuyên khoa", description: "Chuyên khoa không còn trong danh sách quản trị." });
    } catch (error) {
      const copy = describeAdminError(error);
      setFeedback({ tone: "error", title: copy.title, description: copy.description });
    } finally {
      setMutating(false);
    }
  };

  return (
    <div>
      <header className="border-b border-slate-200 pb-6">
        <h1 className="text-3xl font-bold text-slate-950">Quản lý chuyên khoa</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Cập nhật nội dung và trạng thái hiển thị của các chuyên khoa trong mạng lưới.</p>
      </header>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section aria-labelledby="specialty-form-title" className="border-t border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3"><h2 className="text-xl font-bold text-slate-900" id="specialty-form-title">{editingSlug ? "Sửa chuyên khoa" : "Thêm chuyên khoa"}</h2>{editingSlug ? <button className="text-xs font-bold text-slate-600 underline underline-offset-4 disabled:opacity-50" disabled={mutating} onClick={resetForm} type="button">Hủy sửa</button> : null}</div>
          <div className="mt-4"><AdminState tone="info" title="Quyền quản trị" description="Chỉ tài khoản quản trị được phép tạo hoặc thay đổi thông tin chuyên khoa." /></div>
          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            {formError ? <p aria-live="assertive" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{formError}</p> : null}
            <div><label className="text-sm font-semibold text-slate-700" htmlFor="specialty-name">Tên chuyên khoa</label><input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" id="specialty-name" maxLength={160} onChange={(event) => setForm({ ...form, name: event.target.value })} required value={form.name} /></div>
            <div><label className="text-sm font-semibold text-slate-700" htmlFor="specialty-slug">Slug</label><input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" id="specialty-slug" maxLength={180} onChange={(event) => setForm({ ...form, slug: event.target.value })} required value={form.slug} /><p className="mt-1 text-xs text-slate-500">Slug phải duy nhất trong danh sách chuyên khoa.</p></div>
            <div><label className="text-sm font-semibold text-slate-700" htmlFor="specialty-description">Mô tả</label><textarea className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" id="specialty-description" maxLength={2000} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={5} value={form.description} /></div>
            <label className="flex items-center gap-2 text-sm text-slate-700" htmlFor="specialty-active"><input checked={form.active} className="h-4 w-4 accent-teal-700" id="specialty-active" onChange={(event) => setForm({ ...form, active: event.target.checked })} type="checkbox" />Đang hiển thị trong catalog công khai</label>
            <button className="w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50" disabled={mutating} type="submit">{mutating ? "Đang gửi…" : editingSlug ? "Lưu thay đổi" : "Tạo chuyên khoa"}</button>
          </form>
        </section>

        <section aria-labelledby="specialty-list-title" className="min-w-0">
          <div className="mb-3 flex items-end justify-between gap-3"><h2 className="text-xl font-bold text-slate-900" id="specialty-list-title">Danh sách chuyên khoa</h2><button className="text-sm font-bold text-teal-800 underline underline-offset-4 disabled:opacity-50" disabled={loading} onClick={() => void load()} type="button">Làm mới</button></div>
          {feedback ? <div className="mb-4"><AdminState description={feedback.description} title={feedback.title} tone={feedback.tone} /></div> : null}
          {loading ? <AdminState tone="loading" title="Đang tải danh sách chuyên khoa" description="Vui lòng chờ trong giây lát." /> : null}
          {!loading && loadError ? <AdminState action={<button className="text-sm font-bold underline underline-offset-4" onClick={() => void load()} type="button">Thử lại</button>} description={loadError} title="Không thể tải danh sách chuyên khoa" tone="error" /> : null}
          {!loading && !loadError && specialties.length === 0 ? <AdminState tone="empty" title="Chưa có chuyên khoa" description="Tạo chuyên khoa đầu tiên để bắt đầu quản lý danh mục khám." /> : null}
          {!loading && !loadError && specialties.length > 0 ? <div className="overflow-hidden rounded-lg border border-slate-200 bg-white"><div aria-label="Bảng chuyên khoa, có thể cuộn ngang" className="overflow-x-auto" role="region" tabIndex={0}><table className="min-w-[680px] w-full text-left text-sm"><caption className="sr-only">Chuyên khoa trong danh sách quản trị</caption><thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 font-bold">Tên</th><th className="px-4 py-3 font-bold">Slug</th><th className="px-4 py-3 font-bold">Trạng thái</th><th className="px-4 py-3 text-right font-bold">Thao tác</th></tr></thead><tbody>{specialties.map((specialty) => <tr className="border-b border-slate-100 last:border-0" key={specialty.id}><td className="px-4 py-4 font-semibold text-slate-900">{specialty.name}</td><td className="px-4 py-4 font-mono text-xs text-slate-500">{specialty.slug}</td><td className="px-4 py-4"><span className={specialty.active ?? true ? "rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700" : "rounded-md bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600"}>{specialty.active ?? true ? "Đang hiển thị" : "Tạm ẩn"}</span></td><td className="px-4 py-4"><div className="flex justify-end gap-3"><button aria-label={`Sửa ${specialty.name}`} className="text-xs font-bold text-teal-800 underline underline-offset-4 disabled:opacity-50" disabled={mutating} onClick={() => { setEditingSlug(specialty.slug); setForm(formFromSpecialty(specialty)); setFormError(null); setFeedback(null); }} type="button">Sửa</button><button aria-label={`Xóa ${specialty.name}`} className="text-xs font-bold text-red-700 underline underline-offset-4 disabled:opacity-50" disabled={mutating} onClick={() => void handleDelete(specialty.slug)} type="button">Xóa</button></div></td></tr>)}</tbody></table></div></div> : null}
        </section>
      </div>
    </div>
  );
}
