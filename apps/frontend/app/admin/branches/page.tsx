"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchBranches, type Branch } from "../../../lib/api-client";
import AdminState from "../_components/AdminState";
import { describeAdminError } from "../_lib/errors";

export default function AdminBranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await fetchBranches(0, 100);
      setBranches(page.content);
    } catch (reason) {
      setError(describeAdminError(reason).description);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const task = Promise.resolve().then(() => load());
    return () => void task;
  }, [load]);

  return (
    <div>
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">MẠNG LƯỚI CƠ SỞ</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Cơ sở bệnh viện</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Đang đọc danh mục public active để tránh hiển thị địa chỉ hoặc trạng thái chưa được backend xác nhận.</p></div>
        <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">Bản demo local</span>
      </header>

      <section aria-labelledby="branch-list-title" className="mt-6">
        <div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">PUBLIC ACTIVE READ</p><h2 className="mt-1 text-xl font-bold text-slate-900" id="branch-list-title">Danh sách đang hiển thị</h2></div><button className="text-sm font-bold text-teal-800 underline underline-offset-4 disabled:opacity-50" disabled={loading} onClick={() => void load()} type="button">Làm mới</button></div>
        {loading ? <AdminState tone="loading" title="Đang tải danh sách cơ sở" description="Đang đọc public catalog từ backend." /> : null}
        {!loading && error ? <AdminState action={<button className="text-sm font-bold underline underline-offset-4" onClick={() => void load()} type="button">Thử lại</button>} description={error} title="Không thể tải danh sách cơ sở" tone="error" /> : null}
        {!loading && !error && branches.length === 0 ? <AdminState tone="empty" title="Chưa có cơ sở active" description="Public catalog hiện không có cơ sở để hiển thị." /> : null}
        {!loading && !error && branches.length > 0 ? <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-[760px] w-full text-left text-sm"><caption className="sr-only">Cơ sở active trong public catalog</caption><thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 font-bold">Tên cơ sở</th><th className="px-4 py-3 font-bold">Địa chỉ</th><th className="px-4 py-3 font-bold">Điện thoại</th><th className="px-4 py-3 font-bold">Trạng thái</th></tr></thead><tbody>{branches.map((branch) => <tr className="border-b border-slate-100 last:border-0" key={branch.id}><td className="px-4 py-4"><p className="font-semibold text-slate-900">{branch.name}</p><p className="mt-1 font-mono text-xs text-slate-500">{branch.slug}</p></td><td className="max-w-md px-4 py-4 text-slate-700">{branch.address}</td><td className="px-4 py-4 text-slate-700">{branch.phone || "Chưa cung cấp"}</td><td className="px-4 py-4"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">Active</span></td></tr>)}</tbody></table></div></div> : null}
      </section>

      <section aria-labelledby="branch-contract-title" className="mt-6"><AdminState titleId="branch-contract-title" tone="unavailable" title="Chưa có contract quản trị cơ sở ở frontend" description="Backend có POST/PUT/DELETE /admin/branches và role ADMIN, nhưng shared frontend API client hiện chỉ expose public fetchBranches. Vì vậy màn hình này không hiển thị form ghi hoặc tự suy đoán dữ liệu quản trị." /></section>
    </div>
  );
}
