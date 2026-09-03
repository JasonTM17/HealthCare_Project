"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
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
import styles from "./DoctorProfile.module.css";

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

  // Password states
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [savingPassword, setSavingPassword] = useState(false);

  // Toast Notification State
  const [toast, setToast] = useState<{ tone: "success" | "error"; title: string; message: string } | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (t: { tone: "success" | "error"; title: string; message: string }) => {
    clearTimeout(toastTimerRef.current ?? undefined);
    setToast(t);
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  useEffect(() => {
    return () => {
      clearTimeout(toastTimerRef.current ?? undefined);
    };
  }, []);

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
    try {
      const updated = await updateDoctorProfile({
        bio: bio.trim(),
        achievements: achievements.trim(),
        photoUrl: photoUrl.trim() || undefined,
      });
      setProfile(updated);
      showToast({
        tone: "success",
        title: "Đã lưu hồ sơ thành công",
        message: "Tiểu sử, ảnh đại diện và thành tựu chuyên môn đã được cập nhật thành công.",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Không thể cập nhật hồ sơ bác sĩ.";
      showToast({
        tone: "error",
        title: "Cập nhật hồ sơ thất bại",
        message: msg,
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showToast({
        tone: "error",
        title: "Đổi mật khẩu thất bại",
        message: "Mật khẩu mới và xác nhận mật khẩu không khớp.",
      });
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      showToast({
        tone: "error",
        title: "Đổi mật khẩu thất bại",
        message: "Mật khẩu mới phải có tối thiểu 8 ký tự.",
      });
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      showToast({
        tone: "success",
        title: "Đổi mật khẩu thành công",
        message: "Mật khẩu đăng nhập cổng bác sĩ đã được cập nhật thành công.",
      });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Không thể đổi mật khẩu.";
      showToast({
        tone: "error",
        title: "Đổi mật khẩu thất bại",
        message: msg,
      });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <PortalChrome role="DOCTOR" user={session.user}>
      <div className={styles.container}>
        {/* Header Title */}
        <header className="portal-hero mb-6">
          <div>
            <p className="section-note">HỒ SƠ BÁC SĨ CHUYÊN KHOA</p>
            <h1 className="text-2xl font-black text-teal-950 tracking-tight">
              Hồ sơ Bác sĩ & Cài đặt Tài khoản
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Quản lý ảnh đại diện, tiểu sử lâm sàng, thành tựu chuyên môn và bảo mật đăng nhập cổng y tế.
            </p>
          </div>
        </header>

        {loadError ? (
          <div className="portal-inline-error mb-6" role="alert">{loadError}</div>
        ) : null}

        <div className={styles.profileGrid}>
          {/* Cột trái: Tóm tắt thông tin & Ảnh chân dung */}
          <aside className={styles.doctorCard}>
            <div className={styles.avatarWrapper}>
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={profile?.fullName ?? session.user.displayName}
                  className={styles.avatarImg}
                  src={photoUrl}
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              ) : (
                <div className={styles.avatarFallback}>
                  {session.user.displayName ? session.user.displayName.charAt(0).toUpperCase() : "BS"}
                </div>
              )}
            </div>

            <h2 className={styles.doctorName}>{profile?.fullName ?? session.user.displayName}</h2>
            <p className={styles.doctorSpecialty}>
              <UiIcon name="stethoscope" size={15} />
              <span>{profile?.specialtyName ?? "Bác sĩ chuyên khoa"}</span>
            </p>
            <p className={styles.doctorEmail}>{session.user.email}</p>

            <div className={styles.doctorMetaList}>
              {profile?.branchNames && profile.branchNames.length > 0 ? (
                <div>
                  <span className={styles.metaLabel}>Cơ sở làm việc:</span>
                  <span className={styles.metaValue}>{profile.branchNames.join(", ")}</span>
                </div>
              ) : null}
              {profile?.specialtySlugs && profile.specialtySlugs.length > 0 ? (
                <div>
                  <span className={styles.metaLabel}>Mã chuyên khoa:</span>
                  <span className={styles.metaValue}>{profile.specialtySlugs.join(", ")}</span>
                </div>
              ) : null}
            </div>

            {/* Gợi ý ảnh chân dung chuẩn */}
            <div className={styles.samplePortraitsSection}>
              <span className={styles.samplePortraitsTitle}>Chọn nhanh ảnh chân dung bệnh viện:</span>
              <div className={styles.samplePortraitsGrid}>
                {SAMPLE_DOCTOR_PORTRAITS.map((url, idx) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setPhotoUrl(url)}
                    className={`${styles.samplePortraitBtn} ${photoUrl === url ? styles.samplePortraitBtnSelected : ""}`}
                    title={`Chọn ảnh mẫu ${idx + 1}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt={`Mẫu ${idx + 1}`} src={url} className={styles.samplePortraitImg} />
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Cột phải: Form cập nhật Tiểu sử, Thành tựu & Mật khẩu */}
          <main className="space-y-6">
            {/* Form 1: Tiểu sử & Thành tựu */}
            <form className={styles.formCard} onSubmit={handleSaveProfile}>
              <div className={styles.cardHeader}>
                <div className={styles.cardHeaderIcon}>
                  <UiIcon name="stethoscope" size={20} />
                </div>
                <div>
                  <h3 className={styles.cardTitle}>Tiểu sử & Thành tựu Chuyên môn</h3>
                  <p className={styles.cardSubtitle}>Thông tin hiển thị công khai trên cổng giới thiệu bác sĩ cho người bệnh</p>
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="photoUrl">
                  Đường dẫn ảnh đại diện (Portrait URL)
                </label>
                <input
                  id="photoUrl"
                  type="text"
                  maxLength={500}
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="Ví dụ: /media/doctors/doctor-5.jpg hoặc link ảnh bên ngoài"
                  className={styles.inputField}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="bio">
                  Tiểu sử lâm sàng chi tiết (Clinical Biography)
                </label>
                <textarea
                  id="bio"
                  rows={6}
                  maxLength={4000}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Mô tả quá trình đào tạo, học vị, các bệnh viện từng công tác và phương châm y đức phục vụ người bệnh..."
                  className={styles.textareaField}
                />
                <div className={styles.charCount}>{bio.length} / 4000 ký tự</div>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="achievements">
                  Thành tựu, Giải thưởng & Cột mốc nổi bật (Key Achievements)
                </label>
                <textarea
                  id="achievements"
                  rows={5}
                  value={achievements}
                  onChange={(e) => setAchievements(e.target.value)}
                  placeholder="Liệt kê các thành tựu nổi bật (mỗi ý một dòng), ví dụ:&#10;- Hơn 4.500 ca can thiệp mạch vành qua da (PCI) thành công&#10;- Chứng chỉ can thiệp tim mạch nâng cao Viện Tim mạch Quốc gia Singapore (NHCS)&#10;- Thầy thuốc Ưu tú năm 2022&#10;- Tác giả của 15 bài báo khoa học quốc tế về tim mạch"
                  className={styles.textareaField}
                />
                <div className={styles.fieldHelper}>Nên ghi dạng các gạch đầu dòng rõ ràng để người bệnh dễ dàng theo dõi.</div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                <button className={styles.submitBtn} disabled={savingProfile} type="submit">
                  <UiIcon name="shield-check" size={16} />
                  <span>{savingProfile ? "Đang lưu dữ liệu…" : "Lưu Tiểu Sử & Thành Tựu"}</span>
                </button>
              </div>
            </form>

            {/* Form 2: Đổi mật khẩu */}
            <form className={styles.formCard} onSubmit={handleChangePassword}>
              <div className={styles.cardHeader}>
                <div className={styles.cardHeaderIcon}>
                  <UiIcon name="shield-check" size={20} />
                </div>
                <div>
                  <h3 className={styles.cardTitle}>Bảo mật & Đổi Mật khẩu</h3>
                  <p className={styles.cardSubtitle}>Thay đổi mật khẩu đăng nhập vào cổng làm việc bác sĩ</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel} htmlFor="currentPassword">
                    Mật khẩu hiện tại *
                  </label>
                  <input
                    id="currentPassword"
                    required
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm((v) => ({ ...v, currentPassword: e.target.value }))}
                    placeholder="Mật khẩu hiện tại"
                    className={styles.inputField}
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel} htmlFor="newPassword">
                    Mật khẩu mới *
                  </label>
                  <input
                    id="newPassword"
                    required
                    type="password"
                    minLength={8}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm((v) => ({ ...v, newPassword: e.target.value }))}
                    placeholder="Tối thiểu 8 ký tự"
                    className={styles.inputField}
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel} htmlFor="confirmPassword">
                    Xác nhận mật khẩu *
                  </label>
                  <input
                    id="confirmPassword"
                    required
                    type="password"
                    minLength={8}
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm((v) => ({ ...v, confirmPassword: e.target.value }))}
                    placeholder="Nhập lại mật khẩu mới"
                    className={styles.inputField}
                  />
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                <button className={styles.secondaryBtn} disabled={savingPassword} type="submit">
                  {savingPassword ? "Đang xử lý…" : "Cập nhật Mật khẩu"}
                </button>
              </div>
            </form>
          </main>
        </div>

        {/* ── Fixed Green Corner Toast Notification ── */}
        {toast && (
          <div
            aria-live="polite"
            className={`${styles.toast} ${toast.tone === "success" ? styles.toastSuccess : styles.toastError}`}
            role="status"
          >
            <div className={`${styles.toastIcon} ${toast.tone === "error" ? styles.toastIconError : ""}`}>
              <UiIcon name={toast.tone === "success" ? "shield-check" : "alert-triangle"} size={16} />
            </div>
            <div className={styles.toastContent}>
              <h4 className={styles.toastTitle}>{toast.title}</h4>
              <p className={styles.toastMessage}>{toast.message}</p>
            </div>
            <button
              aria-label="Đóng thông báo"
              className={styles.toastClose}
              onClick={() => setToast(null)}
              type="button"
            >
              <UiIcon name="x" size={14} />
            </button>
            <div className={`${styles.toastProgress} ${toast.tone === "error" ? styles.toastProgressError : ""}`} />
          </div>
        )}
      </div>
    </PortalChrome>
  );
}
