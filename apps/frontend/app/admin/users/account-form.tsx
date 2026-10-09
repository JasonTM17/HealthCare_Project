"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminListDoctors, type Doctor, type Page } from "../../../lib/api-client";
import { ACCOUNT_ROLES, type AccountRole, type AdminAccount } from "../../../lib/admin-users-client";
import type { AccountFormValues } from "./account-form-state";
import styles from "./users.module.css";

export const ROLE_LABELS: Record<AccountRole, string> = { PATIENT: "Bệnh nhân", DOCTOR: "Bác sĩ", ADMIN: "Quản trị viên" };
export function AccountForm({ account, value, onChange, disabled, self, onSubmit }: {
  account: AdminAccount | null; value: AccountFormValues; onChange: (value: AccountFormValues) => void;
  disabled: boolean; self: boolean; onSubmit: () => void;
}) {
  const [doctors, setDoctors] = useState<Page<Doctor> | null>(null);
  const [doctorPage, setDoctorPage] = useState(0);
  const [doctorLoading, setDoctorLoading] = useState(false);
  const [doctorError, setDoctorError] = useState(false);
  const [doctorRetry, setDoctorRetry] = useState(0);
  const wantsDoctor = value.roles.includes("DOCTOR");
  useEffect(() => {
    if (!wantsDoctor || disabled) return;
    let current = true;
    Promise.resolve().then(() => { if (current) { setDoctorLoading(true); setDoctorError(false); } });
    adminListDoctors(doctorPage, 50).then((page) => { if (current) setDoctors(page); })
      .catch(() => { if (current) setDoctorError(true); }).finally(() => { if (current) setDoctorLoading(false); });
    return () => { current = false; };
  }, [wantsDoctor, disabled, doctorPage, doctorRetry]);
  const change = <K extends keyof AccountFormValues>(key: K, next: AccountFormValues[K]) => onChange({ ...value, [key]: next });
  const linkedName = Boolean(account?.doctorProfile && !value.doctorProfileId);
  const options = doctors?.content.filter((doctor) => doctor.active === true) ?? [];
  return (
    <form className={styles.form} data-testid="account-form" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
      <fieldset disabled={disabled}>
        <legend>Thông tin cơ bản</legend>
        <label>Họ tên hiển thị<input autoComplete="name" maxLength={160} minLength={2} onChange={(event) => change("displayName", event.target.value)} readOnly={linkedName || Boolean(value.doctorProfileId)} required value={value.displayName} /></label>
        {(linkedName || value.doctorProfileId) && <p>Tên theo hồ sơ chuyên môn. <Link href="/admin/doctors">Mở Quản lý bác sĩ</Link> để thay đổi tên.</p>}
        <label>Email<input autoComplete="email" maxLength={320} onChange={(event) => change("email", event.target.value)} readOnly={self} required type="email" value={value.email} /></label>
        {self && <p>Bạn không thể đổi email của tài khoản quản trị đang sử dụng.</p>}
        {!account && <label>Mật khẩu ban đầu<input aria-describedby="account-password-help" autoComplete="new-password" maxLength={128} minLength={8} onChange={(event) => change("password", event.target.value)} required type="password" value={value.password} /><small id="account-password-help">8–128 ký tự, có chữ và số, tối đa 72 byte UTF-8. Tài khoản mới chưa xác minh email.</small></label>}
      </fieldset>
      <fieldset disabled={disabled}>
        <legend>Quyền truy cập</legend>
        {ACCOUNT_ROLES.map((role) => <label className={styles.checkbox} key={role}><input checked={value.roles.includes(role)} disabled={self && role === "ADMIN"} onChange={(event) => {
          const roles = event.target.checked ? [...value.roles, role] : value.roles.filter((item) => item !== role);
          onChange({ ...value, roles, ...(!roles.includes("DOCTOR") ? { doctorProfileId: "" } : {}) });
        }} type="checkbox" />{ROLE_LABELS[role]}<small>{role === "ADMIN" ? "Quản lý hệ thống và tài khoản" : role === "DOCTOR" ? "Cần hồ sơ bác sĩ có thật" : "Sử dụng dịch vụ dành cho người bệnh"}</small></label>)}
        {self && <p>Bạn không thể tự gỡ quyền quản trị. Server kiểm tra quyền và quản trị viên cuối cùng.</p>}
      </fieldset>
      {(wantsDoctor || account?.doctorProfile) && <fieldset disabled={disabled}>
        <legend>Hồ sơ bác sĩ</legend>
        <p>{account?.doctorProfile ? `Hiện liên kết: ${account.doctorProfile.fullName} · ${account.doctorProfile.active ? "Đang hoạt động" : "Ngừng hoạt động"}` : "Chưa liên kết hồ sơ bác sĩ."}</p>
        {wantsDoctor && <>
          <label>{account?.doctorProfile ? "Giữ hoặc thay hồ sơ liên kết" : "Chọn hồ sơ đang hoạt động"}<select disabled={doctorLoading} onChange={(event) => {
            const selected = options.find((doctor) => doctor.id === event.target.value);
            onChange({ ...value, doctorProfileId: event.target.value, displayName: selected?.fullName ?? account?.displayName ?? value.displayName, unlinkDoctorProfile: false });
          }} required={!account || !account.roles.includes("DOCTOR")} value={value.doctorProfileId}>
            <option value="">{account?.doctorProfile ? "Giữ liên kết hiện tại" : "Chọn một hồ sơ"}</option>
            {value.doctorProfileId && !options.some((doctor) => doctor.id === value.doctorProfileId) && <option value={value.doctorProfileId}>{value.displayName} · đã chọn</option>}
            {options.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.fullName} · {doctor.slug}</option>)}
          </select></label>
          <p>Danh sách không cung cấp tình trạng liên kết tài khoản. Server sẽ kiểm tra hồ sơ còn khả dụng khi xác nhận; không chuyển hồ sơ của tài khoản khác.</p>
          {doctorLoading && <p role="status">Đang tải hồ sơ…</p>}
          {doctorError && <p role="alert">Chưa tải được hồ sơ. <button onClick={() => setDoctorRetry((n) => n + 1)} type="button">Thử lại</button></p>}
          <div className={styles.actions}><button disabled={doctorLoading || doctorPage === 0} onClick={() => setDoctorPage((n) => n - 1)} type="button">Hồ sơ trước</button><span>Trang hồ sơ {doctorPage + 1}{doctors ? ` / ${Math.max(1, doctors.totalPages)}` : ""}</span><button disabled={doctorLoading || !doctors || doctorPage + 1 >= doctors.totalPages} onClick={() => setDoctorPage((n) => n + 1)} type="button">Hồ sơ sau</button></div>
        </>}
        {!wantsDoctor && account?.doctorProfile && <label className={styles.checkbox}><input checked={value.unlinkDoctorProfile} onChange={(event) => change("unlinkDoctorProfile", event.target.checked)} required type="checkbox" />Xác nhận gỡ liên kết hồ sơ bác sĩ khi bỏ vai trò bác sĩ</label>}
      </fieldset>}
      <button className={styles.primary} data-testid="account-save" disabled={disabled || value.roles.length === 0} type="submit">{account ? "Xem thay đổi và lưu" : "Xem thông tin và tạo tài khoản"}</button>
    </form>
  );
}
