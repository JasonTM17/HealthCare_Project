"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  changePassword,
  fetchPatientProfile,
  hasRole,
  updatePatientProfile,
  type PatientGender,
} from "../../../lib/api-client";
import type { PatientProfile } from "../../../types/hospital";
import { ForbiddenState, LoadingState, LoginRequiredState } from "../../../components/PortalStates";
import { useAuthSession, useAuthSessionStatus } from "../../../components/useAuthSession";
import UiIcon from "../../../components/UiIcon";

const TIER_META: Record<string, { label: string; badge: string; icon: string; bg: string; maxCredits: number; perks: string }> = {
  VIP: {
    label: "Hạng VIP Đặc Biệt",
    badge: "bg-purple-100 text-purple-900 border-purple-200",
    icon: "👑",
    bg: "from-purple-900 via-indigo-950 to-slate-900",
    maxCredits: 300,
    perks: "Ưu tiên xếp lịch khám tức thì · 300 lượt Trợ lý AI y khoa · Bác sĩ gia đình đồng hành",
  },
  GOLD: {
    label: "Hạng Vàng (Gold Member)",
    badge: "bg-amber-100 text-amber-900 border-amber-200",
    icon: "⭐",
    bg: "from-amber-900 via-teal-950 to-slate-900",
    maxCredits: 100,
    perks: "Ưu tiên điều phối tư vấn trực tuyến · 100 lượt Trợ lý AI y khoa · Nhắc lịch định kỳ",
  },
  SILVER: {
    label: "Hạng Bạc (Silver Member)",
    badge: "bg-slate-200 text-slate-800 border-slate-300",
    icon: "🥈",
    bg: "from-slate-800 via-teal-950 to-slate-900",
    maxCredits: 50,
    perks: "50 lượt Trợ lý AI y khoa · Lưu trữ hồ sơ bệnh án không giới hạn thời gian",
  },
  STANDARD: {
    label: "Hạng Tiêu Chuẩn",
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
    icon: "🌱",
    bg: "from-teal-900 via-teal-950 to-slate-900",
    maxCredits: 20,
    perks: "20 lượt Trợ lý AI y khoa cơ bản · Đặt lịch khám và theo dõi đơn thuốc trực tuyến",
  },
};

export default function PatientProfilePage() {
  const session = useAuthSession();
  const status = useAuthSessionStatus();
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Profile Form states
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState<PatientGender>("UNSPECIFIED");
  const [address, setAddress] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [bloodType, setBloodType] = useState("");
  const [medicalHistory, setMedicalHistory] = useState("");
  const [allergies, setAllergies] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileNotice, setProfileNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  // Password states
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!session?.user || !hasRole(session.user, "PATIENT")) return;
    const task = Promise.resolve().then(async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await fetchPatientProfile();
        setProfile(data);
        setFullName(data.fullName || "");
        setPhone(data.phone || "");
        setEmail(data.email || "");
        setDateOfBirth(data.dateOfBirth || "");
        setGender(data.gender || "UNSPECIFIED");
        setAddress(data.address || "");
        setEmergencyContactName(data.emergencyContactName || "");
        setEmergencyContactPhone(data.emergencyContactPhone || "");
        setBloodType(data.bloodType || "");
        setMedicalHistory(data.medicalHistory || "");
        setAllergies(data.allergies || "");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Không thể tải hồ sơ bệnh nhân.";
        setLoadError(msg);
      } finally {
        setLoading(false);
      }
    });
    return () => void task;
  }, [session, status]);

  if (status !== "settled" && loading) {
    return (
      <main className="portal-shell">
        <LoadingState label="Đang tải hồ sơ bệnh nhân..." />
      </main>
    );
  }

  if (!session?.user) {
    return (
      <main className="portal-shell">
        <LoginRequiredState nextPath="/patient/profile" />
      </main>
    );
  }

  if (!hasRole(session.user, "PATIENT")) {
    return (
      <main className="portal-shell">
        <ForbiddenState
          description="Khu vực này chỉ dành cho tài khoản Bệnh nhân."
          title="Không có quyền truy cập"
        />
      </main>
    );
  }

  const tierKey = (profile?.patientTier || "STANDARD").toUpperCase();
  const tierInfo = TIER_META[tierKey] || TIER_META.STANDARD;
  const currentCredits = profile?.aiCredits ?? 20;

  const handleSaveProfile = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileNotice(null);
    try {
      const updated = await updatePatientProfile({
        fullName: fullName.trim(),
        dateOfBirth: dateOfBirth || undefined,
        gender,
        address: address.trim() || undefined,
        emergencyContactName: emergencyContactName.trim() || undefined,
        emergencyContactPhone: emergencyContactPhone.trim() || undefined,
        bloodType: bloodType.trim() || undefined,
        medicalHistory: medicalHistory.trim() || undefined,
        allergies: allergies.trim() || undefined,
      });
      setProfile(updated);
      setProfileNotice({ tone: "success", text: "Hồ sơ sức khỏe cá nhân đã được cập nhật thành công!" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Không thể lưu thông tin hồ sơ.";
      setProfileNotice({ tone: "error", text: msg });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordNotice({ tone: "error", text: "Mật khẩu mới và xác nhận mật khẩu không khớp." });
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      setPasswordNotice({ tone: "error", text: "Mật khẩu mới phải có ít nhất 8 ký tự." });
      return;
    }
    setSavingPassword(true);
    setPasswordNotice(null);
    try {
      const res = await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordNotice({ tone: "success", text: res.message || "Đã đổi mật khẩu thành công!" });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Không thể đổi mật khẩu.";
      setPasswordNotice({ tone: "error", text: msg });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="border-b border-slate-200 pb-6">
        <h1 className="text-3xl font-bold text-slate-900">Hồ sơ sức khỏe & Tài khoản người bệnh</h1>
        <p className="mt-1 text-sm text-slate-600">
          Theo dõi phân hạng thẻ thành viên, hạn mức Trợ lý AI và cập nhật thông tin lâm sàng, tiền sử bệnh án cá nhân.
        </p>
      </header>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-900">
          {loadError}
        </div>
      )}

      {/* ── Membership Tier & AI Credits Card ──────────────────────────────── */}
      <section className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${tierInfo.bg} p-6 sm:p-8 text-white shadow-xl`}>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider backdrop-blur-md">
              <span>{tierInfo.icon}</span>
              <span>{tierInfo.label}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {profile?.fullName || session.user.displayName}
            </h2>
            <p className="text-sm text-slate-300 max-w-xl leading-relaxed">
              {tierInfo.perks}
            </p>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-md min-w-[240px] text-center md:text-right">
            <p className="text-xs uppercase tracking-wider text-slate-300">Lượt hỏi Trợ lý AI y khoa</p>
            <div className="mt-2 flex items-baseline justify-center md:justify-end gap-1.5">
              <span className="text-4xl font-extrabold text-amber-300">{currentCredits}</span>
              <span className="text-sm text-slate-300">/ {tierInfo.maxCredits} lượt</span>
            </div>
            {/* Progress bar */}
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-500"
                style={{ width: `${Math.min(100, Math.round((currentCredits / tierInfo.maxCredits) * 100))}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-slate-400">Tự động làm mới định kỳ theo chính sách bệnh viện</p>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-amber-500/20 blur-3xl" />
      </section>

      {/* ── Main Profile Form ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Column: Personal & Health Info */}
        <div className="lg:col-span-8 space-y-6">
          <form className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-6" onSubmit={handleSaveProfile}>
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-slate-900">Thông tin cá nhân & Y tế</h3>
              <p className="text-xs text-slate-500">Thông tin được bảo mật và chỉ sử dụng cho mục đích chăm sóc sức khỏe.</p>
            </div>

            {profileNotice && (
              <div
                className={`rounded-xl border p-4 text-sm font-semibold ${
                  profileNotice.tone === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-red-200 bg-red-50 text-red-900"
                }`}
              >
                {profileNotice.text}
              </div>
            )}

            {/* General Info */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">Họ và tên *</label>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  type="text"
                  value={fullName}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">Số điện thoại</label>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500"
                  readOnly
                  type="text"
                  value={phone}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">Email</label>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500"
                  readOnly
                  type="email"
                  value={email}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">Ngày sinh</label>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  type="date"
                  value={dateOfBirth}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">Giới tính</label>
                <select
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm"
                  onChange={(e) => setGender(e.target.value as PatientGender)}
                  value={gender}
                >
                  <option value="MALE">Nam</option>
                  <option value="FEMALE">Nữ</option>
                  <option value="OTHER">Khác</option>
                  <option value="UNSPECIFIED">Chưa xác định</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">Nhóm máu</label>
                <input
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                  onChange={(e) => setBloodType(e.target.value)}
                  placeholder="A, B, AB, O (Rh+ / Rh-)..."
                  type="text"
                  value={bloodType}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">Địa chỉ thường trú</label>
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành..."
                type="text"
                value={address}
              />
            </div>

            {/* Medical Info */}
            <div className="border-t border-slate-100 pt-5 space-y-4">
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Thông tin tiền sử y tế</h4>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">Tiền sử bệnh lý bản thân & gia đình</label>
                <textarea
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                  onChange={(e) => setMedicalHistory(e.target.value)}
                  placeholder="Ví dụ: Tăng huyết áp 3 năm, tiểu đường típ 2, từng phẫu thuật ruột thừa..."
                  rows={3}
                  value={medicalHistory}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">Dị ứng thuốc & thực phẩm</label>
                <textarea
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                  onChange={(e) => setAllergies(e.target.value)}
                  placeholder="Ví dụ: Dị ứng Penicillin, Paracetamol, hải sản (tôm, cua)..."
                  rows={2}
                  value={allergies}
                />
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="border-t border-slate-100 pt-5 space-y-4">
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Người liên hệ khẩn cấp</h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">Tên người liên hệ</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                    onChange={(e) => setEmergencyContactName(e.target.value)}
                    placeholder="Họ tên người thân..."
                    type="text"
                    value={emergencyContactName}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">SĐT người liên hệ</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                    onChange={(e) => setEmergencyContactPhone(e.target.value)}
                    placeholder="Số điện thoại khẩn cấp..."
                    type="tel"
                    value={emergencyContactPhone}
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 flex justify-end">
              <button
                className="rounded-xl bg-teal-700 px-6 py-2.5 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50 transition-all shadow-sm"
                disabled={savingProfile}
                type="submit"
              >
                {savingProfile ? "Đang lưu..." : "Lưu thay đổi hồ sơ"}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Account Security & Quick Actions */}
        <div className="lg:col-span-4 space-y-6">
          {/* Change Password Card */}
          <form className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4" onSubmit={handleChangePassword}>
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Bảo mật & Đổi mật khẩu</h3>
              <p className="text-xs text-slate-500">Đổi mật khẩu định kỳ để bảo vệ dữ liệu y tế cá nhân.</p>
            </div>

            {passwordNotice && (
              <div
                className={`rounded-xl border p-3 text-xs font-semibold ${
                  passwordNotice.tone === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-red-200 bg-red-50 text-red-900"
                }`}
              >
                {passwordNotice.text}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">Mật khẩu hiện tại</label>
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                required
                type="password"
                value={passwordForm.currentPassword}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">Mật khẩu mới</label>
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                required
                type="password"
                value={passwordForm.newPassword}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">Xác nhận mật khẩu mới</label>
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                required
                type="password"
                value={passwordForm.confirmPassword}
              />
            </div>

            <button
              className="w-full rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-900 disabled:opacity-50 transition-all shadow-sm"
              disabled={savingPassword}
              type="submit"
            >
              {savingPassword ? "Đang xử lý..." : "Cập nhật mật khẩu"}
            </button>
          </form>

          {/* Tier Policy Card */}
          <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-teal-50/40 p-6 shadow-sm space-y-3">
            <h4 className="text-sm font-bold text-teal-900">Quy chế Hạng Thành Viên</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Hạng thành viên được quản trị viên bệnh viện cấp phát hoặc tự động nâng hạng dựa trên tần suất khám, gói chăm sóc và đồng hành lâu năm.
            </p>
            <div className="space-y-2 pt-2 border-t border-slate-200/60 text-xs text-slate-700">
              <div className="flex items-center justify-between">
                <span>🌱 Tiêu chuẩn</span>
                <span className="font-bold text-emerald-800">20 credits</span>
              </div>
              <div className="flex items-center justify-between">
                <span>🥈 Hạng Bạc</span>
                <span className="font-bold text-slate-800">50 credits</span>
              </div>
              <div className="flex items-center justify-between">
                <span>⭐ Hạng Vàng</span>
                <span className="font-bold text-amber-800">100 credits</span>
              </div>
              <div className="flex items-center justify-between">
                <span>👑 Hạng VIP</span>
                <span className="font-bold text-purple-800">300 credits</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
