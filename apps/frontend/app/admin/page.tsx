"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  adminListAppointments,
  adminListArticles,
  adminListBranches,
  adminListDoctors,
  adminListFaqs,
  adminListPackages,
  adminListServices,
  adminListSpecialties,
} from "../../lib/api-client";
import AdminState from "./_components/AdminState";
import { describeAdminError } from "./_lib/errors";

type Snapshot =
  | { status: "loading" }
  | { status: "success"; count: number }
  | { status: "error"; description: string };

type SnapshotMap = {
  doctors: Snapshot;
  specialties: Snapshot;
  branches: Snapshot;
  services: Snapshot;
  packages: Snapshot;
  faqs: Snapshot;
  articles: Snapshot;
  appointments: Snapshot;
};

const INITIAL_SNAPSHOTS: SnapshotMap = {
  doctors: { status: "loading" },
  specialties: { status: "loading" },
  branches: { status: "loading" },
  services: { status: "loading" },
  packages: { status: "loading" },
  faqs: { status: "loading" },
  articles: { status: "loading" },
  appointments: { status: "loading" },
};

function SnapshotCard({
  href,
  label,
  snapshot,
  successNote,
}: {
  href: string;
  label: string;
  snapshot: Snapshot;
  successNote?: string;
}) {
  let value = "—";
  let note = "Đang tải dữ liệu thật…";

  if (snapshot.status === "success") {
    value = snapshot.count.toLocaleString("vi-VN");
    note = successNote ?? (snapshot.count === 0 ? "Chưa có bản ghi quản trị" : "Bản ghi qua endpoint ADMIN");
  }

  if (snapshot.status === "error") {
    value = "!";
    note = snapshot.description;
  }

  return (
    <Link className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md" href={href}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-600">{label}</h3>
        <span aria-hidden="true" className="text-teal-700 transition-transform group-hover:translate-x-0.5">→</span>
      </div>
      <p className={`mt-4 text-3xl font-bold ${snapshot.status === "error" ? "text-red-700" : "text-teal-800"}`}>
        {value}
      </p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{note}</p>
    </Link>
  );
}

export default function AdminDashboard() {
  const [snapshots, setSnapshots] = useState<SnapshotMap>(INITIAL_SNAPSHOTS);

  const load = useCallback(async () => {
    setSnapshots(INITIAL_SNAPSHOTS);
    const results = await Promise.allSettled([
      adminListDoctors(0, 1),
      adminListSpecialties(0, 1),
      adminListBranches(0, 1),
      adminListServices(0, 1),
      adminListPackages(0, 1),
      adminListFaqs(0, 1),
      adminListArticles(0, 1),
      adminListAppointments({ page: 0, size: 1 }),
    ]);

    const toSnapshot = (result: PromiseSettledResult<{ totalElements: number }>): Snapshot => {
      if (result.status === "fulfilled") return { status: "success", count: result.value.totalElements };
      return { status: "error", description: describeAdminError(result.reason).description };
    };

    setSnapshots({
      doctors: toSnapshot(results[0]),
      specialties: toSnapshot(results[1]),
      branches: toSnapshot(results[2]),
      services: toSnapshot(results[3]),
      packages: toSnapshot(results[4]),
      faqs: toSnapshot(results[5]),
      articles: toSnapshot(results[6]),
      appointments: toSnapshot(results[7]),
    });
  }, []);

  useEffect(() => {
    const task = Promise.resolve().then(() => load());
    return () => void task;
  }, [load]);

  const loading = Object.values(snapshots).some((snapshot) => snapshot.status === "loading");

  return (
    <div>
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">BẢNG ĐIỀU HÀNH</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Điều hành bệnh viện</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Theo dõi lịch hẹn vận hành và catalog đang hiển thị. Mọi con số đều được tải từ backend theo đúng quyền của phiên hiện tại.
          </p>
        </div>
        <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">Bản demo local</span>
      </header>

      <section aria-labelledby="catalog-summary-title" className="mt-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">ẢNH CHỤP HỆ THỐNG</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900" id="catalog-summary-title">Dữ liệu hiện tại</h2>
          </div>
          <button className="w-fit text-sm font-bold text-teal-800 underline underline-offset-4" onClick={() => void load()} type="button">
            Làm mới
          </button>
        </div>

        {loading ? (
          <div className="mt-4">
            <AdminState tone="loading" title="Đang tải snapshot catalog" description="Đang đọc số lượng từ các endpoint quản trị đã xác thực." />
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <SnapshotCard href="/admin/doctors" label="Bác sĩ" snapshot={snapshots.doctors} />
          <SnapshotCard href="/admin/specialties" label="Chuyên khoa" snapshot={snapshots.specialties} />
          <SnapshotCard href="/admin/branches" label="Cơ sở" snapshot={snapshots.branches} />
          <SnapshotCard href="/admin/services" label="Dịch vụ" snapshot={snapshots.services} />
          <SnapshotCard href="/admin/catalog" label="Gói khám" snapshot={snapshots.packages} />
          <SnapshotCard href="/admin/catalog" label="FAQ" snapshot={snapshots.faqs} />
          <SnapshotCard href="/admin/catalog" label="Bài viết" snapshot={snapshots.articles} />
          <SnapshotCard href="/admin/appointments" label="Tổng lịch hẹn" snapshot={snapshots.appointments} successNote="Bản ghi vận hành qua endpoint ADMIN" />
        </div>
      </section>

      <section aria-labelledby="contract-title" className="mt-8 grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">TRẠNG THÁI TÍCH HỢP</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900" id="contract-title">Điều gì có thể làm trong baseline này?</h2>
          <ul className="mt-5 space-y-4 text-sm leading-6 text-slate-700">
            <li className="flex gap-3"><span className="font-bold text-emerald-700">✓</span><span><strong>Lịch hẹn:</strong> xem dữ liệu vận hành có phân trang, lọc ngày và trạng thái qua endpoint chỉ dành cho ADMIN.</span></li>
            <li className="flex gap-3"><span className="font-bold text-emerald-700">✓</span><span><strong>Catalog:</strong> bác sĩ, chuyên khoa, cơ sở, dịch vụ, gói khám, FAQ và bài viết có contract quản trị có xác thực.</span></li>
            <li className="flex gap-3"><span className="font-bold text-slate-500">i</span><span><strong>Phân quyền lâm sàng:</strong> admin chỉ quan sát lịch hẹn; tiếp nhận và hoàn tất hồ sơ vẫn thuộc workflow bác sĩ.</span></li>
          </ul>
        </div>
        <div className="rounded-2xl border border-teal-100 bg-teal-50 p-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-800">AN TOÀN NỘI DUNG</p>
          <h2 className="mt-1 text-xl font-bold text-teal-950">Kiểm soát trước khi xuất bản</h2>
          <p className="mt-3 text-sm leading-6 text-teal-950/80">
            Trang lịch hẹn chỉ hiển thị dữ liệu cần cho vận hành và không mở quyền sửa trạng thái lâm sàng. Mọi thao tác ghi vẫn phải qua backend đúng role; lỗi 401/403 được giữ nguyên thành trạng thái hướng dẫn.
          </p>
        </div>
      </section>
    </div>
  );
}
