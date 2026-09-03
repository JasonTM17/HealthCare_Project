"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import PortalChrome from "../../../components/PortalChrome";
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
import UiIcon, { type IconName } from "../../../components/UiIcon";
import styles from "./PatientProfile.module.css";

interface TierDefinition {
  label: string;
  sublabel: string;
  icon: IconName;
  maxCredits: number;
  perks: string;
  quotaDescription: string;
}

const TIER_META: Record<string, TierDefinition> = {
  VIP: {
    label: "Hội Viên VIP Đặc Quyền",
    sublabel: "Executive Health · Bác sĩ gia đình",
    icon: "sparkles",
    maxCredits: 300,
    perks: "Ưu tiên xếp lịch khám tức thì · 300 lượt Trợ lý AI y khoa chuyên sâu · Bác sĩ gia đình đồng hành trực tuyến.",
    quotaDescription: "Hạn mức cao cấp không giới hạn tính năng phân tích triệu chứng chuyên sâu.",
  },
  GOLD: {
    label: "Hội Viên Vàng (Gold Privilege)",
    sublabel: "Gold Healthcare · Ưu tiên điều phối",
    icon: "shield-check",
    maxCredits: 100,
    perks: "Ưu tiên điều phối tư vấn từ xa · 100 lượt Trợ lý AI y khoa · Nhắc lịch tái khám & xét nghiệm định kỳ.",
    quotaDescription: "Tự động làm mới và duy trì theo định kỳ hoạt động khám chữa bệnh.",
  },
  SILVER: {
    label: "Hội Viên Bạc (Silver Member)",
    sublabel: "Silver Health · Hồ sơ số vĩnh viễn",
    icon: "shield-check",
    maxCredits: 50,
    perks: "50 lượt Trợ lý AI y khoa · Lưu trữ hồ sơ bệnh án không giới hạn thời gian trên nền tảng y tế số.",
    quotaDescription: "Được cấp định kỳ theo chính sách chăm sóc sức khỏe khách hàng thân thiết.",
  },
  STANDARD: {
    label: "Hội Viên Tiêu Chuẩn",
    sublabel: "Standard Care · Chăm sóc cơ bản",
    icon: "shield-check",
    maxCredits: 20,
    perks: "20 lượt Trợ lý AI y khoa cơ bản · Đặt lịch khám, quản lý toa thuốc điện tử và tra cứu xét nghiệm.",
    quotaDescription: "Cấp mặc định cho toàn bộ tài khoản người bệnh đăng ký tại bệnh viện.",
  },
};

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "CHƯA XÁC ĐỊNH"];

export default function PatientProfilePage() {
  const session = useAuthSession();
  const status = useAuthSessionStatus();
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form states
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState<PatientGender>("UNSPECIFIED");
  const [avatarUrl, setAvatarUrl] = useState("");
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

  // Corner Toast Notification State
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
        setAvatarUrl(data.avatarUrl || "");
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
          title="Không có quyền truy cập"
          description="Khu vực hồ sơ này chỉ dành cho tài khoản bệnh nhân."
        />
      </main>
    );
  }

  const tierKey = (profile?.patientTier || "STANDARD").toUpperCase();
  const tierInfo = TIER_META[tierKey] || TIER_META.STANDARD;
  const currentCredits = profile?.aiCredits ?? 20;
  const creditPercent = Math.min(100, Math.max(5, Math.round((currentCredits / tierInfo.maxCredits) * 100)));
  const patientCode = `PAT-2026-${(profile?.id || session.user.id || "882910").slice(-6).toUpperCase()}`;

  const handleSaveProfile = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileNotice(null);
    try {
      const updated = await updatePatientProfile({
        fullName: fullName.trim(),
        dateOfBirth: dateOfBirth || undefined,
        gender,
        avatarUrl: avatarUrl.trim() || undefined,
        address: address.trim() || undefined,
        emergencyContactName: emergencyContactName.trim() || undefined,
        emergencyContactPhone: emergencyContactPhone.trim() || undefined,
        bloodType: bloodType.trim() || undefined,
        medicalHistory: medicalHistory.trim() || undefined,
        allergies: allergies.trim() || undefined,
      });
      setProfile(updated);
      setProfileNotice({ tone: "success", text: "Hồ sơ sức khỏe cá nhân đã được lưu thành công vào cơ sở dữ liệu y tế." });
      showToast({
        tone: "success",
        title: "Đã lưu hồ sơ thành công",
        message: "Hồ sơ sức khỏe cá nhân đã được lưu thành công vào cơ sở dữ liệu y tế.",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Không thể lưu thông tin hồ sơ.";
      setProfileNotice({ tone: "error", text: msg });
      showToast({
        tone: "error",
        title: "Lưu hồ sơ thất bại",
        message: msg,
      });
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
      setPasswordNotice({ tone: "error", text: "Mật khẩu mới phải có tối thiểu 8 ký tự." });
      return;
    }
    setSavingPassword(true);
    setPasswordNotice(null);
    try {
      const res = await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordNotice({ tone: "success", text: res.message || "Đã cập nhật mật khẩu tài khoản thành công!" });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      showToast({
        tone: "success",
        title: "Đổi mật khẩu thành công",
        message: res.message || "Mật khẩu mới của bạn đã được cập nhật thành công!",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Không thể đổi mật khẩu.";
      setPasswordNotice({ tone: "error", text: msg });
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
    <PortalChrome role="PATIENT" user={session.user}>
      <div className={styles.profileContainer}>
        {/* Page Hero Title */}
        <header className="portal-hero mb-6">
          <div>
            <p className="section-note">HỒ SƠ BỆNH NHÂN & THẺ HỘI VIÊN SỐ</p>
            <h1 className="text-2xl font-black text-teal-950 tracking-tight">
              Hồ sơ Sức khỏe & Tài khoản Người bệnh
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Quản lý định danh y tế, phân hạng hội viên số, hạn mức Trợ lý AI và cập nhật tiền sử lâm sàng cá nhân.
            </p>
          </div>
        </header>

        {loadError && (
          <div className="portal-inline-error mb-6" role="alert">
            {loadError}
          </div>
        )}

        {/* ── 1. Digital Hospital Health Passport (Thẻ Bệnh Nhân & Hội Viên Y Tế Số) ── */}
        <section
          aria-label="Thẻ Bệnh Nhân & Hội Viên Y Tế Số"
          className={styles.passportCard}
          data-tier={tierKey}
        >
          {/* Subtle medical watermark in background */}
          <div className={styles.passportWatermark} aria-hidden="true">
            <UiIcon name="activity" size={240} />
          </div>

          <div className={styles.passportTop}>
            <div className={styles.passportBrand}>
              <UiIcon name="shield-check" size={18} />
              <span>HealthCare Hospital System · Thẻ Bệnh Nhân Số</span>
            </div>

            <div className={styles.securityChip}>
              <div className={styles.chipSvg} title="Smart Chip Y Tế Số" />
              <span className={styles.tierPill} data-tier={tierKey}>
                <UiIcon name={tierInfo.icon} size={13} />
                <span>{tierInfo.label}</span>
              </span>
            </div>
          </div>

          <div className={styles.passportBody}>
            <div className={styles.patientAvatarWrapper}>
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={fullName || session.user.displayName}
                  className={styles.patientAvatar}
                  src={avatarUrl}
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              ) : (
                <div className={styles.patientAvatar}>
                  <span>{fullName ? fullName.charAt(0).toUpperCase() : "BN"}</span>
                </div>
              )}
            </div>

            <div className={styles.patientMeta}>
              <h2>{fullName || session.user.displayName}</h2>
              <div className={styles.patientIdTag}>
                <span>MÃ ĐỊNH DANH:</span>
                <span className={styles.patientCodeBadge}>{patientCode}</span>
                <span>·</span>
                <span>NHÓM MÁU: <strong>{bloodType || "CHƯA XÁC ĐỊNH"}</strong></span>
                <span>·</span>
                <span>{tierInfo.sublabel}</span>
              </div>
              <p className={styles.passportPerks}>{tierInfo.perks}</p>
            </div>

            <div className={styles.creditMeter}>
              <div className={styles.creditMeterLabel}>
                <span>Trợ lý AI Y khoa</span>
                <span>
                  <strong className={styles.creditNumbers}>{currentCredits}</strong>
                  <span className={styles.creditTotal}>/ {tierInfo.maxCredits} lượt</span>
                </span>
              </div>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${creditPercent}%` }}
                />
              </div>
              <p className="text-[11px] text-white/70 mt-1 m-0">
                {tierInfo.quotaDescription}
              </p>
            </div>
          </div>
        </section>

        {/* ── 2. Two-Column Clinical Layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Clinical & Personal Forms (8 columns) */}
          <div className="lg:col-span-8 space-y-6">
            <form className={styles.clinicalCard} onSubmit={handleSaveProfile}>
              {/* Section 1: Demographics */}
              <div className={styles.sectionHeader}>
                <div className={styles.sectionHeaderIcon}>
                  <UiIcon name="user" size={20} />
                </div>
                <div>
                  <h3>1. Thông tin Định danh & Liên lạc</h3>
                  <p className={styles.sectionHeaderSub}>
                    Dữ liệu hành chính dùng cho việc xuất hồ sơ bệnh án và xác minh bảo hiểm y tế.
                  </p>
                </div>
              </div>

              {profileNotice && (
                <div
                  className={`p-4 rounded-lg mb-5 text-sm font-semibold border ${
                    profileNotice.tone === "success"
                      ? "bg-teal-50 border-teal-300 text-teal-950"
                      : "bg-red-50 border-red-300 text-red-900"
                  }`}
                  role="alert"
                >
                  {profileNotice.text}
                </div>
              )}

              <div className={styles.fieldGrid}>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel} htmlFor="fullName">
                    Họ và tên bệnh nhân *
                  </label>
                  <input
                    className={styles.inputField}
                    id="fullName"
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nguyễn Văn An"
                    required
                    type="text"
                    value={fullName}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel} htmlFor="dateOfBirth">
                    Ngày sinh (DD/MM/YYYY)
                  </label>
                  <input
                    className={styles.inputField}
                    id="dateOfBirth"
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    type="date"
                    value={dateOfBirth}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel} htmlFor="gender">
                    Giới tính
                  </label>
                  <select
                    className={styles.inputField}
                    id="gender"
                    onChange={(e) => setGender(e.target.value as PatientGender)}
                    value={gender}
                  >
                    <option value="MALE">Nam</option>
                    <option value="FEMALE">Nữ</option>
                    <option value="OTHER">Khác</option>
                    <option value="UNSPECIFIED">Chưa xác định</option>
                  </select>
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel} htmlFor="avatarUrl">
                    Ảnh chân dung (Đường dẫn URL)
                  </label>
                  <input
                    className={styles.inputField}
                    id="avatarUrl"
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://example.com/avatar.jpg"
                    type="url"
                    value={avatarUrl}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel} htmlFor="phone">
                    Số điện thoại xác thực (Cố định OTP)
                  </label>
                  <input
                    className={`${styles.inputField} ${styles.inputFieldReadOnly}`}
                    id="phone"
                    readOnly
                    title="Thông tin xác thực SMS. Để thay đổi, vui lòng liên hệ quầy tiếp tân."
                    type="tel"
                    value={phone || "Chưa cập nhật"}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel} htmlFor="email">
                    Email đăng nhập tài khoản
                  </label>
                  <input
                    className={`${styles.inputField} ${styles.inputFieldReadOnly}`}
                    id="email"
                    readOnly
                    title="Email xác thực tài khoản bệnh viện số."
                    type="email"
                    value={email || session.user.email}
                  />
                </div>

                <div className={`${styles.inputGroup} ${styles.fieldGridFull}`}>
                  <label className={styles.inputLabel} htmlFor="address">
                    Địa chỉ thường trú / Cư trú hiện tại
                  </label>
                  <input
                    className={styles.inputField}
                    id="address"
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành phố..."
                    type="text"
                    value={address}
                  />
                </div>
              </div>

              {/* Section 2: Clinical Alert Registry */}
              <div className={`${styles.sectionHeader} mt-8`}>
                <div className={styles.sectionHeaderIcon}>
                  <UiIcon name="activity" size={20} />
                </div>
                <div>
                  <h3>2. Hồ sơ Lâm sàng & Cảnh báo An toàn Điều trị</h3>
                  <p className={styles.sectionHeaderSub}>
                    Bác sĩ chuyên khoa sẽ đối soát thông tin này trước khi chỉ định cận lâm sàng và kê đơn thuốc.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel} htmlFor="bloodType">
                    Nhóm máu (Hệ thống ABO & Rhesus)
                  </label>
                  <select
                    className={styles.inputField}
                    id="bloodType"
                    onChange={(e) => setBloodType(e.target.value)}
                    value={bloodType || "CHƯA XÁC ĐỊNH"}
                  >
                    {BLOOD_TYPES.map((bt) => (
                      <option key={bt} value={bt}>
                        {bt === "CHƯA XÁC ĐỊNH" ? "-- Chọn nhóm máu --" : `Nhóm máu ${bt}`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Critical Allergy Alert Container */}
                <div className={styles.allergyAlertBox}>
                  <div className={styles.allergyAlertHeader}>
                    <UiIcon name="alert-triangle" size={18} />
                    <span>CẢNH BÁO DỊ ỨNG THUỐC & THỰC PHẨM (BÁC SĨ ĐỐI SOÁT KHI KÊ ĐƠN)</span>
                  </div>
                  <textarea
                    className={styles.textareaField}
                    id="allergies"
                    onChange={(e) => setAllergies(e.target.value)}
                    placeholder="Ghi rõ tên thuốc (ví dụ: Penicillin, Aspirin, Cephalosporin), thức ăn hoặc dị nguyên có tiền sử sốc/dị ứng..."
                    rows={2}
                    value={allergies}
                  />
                  <p className="text-xs text-amber-800 m-0">
                    * Bệnh nhân có tiền sử phản vệ hoặc dị ứng kháng sinh bắt buộc phải ghi rõ để đảm bảo an toàn tính mạng.
                  </p>
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel} htmlFor="medicalHistory">
                    Tiền sử bệnh lý bản thân & Gia đình (Bệnh mạn tính, phẫu thuật trước đây)
                  </label>
                  <textarea
                    className={styles.textareaField}
                    id="medicalHistory"
                    onChange={(e) => setMedicalHistory(e.target.value)}
                    placeholder="Ví dụ: Tăng huyết áp 5 năm đang dùng thuốc, Đái tháo đường type 2, tiền sử phẫu thuật ruột thừa năm 2020..."
                    rows={3}
                    value={medicalHistory}
                  />
                </div>
              </div>

              {/* Section 3: Emergency Contacts */}
              <div className={`${styles.sectionHeader} mt-8`}>
                <div className={styles.sectionHeaderIcon}>
                  <UiIcon name="phone" size={20} />
                </div>
                <div>
                  <h3>3. Thông tin Liên hệ Khẩn cấp</h3>
                  <p className={styles.sectionHeaderSub}>
                    Bệnh viện sẽ liên lạc với người thân trong trường hợp khẩn cấp hoặc cần hỗ trợ y tế đặc biệt.
                  </p>
                </div>
              </div>

              <div className={styles.fieldGrid}>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel} htmlFor="emergencyContactName">
                    Họ và tên người thân / Người giám hộ
                  </label>
                  <input
                    className={styles.inputField}
                    id="emergencyContactName"
                    onChange={(e) => setEmergencyContactName(e.target.value)}
                    placeholder="Ví dụ: Nguyễn Thị Mai (Vợ/Mẹ)"
                    type="text"
                    value={emergencyContactName}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel} htmlFor="emergencyContactPhone">
                    Số điện thoại liên hệ khẩn cấp
                  </label>
                  <input
                    className={styles.inputField}
                    id="emergencyContactPhone"
                    onChange={(e) => setEmergencyContactPhone(e.target.value)}
                    placeholder="0912 345 678"
                    type="tel"
                    value={emergencyContactPhone}
                  />
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-200 flex justify-end">
                <button
                  className={styles.submitButton}
                  disabled={savingProfile}
                  type="submit"
                >
                  <UiIcon name="shield-check" size={16} />
                  <span>{savingProfile ? "Đang lưu dữ liệu..." : "Lưu Thay Đổi Hồ Sơ Y Tế"}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Sidebar Panels: Security & Member Policy (4 columns) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Account Security Card */}
            <form className={styles.clinicalCard} onSubmit={handleChangePassword}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionHeaderIcon}>
                  <UiIcon name="shield-check" size={18} />
                </div>
                <div>
                  <h3>Bảo mật & Đổi Mật khẩu</h3>
                  <p className={styles.sectionHeaderSub}>Bảo vệ dữ liệu bệnh án điện tử</p>
                </div>
              </div>

              {passwordNotice && (
                <div
                  className={`p-3 rounded-md mb-4 text-xs font-semibold border ${
                    passwordNotice.tone === "success"
                      ? "bg-teal-50 border-teal-300 text-teal-950"
                      : "bg-red-50 border-red-300 text-red-900"
                  }`}
                  role="alert"
                >
                  {passwordNotice.text}
                </div>
              )}

              <div className="space-y-3">
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel} htmlFor="currentPassword">
                    Mật khẩu hiện tại *
                  </label>
                  <input
                    className={styles.inputField}
                    id="currentPassword"
                    onChange={(e) =>
                      setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))
                    }
                    required
                    type="password"
                    value={passwordForm.currentPassword}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel} htmlFor="newPassword">
                    Mật khẩu mới (Tối thiểu 8 ký tự) *
                  </label>
                  <input
                    className={styles.inputField}
                    id="newPassword"
                    onChange={(e) =>
                      setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))
                    }
                    required
                    type="password"
                    value={passwordForm.newPassword}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel} htmlFor="confirmPassword">
                    Xác nhận mật khẩu mới *
                  </label>
                  <input
                    className={styles.inputField}
                    id="confirmPassword"
                    onChange={(e) =>
                      setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))
                    }
                    required
                    type="password"
                    value={passwordForm.confirmPassword}
                  />
                </div>

                <button
                  className={styles.secondaryButton}
                  disabled={savingPassword}
                  type="submit"
                >
                  {savingPassword ? "Đang xử lý..." : "Cập nhật Mật khẩu"}
                </button>
              </div>
            </form>

            {/* Member Tier Policy Overview Card */}
            <div className={styles.clinicalCard}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionHeaderIcon}>
                  <UiIcon name="sparkles" size={18} />
                </div>
                <div>
                  <h3>Quy chế Phân hạng Hội viên</h3>
                  <p className={styles.sectionHeaderSub}>Đặc quyền Trợ lý Y khoa Bệnh viện Số</p>
                </div>
              </div>

              <div className={styles.tierTable}>
                <div className={styles.tierRow}>
                  <div className={styles.tierName}>
                    <UiIcon name="shield-check" size={15} />
                    <span>Hội Viên Tiêu Chuẩn</span>
                  </div>
                  <span className={styles.tierQuotaBadge} data-tier="STANDARD">
                    20 lượt AI
                  </span>
                </div>

                <div className={styles.tierRow}>
                  <div className={styles.tierName}>
                    <UiIcon name="shield-check" size={15} />
                    <span>Hội Viên Bạc (Silver)</span>
                  </div>
                  <span className={styles.tierQuotaBadge} data-tier="SILVER">
                    50 lượt AI
                  </span>
                </div>

                <div className={styles.tierRow}>
                  <div className={styles.tierName}>
                    <UiIcon name="shield-check" size={15} />
                    <span>Hội Viên Vàng (Gold)</span>
                  </div>
                  <span className={styles.tierQuotaBadge} data-tier="GOLD">
                    100 lượt AI
                  </span>
                </div>

                <div className={styles.tierRow}>
                  <div className={styles.tierName}>
                    <UiIcon name="sparkles" size={15} />
                    <span>Hội Viên VIP Đặc Quyền</span>
                  </div>
                  <span className={styles.tierQuotaBadge} data-tier="VIP">
                    300 lượt AI
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 leading-relaxed">
                Phân hạng được tự động tính toán dựa trên tần suất khám chữa bệnh, lịch sử xét nghiệm và các chương trình chăm sóc sức khỏe toàn diện tại bệnh viện.
              </div>
            </div>

            {/* Clinical Trust & Emergency Banner */}
            <div className="p-4 rounded-xl border border-teal-200 bg-teal-50/70 text-xs text-teal-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-teal-950">
                <UiIcon name="shield-check" size={16} />
                <span>Bảo mật Dữ liệu Y tế Quốc gia</span>
              </div>
              <p className="m-0 leading-relaxed text-slate-600">
                Hồ sơ bệnh án điện tử tuân thủ quy định tại Thông tư 46/2018/TT-BYT của Bộ Y tế về quản lý và lưu trữ dữ liệu y tế an toàn.
              </p>
            </div>
          </div>
        </div>
      </div>
        {/* ── Fixed Green Corner Toast Notification ── */}
        {toast && (
          <div
            aria-live="polite"
            className={`${styles.toast} ${toast.tone === "success" ? styles.toastSuccess : styles.toastError}`}
            role="status"
          >
            <div
              className={`${styles.toastIcon} ${toast.tone === "error" ? styles.toastIconError : ""}`}
            >
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
            <div
              className={`${styles.toastProgress} ${toast.tone === "error" ? styles.toastProgressError : ""}`}
            />
          </div>
        )}
    </PortalChrome>
  );
}
