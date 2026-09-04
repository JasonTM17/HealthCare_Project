"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  adminCreateBranch,
  adminDeleteBranch,
  adminListBranches,
  adminUpdateBranch,
  type AdminBranchPayload,
  type Branch,
} from "../../../lib/api-client";
import AdminState from "../_components/AdminState";
import { describeAdminError } from "../_lib/errors";

type BranchForm = {
  name: string;
  slug: string;
  address: string;
  phone: string;
  active: boolean;
};

const EMPTY_FORM: BranchForm = {
  name: "",
  slug: "",
  address: "",
  phone: "",
  active: true,
};

function formFromBranch(branch: Branch): BranchForm {
  return {
    name: branch.name,
    slug: branch.slug,
    address: branch.address,
    phone: branch.phone ?? "",
    active: branch.active ?? true,
  };
}

function toPayload(form: BranchForm): AdminBranchPayload {
  return {
    name: form.name.trim(),
    slug: form.slug.trim(),
    address: form.address.trim(),
    phone: form.phone.trim() || null,
    active: form.active,
  };
}

export default function AdminBranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<BranchForm>(EMPTY_FORM);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    title: string;
    description: string;
  } | null>(null);
  const [mutating, setMutating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const page = await adminListBranches(0, 100);
      setBranches(page.content);
    } catch (reason: unknown) {
      setLoadError(describeAdminError(reason).description);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const task = Promise.resolve().then(() => load());
    return () => void task;
  }, [load]);

  const reset = () => {
    setForm(EMPTY_FORM);
    setEditingSlug(null);
    setFormError(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMutating(true);
    setFormError(null);
    setFeedback(null);
    try {
      const payload = toPayload(form);
      if (editingSlug) {
        await adminUpdateBranch(editingSlug, payload);
      } else {
        await adminCreateBranch(payload);
      }
      const wasEditing = Boolean(editingSlug);
      reset();
      setFeedback({
        tone: "success",
        title: wasEditing ? "Đã cập nhật cơ sở" : "Đã tạo cơ sở",
        description: "Thay đổi đã được ghi nhận và danh sách đang được làm mới.",
      });
      await load();
    } catch (reason: unknown) {
      const copy = describeAdminError(reason);
      setFormError(`${copy.title}: ${copy.description}`);
    } finally {
      setMutating(false);
    }
  };

  const remove = async (slug: string) => {
    if (!window.confirm(`Xóa cơ sở "${slug}"? Hành động này không thể hoàn tác.`)) return;
    setMutating(true);
    setFeedback(null);
    try {
      await adminDeleteBranch(slug);
      const refreshed = await adminListBranches(0, 100);
      setBranches(refreshed.content);
      const stillPresent = refreshed.content.some((branch) => branch.slug === slug);
      setFeedback(stillPresent
        ? {
          tone: "error",
          title: "Chưa xác nhận được việc xóa",
          description: "Cơ sở vẫn còn trong danh sách quản trị. Vui lòng kiểm tra quyền truy cập rồi thử lại.",
        }
        : {
          tone: "success",
          title: "Đã xóa cơ sở",
          description: "Cơ sở không còn trong danh sách quản trị.",
        });
    } catch (reason: unknown) {
      const copy = describeAdminError(reason);
      setFeedback({ tone: "error", title: copy.title, description: copy.description });
    } finally {
      setMutating(false);
    }
  };

  return (
    <div>
      <header className="border-b border-slate-200 pb-6">
        <h1 className="text-3xl font-bold text-slate-950">Quản lý cơ sở</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Cập nhật thông tin, liên hệ và trạng thái hiển thị của từng cơ sở trong mạng lưới.
        </p>
      </header>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section aria-labelledby="branch-form-title" className="border-t border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900" id="branch-form-title">
                {editingSlug ? "Sửa cơ sở" : "Thêm cơ sở"}
              </h2>
            </div>
            {editingSlug ? (
              <button className="text-xs font-bold text-slate-600 underline disabled:opacity-50" disabled={mutating} onClick={reset} type="button">
                Hủy sửa
              </button>
            ) : null}
          </div>
          <div className="mt-4">
            <AdminState
              tone="info"
              title="Quyền quản trị"
              description="Chỉ tài khoản quản trị được phép tạo hoặc thay đổi thông tin cơ sở."
            />
          </div>
          <form className="mt-5 space-y-4" onSubmit={submit}>
            {formError ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{formError}</p>
            ) : null}
            <label className="block text-sm font-semibold">
              Tên cơ sở
              <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" maxLength={160} onChange={(event) => setForm({ ...form, name: event.target.value })} required value={form.name} />
            </label>
            <label className="block text-sm font-semibold">
              Slug
              <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-sm" maxLength={180} onChange={(event) => setForm({ ...form, slug: event.target.value })} required value={form.slug} />
            </label>
            <label className="block text-sm font-semibold">
              Địa chỉ
              <textarea className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" maxLength={500} onChange={(event) => setForm({ ...form, address: event.target.value })} required rows={3} value={form.address} />
            </label>
            <label className="block text-sm font-semibold">
              Điện thoại
              <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" maxLength={50} onChange={(event) => setForm({ ...form, phone: event.target.value })} value={form.phone} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} type="checkbox" />
              Đang hiển thị trong catalog công khai
            </label>
            <button className="w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50" disabled={mutating} type="submit">
              {mutating ? "Đang gửi…" : editingSlug ? "Lưu thay đổi" : "Tạo cơ sở"}
            </button>
          </form>
        </section>

        <section aria-labelledby="branch-list-title" className="min-w-0">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900" id="branch-list-title">Danh sách cơ sở</h2>
            </div>
            <button className="text-sm font-bold text-teal-800 underline disabled:opacity-50" disabled={loading} onClick={() => void load()} type="button">Làm mới</button>
          </div>

          {feedback ? <div className="mb-4"><AdminState description={feedback.description} title={feedback.title} tone={feedback.tone} /></div> : null}
          {loading ? <AdminState tone="loading" title="Đang tải danh sách cơ sở" description="Vui lòng chờ trong giây lát." /> : null}
          {!loading && loadError ? <AdminState action={<button className="text-sm font-bold underline" onClick={() => void load()} type="button">Thử lại</button>} description={loadError} title="Không thể tải danh sách cơ sở" tone="error" /> : null}
          {!loading && !loadError && branches.length === 0 ? <AdminState tone="empty" title="Chưa có cơ sở" description="Tạo cơ sở đầu tiên để bắt đầu quản lý mạng lưới." /> : null}
          {!loading && !loadError && branches.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div aria-label="Bảng cơ sở, có thể cuộn ngang" className="overflow-x-auto" role="region" tabIndex={0}>
                <table className="min-w-[820px] w-full text-left text-sm">
                  <caption className="sr-only">Cơ sở trong admin catalog</caption>
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Tên</th>
                      <th className="px-4 py-3">Địa chỉ</th>
                      <th className="px-4 py-3">Điện thoại</th>
                      <th className="px-4 py-3">Trạng thái</th>
                      <th className="px-4 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {branches.map((branch) => (
                      <tr className="border-b border-slate-100 last:border-0" key={branch.id}>
                        <td className="px-4 py-4">
                          <p className="font-semibold">{branch.name}</p>
                          <p className="mt-1 font-mono text-xs text-slate-500">{branch.slug}</p>
                        </td>
                        <td className="max-w-md px-4 py-4">{branch.address}</td>
                        <td className="px-4 py-4">{branch.phone || "Chưa cung cấp"}</td>
                        <td className="px-4 py-4">
                          <span className={branch.active ?? true ? "rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700" : "rounded-md bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600"}>
                            {branch.active ?? true ? "Đang hiển thị" : "Tạm ẩn"}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-3">
                            <button aria-label={`Sửa ${branch.name}`} className="text-xs font-bold text-teal-800 underline disabled:opacity-50" disabled={mutating} onClick={() => { setEditingSlug(branch.slug); setForm(formFromBranch(branch)); setFormError(null); setFeedback(null); }} type="button">Sửa</button>
                            <button aria-label={`Xóa ${branch.name}`} className="text-xs font-bold text-red-700 underline disabled:opacity-50" disabled={mutating} onClick={() => void remove(branch.slug)} type="button">Xóa</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
