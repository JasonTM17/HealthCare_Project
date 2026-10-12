"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import ConfirmActionDialog from "../../../components/ui/ConfirmActionDialog";
import { ApiError } from "../../../lib/api-client";
import { validateAccountPassword, type AdminAccount } from "../../../lib/admin-users-client";
import styles from "./users.module.css";

export function passwordChangeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) return "Thông tin tài khoản đã thay đổi. Đọc lại thông tin mới rồi nhập và xác nhận mật khẩu lại.";
    if (error.status === 401 || error.status === 403) return "Bạn không còn quyền đổi mật khẩu cho tài khoản này. Vui lòng kiểm tra phiên đăng nhập.";
    if (error.status === 400 || error.status === 422) return "Kiểm tra độ dài mật khẩu, chữ, số và giới hạn 72 byte UTF-8.";
    if (error.status === 429) return "Thao tác quá nhanh. Vui lòng đợi rồi kiểm tra thông tin trước khi thử lại.";
  }
  return "Chưa xác nhận được việc đổi mật khẩu. Kiểm tra thông tin tài khoản trước khi thử lại.";
}

export default function AdminPasswordForm({ account, disabled, pending, onDirty, onSubmit, onReadLatest }: {
  account: AdminAccount; disabled: boolean; pending: boolean; onDirty: (dirty: boolean) => void;
  onSubmit: (password: string) => Promise<void>; onReadLatest: () => void;
}) {
  const [password, setPassword] = useState("");
  const [repeated, setRepeated] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const [invalidField, setInvalidField] = useState<"password" | "repeated" | null>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const repeatInput = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; onDirty(false); }; }, [onDirty]);
  const clear = () => { setPassword(""); setRepeated(""); setConfirm(false); setInvalidField(null); onDirty(false); };
  const prepare = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled || pending || submitting.current) return;
    const data = new FormData(event.currentTarget);
    const next = String(data.get("newPassword") ?? "");
    const again = String(data.get("repeatPassword") ?? "");
    try {
      validateAccountPassword(next);
      if (next !== again) { setError("Mật khẩu nhập lại chưa khớp."); setInvalidField("repeated"); repeatInput.current?.focus(); return; }
      setPassword(next); setRepeated(again); setError(""); setInvalidField(null); setConfirm(true); onDirty(true);
    } catch { setError("Mật khẩu cần 8–128 ký tự, có chữ và số, tối đa 72 byte UTF-8; không có ký tự xuống dòng."); setInvalidField("password"); passwordInput.current?.focus(); }
  };
  const run = async () => {
    if (disabled || pending || submitting.current || !confirm) return;
    submitting.current = true;
    const value = password;
    setPassword(""); setRepeated(""); setError(""); setInvalidField(null);
    try { await onSubmit(value); }
    catch (failure) { if (mounted.current) setError(passwordChangeError(failure)); }
    finally {
      submitting.current = false;
      if (mounted.current) { setConfirm(false); onDirty(false); }
    }
  };
  return <section className={styles.lifecycle} aria-label="Đổi mật khẩu trực tiếp">
    <h3>Đổi mật khẩu trực tiếp</h3>
    <p>Đặt mật khẩu mới cho bác sĩ hoặc bệnh nhân. Các phiên đăng nhập cũ sẽ mất hiệu lực; trạng thái tài khoản và xác minh email được giữ nguyên.</p>
    {disabled && <p role="status">Lưu hoặc bỏ thay đổi hồ sơ trước khi đổi mật khẩu. Chức năng chỉ dành cho tài khoản bác sĩ, bệnh nhân được phép quản lý.</p>}
    <form className={styles.form} onSubmit={prepare}>
      <fieldset disabled={disabled || pending || confirm}>
        <legend>Mật khẩu mới</legend>
        <label htmlFor="account-new-password">Mật khẩu mới
          <input ref={passwordInput} id="account-new-password" name="newPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128}
            value={password} aria-describedby="account-password-help account-password-error" aria-invalid={invalidField === "password"}
            onChange={(event) => { setPassword(event.target.value); onDirty(Boolean(event.target.value || repeated)); setError(""); setInvalidField(null); }} />
        </label>
        <label htmlFor="account-repeat-password">Nhập lại mật khẩu mới
          <input ref={repeatInput} id="account-repeat-password" name="repeatPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128}
            value={repeated} aria-describedby="account-password-help account-password-error" aria-invalid={invalidField === "repeated"}
            onChange={(event) => { setRepeated(event.target.value); onDirty(Boolean(event.target.value || password)); setError(""); setInvalidField(null); }} />
        </label>
        <p id="account-password-help">8–128 ký tự, có chữ và số, tối đa 72 byte UTF-8.</p>
      </fieldset>
      <div id="account-password-error" role={error ? "alert" : undefined}>{error && <><p>{error}</p><button type="button" disabled={pending} onClick={onReadLatest}>Đọc lại thông tin tài khoản</button></>}</div>
      <div className={styles.actions}>
        <button type="submit" disabled={disabled || pending || confirm}>Xem lại và đổi mật khẩu</button>
        <button type="button" disabled={pending} onClick={() => { if (!submitting.current) { clear(); setError(""); } }}>Hủy đổi mật khẩu</button>
      </div>
    </form>
    <ConfirmActionDialog open={confirm} title="Xác nhận đổi mật khẩu?" destructive pending={pending}
      description="Mật khẩu cũ và các phiên đăng nhập hiện tại sẽ mất hiệu lực. Gửi mật khẩu mới cho người sở hữu qua kênh riêng phù hợp."
      entity={{ id: account.id, version: account.version, updatedAt: account.updatedAt }}
      summaryItems={[{ label: "Tài khoản", value: account.displayName }, { label: "Email", value: account.email }]}
      confirmLabel="Đổi mật khẩu" cancelLabel="Hủy" onConfirm={() => void run()} onCancel={() => { if (!pending) { clear(); setError(""); } }} />
  </section>;
}
