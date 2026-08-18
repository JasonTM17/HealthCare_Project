"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  adminCreateDoctor,
  adminDeleteDoctor,
  adminUpdateDoctor,
  fetchDoctors,
  type AdminDoctorPayload,
  type Doctor,
} from "../../../lib/api-client";
import AdminState from "../_components/AdminState";
import { describeAdminError } from "../_lib/errors";

type DoctorForm = {
  fullName: string;
  slug: string;
  bio: string;
  photoUrl: string;
  active: boolean;
};

const EMPTY_FORM: DoctorForm = { fullName: "", slug: "", bio: "", photoUrl: "", active: true };

function formFromDoctor(doctor: Doctor): DoctorForm {
  return {
    fullName: doctor.fullName,
    slug: doctor.slug,
    bio: doctor.bio ?? "",
    photoUrl: doctor.photoUrl ?? "",
    active: true,
  };
}

function toPayload(form: DoctorForm): AdminDoctorPayload {
  return {
    fullName: form.fullName.trim(),
    slug: form.slug.trim(),
    bio: form.bio.trim() || null,
    photoUrl: form.photoUrl.trim() || null,
    active: form.active,
    userId: null,
  };
}

export default function AdminDoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<DoctorForm>(EMPTY_FORM);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; title: string; description: string } | null>(null);
  const [mutating, setMutating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const page = await fetchDoctors({ page: 0, size: 100 });
      setDoctors(page.content);
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
      if (editingSlug) {
        await adminUpdateDoctor(editingSlug, payload);
      } else {
        await adminCreateDoctor(payload);
      }
      setFeedback({
        tone: "success",
        title: editingSlug ? "Cập nhật đã được gửi" : "Tạo bác sĩ đã được gửi",
        description: "Backend đã trả về thành công. Bảng bên dưới sẽ chỉ hiển thị bản ghi đang active trong catalog công khai.",
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
    if (!window.confirm(`Gửi yêu cầu xóa bác sĩ "${slug}"?`)) return;
    setMutating(true);
    setFeedback(null);
    try {
      await adminDeleteDoctor(slug);
      const refreshed = await fetchDoctors({ page: 0, size: 100 });
      setDoctors(refreshed.content);
      const stillVisible = refreshed.content.some((doctor) => doctor.slug === slug);
      setFeedback(stillVisible
        ? { tone: "error", title: "Chưa xác nhận được việc xóa", description: "Slug vẫn còn trong public catalog. Backend có thể đã từ chối request hoặc cần phiên ADMIN hợp lệ." }
        : { tone: "success", title: "Đã xác nhận slug không còn hiển thị", description: "Bản ghi này không còn trong public catalog active. Backend vẫn là nguồn xác nhận cuối cùng." });
    } catch (error) {
      const copy = describeAdminError(error);
      setFeedback({ tone: "error", title: copy.title, description: copy.description });
    } finally {
      setMutating(false);
    }
  };

  return (
    <div>
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">NỘI DUNG BÁC SĨ</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Quản lý bác sĩ</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Danh sách lấy từ public endpoint nên chỉ phản ánh bác sĩ active. Các thao tác ghi đi qua admin contract hiện có.</p>
        </div>
        <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">Bản demo local</span>
      </header>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section aria-labelledby="doctor-form-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">ADMIN WRITE CONTRACT</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900" id="doctor-form-title">{editingSlug ? "Sửa hồ sơ" : "Thêm bác sĩ"}</h2>
            </div>
            {editingSlug ? <button className="text-xs font-bold text-slate-600 underline underline-offset-4" onClick={resetForm} type="button">Hủy sửa</button> : null}
          </div>

          <div className="mt-4">
            <AdminState tone="info" title="Backend giữ quyền quyết định" description="Phiên ADMIN được gửi trong Authorization ở shared API client. Nếu backend trả 401/403, form sẽ giữ nguyên trạng thái lỗi và không giả lập thành công." />
          </div>

          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            {formError ? <p aria-live="assertive" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{formError}</p> : null}
            <div>
              <label className="text-sm font-semibold text-slate-700" htmlFor="doctor-full-name">Họ tên</label>
              <input className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" id="doctor-full-name" maxLength={160} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required value={form.fullName} />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700" htmlFor="doctor-slug">Slug</label>
              <input className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" id="doctor-slug" maxLength={180} onChange={(event) => setForm({ ...form, slug: event.target.value })} required value={form.slug} />
              <p className="mt-1 text-xs text-slate-500">Slug phải duy nhất; backend xử lý xung đột.</p>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700" htmlFor="doctor-bio">Tiểu sử</label>
              <textarea className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" id="doctor-bio" maxLength={4000} onChange={(event) => setForm({ ...form, bio: event.target.value })} rows={4} value={form.bio} />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700" htmlFor="doctor-photo-url">Ảnh đại diện URL (tùy chọn)</label>
              <input className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" id="doctor-photo-url" maxLength={500} onChange={(event) => setForm({ ...form, photoUrl: event.target.value })} type="url" value={form.photoUrl} />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700" htmlFor="doctor-active">
              <input checked={form.active} className="h-4 w-4 accent-teal-700" id="doctor-active" onChange={(event) => setForm({ ...form, active: event.target.checked })} type="checkbox" />
              Đang hiển thị trong catalog công khai
            </label>
            <button className="w-full rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50" disabled={mutating} type="submit">
              {mutating ? "Đang gửi…" : editingSlug ? "Lưu thay đổi" : "Tạo bác sĩ"}
            </button>
          </form>
        </section>

        <section aria-labelledby="doctor-list-title" className="min-w-0">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">PUBLIC ACTIVE READ</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900" id="doctor-list-title">Danh sách đang hiển thị</h2>
            </div>
            <button className="text-sm font-bold text-teal-800 underline underline-offset-4 disabled:opacity-50" disabled={loading} onClick={() => void load()} type="button">Làm mới</button>
          </div>

          {feedback ? <div className="mb-4"><AdminState description={feedback.description} title={feedback.title} tone={feedback.tone} /></div> : null}
          {loading ? <AdminState tone="loading" title="Đang tải danh sách bác sĩ" description="Đang đọc public catalog từ backend." /> : null}
          {!loading && loadError ? <AdminState action={<button className="text-sm font-bold underline underline-offset-4" onClick={() => void load()} type="button">Thử lại</button>} description={loadError} title="Không thể tải danh sách bác sĩ" tone="error" /> : null}
          {!loading && !loadError && doctors.length === 0 ? <AdminState tone="empty" title="Chưa có bác sĩ active" description="Public catalog hiện không có bản ghi để hiển thị. Bạn có thể tạo bản ghi mới nếu phiên ADMIN được backend chấp nhận." /> : null}
          {!loading && !loadError && doctors.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-[680px] w-full text-left text-sm">
                  <caption className="sr-only">Bác sĩ active trong public catalog</caption>
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr><th className="px-4 py-3 font-bold">Họ tên</th><th className="px-4 py-3 font-bold">Slug</th><th className="px-4 py-3 font-bold">Trạng thái</th><th className="px-4 py-3 text-right font-bold">Thao tác</th></tr>
                  </thead>
                  <tbody>
                    {doctors.map((doctor) => (
                      <tr className="border-b border-slate-100 last:border-0" key={doctor.id}>
                        <td className="px-4 py-4 font-semibold text-slate-900">{doctor.fullName}</td>
                        <td className="px-4 py-4 font-mono text-xs text-slate-500">{doctor.slug}</td>
                        <td className="px-4 py-4"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">Active</span></td>
                        <td className="px-4 py-4"><div className="flex justify-end gap-3"><button aria-label={`Sửa ${doctor.fullName}`} className="text-xs font-bold text-teal-800 underline underline-offset-4" onClick={() => { setEditingSlug(doctor.slug); setForm(formFromDoctor(doctor)); setFormError(null); setFeedback(null); }} type="button">Sửa</button><button aria-label={`Xóa ${doctor.fullName}`} className="text-xs font-bold text-red-700 underline underline-offset-4 disabled:opacity-50" disabled={mutating} onClick={() => void handleDelete(doctor.slug)} type="button">Xóa</button></div></td>
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
