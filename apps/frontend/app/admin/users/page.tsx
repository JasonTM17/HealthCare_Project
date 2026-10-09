"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  adminListUsers,
  adminUpdateUserRoles,
  adminUpdateUserStatus,
  type AdminUserAccount,
} from "../../../lib/api-client";
import { formatBusinessDateTime } from "../../../lib/business-time";
import AdminState from "../_components/AdminState";
import ConfirmActionDialog from "../../../components/ui/ConfirmActionDialog";
import UiIcon from "../../../components/UiIcon";
import { describeAdminError } from "../_lib/errors";

const ROLE_OPTIONS = [
  ["PATIENT", "Bệnh nhân"],
  ["DOCTOR", "Bác sĩ"],
  ["ADMIN", "Quản trị"],
] as const;

const ROLE_LABEL: Record<string, string> = Object.fromEntries(ROLE_OPTIONS);
const ROLE_TONE: Record<string, string> = {
  PATIENT: "bg-teal-100 text-teal-900",
  DOCTOR: "bg-sky-100 text-sky-900",
  ADMIN: "bg-purple-100 text-purple-900",
};

function roleLabel(code: string): string {
  return ROLE_LABEL[code] ?? code;
}

function statusBadge(status: string): { label: string; tone: string } {
  return status === "ACTIVE"
    ? { label: "Đang hoạt động", tone: "bg-emerald-100 text-emerald-900" }
    : { label: "Đã khóa", tone: "bg-red-100 text-red-900" };
}

function AdminUsersWorkspace() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<AdminUserAccount[]>([]);
  const [role, setRole] = useState("");
  // A valid ?status= deep link (e.g. the dashboard "Tài khoản đang khóa" queue)
  // seeds the filter; anything else falls back to "Tất cả".
  const [status, setStatus] = useState(() => {
    const requested = searchParams.get("status");
    return requested === "ACTIVE" || requested === "DISABLED" ? requested : "";
  });
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<{ item: AdminUserAccount; next: "ACTIVE" | "DISABLED" } | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [rolesEditing, setRolesEditing] = useState<AdminUserAccount | null>(null);
  const [rolesDraft, setRolesDraft] = useState<string[]>([]);
  const [rolesBusy, setRolesBusy] = useState(false);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const loadRequestRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await adminListUsers({
        role: role || undefined,
        status: status || undefined,
        q: submittedQuery || undefined,
        page,
        size: 20,
      });
      if (requestId !== loadRequestRef.current) return;
      setItems(result.content);
      setTotal(result.totalElements);
      setTotalPages(result.totalPages);
    } catch (reason) {
      if (requestId !== loadRequestRef.current) return;
      setError(describeAdminError(reason).description);
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false);
    }
  }, [page, role, status, submittedQuery]);

  useEffect(() => {
    void Promise.resolve().then(() => load());
    return () => { loadRequestRef.current += 1; };
  }, [load]);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setPage(0);
    setSubmittedQuery(query.trim());
  };

  const submitStatus = async (): Promise<void> => {
    const current = pendingStatus;
    if (!current || statusBusy) return;
    setStatusBusy(true);
    setStatusError(null);
    try {
      await adminUpdateUserStatus(current.item.id, current.next);
      setPendingStatus(null);
      await load();
    } catch (reason) {
      setStatusError(describeAdminError(reason, { preferServerMessage: true }).description);
    } finally {
      setStatusBusy(false);
    }
  };

  const openRoleEditor = (item: AdminUserAccount) => {
    setRolesEditing(item);
    setRolesDraft(item.roles);
    setRolesError(null);
  };

  const toggleDraftRole = (code: string) => {
    setRolesDraft((current) =>
      current.includes(code) ? current.filter((value) => value !== code) : [...current, code],
    );
  };

  const submitRoles = async (): Promise<void> => {
    const target = rolesEditing;
    if (!target || rolesBusy) return;
    if (rolesDraft.length === 0) {
      setRolesError("Tài khoản phải giữ ít nhất một vai trò.");
      return;
    }
    setRolesBusy(true);
    setRolesError(null);
    try {
      await adminUpdateUserRoles(target.id, rolesDraft);
      setRolesEditing(null);
      await load();
    } catch (reason) {
      setRolesError(describeAdminError(reason, { preferServerMessage: true }).description);
    } finally {
      setRolesBusy(false);
    }
  };

  return (
    <div>
      <header className="border-b border-slate-200 pb-6">
        <h1 className="text-3xl font-bold text-slate-950">Tài khoản người dùng</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Xem ngày tạo, vai trò và trạng thái của mọi tài khoản; khóa tài khoản vi phạm hoặc điều chỉnh quyền truy cập.
          Khóa tài khoản chặn đăng nhập ngay lập tức và thu hồi toàn bộ phiên đang mở.
        </p>
      </header>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <form className="flex flex-wrap items-end gap-3" onSubmit={submitSearch}>
          <label className="text-sm font-semibold">Tìm kiếm
            <input
              className="mt-1 block min-h-11 w-64 rounded-lg border border-slate-300 px-3"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Email hoặc họ tên…"
              type="search"
              value={query}
            />
          </label>
          <label className="text-sm font-semibold">Vai trò
            <select className="mt-1 block min-h-11 rounded-lg border border-slate-300 px-3" onChange={(event) => { setRole(event.target.value); setPage(0); }} value={role}>
              <option value="">Tất cả</option>
              {ROLE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">Trạng thái
            <select className="mt-1 block min-h-11 rounded-lg border border-slate-300 px-3" onChange={(event) => { setStatus(event.target.value); setPage(0); }} value={status}>
              <option value="">Tất cả</option>
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="DISABLED">Đã khóa</option>
            </select>
          </label>
          <button className="min-h-11 rounded-lg bg-teal-700 px-4 text-sm font-bold text-white disabled:opacity-50" disabled={loading} type="submit">
            Tìm
          </button>
        </form>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600">Tổng cộng <strong>{loading ? "--" : total.toLocaleString("vi-VN")}</strong></span>
          <button className="text-sm font-bold text-teal-800 underline" disabled={loading} onClick={() => void load()} type="button">Làm mới</button>
        </div>
      </div>

      {error ? <div className="mt-4"><AdminState tone="error" title="Không thể tải tài khoản" description={error} /></div> : null}
      {loading ? <div className="mt-4"><AdminState tone="loading" title="Đang tải tài khoản" description="Đang lấy danh sách tài khoản mới nhất." /></div> : null}
      {!loading && !error && items.length === 0 ? <div className="mt-4"><AdminState tone="empty" title="Không có tài khoản" description="Không có tài khoản phù hợp với bộ lọc đã chọn." /></div> : null}

      {!loading && items.length > 0 ? (
        <div aria-label="Danh sách tài khoản, có thể cuộn ngang trên màn hình nhỏ" className="mt-4 max-w-full overflow-x-auto rounded-lg border border-slate-200 bg-white" role="region" tabIndex={0}>
          <table className="w-full min-w-[1100px] text-left text-sm">
            <caption className="sr-only">Danh sách tài khoản người dùng và quyền truy cập</caption>
            <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3">Tài khoản</th>
                <th scope="col" className="px-4 py-3">Liên hệ</th>
                <th scope="col" className="px-4 py-3">Vai trò</th>
                <th scope="col" className="px-4 py-3">Trạng thái</th>
                <th scope="col" className="px-4 py-3">Ngày tạo</th>
                <th scope="col" className="px-4 py-3">Hành động</th>
              </tr>
            </thead>
            <tbody>{items.map((item) => {
              const badge = statusBadge(item.status);
              return (
                <tr className="border-b border-slate-100 align-top last:border-0" key={item.id}>
                  <td className="px-4 py-4">
                    <strong>{item.displayName || item.email}</strong>
                    {item.demo ? <span className="ml-2 rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-900">Demo</span> : null}
                    <br />
                    <span className="text-xs text-slate-500">{item.email}</span>
                    {item.doctorProfileId ? <><br /><span className="text-xs text-teal-800">Có hồ sơ bác sĩ trong danh mục</span></> : null}
                    {item.patientProfileId ? <><br /><span className="text-xs text-slate-500">Có hồ sơ bệnh nhân</span></> : null}
                  </td>
                  <td className="px-4 py-4">
                    {item.phone || "—"}
                    {!item.emailVerified ? <><br /><span className="text-xs text-amber-800">Email chưa xác minh</span></> : null}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {item.roles.map((code) => (
                        <span className={`rounded-md px-2 py-1 text-xs font-bold ${ROLE_TONE[code] ?? "bg-slate-100 text-slate-700"}`} key={code}>{roleLabel(code)}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-4"><span className={`rounded-md px-2 py-1 text-xs font-bold ${badge.tone}`}>{badge.label}</span></td>
                  <td className="px-4 py-4 text-xs text-slate-600">{formatBusinessDateTime(item.createdAt)}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100"
                        onClick={() => openRoleEditor(item)}
                        type="button"
                      >
                        <UiIcon name="shield" size={13} className="mr-1 inline-block align-[-2px]" />
                        Vai trò
                      </button>
                      {item.status === "ACTIVE" ? (
                        <button
                          className="min-h-11 rounded-lg border border-red-300 px-3 py-2 text-xs font-bold text-red-700 transition-colors hover:bg-red-50"
                          onClick={() => { setStatusError(null); setPendingStatus({ item, next: "DISABLED" }); }}
                          type="button"
                        >
                          Khóa tài khoản
                        </button>
                      ) : (
                        <button
                          className="min-h-11 rounded-lg border border-emerald-300 px-3 py-2 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-50"
                          onClick={() => { setStatusError(null); setPendingStatus({ item, next: "ACTIVE" }); }}
                          type="button"
                        >
                          Mở khóa
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      ) : null}

      <nav aria-label="Phân trang tài khoản" className="mt-5 flex justify-end gap-2">
        <button className="inline-flex min-h-11 items-center rounded-lg border px-4 py-2 text-sm disabled:opacity-40" disabled={page === 0 || loading} onClick={() => setPage((value) => value - 1)} type="button">Trang trước</button>
        <span className="inline-flex min-h-11 items-center px-3 text-sm">{totalPages === 0 ? 0 : page + 1}/{totalPages}</span>
        <button className="inline-flex min-h-11 items-center rounded-lg border px-4 py-2 text-sm disabled:opacity-40" disabled={page + 1 >= totalPages || loading} onClick={() => setPage((value) => value + 1)} type="button">Trang sau</button>
      </nav>

      <ConfirmActionDialog
        confirmLabel={pendingStatus?.next === "DISABLED" ? "Khóa tài khoản" : "Mở khóa tài khoản"}
        confirmingLabel="Đang cập nhật tài khoản…"
        description={pendingStatus?.next === "DISABLED"
          ? "Tài khoản sẽ không thể đăng nhập trên mọi thiết bị và mọi phiên đang mở bị thu hồi ngay lập tức. Người dùng có thể được mở lại bất cứ lúc nào."
          : "Tài khoản được phép đăng nhập trở lại. Các phiên cũ đã bị thu hồi nên người dùng phải đăng nhập lại."}
        destructive={pendingStatus?.next === "DISABLED"}
        dismissOnBackdrop={false}
        entity={pendingStatus?.item}
        error={statusBusy ? null : statusError}
        onCancel={() => { if (!statusBusy) { setPendingStatus(null); setStatusError(null); } }}
        onConfirm={() => void submitStatus()}
        open={pendingStatus !== null}
        pending={statusBusy}
        summaryItems={pendingStatus ? [
          { label: "Tài khoản", value: pendingStatus.item.displayName || pendingStatus.item.email },
          { label: "Email", value: pendingStatus.item.email, mono: true },
          { label: "Vai trò", value: pendingStatus.item.roles.map(roleLabel).join(", ") },
          { label: "Ngày tạo", value: formatBusinessDateTime(pendingStatus.item.createdAt) },
          { label: "Chuyển sang", value: statusBadge(pendingStatus.next).label },
        ] : []}
        summaryLabel="Tài khoản đang xét"
        title={pendingStatus?.next === "DISABLED" ? "Khóa tài khoản này?" : "Mở khóa tài khoản này?"}
      />

      {rolesEditing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation">
          <div aria-labelledby="role-editor-title" aria-modal="true" className="w-full max-w-md rounded-sm bg-white p-6 shadow-xl" role="dialog">
            <h3 className="text-lg font-bold text-slate-900" id="role-editor-title">Chỉnh sửa vai trò</h3>
            <p className="mt-1 text-sm text-slate-600">
              <strong>{rolesEditing.displayName || rolesEditing.email}</strong> ({rolesEditing.email})
            </p>
            {rolesEditing.doctorProfileId && !rolesDraft.includes("DOCTOR") ? (
              <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                Tài khoản này đang gắn hồ sơ bác sĩ trong danh mục. Gỡ vai trò Bác sĩ sẽ chặn truy cập cổng bác sĩ
                nhưng không xóa hồ sơ danh mục — hãy kiểm tra lại trang Quản lý bác sĩ nếu cần.
              </p>
            ) : null}
            <fieldset className="mt-4 space-y-2">
              <legend className="text-xs font-bold uppercase tracking-wider text-slate-600">Vai trò được cấp</legend>
              {ROLE_OPTIONS.map(([code, label]) => (
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3" key={code}>
                  <input
                    checked={rolesDraft.includes(code)}
                    className="h-4 w-4 accent-teal-700"
                    onChange={() => toggleDraftRole(code)}
                    type="checkbox"
                  />
                  <span className="text-sm font-semibold text-slate-800">{label}</span>
                  <span className="text-xs text-slate-500">({code})</span>
                </label>
              ))}
            </fieldset>
            {rolesError ? (
              <div aria-live="assertive" className="mt-4 rounded-sm border border-red-200 bg-red-50 p-3 text-sm text-red-900" role="alert">
                {rolesError}
              </div>
            ) : null}
            <p className="mt-3 text-xs text-slate-500">
              Thay đổi vai trò có hiệu lực ngay ở lần truy cập kế tiếp của tài khoản. Không thể sửa vai trò của chính mình
              hoặc thu hồi quyền của quản trị viên cuối cùng.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-sm border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                disabled={rolesBusy}
                onClick={() => { setRolesEditing(null); setRolesError(null); }}
                type="button"
              >
                Hủy
              </button>
              <button
                className="rounded-sm bg-teal-700 px-5 py-2 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
                disabled={rolesBusy || rolesDraft.length === 0}
                onClick={() => void submitRoles()}
                type="button"
              >
                {rolesBusy ? "Đang lưu…" : "Lưu vai trò"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<AdminState tone="loading" title="Đang mở danh sách tài khoản" description="Vui lòng chờ trong giây lát." />}>
      <AdminUsersWorkspace />
    </Suspense>
  );
}
