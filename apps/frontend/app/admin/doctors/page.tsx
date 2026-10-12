"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  adminListBranches,
  adminListDoctors,
  adminCreateDoctor,
  adminDeleteDoctor,
  adminListSpecialties,
  adminListUsers,
  adminUpdateDoctor,
  fetchAllContent,
  type AdminDoctorPayload,
  type AdminUserAccount,
  type Branch,
  type Doctor,
  type Specialty,
} from "../../../lib/api-client";
import AdminState from "../_components/AdminState";
import ConfirmActionDialog from "../../../components/ui/ConfirmActionDialog";
import { describeAdminError } from "../_lib/errors";

type DoctorForm = {
  fullName: string;
  slug: string;
  bio: string;
  photoUrl: string;
  userId: string;
  branchIds: string[];
  specialtyIds: string[];
  active: boolean;
};

const EMPTY_FORM: DoctorForm = {
  fullName: "", slug: "", bio: "", photoUrl: "", userId: "",
  branchIds: [], specialtyIds: [], active: true,
};
const ADMIN_PAGE_SIZE = 100;

function formFromDoctor(doctor: Doctor): DoctorForm {
  return {
    fullName: doctor.fullName,
    slug: doctor.slug,
    bio: doctor.bio ?? "",
    photoUrl: doctor.photoUrl ?? "",
    userId: doctor.linkedUser?.id ?? "",
    branchIds: doctor.branchIds ?? [],
    specialtyIds: doctor.specialtyIds ?? [],
    active: doctor.active ?? true,
  };
}

function toPayload(form: DoctorForm, editingDoctor: Doctor | null): AdminDoctorPayload {
  const userId = form.userId.trim();
  return {
    fullName: form.fullName.trim(),
    slug: form.slug.trim(),
    bio: form.bio.trim() || null,
    photoUrl: form.photoUrl.trim() || null,
    active: form.active,
    ...(userId ? { userId } : {}),
    // Clearing the select on a doctor that has a link is an explicit unlink;
    // on a never-linked doctor the empty select stays a no-op.
    ...(editingDoctor?.linkedUser && !userId ? { unlinkUser: true } : {}),
    branchIds: form.branchIds,
    specialtyIds: form.specialtyIds,
  };
}

function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((value) => value !== id) : [...list, id];
}

/** Case- and accent-insensitive folding so "nguyen" matches "Nguyễn". */
function foldForFilter(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

export default function AdminDoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [doctorAccounts, setDoctorAccounts] = useState<AdminUserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<DoctorForm>(EMPTY_FORM);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; title: string; description: string } | null>(null);
  const [mutating, setMutating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Doctor | null>(null);

  // Search, filter and pagination states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"" | "active" | "hidden">("");
  const [selectedAccountStatus, setSelectedAccountStatus] = useState<"" | "linked" | "unlinked">("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const filteredDoctors = useMemo(() => {
    const q = foldForFilter(searchQuery.trim());
    return doctors.filter((doctor) => {
      if (q) {
        const nameFolded = foldForFilter(doctor.fullName);
        const slugFolded = foldForFilter(doctor.slug);
        const emailFolded = doctor.linkedUser ? foldForFilter(doctor.linkedUser.email) : "";
        const bioFolded = doctor.bio ? foldForFilter(doctor.bio) : "";
        const matches =
          nameFolded.includes(q) ||
          slugFolded.includes(q) ||
          emailFolded.includes(q) ||
          bioFolded.includes(q);
        if (!matches) return false;
      }
      if (selectedSpecialty && !(doctor.specialtyIds ?? []).includes(selectedSpecialty)) {
        return false;
      }
      if (selectedBranch && !(doctor.branchIds ?? []).includes(selectedBranch)) {
        return false;
      }
      if (selectedStatus === "active" && doctor.active === false) return false;
      if (selectedStatus === "hidden" && doctor.active !== false) return false;
      if (selectedAccountStatus === "linked" && !doctor.linkedUser) return false;
      if (selectedAccountStatus === "unlinked" && doctor.linkedUser) return false;
      return true;
    });
  }, [doctors, searchQuery, selectedSpecialty, selectedBranch, selectedStatus, selectedAccountStatus]);

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
    selectedSpecialty ||
    selectedBranch ||
    selectedStatus ||
    selectedAccountStatus
  );

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedSpecialty("");
    setSelectedBranch("");
    setSelectedStatus("");
    setSelectedAccountStatus("");
    setCurrentPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(filteredDoctors.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pagedDoctors = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredDoctors.slice(start, start + pageSize);
  }, [filteredDoctors, safePage, pageSize]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [content, branchRows, specialtyRows, accountRows] = await Promise.all([
        fetchAllContent(adminListDoctors, ADMIN_PAGE_SIZE),
        fetchAllContent((p, s) => adminListBranches(p, s), ADMIN_PAGE_SIZE),
        fetchAllContent((p, s) => adminListSpecialties(p, s), ADMIN_PAGE_SIZE),
        fetchAllContent((p, s) => adminListUsers({ role: "DOCTOR", status: "ACTIVE", page: p, size: s }), ADMIN_PAGE_SIZE),
      ]);
      setDoctors(content);
      setBranches(branchRows);
      setSpecialties(specialtyRows);
      setDoctorAccounts(accountRows);
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
      const editingDoctor = editingSlug
        ? (doctors.find((doctor) => doctor.slug === editingSlug) ?? null)
        : null;
      const payload = toPayload(form, editingDoctor);
      if (editingSlug) {
        await adminUpdateDoctor(editingSlug, payload);
      } else {
        await adminCreateDoctor(payload);
      }
      setFeedback({
        tone: "success",
        title: editingSlug ? "Đã cập nhật bác sĩ" : "Đã tạo bác sĩ",
        description: "Thay đổi đã được ghi nhận và danh sách đang được làm mới.",
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
    setMutating(true);
    setFeedback(null);
    try {
      await adminDeleteDoctor(slug);
      const refreshed = await fetchAllContent(adminListDoctors, ADMIN_PAGE_SIZE);
      setDoctors(refreshed);
      const stillPresent = refreshed.some((doctor) => doctor.slug === slug);
      setFeedback(stillPresent
        ? { tone: "error", title: "Chưa xác nhận được việc xóa", description: "Bác sĩ vẫn còn trong danh sách quản trị. Vui lòng kiểm tra quyền truy cập rồi thử lại." }
        : { tone: "success", title: "Đã xóa bác sĩ", description: "Bác sĩ không còn trong danh sách quản trị." });
    } catch (error) {
      const copy = describeAdminError(error);
      setFeedback({ tone: "error", title: copy.title, description: copy.description });
    } finally {
      setMutating(false);
      setPendingDelete(null);
    }
  };

  return (
    <div>
      <header className="border-b border-slate-200 pb-6">
        <h1 className="text-3xl font-bold text-slate-950">Quản lý bác sĩ</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Cập nhật hồ sơ và trạng thái hiển thị của đội ngũ bác sĩ trong mạng lưới.</p>
      </header>

      <div className="mt-6 grid min-w-0 grid-cols-1 gap-6 min-[1920px]:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section aria-labelledby="doctor-form-title" className="min-w-0 border-t border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900" id="doctor-form-title">{editingSlug ? "Sửa hồ sơ" : "Thêm bác sĩ"}</h2>
            </div>
            {editingSlug ? <button className="text-xs font-bold text-slate-600 underline underline-offset-4 disabled:opacity-50" disabled={mutating} onClick={resetForm} type="button">Hủy sửa</button> : null}
          </div>

          <div className="mt-4">
            <AdminState tone="info" title="Quyền quản trị" description="Chỉ tài khoản quản trị được phép tạo hoặc thay đổi hồ sơ bác sĩ." />
          </div>

          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            {formError ? <p aria-live="assertive" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{formError}</p> : null}
            <div>
              <label className="text-sm font-semibold text-slate-700" htmlFor="doctor-full-name">Họ tên</label>
              <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" id="doctor-full-name" maxLength={160} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required value={form.fullName} />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700" htmlFor="doctor-slug">Slug</label>
              <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" id="doctor-slug" maxLength={180} onChange={(event) => setForm({ ...form, slug: event.target.value })} required value={form.slug} />
              <p className="mt-1 text-xs text-slate-500">Slug phải duy nhất trong danh sách bác sĩ.</p>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700" htmlFor="doctor-bio">Tiểu sử</label>
              <textarea className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" id="doctor-bio" maxLength={4000} onChange={(event) => setForm({ ...form, bio: event.target.value })} rows={4} value={form.bio} />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700" htmlFor="doctor-photo-url">Ảnh đại diện URL (tùy chọn)</label>
              <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100" id="doctor-photo-url" maxLength={500} onChange={(event) => setForm({ ...form, photoUrl: event.target.value })} type="url" value={form.photoUrl} />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700" htmlFor="doctor-user-id">Tài khoản liên kết (tùy chọn)</label>
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                id="doctor-user-id"
                onChange={(event) => setForm({ ...form, userId: event.target.value })}
                value={form.userId}
              >
                <option value="">Không liên kết tài khoản</option>
                {form.userId && !doctorAccounts.some((account) => account.id === form.userId) ? (
                  <option value={form.userId}>
                    {(() => {
                      const linked = doctors.find((doctor) => doctor.linkedUser?.id === form.userId)?.linkedUser;
                      return linked
                        ? `Tài khoản hiện tại (${linked.email}) — giữ nguyên`
                        : `Tài khoản hiện tại (${form.userId.slice(0, 8)}…) — giữ nguyên`;
                    })()}
                  </option>
                ) : null}
                {doctorAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.displayName || account.email} — {account.email}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Chọn một tài khoản có vai trò Bác sĩ để người đó đăng nhập cổng bác sĩ với hồ sơ này.
                Tạo hoặc cấp vai trò tài khoản tại trang Tài khoản.
              </p>
            </div>
            <fieldset>
              <legend className="text-sm font-semibold text-slate-700">Cơ sở trực thuộc</legend>
              {branches.length === 0 ? (
                <p className="mt-1 text-xs text-slate-500">Chưa có cơ sở nào — tạo cơ sở ở trang Cơ sở trước.</p>
              ) : (
                <div className="mt-1 max-h-36 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                  {branches.map((branch) => (
                    <label className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 text-sm text-slate-700 hover:bg-slate-50" key={branch.id}>
                      <input
                        checked={form.branchIds.includes(branch.id)}
                        className="h-4 w-4 accent-teal-700"
                        onChange={() => setForm({ ...form, branchIds: toggleId(form.branchIds, branch.id) })}
                        type="checkbox"
                      />
                      {branch.name}
                    </label>
                  ))}
                </div>
              )}
              <p className="mt-1 text-xs text-slate-500">Bác sĩ chỉ xuất hiện trong bộ lọc lịch của các cơ sở được gán.</p>
            </fieldset>
            <fieldset>
              <legend className="text-sm font-semibold text-slate-700">Chuyên khoa phụ trách</legend>
              {specialties.length === 0 ? (
                <p className="mt-1 text-xs text-slate-500">Chưa có chuyên khoa nào — tạo ở trang Chuyên khoa trước.</p>
              ) : (
                <div className="mt-1 max-h-36 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                  {specialties.map((specialty) => (
                    <label className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 text-sm text-slate-700 hover:bg-slate-50" key={specialty.id}>
                      <input
                        checked={form.specialtyIds.includes(specialty.id)}
                        className="h-4 w-4 accent-teal-700"
                        onChange={() => setForm({ ...form, specialtyIds: toggleId(form.specialtyIds, specialty.id) })}
                        type="checkbox"
                      />
                      {specialty.name}
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
            <label className="flex items-center gap-2 text-sm text-slate-700" htmlFor="doctor-active">
              <input checked={form.active} className="h-4 w-4 accent-teal-700" id="doctor-active" onChange={(event) => setForm({ ...form, active: event.target.checked })} type="checkbox" />
              Đang hiển thị trong catalog công khai
            </label>
            <button className="w-full rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50" disabled={mutating} type="submit">
              {mutating ? "Đang gửi…" : editingSlug ? "Lưu thay đổi" : "Tạo bác sĩ"}
            </button>
          </form>
        </section>

        <section aria-labelledby="doctor-list-title" className="min-w-0">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900" id="doctor-list-title">Danh sách bác sĩ</h2>
            </div>
            <button className="text-sm font-bold text-teal-800 underline underline-offset-4 disabled:opacity-50" disabled={loading} onClick={() => void load()} type="button">Làm mới</button>
          </div>

          {feedback ? <div className="mb-4"><AdminState description={feedback.description} title={feedback.title} tone={feedback.tone} /></div> : null}
          {loading ? <AdminState tone="loading" title="Đang tải danh sách bác sĩ" description="Vui lòng chờ trong giây lát." /> : null}
          {!loading && loadError ? <AdminState action={<button className="text-sm font-bold underline underline-offset-4" onClick={() => void load()} type="button">Thử lại</button>} description={loadError} title="Không thể tải danh sách bác sĩ" tone="error" /> : null}
          {!loading && !loadError && doctors.length === 0 ? <AdminState tone="empty" title="Chưa có bác sĩ" description="Tạo hồ sơ bác sĩ đầu tiên để bắt đầu quản lý đội ngũ." /> : null}
          {!loading && !loadError && doctors.length > 0 ? (
            <>
              {/* Thanh tìm kiếm và bộ lọc */}
              <div className="mb-4 space-y-3 rounded-lg border border-slate-200 bg-white p-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="sm:col-span-2 lg:col-span-1">
                    <label className="block text-xs font-bold text-slate-700" htmlFor="doctor-search-input">
                      Tìm kiếm bác sĩ
                    </label>
                    <div className="relative mt-1">
                      <input
                        id="doctor-search-input"
                        type="search"
                        className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                        placeholder="Tìm theo họ tên, slug, email..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setCurrentPage(1);
                        }}
                      />
                      <svg
                        aria-hidden="true"
                        className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700" htmlFor="doctor-filter-specialty">
                      Chuyên khoa
                    </label>
                    <select
                      id="doctor-filter-specialty"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                      value={selectedSpecialty}
                      onChange={(e) => {
                        setSelectedSpecialty(e.target.value);
                        setCurrentPage(1);
                      }}
                    >
                      <option value="">Tất cả chuyên khoa</option>
                      {specialties.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700" htmlFor="doctor-filter-branch">
                      Cơ sở
                    </label>
                    <select
                      id="doctor-filter-branch"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                      value={selectedBranch}
                      onChange={(e) => {
                        setSelectedBranch(e.target.value);
                        setCurrentPage(1);
                      }}
                    >
                      <option value="">Tất cả cơ sở</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700" htmlFor="doctor-filter-status">
                      Trạng thái hiển thị
                    </label>
                    <select
                      id="doctor-filter-status"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                      value={selectedStatus}
                      onChange={(e) => {
                        setSelectedStatus(e.target.value as "" | "active" | "hidden");
                        setCurrentPage(1);
                      }}
                    >
                      <option value="">Tất cả trạng thái</option>
                      <option value="active">Đang hiển thị</option>
                      <option value="hidden">Tạm ẩn</option>
                    </select>
                  </div>
                </div>

                {/* Thanh thông tin số lượng và nút xóa bộ lọc */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-xs">
                  <span className="font-medium text-slate-600">
                    Hiển thị <strong className="text-teal-900">{filteredDoctors.length}</strong> / {doctors.length} bác sĩ
                    {hasActiveFilters ? " (đang lọc)" : ""}
                  </span>

                  {hasActiveFilters ? (
                    <button
                      type="button"
                      className="font-bold text-teal-800 underline underline-offset-4 hover:text-teal-950"
                      onClick={resetFilters}
                    >
                      Xóa bộ lọc
                    </button>
                  ) : null}
                </div>
              </div>

              {filteredDoctors.length === 0 ? (
                <AdminState
                  tone="empty"
                  title="Không tìm thấy bác sĩ phù hợp"
                  description="Không có hồ sơ bác sĩ nào khớp với từ khóa tìm kiếm hoặc bộ lọc hiện tại."
                  action={
                    <button
                      className="text-sm font-bold text-teal-800 underline underline-offset-4"
                      onClick={resetFilters}
                      type="button"
                    >
                      Xóa bộ lọc
                    </button>
                  }
                />
              ) : (
                <>
                  <div className="min-w-0 max-w-full overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <p className="border-b border-slate-200 px-4 py-2 text-xs text-slate-600" id="doctor-table-help">
                      Trên màn hình nhỏ, cuộn ngang trong bảng để xem đủ họ tên, tài khoản và thao tác.
                    </p>
                    <div aria-describedby="doctor-table-help" aria-label="Bảng bác sĩ, có thể cuộn ngang" className="max-w-full overflow-x-auto" role="region" tabIndex={0}>
                      <table className="min-w-[1100px] w-full table-fixed text-left text-sm">
                        <caption className="sr-only">Bác sĩ trong admin catalog</caption>
                        <colgroup>
                          <col className="w-[16%]" /><col className="w-[19%]" /><col className="w-[22%]" /><col className="w-[20%]" /><col className="w-[11%]" /><col className="w-[12%]" />
                        </colgroup>
                        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                          <tr><th scope="col" className="whitespace-nowrap px-4 py-3 font-bold">Họ tên</th><th scope="col" className="whitespace-nowrap px-4 py-3 font-bold">Tài khoản</th><th scope="col" className="whitespace-nowrap px-4 py-3 font-bold">Cơ sở</th><th scope="col" className="whitespace-nowrap px-4 py-3 font-bold">Chuyên khoa</th><th scope="col" className="whitespace-nowrap px-4 py-3 font-bold">Trạng thái</th><th scope="col" className="whitespace-nowrap px-4 py-3 text-right font-bold">Thao tác</th></tr>
                        </thead>
                        <tbody>
                          {pagedDoctors.map((doctor) => {
                            const branchNames = (doctor.branchIds ?? [])
                              .map((id) => branches.find((branch) => branch.id === id)?.name ?? null)
                              .filter((name): name is string => name !== null);
                            const specialtyNames = (doctor.specialtyIds ?? [])
                              .map((id) => specialties.find((specialty) => specialty.id === id)?.name ?? null)
                              .filter((name): name is string => name !== null);
                            return (
                            <tr className="border-b border-slate-100 align-top last:border-0" key={doctor.id}>
                              <td className="px-4 py-4 font-semibold text-slate-900">{doctor.fullName}<br /><span className="font-mono text-xs font-normal text-slate-500 break-all">{doctor.slug}</span></td>
                              <td className="px-4 py-4 text-xs text-slate-700">
                                {doctor.linkedUser ? <div className="space-y-2"><span className="block break-all">{doctor.linkedUser.email}</span><Link className="inline-block font-semibold text-teal-800 underline underline-offset-4" href={`/admin/users?account=${encodeURIComponent(doctor.linkedUser.id)}`}>Đổi email / mật khẩu</Link></div> : <span className="text-slate-400">Chưa liên kết tài khoản</span>}
                              </td>
                              <td className="px-4 py-4">
                                {branchNames.length > 0 ? (
                                  <div className="flex flex-wrap gap-1.5">{branchNames.map((name) => <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700" key={name}>{name}</span>)}</div>
                                ) : <span className="text-xs text-amber-800">Chưa gán cơ sở</span>}
                              </td>
                              <td className="px-4 py-4">
                                {specialtyNames.length > 0 ? (
                                  <div className="flex flex-wrap gap-1.5">{specialtyNames.map((name) => <span className="rounded-md bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-900" key={name}>{name}</span>)}</div>
                                ) : <span className="text-xs text-amber-800">Chưa gán chuyên khoa</span>}
                              </td>
                              <td className="px-4 py-4">
                                <span className={doctor.active ?? true ? "inline-flex whitespace-nowrap rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700" : "inline-flex whitespace-nowrap rounded-md bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600"}>
                                  {doctor.active ?? true ? "Đang hiển thị" : "Tạm ẩn"}
                                </span>
                              </td>
                              <td className="px-4 py-4"><div className="flex justify-end gap-3"><button aria-label={`Sửa ${doctor.fullName}`} className="text-xs font-bold text-teal-800 underline underline-offset-4 disabled:opacity-50" disabled={mutating} onClick={() => { setEditingSlug(doctor.slug); setForm(formFromDoctor(doctor)); setFormError(null); setFeedback(null); }} type="button">Sửa</button><button aria-label={`Xóa ${doctor.fullName}`} className="text-xs font-bold text-red-700 underline underline-offset-4 disabled:opacity-50" disabled={mutating} onClick={() => setPendingDelete(doctor)} type="button">Xóa</button></div></td>
                            </tr>
                          );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Phân trang bác sĩ */}
                  <nav
                    aria-label="Phân trang bác sĩ"
                    className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600"
                  >
                    <p>
                      Hiển thị {Math.min((safePage - 1) * pageSize + 1, filteredDoctors.length)}–
                      {Math.min(safePage * pageSize, filteredDoctors.length)} trên {filteredDoctors.length} bác sĩ · Trang{" "}
                      {safePage} / {totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={safePage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className="rounded border border-slate-300 bg-white px-2.5 py-1.5 font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Trang trước
                      </button>
                      <button
                        type="button"
                        disabled={safePage >= totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        className="rounded border border-slate-300 bg-white px-2.5 py-1.5 font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Trang sau
                      </button>
                      <label className="flex items-center gap-1.5 ml-2">
                        <span>Số dòng:</span>
                        <select
                          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-teal-600"
                          value={pageSize}
                          onChange={(e) => {
                            setPageSize(Number(e.target.value));
                            setCurrentPage(1);
                          }}
                        >
                          <option value={10}>10</option>
                          <option value={20}>20</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                        </select>
                      </label>
                    </div>
                  </nav>
                </>
              )}
            </>
          ) : null}
        </section>
      </div>

      <ConfirmActionDialog
        confirmLabel="Xóa hồ sơ bác sĩ"
        confirmingLabel="Đang xóa…"
        description="Lịch làm việc và liên kết đặt lịch của bác sĩ này sẽ không còn hiển thị công khai. Nếu chỉ nghỉ tạm thời, hãy dùng trạng thái “Tạm ẩn”."
        destructive
        entity={pendingDelete ?? undefined}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void handleDelete(pendingDelete?.slug ?? "")}
        open={pendingDelete !== null}
        pending={mutating}
        summaryItems={pendingDelete ? [
          { label: "Họ tên", value: pendingDelete.fullName },
          { label: "Slug", value: pendingDelete.slug, mono: true },
          { label: "Trạng thái", value: pendingDelete.active ?? true ? "Đang hiển thị" : "Tạm ẩn" },
        ] : []}
        summaryLabel="Hồ sơ sẽ bị xóa vĩnh viễn"
        title="Xóa hồ sơ bác sĩ này?"
      />
    </div>
  );
}
