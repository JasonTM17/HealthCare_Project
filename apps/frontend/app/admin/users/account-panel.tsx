"use client";

import { useEffect, useRef, useState } from "react";
import ConfirmActionDialog from "../../../components/ui/ConfirmActionDialog";
import { adminUsers, accountError, expectedAccount, type AccountAction, type AdminAccount } from "../../../lib/admin-users-client";
import { installAdminHistoryGuard } from "../../../lib/admin-history-guard";
import { formatBusinessDateTime } from "../../../lib/business-time";
import { AccountForm, ROLE_LABELS } from "./account-form";
import { accountForm, accountFormDirty, accountUpdatePayload, reconcileAccountBuffer, type AccountBuffer } from "./account-form-state";
import styles from "./users.module.css";

export function AccountTime({ value, testId }: { value: string | null; testId?: string }) {
  return value ? <time data-testid={testId} dateTime={value}>{formatBusinessDateTime(value)}</time> : <span data-testid={testId}>Chưa có dữ liệu</span>;
}
type Intent = "save" | "lock" | "unlock" | AccountAction;
const LABELS: Record<Intent, string> = { save: "Lưu thay đổi", lock: "Khóa tài khoản", unlock: "Mở khóa tài khoản", verification: "Yêu cầu xác minh email", "password-reset": "Yêu cầu đặt lại mật khẩu", "revoke-sessions": "Thu hồi các phiên đăng nhập" };
export default function AccountPanel({ initial, actor, onClose, onChanged }: {
  initial: AdminAccount | null; actor: AdminAccount | null; onClose: () => void; onChanged: (account: AdminAccount) => void;
}) {
  const [buffer, setBuffer] = useState<AccountBuffer>(() => ({ baseline: initial, form: accountForm(initial) }));
  const [confirm, setConfirm] = useState<Intent | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [latest, setLatest] = useState<AdminAccount | null>(null);
  const [readingLatest, setReadingLatest] = useState(false);
  const [leaveIntent, setLeaveIntent] = useState<(() => void) | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const busy = useRef(false);
  const bypassLeave = useRef(false);
  const latestAbort = useRef<AbortController | null>(null);
  const dirty = accountFormDirty(buffer);
  const dirtyRef = useRef(dirty);
  const baseline = buffer.baseline;
  const self = Boolean(baseline && actor?.id === baseline.id);
  const readOnly = !actor || actor.demo || !actor.emailVerified || actor.status !== "ACTIVE" || !actor.roles.includes("ADMIN") || Boolean(baseline?.demo);
  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);
  useEffect(() => { heading.current?.focus(); return () => latestAbort.current?.abort(); }, []);
  useEffect(() => {
    const blocked = () => dirtyRef.current && !bypassLeave.current;
    const request = (proceed: () => void) => {
      if (busy.current) return;
      if (!blocked()) { proceed(); return; }
      setConfirm(null);
      setLeaveIntent(() => () => { bypassLeave.current = true; proceed(); });
    };
    const unload = (event: BeforeUnloadEvent) => { if (blocked() || busy.current) { event.preventDefault(); event.returnValue = ""; } };
    const click = (event: MouseEvent) => {
      if (!blocked() && !busy.current || !(event.target instanceof Element)) return;
      const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
      const logout = event.target.closest<HTMLButtonElement>("button[data-leaves-admin-session]");
      if (anchor && (anchor.target === "_blank" || anchor.hasAttribute("download") || anchor.href === window.location.href)) return;
      if (!anchor && !logout) return;
      event.preventDefault(); event.stopPropagation();
      if (busy.current) return;
      request(() => { if (anchor) window.location.assign(anchor.href); else logout?.click(); });
    };
    const historyGuard = installAdminHistoryGuard({ isBlocked: () => blocked() || busy.current, isBusy: () => busy.current, onRequestLeave: request });
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    return () => { historyGuard.dispose(); window.removeEventListener("beforeunload", unload); document.removeEventListener("click", click, true); };
  }, []);
  const close = () => {
    if (busy.current) return;
    if (dirty) setLeaveIntent(() => onClose); else onClose();
  };
  const run = async () => {
    if (!confirm || busy.current || readOnly) return;
    latestAbort.current?.abort(); setReadingLatest(false);
    busy.current = true; setPending(true); setError(""); setNotice("");
    try {
      let account: AdminAccount;
      let delivery = false;
      if (confirm === "save") {
        if (baseline) {
          account = await adminUsers.update(baseline.id, accountUpdatePayload(buffer));
          delivery = account.email !== baseline.email && account.status === "ACTIVE";
        } else {
          const result = await adminUsers.create({ email: buffer.form.email, displayName: buffer.form.displayName, password: buffer.form.password, roles: buffer.form.roles, ...(buffer.form.doctorProfileId ? { doctorProfileId: buffer.form.doctorProfileId } : {}) });
          account = result.account; delivery = result.deliveryState === "REQUESTED_UNCONFIRMED";
        }
      } else {
        if (!baseline) return;
        if (confirm === "lock" || confirm === "unlock") {
          account = await adminUsers.update(baseline.id, { ...accountUpdatePayload({ baseline, form: accountForm(baseline) }), status: confirm === "lock" ? "DISABLED" : "ACTIVE" });
        } else {
          const result = await adminUsers.action(baseline.id, confirm, expectedAccount(baseline));
          account = result.account; delivery = result.deliveryState === "REQUESTED_UNCONFIRMED";
        }
      }
      setBuffer({ baseline: account, form: accountForm(account) }); setLatest(null); setConfirm(null);
      setNotice(delivery ? "Yêu cầu đã được tiếp nhận. Chưa xác nhận việc gửi hoặc nhận email." : "Đã cập nhật theo phản hồi của hệ thống.");
      onChanged(account);
    } catch (failure) { setError(accountError(failure)); }
    finally { busy.current = false; setPending(false); }
  };
  const readLatest = async () => {
    if (!baseline || readingLatest || busy.current) return;
    latestAbort.current?.abort(); const controller = new AbortController(); latestAbort.current = controller;
    setReadingLatest(true);
    try { const next = await adminUsers.get(baseline.id, controller.signal); if (!controller.signal.aborted) setLatest(next); }
    catch (failure) { if (!controller.signal.aborted) setError(accountError(failure)); }
    finally { if (!controller.signal.aborted) setReadingLatest(false); }
  };
  const showAction = (intent: Intent) => { setError(""); setConfirm(intent); };
  const currentSummary = [
    { label: "Tài khoản", value: baseline?.displayName ?? buffer.form.displayName },
    { label: "Email", value: baseline?.email ?? buffer.form.email },
    { label: "Vai trò", value: (baseline?.roles ?? buffer.form.roles).map((role) => ROLE_LABELS[role]).join(", ") },
  ];
  const changes = confirm === "save" ? [
    { label: "Họ tên sau khi lưu", value: buffer.form.displayName },
    { label: "Email sau khi lưu", value: buffer.form.email },
    { label: "Vai trò sau khi lưu", value: buffer.form.roles.map((role) => ROLE_LABELS[role]).join(", ") || "Chưa chọn" },
    { label: "Hồ sơ bác sĩ", value: buffer.form.doctorProfileId ? `${buffer.form.displayName} · chọn thay liên kết` : buffer.form.unlinkDoctorProfile ? "Gỡ liên kết đã xác nhận" : baseline?.doctorProfile ? `Giữ ${baseline.doctorProfile.fullName}` : "Chưa liên kết" },
  ] : [{ label: "Thao tác", value: confirm ? LABELS[confirm] : "" }];
  const description = confirm === "lock" ? "Các phiên đăng nhập hiện tại sẽ mất hiệu lực." : confirm === "unlock" ? "Tài khoản phải đăng nhập lại. Phiên cũ không được phục hồi và email không tự được xác minh." : confirm === "revoke-sessions" ? `Các phiên đăng nhập, làm mới và OTP sẽ mất hiệu lực.${self ? " Phiên quản trị của bạn có thể kết thúc ở yêu cầu tiếp theo." : ""}` : confirm === "save" ? baseline && baseline.email !== buffer.form.email.trim().toLowerCase() ? "Đổi email sẽ gỡ liên kết Google, bỏ trạng thái xác minh và thu hồi phiên cũ. Yêu cầu xác minh mới chỉ được tạo khi tài khoản hoạt động; việc gửi email chưa được xác nhận." : baseline ? "Thay đổi vai trò, liên kết hồ sơ hoặc trạng thái sẽ thu hồi phiên đăng nhập cũ. Tên bác sĩ thuộc hồ sơ chuyên môn." : "Tạo tài khoản đang hoạt động, email chưa xác minh. Hệ thống tiếp nhận yêu cầu xác minh; việc gửi email chưa được xác nhận." : "Hệ thống tiếp nhận yêu cầu qua quy trình hiện có. Việc gửi và nhận email chưa được xác nhận.";
  return (
    <section className={styles.panel} data-testid="account-detail">
      <div className={styles.actions}><button disabled={pending} onClick={close} type="button">Trở lại danh sách</button><span>{dirty ? "Có thay đổi chưa lưu" : "Thông tin từ hệ thống"}</span></div>
      <h2 ref={heading} tabIndex={-1}>{baseline ? baseline.displayName : "Tạo tài khoản"}</h2>
      {readOnly && <p className={styles.warning} role="status">{actor?.demo || baseline?.demo ? "Tài khoản trải nghiệm chỉ có thể xem. Các thao tác thay đổi được tắt." : "Chưa xác minh được quyền thay đổi của phiên quản trị. Bạn vẫn có thể xem thông tin."}</p>}
      {baseline && <>
        <p className={styles.email}>{baseline.email}{self ? " · Bạn" : ""}{baseline.demo ? " · Trải nghiệm" : ""}</p>
        <dl className={styles.metadata}>
          <div><dt>Trạng thái</dt><dd>{baseline.status === "ACTIVE" ? "Hoạt động" : "Đã khóa"}</dd></div>
          <div><dt>Ngày tạo</dt><dd><AccountTime testId="account-created-at" value={baseline.createdAt} /></dd></div>
          <div><dt>Cập nhật gần nhất</dt><dd><AccountTime testId="account-updated-at" value={baseline.updatedAt} /></dd></div>
          <div><dt>Xác minh email</dt><dd>{baseline.emailVerified ? baseline.emailVerifiedAt ? <>Đã xác minh · <AccountTime value={baseline.emailVerifiedAt} /></> : "Đã xác minh; thời điểm chưa có dữ liệu" : "Chưa xác minh"}</dd></div>
          <div><dt>Google</dt><dd>{baseline.googleLinked ? "Đã liên kết" : "Chưa liên kết"}</dd></div>
          <div><dt>Hồ sơ bệnh nhân</dt><dd>{baseline.patientProfileId ? "Đã liên kết" : "Chưa liên kết hồ sơ"}</dd></div>
          <div><dt>Mã tài khoản</dt><dd className={styles.email}>{baseline.id} <button onClick={() => { void navigator.clipboard.writeText(baseline.id).then(() => setNotice("Đã sao chép mã tài khoản.")).catch(() => setNotice("Chưa sao chép được. Bạn có thể chọn mã để sao chép.")); }} type="button">Sao chép</button></dd></div>
        </dl>
      </>}
      {notice && <p className={styles.notice} role="status">{notice}</p>}
      {error && <div className={styles.error} role="alert"><p>{error}</p>{baseline && <button disabled={readingLatest || pending} onClick={() => void readLatest()} type="button">{readingLatest ? "Đang đọc…" : "Xem thông tin mới, giữ nội dung đang sửa"}</button>}</div>}
      {latest && <section className={styles.review} aria-label="Thông tin mới từ hệ thống">
        <h3>Đối chiếu thông tin mới</h3><p>{latest.displayName} · {latest.email}</p><p>{latest.roles.map((role) => ROLE_LABELS[role]).join(", ")} · {latest.status === "ACTIVE" ? "Hoạt động" : "Đã khóa"} · {latest.doctorProfile?.fullName ?? "Chưa liên kết bác sĩ"}</p><p>Cập nhật: <AccountTime value={latest.updatedAt} /></p>
        <p>Nội dung đang sửa vẫn được giữ. Chọn thông tin mới làm cơ sở rồi xem lại thay đổi trước khi lưu.</p>
        <div className={styles.actions}><button disabled={pending} onClick={() => { setBuffer(reconcileAccountBuffer(buffer, latest, true)); setLatest(null); setError(""); }} type="button">Giữ nội dung sửa để đối chiếu</button><button disabled={pending} onClick={() => setLeaveIntent(() => () => { setBuffer(reconcileAccountBuffer(buffer, latest, false)); setLatest(null); setError(""); })} type="button">Bỏ nội dung sửa và dùng bản mới</button></div>
      </section>}
      <AccountForm account={baseline} disabled={readOnly || pending || confirm !== null} onChange={(form) => { setBuffer({ ...buffer, form }); setNotice(""); }} onSubmit={() => showAction("save")} self={self} value={buffer.form} />
      {baseline && <section className={styles.lifecycle} aria-label="Thao tác tài khoản">
        <h3>Thao tác tài khoản</h3>
        {dirty && <p>Lưu hoặc bỏ thay đổi trước khi thực hiện thao tác tài khoản.</p>}
        {self && <p>Bạn không thể khóa tài khoản đang sử dụng.</p>}
        <div className={styles.actions}>
          <button disabled={readOnly || pending || dirty || self && baseline.status === "ACTIVE"} onClick={() => showAction(baseline.status === "ACTIVE" ? "lock" : "unlock")} type="button">{baseline.status === "ACTIVE" ? "Khóa tài khoản" : "Mở khóa tài khoản"}</button>
          <button disabled={readOnly || pending || dirty || baseline.emailVerified || baseline.status !== "ACTIVE"} onClick={() => showAction("verification")} type="button">Yêu cầu xác minh email</button>
          <button disabled={readOnly || pending || dirty || !baseline.emailVerified || baseline.status !== "ACTIVE"} onClick={() => showAction("password-reset")} type="button">Yêu cầu đặt lại mật khẩu</button>
          <button disabled={readOnly || pending || dirty} onClick={() => showAction("revoke-sessions")} type="button">Thu hồi các phiên đăng nhập</button>
          <button disabled={!dirty || pending || readOnly} onClick={() => setLeaveIntent(() => () => { setBuffer({ baseline, form: accountForm(baseline) }); setError(""); })} type="button">Bỏ thay đổi đang sửa</button>
        </div>
      </section>}
      <ConfirmActionDialog confirmLabel={confirm === "save" && !baseline ? "Tạo tài khoản" : confirm ? LABELS[confirm] : "Xác nhận"} cancelLabel="Ở lại" description={description} destructive={confirm === "lock" || confirm === "revoke-sessions"} entity={buffer} error={error} onCancel={() => { if (!pending) setConfirm(null); }} onConfirm={() => void run()} open={confirm !== null} pending={pending} summaryItems={[...currentSummary, ...changes]} title={`${confirm === "save" && !baseline ? "Tạo tài khoản" : confirm ? LABELS[confirm] : "Xác nhận"}${baseline ? `: ${baseline.displayName}` : ""}?`} />
      <ConfirmActionDialog cancelLabel="Ở lại" confirmLabel="Bỏ thay đổi và tiếp tục" description="Nội dung chưa lưu sẽ bị bỏ. Không có thao tác tự động lưu." entity={buffer} onCancel={() => setLeaveIntent(null)} onConfirm={() => { const proceed = leaveIntent; setLeaveIntent(null); proceed?.(); }} open={leaveIntent !== null} summaryItems={currentSummary} title="Bạn có thay đổi chưa lưu" />
    </section>
  );
}
