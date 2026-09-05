"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  adminCreateService,
  adminDeleteService,
  adminListServices,
  adminUpdateService,
  fetchAllContent,
  type AdminServicePayload,
  type MedicalService,
} from "../../../lib/api-client";
import AdminState from "../_components/AdminState";
import { describeAdminError } from "../_lib/errors";

type ServiceForm = { name: string; slug: string; description: string; active: boolean };

const EMPTY_FORM: ServiceForm = { name: "", slug: "", description: "", active: true };
const ADMIN_PAGE_SIZE = 100;

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const content = await fetchAllContent(adminListServices, ADMIN_PAGE_SIZE);
      setServices(content);
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
        await adminUpdateService(editingSlug, payload);
      } else {
        await adminCreateService(payload);
      }
      setFeedback({ tone: "success", message: editingSlug ? "Đã cập nhật dịch vụ." : "Đã tạo dịch vụ mới." });
      reset();
      await load();
    } catch (reason: unknown) {
      const copy = describeAdminError(reason);
      setFormError(`${copy.title}: ${copy.description}`);
    } finally {
      setMutating(false);
    }
  };

  const remove = async (slug: string) => {
    if (!window.confirm(`Xóa dịch vụ "${slug}"? Hành động này không thể hoàn tác.`)) return;
    setMutating(true);
    setFormError(null);
    setFeedback(null);
    try {
      await adminDeleteService(slug);
      const refreshed = await fetchAllContent(adminListServices, ADMIN_PAGE_SIZE);
      const stillPresent = refreshed.some((service) => service.slug === slug);
      setServices(refreshed);
      setFeedback(stillPresent
        ? { tone: "error", message: "Chưa xác nhận được việc xóa. Dịch vụ vẫn còn trong danh sách quản trị." }
        : { tone: "success", message: "Đã xóa dịch vụ khỏi danh mục quản trị." });
    } catch (reason: unknown) {
      const copy = describeAdminError(reason);
      setFeedback({ tone: "error", message: `${copy.title}: ${copy.description}` });
    } finally {
      setMutating(false);
    }
  };

  return (
    <div>
      <header className="border-b border-slate-200 pb-6">
        <h1 className="text-3xl font-bold text-slate-950">Quản lý dịch vụ</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Cập nhật dịch vụ đang hiển thị và các dịch vụ đã tạm ẩn khỏi danh mục công khai.
        </p>
      </header>

      {feedback ? (
        <div className="mt-5"><AdminState description={feedback.message} title={feedback.tone === "success" ? "Thao tác đã hoàn tất" : "Chưa thể hoàn tất thao tác"} tone={feedback.tone} /></div>
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section aria-labelledby="service-form-title" className="border-t border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900" id="service-form-title">{editingSlug ? "Sửa dịch vụ" : "Thêm dịch vụ"}</h2>
            </div>
            {editingSlug ? (
              <button className="text-xs font-bold text-slate-600 underline disabled:opacity-50" disabled={mutating} onClick={reset} type="button">
                Hủy sửa
              </button>
            ) : null}
          </div>

          {formError ? (
            <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">
              {formError}
            </p>
          ) : null}
          <form className="mt-5 space-y-4" onSubmit={submit}>
            <label className="block text-sm font-semibold">
              Tên dịch vụ
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"
                maxLength={160}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
                value={form.name}
              />
            </label>
            <label className="block text-sm font-semibold">
              Slug
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono"
                maxLength={180}
                onChange={(event) => setForm({ ...form, slug: event.target.value })}
                required
                value={form.slug}
              />
            </label>
            <label className="block text-sm font-semibold">
              Mô tả
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"
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
              Đang hiển thị công khai
            </label>
            <button className="w-full rounded-lg bg-teal-700 px-4 py-2.5 font-bold text-white disabled:opacity-50" disabled={mutating} type="submit">
              {mutating ? "Đang gửi…" : editingSlug ? "Lưu thay đổi" : "Tạo dịch vụ"}
            </button>
          </form>
        </section>

        <section aria-labelledby="service-list-title" className="min-w-0">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900" id="service-list-title">Toàn bộ dịch vụ</h2>
            </div>
            <button className="text-sm font-bold text-teal-800 underline disabled:opacity-50" disabled={loading} onClick={() => void load()} type="button">
              Làm mới
            </button>
          </div>

          {loading ? <AdminState tone="loading" title="Đang tải dịch vụ" description="Danh sách dịch vụ đang được cập nhật." /> : null}
          {!loading && loadError ? <AdminState action={<button className="text-sm font-bold underline underline-offset-4" onClick={() => void load()} type="button">Thử lại</button>} tone="error" title="Không thể tải dịch vụ" description={loadError} /> : null}
          {!loading && !loadError && services.length === 0 ? (
            <AdminState tone="empty" title="Chưa có dịch vụ" description="Tạo dịch vụ đầu tiên để bổ sung vào danh mục bệnh viện." />
          ) : null}
          {!loading && !loadError && services.length > 0 ? (
            <div aria-label="Bảng dịch vụ, có thể cuộn ngang trên màn hình nhỏ" className="max-w-full overflow-x-auto rounded-lg border border-slate-200 bg-white" role="region" tabIndex={0}>
              <table className="min-w-[760px] w-full text-left text-sm">
                <caption className="sr-only">Dịch vụ trong danh sách quản trị</caption>
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
                        <span className={service.active ?? true ? "rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700" : "rounded-md bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600"}>
                          {service.active ?? true ? "Đang hiển thị" : "Tạm ẩn"}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-3">
                          <button
                            aria-label={`Sửa ${service.name}`}
                            className="text-xs font-bold text-teal-800 underline disabled:opacity-50"
                            disabled={mutating}
                            onClick={() => {
                              setEditingSlug(service.slug);
                              setForm(formFromService(service));
                              setFormError(null);
                              setFeedback(null);
                            }}
                            type="button"
                          >
                            Sửa
                          </button>
                          <button
                            aria-label={`Xóa ${service.name}`}
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
