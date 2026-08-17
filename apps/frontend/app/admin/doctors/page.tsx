"use client";

import React, { useEffect, useState } from "react";
import {
  adminListDoctors,
  adminCreateDoctor,
  adminDeleteDoctor,
  type Doctor,
} from "../../../lib/api-client";

export default function AdminDoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fullName: "", slug: "", bio: "", active: true });
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await adminListDoctors(0, 100);
      setDoctors(page.content);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    try {
      await adminCreateDoctor({ ...form, bio: form.bio || null, photoUrl: null, userId: null });
      setForm({ fullName: "", slug: "", bio: "", active: true });
      setShowForm(false);
      await load();
    } catch (e) {
      setSubmitError((e as Error).message);
    }
  };

  const handleDelete = async (slug: string) => {
    if (!window.confirm(`Xóa bác sĩ "${slug}"?`)) return;
    try {
      await adminDeleteDoctor(slug);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Quản lý bác sĩ</h1>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-sm font-bold rounded-xl transition-colors"
        >
          {showForm ? "Đóng" : "+ Thêm bác sĩ"}
        </button>
      </div>

      {error && <p className="text-red-600 mt-3">Lỗi: {error}</p>}

      {showForm && (
        <form onSubmit={handleCreate} className="mt-4 p-5 bg-white border border-slate-200 rounded-2xl space-y-3 max-w-lg">
          {submitError && <p className="text-red-600 text-sm">Lỗi: {submitError}</p>}
          <div>
            <label className="text-sm font-medium text-slate-700">Họ tên</label>
            <input
              required
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Slug</label>
            <input
              required
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Tiểu sử</label>
            <textarea
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
              rows={3}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            <label className="text-sm text-slate-700">Đang hoạt động</label>
          </div>
          <button
            type="submit"
            className="px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white text-sm font-bold rounded-xl"
          >
            Lưu
          </button>
        </form>
      )}

      {loading && <p className="text-slate-500 mt-4">Đang tải...</p>}

      {!loading && !error && (
        <div className="mt-4 bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Họ tên</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Slug</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Trạng thái</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {doctors.map((doc) => (
                <tr key={doc.id} className="border-b border-slate-100">
                  <td className="px-4 py-3 text-slate-900">{doc.fullName}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{doc.slug}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700">Active</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(doc.slug)}
                      className="text-red-600 hover:underline text-xs"
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
