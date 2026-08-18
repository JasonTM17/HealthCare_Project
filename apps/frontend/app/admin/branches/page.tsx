"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  adminCreateBranch,
  adminDeleteBranch,
  adminUpdateBranch,
  fetchBranches,
  type AdminBranchPayload,
  type Branch,
} from "../../../lib/api-client";
import AdminState from "../_components/AdminState";
import { describeAdminError } from "../_lib/errors";

type BranchForm = { name: string; slug: string; address: string; phone: string; active: boolean };
const EMPTY_FORM: BranchForm = { name: "", slug: "", address: "", phone: "", active: true };

function formFromBranch(branch: Branch): BranchForm {
  return { name: branch.name, slug: branch.slug, address: branch.address, phone: branch.phone ?? "", active: true };
}

function toPayload(form: BranchForm): AdminBranchPayload {
  return { name: form.name.trim(), slug: form.slug.trim(), address: form.address.trim(), phone: form.phone.trim() || null, active: form.active };
}

export default function AdminBranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<BranchForm>(EMPTY_FORM);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; title: string; description: string } | null>(null);
  const [mutating, setMutating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setLoadError(null);
    try { const page = await fetchBranches(0, 100); setBranches(page.content); }
    catch (reason: unknown) { setLoadError(describeAdminError(reason).description); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const task = Promise.resolve().then(() => load());
    return () => void task;
  }, [load]);

  const reset = () => { setForm(EMPTY_FORM); setEditingSlug(null); setFormError(null); };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setMutating(true); setFormError(null); setFeedback(null);
    try {
      const payload = toPayload(form);
      if (editingSlug) await adminUpdateBranch(editingSlug, payload); else await adminCreateBranch(payload);
      const wasEditing = Boolean(editingSlug);
      reset(); setFeedback({ tone: "success", title: wasEditing ? "Cập nhật cơ sở đã được gửi" : "Tạo cơ sở đã được gửi", description: "Public catalog sẽ phản ánh dữ liệu sau khi backend xác nhận." });
      await load();
    } catch (reason: unknown) { const copy = describeAdminError(reason); setFormError(`${copy.title}: ${copy.description}`); }
    finally { setMutating(false); }
  };
  const remove = async (slug: string) => {
    if (!window.confirm(`Gửi yêu cầu xóa cơ sở "${slug}"?`)) return;
    setMutating(true); setFeedback(null);
    try {
      await adminDeleteBranch(slug);
      const refreshed = await fetchBranches(0, 100); setBranches(refreshed.content);
      setFeedback(refreshed.content.some((branch) => branch.slug === slug)
        ? { tone: "error", title: "Chưa xác nhận được việc xóa", description: "Slug vẫn còn trong public catalog; backend là nguồn xác nhận cuối cùng." }
        : { tone: "success", title: "Đã xác nhận cơ sở không còn hiển thị", description: "Public catalog không còn bản ghi active với slug này." });
    } catch (reason: unknown) { const copy = describeAdminError(reason); setFeedback({ tone: "error", title: copy.title, description: copy.description }); }
    finally { setMutating(false); }
  };

  return <div><header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">MẠNG LƯỚI CƠ SỞ</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Quản lý cơ sở</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Đọc active catalog và gửi mutation qua admin contract. Không có địa chỉ hoặc trạng thái tự dựng trên trình duyệt.</p></div><span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">Bản demo local</span></header><div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"><section aria-labelledby="branch-form-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">ADMIN WRITE CONTRACT</p><h2 className="mt-1 text-xl font-bold text-slate-900" id="branch-form-title">{editingSlug ? "Sửa cơ sở" : "Thêm cơ sở"}</h2></div>{editingSlug ? <button className="text-xs font-bold text-slate-600 underline" onClick={reset} type="button">Hủy sửa</button> : null}</div><div className="mt-4"><AdminState tone="info" title="Backend giữ quyền quyết định" description="Nếu phiên ADMIN bị từ chối, form giữ nguyên lỗi và không hiển thị thành công giả." /></div><form className="mt-5 space-y-4" onSubmit={submit}>{formError ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{formError}</p> : null}<label className="block text-sm font-semibold">Tên cơ sở<input className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" maxLength={160} onChange={(event) => setForm({ ...form, name: event.target.value })} required value={form.name} /></label><label className="block text-sm font-semibold">Slug<input className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-mono text-sm" maxLength={180} onChange={(event) => setForm({ ...form, slug: event.target.value })} required value={form.slug} /></label><label className="block text-sm font-semibold">Địa chỉ<textarea className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" maxLength={500} onChange={(event) => setForm({ ...form, address: event.target.value })} required rows={3} value={form.address} /></label><label className="block text-sm font-semibold">Điện thoại<input className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" maxLength={50} onChange={(event) => setForm({ ...form, phone: event.target.value })} value={form.phone} /></label><label className="flex items-center gap-2 text-sm"><input checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} type="checkbox" />Đang hiển thị trong catalog công khai</label><button className="w-full rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50" disabled={mutating} type="submit">{mutating ? "Đang gửi…" : editingSlug ? "Lưu thay đổi" : "Tạo cơ sở"}</button></form></section><section aria-labelledby="branch-list-title" className="min-w-0"><div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">PUBLIC ACTIVE READ</p><h2 className="mt-1 text-xl font-bold text-slate-900" id="branch-list-title">Danh sách đang hiển thị</h2></div><button className="text-sm font-bold text-teal-800 underline disabled:opacity-50" disabled={loading} onClick={() => void load()} type="button">Làm mới</button></div>{feedback ? <div className="mb-4"><AdminState description={feedback.description} title={feedback.title} tone={feedback.tone} /></div> : null}{loading ? <AdminState tone="loading" title="Đang tải danh sách cơ sở" description="Đang đọc public catalog từ backend." /> : null}{!loading && loadError ? <AdminState action={<button className="text-sm font-bold underline" onClick={() => void load()} type="button">Thử lại</button>} description={loadError} title="Không thể tải danh sách cơ sở" tone="error" /> : null}{!loading && !loadError && branches.length === 0 ? <AdminState tone="empty" title="Chưa có cơ sở active" description="Public catalog hiện chưa có cơ sở để hiển thị." /> : null}{!loading && !loadError && branches.length > 0 ? <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-[760px] w-full text-left text-sm"><caption className="sr-only">Cơ sở active trong public catalog</caption><thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Tên</th><th className="px-4 py-3">Địa chỉ</th><th className="px-4 py-3">Điện thoại</th><th className="px-4 py-3 text-right">Thao tác</th></tr></thead><tbody>{branches.map((branch) => <tr className="border-b border-slate-100 last:border-0" key={branch.id}><td className="px-4 py-4"><p className="font-semibold">{branch.name}</p><p className="mt-1 font-mono text-xs text-slate-500">{branch.slug}</p></td><td className="max-w-md px-4 py-4">{branch.address}</td><td className="px-4 py-4">{branch.phone || "Chưa cung cấp"}</td><td className="px-4 py-4"><div className="flex justify-end gap-3"><button aria-label={`Sửa ${branch.name}`} className="text-xs font-bold text-teal-800 underline" onClick={() => { setEditingSlug(branch.slug); setForm(formFromBranch(branch)); setFormError(null); setFeedback(null); }} type="button">Sửa</button><button aria-label={`Xóa ${branch.name}`} className="text-xs font-bold text-red-700 underline disabled:opacity-50" disabled={mutating} onClick={() => void remove(branch.slug)} type="button">Xóa</button></div></td></tr>)}</tbody></table></div></div> : null}</section></div></div>;
}
