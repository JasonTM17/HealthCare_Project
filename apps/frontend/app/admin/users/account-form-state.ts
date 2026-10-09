import { expectedAccount, type AccountRole, type AccountUpdate, type AdminAccount } from "../../../lib/admin-users-client";

export interface AccountFormValues { email: string; displayName: string; password: string; roles: AccountRole[]; doctorProfileId: string; unlinkDoctorProfile: boolean }
export interface AccountBuffer { baseline: AdminAccount | null; form: AccountFormValues }
export function accountForm(account: AdminAccount | null): AccountFormValues {
  return { email: account?.email ?? "", displayName: account?.displayName ?? "", password: "", roles: account ? [...account.roles] : ["PATIENT"], doctorProfileId: "", unlinkDoctorProfile: false };
}
export function accountFormDirty(buffer: AccountBuffer): boolean { return JSON.stringify(buffer.form) !== JSON.stringify(accountForm(buffer.baseline)); }
export function reconcileAccountBuffer(buffer: AccountBuffer, latest: AdminAccount, keepEdits: boolean): AccountBuffer {
  if (buffer.baseline && latest.id !== buffer.baseline.id) throw new Error("Không thể áp dụng thông tin của tài khoản khác.");
  return { baseline: latest, form: keepEdits ? buffer.form : accountForm(latest) };
}
export function accountUpdatePayload(buffer: AccountBuffer): AccountUpdate {
  if (!buffer.baseline) throw new Error("Chưa tải thông tin tài khoản.");
  const { form, baseline } = buffer;
  return { email: form.email, displayName: form.displayName, roles: [...form.roles], status: baseline.status,
    ...(form.doctorProfileId && form.roles.includes("DOCTOR") ? { doctorProfileId: form.doctorProfileId } : {}),
    unlinkDoctorProfile: form.unlinkDoctorProfile, ...expectedAccount(baseline) };
}
