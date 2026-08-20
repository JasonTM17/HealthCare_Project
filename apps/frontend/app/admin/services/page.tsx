"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  adminCreateService,
  adminDeleteService,
  adminListServices,
  adminUpdateService,
  type AdminServicePayload,
  type MedicalService,
} from "../../../lib/api-client";
import AdminState from "../_components/AdminState";
import { describeAdminError } from "../_lib/errors";

type ServiceForm = { name: string; slug: string; description: string; active: boolean };

const EMPTY_FORM: ServiceForm = { name: "", slug: "", description: "", active: true };

function formFromService(service: MedicalService): ServiceForm {
  return {
    name: service.name,
    slug: service.slug,
    description: service.description ?? "",
    active: service.active ?? true,
  };
}

function toPayload(form: ServiceForm): AdminServicePayload {
  return {
    name: form.name.trim(),
    slug: form.slug.trim(),
    description: form.description.trim() || null,
    active: form.active,
  };
}

export default function AdminServicesPage() {
  const [services, setServices] = useState<MedicalService[]>([]);
  const [form, setForm] = useState<ServiceForm>(EMPTY_FORM);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await adminListServices(0, 100);
      setServices(page.content);
    } catch (reason: unknown) {
      setError(describeAdminError(reason).description);
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
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMutating(true);
    setError(null);
    setFeedback(null);
    try {
      const payload = toPayload(form);
      if (editingSlug) {
        await adminUpdateService(editingSlug, payload);
      } else {
        await adminCreateService(payload);
      }
      setFeedback(editingSlug ? "Đã cập nhật dịch vụ trong catalog admin." : "Đã tạo dịch vụ mới trong catalog admin.");
      reset();
      await load();
    } catch (reason: unknown) {
      const copy = describeAdminError(reason);
      setError(`${copy.title}: ${copy.description}`);
    } finally {
      setMutating(false);
    }
  };

  const remove = async (slug: string) => {
    if (!window.confirm(`Gửi yêu cầu xóa dịch vụ "${slug}"?`)) return;
    setMutating(true);
    setError(null);
    setFeedback(null);
    try {
      await adminDeleteService(slug);
      const refreshed = await adminListServices(0, 100);
      const stillPresent = refreshed.content.some((service) => service.slug === slug);
      setServices(refreshed.content);
      setFeedback(stillPresent ? "Backend vẫn giữ bản ghi sau yêu cầu xóa." : "Đã xóa dịch vụ khỏi catalog admin.");
    } catch (reason: unknown) {
      const copy = describeAdminError(reason);
      setError(`${copy.title}: ${copy.description}`);
    } finally {
      setMutating(false);
    }
  };

  return (
    <div>
      <header className="border-b border-slate-200 pb-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">ADMIN CATALOG</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Quản lý dịch vụ</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Bảng đọc trực tiếp từ endpoint admin để quản trị cả dịch vụ đang hiển thị và dịch vụ đã tạm ẩn khỏi public.
        </p>
      </header>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">ADMIN WRITE CONTRACT</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">{editingSlug ? "Sửa dịch vụ" : "Thêm dịch vụ"}</h2>
            </div>
            {editingSlug ? (
              <button className="text-xs font-bold text-slate-600 underline" onClick={reset} type="button">
                Hủy sửa
              </button>
            ) : null}
          </div>

          {error ? (
            <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">
              {error}
            </p>
          ) : null}
          {feedback ? (
            <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900" role="status">
              {feedback}
            </p>
          ) : null}

          <form className="mt-5 space-y-4" onSubmit={submit}>
            <label className="block text-sm font-semibold">
              Tên dịch vụ
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5"
                maxLength={160}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
                value={form.name}
              />
            </label>
            <label className="block text-sm font-semibold">
              Slug
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-mono"
                maxLength={180}
                onChange={(event) => setForm({ ...form, slug: event.target.value })}
                required
                value={form.slug}
              />
            </label>
            <label className="block text-sm font-semibold">
              Mô tả
              <textarea
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5"
                maxLength={2000}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                rows={4}
                value={form.description}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                checked={form.active}
                onChange={(event) => setForm({ ...form, active: event.target.checked })}
                type="checkbox"
              />
              Đang hiển thị public
            </label>
            <button className="w-full rounded-xl bg-teal-700 px-4 py-2.5 font-bold text-white disabled:opacity-50" disabled={mutating} type="submit">
              {mutating ? "Đang gửi…" : editingSlug ? "Lưu thay đổi" : "Tạo dịch vụ"}
            </button>
          </form>
        </section>

        <section className="min-w-0">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">ADMIN READ CONTRACT</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">Toàn bộ dịch vụ</h2>
            </div>
            <button className="text-sm font-bold text-teal-800 underline disabled:opacity-50" disabled={loading} onClick={() => void load()} type="button">
              Làm mới
            </button>
          </div>

          {loading ? <AdminState tone="loading" title="Đang tải dịch vụ" description="Đang đọc catalog admin từ backend." /> : null}
          {!loading && !error && services.length === 0 ? (
            <AdminState tone="empty" title="Chưa có dịch vụ" description="Bạn có thể tạo bản ghi mới nếu phiên ADMIN được backend chấp nhận." />
          ) : null}
          {!loading && !error && services.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-[760px] w-full text-left text-sm">
                <caption className="sr-only">Dịch vụ trong catalog admin</caption>
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Tên</th>
                    <th className="px-4 py-3">Slug</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((service) => (
                    <tr className="border-b border-slate-100 last:border-0" key={service.id}>
                      <td className="px-4 py-4 font-semibold">{service.name}</td>
                      <td className="px-4 py-4 font-mono text-xs text-slate-500">{service.slug}</td>
                      <td className="px-4 py-4">
                        <span className={service.active ?? true ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700" : "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600"}>
                          {service.active ?? true ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-3">
                          <button
                            className="text-xs font-bold text-teal-800 underline"
                            onClick={() => {
                              setEditingSlug(service.slug);
                              setForm(formFromService(service));
                            }}
                            type="button"
                          >
                            Sửa
                          </button>
                          <button
                            className="text-xs font-bold text-red-700 underline disabled:opacity-50"
                            disabled={mutating}
                            onClick={() => void remove(service.slug)}
                            type="button"
                          >
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
