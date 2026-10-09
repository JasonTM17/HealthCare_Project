"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  adminListAppointments,
  adminListArticles,
  adminListBranches,
  adminListDoctors,
  adminListFaqs,
  adminListHealthQuestions,
  adminListJobApplications,
  adminListPackages,
  adminListPayments,
  adminListServices,
  adminListSpecialties,
  adminListUsers,
  fetchAdminAiContentReviews,
} from "../../lib/api-client";
import AdminState from "./_components/AdminState";
import AdminAppointmentsChart from "../../components/charts/AdminAppointmentsChart";
import { describeAdminError } from "./_lib/errors";
import UiIcon from "../../components/UiIcon";

type Snapshot =
  | { status: "loading" }
  | { status: "success"; count: number; minimum?: boolean }
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
  let value = "--";
  let note = "Đang cập nhật dữ liệu";

  if (snapshot.status === "success") {
    value = snapshot.count.toLocaleString("vi-VN");
    // Only annotate the exceptional case: a silent card reads cleaner than a
    // caption repeated under every number.
    note = successNote ?? (snapshot.count === 0 ? "Chưa có bản ghi" : "");
  }

  if (snapshot.status === "error") {
    value = "—";
    note = snapshot.description;
  }

  return (
    <Link className="group min-h-32 border-b border-slate-200 bg-white p-4 transition-colors hover:bg-teal-50" href={href}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-600">{label}</h3>
        <span aria-hidden="true" className="text-teal-700 transition-transform group-hover:translate-x-0.5"><UiIcon name="arrow-right" size={18} /></span>
      </div>
      <p className={`mt-4 text-3xl font-bold ${snapshot.status === "error" ? "text-red-700" : "text-teal-800"}`}>
        {value}
      </p>
      {note ? (
        <p className="mt-2 text-xs leading-5 text-slate-500">{note}</p>
      ) : null}
    </Link>
  );
}

type WorkQueueItem = {
  href: string;
  label: string;
  snapshot: Snapshot;
};

export default function AdminDashboard() {
  const [snapshots, setSnapshots] = useState<SnapshotMap>(INITIAL_SNAPSHOTS);
  const [queue, setQueue] = useState<Snapshot[]>(Array.from({ length: 5 }, () => ({ status: "loading" }) as Snapshot));
  const loadRun = useRef(0);

  const load = useCallback(async () => {
    const runId = loadRun.current + 1;
    loadRun.current = runId;
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
      adminListPayments({ status: "PENDING_VERIFICATION", page: 0, size: 1 }),
      adminListJobApplications({ status: "SUBMITTED", page: 0, size: 1 }),
      adminListHealthQuestions({ state: "PENDING_MODERATION", page: 0, size: 100 }),
      fetchAdminAiContentReviews({ state: "SUBMITTED", page: 0, size: 1 }),
      adminListUsers({ status: "DISABLED", page: 0, size: 1 }),
    ]);

    const unavailable: Snapshot = { status: "error", description: "Chưa thể xác định số lượng. Hãy mở danh sách hoặc thử làm mới." };
    const toSnapshot = (result: PromiseSettledResult<unknown>): Snapshot => {
      if (result.status === "rejected") return { status: "error", description: describeAdminError(result.reason).description };
      const count = result.value && typeof result.value === "object" && "totalElements" in result.value ? result.value.totalElements : undefined;
      return typeof count === "number" && Number.isSafeInteger(count) && count >= 0 ? { status: "success", count } : unavailable;
    };

    if (loadRun.current !== runId) return;
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
    // Older AI responses and question lists expose only a bounded window.
    // Prefer a validated server total when supplied; never fabricate zero.
    const queueResults = [results[8], results[9], results[10], results[11], results[12]];
    setQueue(queueResults.map((result, index) => {
      if (result.status !== "fulfilled") {
        return { status: "error", description: describeAdminError(result.reason).description };
      }
      const value: unknown = result.value;
      if (index === 2) {
        return Array.isArray(value) ? { status: "success", count: value.length, minimum: value.length >= 100 } : unavailable;
      }
      if (index === 3) {
        if (value && typeof value === "object" && !Array.isArray(value) && "totalElements" in value) return toSnapshot({ status: "fulfilled", value });
        if (!value || typeof value !== "object" || Array.isArray(value) || !("content" in value) || !Array.isArray(value.content) || !("hasMore" in value) || typeof value.hasMore !== "boolean") return unavailable;
        if (value.hasMore && value.content.length === 0) return unavailable;
        return { status: "success", count: value.content.length, minimum: value.hasMore };
      }
      if (!value || Array.isArray(value)) return unavailable;
      return toSnapshot({ status: "fulfilled", value });
    }));
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
          <h1 className="text-3xl font-bold text-slate-950">Điều hành bệnh viện</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Theo dõi lịch hẹn, nhân sự, cơ sở và nội dung đang được quản lý trong một màn hình.
          </p>
        </div>
      </header>

      <section aria-labelledby="work-queue-title" className="mt-8">
        <h2 className="text-xl font-bold text-slate-900" id="work-queue-title">Cần xử lý</h2>
        <p className="mt-1 text-sm text-slate-600">Các đầu việc đang chờ quản trị viên — bấm vào để đi thẳng tới hàng đợi tương ứng.</p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {([
            { href: "/admin/payments?status=PENDING_VERIFICATION", label: "Thanh toán chờ đối soát" },
            { href: "/admin/careers?status=SUBMITTED", label: "Hồ sơ ứng tuyển mới" },
            { href: "/admin/health-questions", label: "Câu hỏi chờ duyệt" },
            { href: "/admin/ai-content-reviews?state=SUBMITTED", label: "Nội dung AI chờ duyệt" },
            { href: "/admin/users?status=DISABLED", label: "Tài khoản đang khóa" },
          ] satisfies Omit<WorkQueueItem, "snapshot">[]).map((item, index) => {
            const snapshot = queue[index] ?? { status: "loading" };
            const isSuccess = snapshot.status === "success";
            const needsWork = isSuccess && snapshot.count > 0;
            return (
              <Link
                className={`border p-4 transition-colors ${needsWork ? "border-amber-300 bg-amber-50 hover:bg-amber-100" : "border-slate-200 bg-white hover:bg-teal-50"}`}
                href={item.href}
                key={item.href}
              >
                <p className="text-sm font-bold text-slate-700">{item.label}</p>
                <p className={`mt-2 text-2xl font-bold ${snapshot.status === "error" ? "text-red-700" : needsWork ? "text-amber-900" : "text-teal-800"}`}>
                  {snapshot.status === "loading" ? "--" : snapshot.status === "error" ? "—" : `${snapshot.count.toLocaleString("vi-VN")}${snapshot.minimum ? "+" : ""}`}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {snapshot.status === "loading" ? "Đang cập nhật dữ liệu" : snapshot.status === "error" ? snapshot.description : snapshot.minimum ? "Có thêm bản ghi; mở danh sách để xem" : needsWork ? "Có việc đang chờ" : "Không có việc chờ"}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="catalog-summary-title" className="mt-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900" id="catalog-summary-title">Dữ liệu hiện tại</h2>
          </div>
          <button className="w-fit text-sm font-bold text-teal-800 underline underline-offset-4 disabled:text-slate-400 disabled:no-underline" disabled={loading} onClick={() => void load()} type="button">
            Làm mới
          </button>
        </div>

        {loading ? (
          <div className="mt-4">
            <AdminState tone="loading" title="Đang cập nhật số liệu" description="Các nhóm dữ liệu đang được tải theo quyền của tài khoản hiện tại." />
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-1 border-t border-slate-200 sm:grid-cols-2 xl:grid-cols-4">
          <SnapshotCard href="/admin/doctors" label="Bác sĩ" snapshot={snapshots.doctors} />
          <SnapshotCard href="/admin/specialties" label="Chuyên khoa" snapshot={snapshots.specialties} />
          <SnapshotCard href="/admin/branches" label="Cơ sở" snapshot={snapshots.branches} />
          <SnapshotCard href="/admin/services" label="Dịch vụ" snapshot={snapshots.services} />
          <SnapshotCard href="/admin/catalog" label="Gói khám" snapshot={snapshots.packages} />
          <SnapshotCard href="/admin/catalog" label="FAQ" snapshot={snapshots.faqs} />
          <SnapshotCard href="/admin/catalog" label="Bài viết" snapshot={snapshots.articles} />
          <SnapshotCard href="/admin/appointments" label="Tổng lịch hẹn" snapshot={snapshots.appointments} successNote="Bản ghi vận hành" />
        </div>
      </section>

      <section aria-labelledby="admin-chart-insights-title" className="mt-8">
        <h2 className="text-xl font-bold text-slate-900" id="admin-chart-insights-title">Nhịp lịch hẹn</h2>
        <p className="mt-2 text-sm text-slate-600">Tổng quan từ dữ liệu lịch hẹn thực tế do tài khoản hiện tại được phép đọc.</p>
        <div className="mt-4 border border-slate-200">
          <AdminAppointmentsChart />
        </div>
      </section>

      <section aria-labelledby="contract-title" className="mt-8 grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="border-t border-slate-200 bg-white py-6">
          <h2 className="text-xl font-bold text-slate-900" id="contract-title">Phân công vận hành</h2>
          <ul className="mt-5 space-y-4 text-sm leading-6 text-slate-700">
            <li className="flex gap-3"><span className="mt-1 text-emerald-700"><UiIcon name="check" size={18} /></span><span><strong>Lịch hẹn:</strong> xem danh sách có phân trang và lọc theo ngày, trạng thái.</span></li>
            <li className="flex gap-3"><span className="mt-1 text-emerald-700"><UiIcon name="check" size={18} /></span><span><strong>Danh mục:</strong> quản lý bác sĩ, chuyên khoa, cơ sở, dịch vụ, gói khám, FAQ và bài viết.</span></li>
            <li className="flex gap-3"><span className="mt-1 text-teal-700"><UiIcon name="activity" size={18} /></span><span><strong>Hồ sơ lâm sàng:</strong> bác sĩ phụ trách tiếp nhận và hoàn tất kết quả khám.</span></li>
          </ul>
        </div>
        <div className="border-t border-teal-200 bg-teal-50 p-6">
          <h2 className="text-xl font-bold text-teal-950">Kiểm soát trước khi xuất bản</h2>
          <p className="mt-3 text-sm leading-6 text-teal-950/80">
            Khu vực quản trị chỉ hiển thị dữ liệu cần cho vận hành. Trạng thái khám và hồ sơ lâm sàng vẫn do bác sĩ phụ trách cập nhật.
          </p>
        </div>
      </section>
    </div>
  );
}
