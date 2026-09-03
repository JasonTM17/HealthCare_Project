"use client";

import { useEffect, useState, type FormEvent } from "react";
import PortalChrome from "../../../components/PortalChrome";
import {
  changePassword,
  fetchDoctorProfile,
  hasRole,
  updateDoctorProfile,
} from "../../../lib/api-client";
import type { Doctor } from "../../../types/hospital";
import { ForbiddenState, LoadingState, LoginRequiredState } from "../../../components/PortalStates";
import { useAuthSession, useAuthSessionStatus } from "../../../components/useAuthSession";
import UiIcon from "../../../components/UiIcon";

const SAMPLE_DOCTOR_PORTRAITS = [
  "/media/doctors/doctor-1.jpg",
  "/media/doctors/doctor-2.jpg",
  "/media/doctors/doctor-3.jpg",
  "/media/doctors/doctor-4.jpg",
  "/media/doctors/doctor-5.jpg",
  "/media/doctors/doctor-6.jpg",
];

export default function DoctorProfilePage() {
  const session = useAuthSession();
  const status = useAuthSessionStatus();
  const [profile, setProfile] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form states
  const [bio, setBio] = useState("");
  const [achievements, setAchievements] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);

  // Password states
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user || !hasRole(session.user, "DOCTOR")) {
      return;
    }
    const task = Promise.resolve().then(async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const doc = await fetchDoctorProfile();
        setProfile(doc);
        setBio(doc.bio ?? "");
        setAchievements(doc.achievements ?? "");
        setPhotoUrl(doc.photoUrl ?? "");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Không thể tải hồ sơ bác sĩ.";
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
        <LoadingState label="Đang tải thông tin hồ sơ bác sĩ..." />
      </main>
    );
  }

  if (!session?.user) {
    return (
      <main className="portal-shell">
        <LoginRequiredState nextPath="/doctor/profile" />
      </main>
    );
  }

  if (!hasRole(session.user, "DOCTOR")) {
    return (
      <main className="portal-shell">
        <ForbiddenState
          title="Không có quyền truy cập"
          description="Khu vực này chỉ dành cho tài khoản Bác sĩ."
        />
      </main>
    );
  }

  const handleSaveProfile = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileNotice(null);
    try {
      const updated = await updateDoctorProfile({
        bio: bio.trim(),
        achievements: achievements.trim(),
        photoUrl: photoUrl.trim() || undefined,
      });
      setProfile(updated);
      setProfileNotice("Đã cập nhật tiểu sử, ảnh và thành tựu chuyên môn thành công.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Không thể cập nhật hồ sơ bác sĩ.";
      setProfileNotice(msg);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordNotice("Mật khẩu mới và xác nhận mật khẩu không khớp.");
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      setPasswordNotice("Mật khẩu mới phải có tối thiểu 8 ký tự.");
      return;
    }
    setSavingPassword(true);
    setPasswordNotice(null);
    try {
      await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordNotice("Đã đổi mật khẩu thành công.");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Không thể đổi mật khẩu.";
      setPasswordNotice(msg);
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <PortalChrome role="DOCTOR" user={session.user}>
      <div className="portal-container">
        <div className="portal-page-header mb-6">
          <h1 className="text-2xl font-black text-teal-950 tracking-tight">Hồ sơ Bác sĩ & Cài đặt Tài khoản</h1>
          <p className="text-sm text-slate-600">Quản lý ảnh đại diện, tiểu sử chuyên môn, thành tựu lâm sàng và bảo mật mật khẩu</p>
        </div>

        {loadError ? (
          <div className="portal-inline-error mb-4">{loadError}</div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cột trái: Tóm tắt thông tin & Ảnh chân dung */}
          <div className="portal-panel portal-panel--secondary flex flex-col items-center text-center p-6">
            <div className="relative mb-4">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={profile?.fullName ?? session.user.displayName}
                  className="w-32 h-32 rounded-full object-cover border-4 border-teal-600 shadow-md"
                  src={photoUrl}
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-teal-800 text-white flex items-center justify-center text-3xl font-black shadow-md">
                  {session.user.displayName ? session.user.displayName.charAt(0).toUpperCase() : "BS"}
                </div>
              )}
            </div>

            <h2 className="text-xl font-bold text-teal-950">{profile?.fullName ?? session.user.displayName}</h2>
            <p className="text-xs text-teal-700 font-semibold mt-1">{profile?.specialtyName ?? "Bác sĩ chuyên khoa"}</p>
            <p className="text-xs text-slate-500 mt-0.5">{session.user.email}</p>

            <div className="w-full mt-6 pt-4 border-t border-slate-200 text-left space-y-2 text-xs text-slate-700">
              {profile?.branchNames && profile.branchNames.length > 0 ? (
                <div>
                  <span className="font-bold block text-slate-900">Cơ sở làm việc:</span>
                  <span>{profile.branchNames.join(", ")}</span>
                </div>
              ) : null}
              {profile?.specialtySlugs && profile.specialtySlugs.length > 0 ? (
                <div>
                  <span className="font-bold block text-slate-900">Mã chuyên khoa:</span>
                  <span>{profile.specialtySlugs.join(", ")}</span>
                </div>
              ) : null}
            </div>

            {/* Gợi ý ảnh chân dung chuẩn */}
            <div className="w-full mt-6 pt-4 border-t border-slate-200 text-left">
              <span className="text-xs font-bold text-slate-800 block mb-2">Chọn nhanh ảnh chân dung bệnh viện:</span>
              <div className="grid grid-cols-3 gap-2">
                {SAMPLE_DOCTOR_PORTRAITS.map((url, idx) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setPhotoUrl(url)}
                    className={`relative rounded-lg overflow-hidden border-2 transition ${photoUrl === url ? "border-teal-600 ring-2 ring-teal-400" : "border-slate-200 hover:border-teal-400"}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt={`Mẫu ${idx + 1}`} src={url} className="w-full h-12 object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Cột phải: Form cập nhật Tiểu sử, Thành tựu & Mật khẩu */}
          <div className="lg:col-span-2 space-y-6">
            {/* Panel 1: Tiểu sử & Thành tựu */}
            <section className="portal-panel portal-panel--secondary">
              <div className="portal-panel__heading">
                <div>
                  <h2 className="text-lg font-bold text-teal-950 flex items-center gap-2">
                    <UiIcon name="stethoscope" size={20} />
                    <span>Tiểu sử & Thành tựu Chuyên môn</span>
                  </h2>
                  <p className="portal-panel__subheading">Thông tin này sẽ được hiển thị công khai trên trang giới thiệu bác sĩ cho bệnh nhân</p>
                </div>
              </div>

              <form className="portal-clinical-form" onSubmit={handleSaveProfile}>
                <div className="space-y-4">
                  <div>
                    <label className="font-semibold text-slate-800 text-sm block mb-1">
                      Đường dẫn ảnh đại diện (Portrait URL)
                    </label>
                    <input
                      type="text"
                      maxLength={500}
                      value={photoUrl}
                      onChange={(e) => setPhotoUrl(e.target.value)}
                      placeholder="Ví dụ: /media/doctors/doctor-1.jpg hoặc link ảnh ngoài"
                      className="w-full text-sm"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-800 text-sm block mb-1">
                      Tiểu sử lâm sàng chi tiết (Clinical Biography)
                    </label>
                    <textarea
                      rows={6}
                      maxLength={4000}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Mô tả quá trình đào tạo, học vị, các bệnh viện từng công tác và phương châm y đức phục vụ người bệnh..."
                      className="w-full text-sm leading-relaxed"
                    />
                    <span className="text-xs text-slate-500 mt-1 block text-right">{bio.length} / 4000 ký tự</span>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-800 text-sm block mb-1">
                      Thành tựu, Giải thưởng & Cột mốc nổi bật (Key Achievements)
                    </label>
                    <textarea
                      rows={5}
                      value={achievements}
                      onChange={(e) => setAchievements(e.target.value)}
                      placeholder="Liệt kê các thành tựu nổi bật (mỗi ý một dòng), ví dụ:&#10;- Hơn 4.500 ca can thiệp mạch vành qua da (PCI) thành công&#10;- Chứng chỉ can thiệp tim mạch nâng cao Viện Tim mạch Quốc gia Singapore (NHCS)&#10;- Thầy thuốc Ưu tú năm 2022&#10;- Tác giả của 15 bài báo khoa học quốc tế về tim mạch"
                      className="w-full text-sm leading-relaxed"
                    />
                    <span className="text-xs text-slate-500 mt-1 block">Nên ghi dạng các gạch đầu dòng rõ ràng để bệnh nhân dễ dàng theo dõi.</span>
                  </div>
                </div>

                {profileNotice ? (
                  <p aria-live="polite" className={profileNotice.startsWith("Đã") ? "portal-inline-success mt-4" : "portal-inline-error mt-4"}>
                    {profileNotice}
                  </p>
                ) : null}

                <div className="mt-5">
                  <button className="button button--primary" disabled={savingProfile} type="submit">
                    {savingProfile ? "Đang lưu thông tin…" : "Lưu tiểu sử & thành tựu"}
                  </button>
                </div>
              </form>
            </section>

            {/* Panel 2: Đổi mật khẩu */}
            <section className="portal-panel portal-panel--secondary">
              <div className="portal-panel__heading">
                <div>
                  <h2 className="text-lg font-bold text-teal-950 flex items-center gap-2">
                    <UiIcon name="shield-check" size={20} />
                    <span>Bảo mật & Đổi mật khẩu</span>
                  </h2>
                  <p className="portal-panel__subheading">Thay đổi mật khẩu đăng nhập vào cổng bác sĩ</p>
                </div>
              </div>

              <form className="portal-clinical-form" onSubmit={handleChangePassword}>
                <div className="portal-clinical-form__grid">
                  <label>
                    Mật khẩu hiện tại *
                    <input
                      required
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm((v) => ({ ...v, currentPassword: e.target.value }))}
                      placeholder="Nhập mật khẩu đang dùng"
                    />
                  </label>
                  <label>
                    Mật khẩu mới *
                    <input
                      required
                      type="password"
                      minLength={8}
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm((v) => ({ ...v, newPassword: e.target.value }))}
                      placeholder="Tối thiểu 8 ký tự"
                    />
                  </label>
                  <label>
                    Xác nhận mật khẩu mới *
                    <input
                      required
                      type="password"
                      minLength={8}
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm((v) => ({ ...v, confirmPassword: e.target.value }))}
                      placeholder="Nhập lại mật khẩu mới"
                    />
                  </label>
                </div>

                {passwordNotice ? (
                  <p aria-live="polite" className={passwordNotice.startsWith("Đã") ? "portal-inline-success mt-4" : "portal-inline-error mt-4"}>
                    {passwordNotice}
                  </p>
                ) : null}

                <div className="mt-5">
                  <button className="outline-button" disabled={savingPassword} type="submit">
                    {savingPassword ? "Đang cập nhật…" : "Cập nhật mật khẩu"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        </div>
      </div>
    </PortalChrome>
  );
}
