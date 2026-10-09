"use client";

import { useEffect, useRef, useState } from "react";
import { useAuthSession } from "../../../components/useAuthSession";
import { ACCOUNT_ROLES, accountDateBounds, accountError, adminUsers, type AccountFilters, type AccountPage, type AccountRole, type AccountStatus, type AdminAccount } from "../../../lib/admin-users-client";
import AdminState from "../_components/AdminState";
import AccountPanel, { AccountTime } from "./account-panel";
import { ROLE_LABELS } from "./account-form";
import styles from "./users.module.css";

interface Filters { q: string; role: AccountRole | ""; status: AccountStatus | ""; verified: string; demo: string; from: string; through: string; sort: NonNullable<AccountFilters["sort"]>; direction: "asc" | "desc"; page: number; size: number }
const DEFAULT_FILTERS: Filters = { q: "", role: "", status: "", verified: "", demo: "", from: "", through: "", sort: "createdAt", direction: "desc", page: 0, size: 20 };
export default function AdminUsersPage() {
  const session = useAuthSession();
  const [actor, setActor] = useState<AdminAccount | null>(null);
  const [actorError, setActorError] = useState("");
  const [actorRetry, setActorRetry] = useState(0);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [data, setData] = useState<AccountPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<{ id: string; account: AdminAccount | null } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const sequence = useRef(0);
  const selectionSequence = useRef(0);
  const detailAbort = useRef<AbortController | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    if (!session?.user.id) return;
    adminUsers.get(session.user.id, controller.signal).then((next) => { if (!controller.signal.aborted) { setActor(next); setActorError(""); } })
      .catch((failure) => { if (!controller.signal.aborted) { setActor(null); setActorError(accountError(failure)); } });
    return () => controller.abort();
  }, [session?.user.id, actorRetry]);
  useEffect(() => {
    const requestSequence = ++sequence.current;
    const controller = new AbortController();
    // Sequence invalidation is immediate; the debounce cannot accept an old filter response.
    const timer = window.setTimeout(async () => {
      setLoading(true); setError("");
      try {
        const bounds = accountDateBounds(filters.from, filters.through);
        const next = await adminUsers.list({ q: filters.q, role: filters.role, status: filters.status, ...(filters.verified ? { verified: filters.verified === "true" } : {}), ...(filters.demo ? { demo: filters.demo === "true" } : {}), ...bounds, page: filters.page, size: filters.size, sort: filters.sort, direction: filters.direction }, controller.signal);
        if (!controller.signal.aborted && requestSequence === sequence.current) setData(next);
      } catch (failure) { if (!controller.signal.aborted && requestSequence === sequence.current) { setData(null); setError(failure instanceof Error && !("status" in failure) ? failure.message : accountError(failure)); } }
      finally { if (!controller.signal.aborted && requestSequence === sequence.current) setLoading(false); }
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [filters, refresh]);
  useEffect(() => () => detailAbort.current?.abort(), []);
  const filter = <K extends keyof Filters>(key: K, value: Filters[K]) => { setLoading(true); setFilters((current) => ({ ...current, [key]: value, page: key === "page" ? Number(value) : 0 })); };
  const openDetail = async (id: string, button?: HTMLButtonElement) => {
    if (button) trigger.current = button;
    detailAbort.current?.abort(); const controller = new AbortController(); detailAbort.current = controller;
    const requestSequence = ++selectionSequence.current;
    setSelected({ id, account: null }); setDetailLoading(true); setDetailError("");
    try { const account = await adminUsers.get(id, controller.signal); if (!controller.signal.aborted && requestSequence === selectionSequence.current) setSelected({ id, account }); }
    catch (failure) { if (!controller.signal.aborted && requestSequence === selectionSequence.current) setDetailError(accountError(failure)); }
    finally { if (!controller.signal.aborted && requestSequence === selectionSequence.current) setDetailLoading(false); }
  };
  const closeDetail = () => { detailAbort.current?.abort(); ++selectionSequence.current; setSelected(null); setDetailError(""); window.setTimeout(() => trigger.current?.focus(), 0); };
  const changed = (account: AdminAccount) => { if (account.id === session?.user.id) setActor(account); setRefresh((n) => n + 1); };
  const editable = Boolean(actor && actor.id === session?.user.id && !actor.demo && actor.emailVerified && actor.status === "ACTIVE" && actor.roles.includes("ADMIN"));
  return (
    <div className={styles.page}>
      <header className={styles.header}><div><h1>Tài khoản</h1><p>Quản lý quyền truy cập và thông tin tài khoản.</p></div>{!selected && <button className={styles.primary} disabled={!editable} onClick={(event) => { trigger.current = event.currentTarget; setSelected({ id: "create", account: null }); setDetailError(""); setDetailLoading(false); }} type="button">Tạo tài khoản</button>}</header>
      {actor?.demo && <p className={styles.warning} role="status">Tài khoản trải nghiệm chỉ có thể xem. Không thể thay đổi tài khoản.</p>}
      {actorError && <div className={styles.error} role="alert"><p>{actorError}</p><button onClick={() => setActorRetry((n) => n + 1)} type="button">Kiểm tra lại phiên quản trị</button></div>}
      {selected ? detailLoading ? <AdminState tone="loading" title="Đang tải chi tiết tài khoản" description="Thông tin thuộc đúng tài khoản đã chọn." /> : detailError ? <AdminState tone="error" title="Chưa đọc được tài khoản" description={detailError} action={<div className={styles.actions}><button onClick={() => void openDetail(selected.id)} type="button">Thử lại</button><button onClick={closeDetail} type="button">Trở lại danh sách</button></div>} /> : <AccountPanel actor={actor?.id === session?.user.id ? actor : null} initial={selected.account} key={selected.id} onChanged={changed} onClose={closeDetail} /> : <>
        <section aria-label="Bộ lọc tài khoản" className={styles.filters}>
          <label className={styles.search}>Tìm theo họ tên hoặc email<input data-testid="account-search" maxLength={160} onChange={(event) => filter("q", event.target.value)} placeholder="Nhập từ khóa tìm kiếm" type="search" value={filters.q} /></label>
          <label>Vai trò<select data-testid="account-role-filter" onChange={(event) => filter("role", event.target.value as Filters["role"])} value={filters.role}><option value="">Tất cả vai trò</option>{ACCOUNT_ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></label>
          <label>Trạng thái<select data-testid="account-status-filter" onChange={(event) => filter("status", event.target.value as Filters["status"])} value={filters.status}><option value="">Tất cả trạng thái</option><option value="ACTIVE">Hoạt động</option><option value="DISABLED">Đã khóa</option></select></label>
          <label>Xác minh email<select data-testid="account-verification-filter" onChange={(event) => filter("verified", event.target.value)} value={filters.verified}><option value="">Tất cả</option><option value="true">Đã xác minh</option><option value="false">Chưa xác minh</option></select></label>
          <label>Loại tài khoản<select onChange={(event) => filter("demo", event.target.value)} value={filters.demo}><option value="">Tất cả</option><option value="false">Tài khoản thực</option><option value="true">Trải nghiệm</option></select></label>
          <label>Tạo từ ngày<input onChange={(event) => filter("from", event.target.value)} type="date" value={filters.from} /></label>
          <label>Đến hết ngày<input onChange={(event) => filter("through", event.target.value)} type="date" value={filters.through} /></label>
          <label>Sắp xếp<select onChange={(event) => filter("sort", event.target.value as Filters["sort"])} value={filters.sort}><option value="createdAt">Ngày tạo</option><option value="updatedAt">Cập nhật gần nhất</option><option value="displayName">Họ tên</option><option value="email">Email</option><option value="status">Trạng thái</option></select></label>
          <label>Thứ tự<select onChange={(event) => filter("direction", event.target.value as Filters["direction"])} value={filters.direction}><option value="desc">Giảm dần</option><option value="asc">Tăng dần</option></select></label>
          <button onClick={() => { setLoading(true); setFilters({ ...DEFAULT_FILTERS }); }} type="button">Xóa bộ lọc</button>
        </section>
        {error ? <AdminState tone="error" title="Chưa tải được danh sách" description={error} action={<button onClick={() => setRefresh((n) => n + 1)} type="button">Thử lại</button>} /> : <>
          {loading && <p role="status">Đang cập nhật danh sách…</p>}
          {!loading && data?.content.length === 0 && <AdminState tone="empty" title="Không có tài khoản phù hợp" description="Thử đổi từ khóa hoặc bộ lọc." />}
          {data && data.content.length > 0 && <div aria-busy={loading} aria-label="Danh sách tài khoản" className={styles.tableRegion} role="region" tabIndex={0}>
            <table><caption>Danh sách tài khoản · ngày giờ theo múi giờ Việt Nam</caption><thead><tr><th scope="col">Tài khoản</th><th scope="col">Vai trò</th><th scope="col">Trạng thái</th><th scope="col">Ngày tạo</th><th scope="col">Cập nhật gần nhất</th><th scope="col">Thao tác</th></tr></thead><tbody>
              {data.content.map((account) => <tr data-testid={`account-row-${account.id}`} key={account.id}>
                <td data-label="Tài khoản"><strong>{account.displayName}</strong><span className={styles.email}>{account.email}</span><small>{account.id === session?.user.id ? "Bạn · " : ""}{account.demo ? "Trải nghiệm" : "Tài khoản thực"}</small></td>
                <td data-label="Vai trò">{account.roles.map((role) => ROLE_LABELS[role]).join(", ")}</td>
                <td data-label="Trạng thái"><span>{account.status === "ACTIVE" ? "Hoạt động" : "Đã khóa"}</span><small>{account.emailVerified ? "Email đã xác minh" : "Email chưa xác minh"}</small></td>
                <td data-label="Ngày tạo"><AccountTime value={account.createdAt} /></td><td data-label="Cập nhật gần nhất"><AccountTime value={account.updatedAt} /></td>
                <td data-label="Thao tác"><button disabled={loading} onClick={(event) => void openDetail(account.id, event.currentTarget)} type="button">Xem chi tiết</button></td>
              </tr>)}
            </tbody></table>
          </div>}
          {data && <nav aria-label="Phân trang tài khoản" className={styles.pagination} data-testid="account-pagination">
            <p>{data.content.length === 0 ? "0" : `${data.number * data.size + 1}–${Math.min((data.number + 1) * data.size, data.totalElements)}`} trên {data.totalElements} tài khoản · Trang {data.number + 1} / {Math.max(1, data.totalPages)}</p>
            <div className={styles.actions}><button disabled={loading || data.number === 0} onClick={() => filter("page", data.number - 1)} type="button">Trang trước</button><button disabled={loading || data.number + 1 >= data.totalPages} onClick={() => filter("page", data.number + 1)} type="button">Trang sau</button><label>Số dòng<select disabled={loading} onChange={(event) => filter("size", Number(event.target.value))} value={filters.size}><option value={20}>20</option><option value={50}>50</option></select></label></div>
          </nav>}
        </>}
      </>}
    </div>
  );
}
