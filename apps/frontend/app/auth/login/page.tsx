"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import BrandMark from "../../../components/BrandMark";
import Icon from "../../../components/UiIcon";
import styles from "./login.module.css";
import { ApiError, hasRole, login } from "../../../lib/api-client";
import { authErrorMessage, authFieldErrors, safeAuthNextPath, type AuthFieldErrors } from "../../../lib/auth-flow";

interface DemoRoleInfo {
  role: string;
  label: string;
  icon: "user" | "stethoscope" | "shield-check";
  email: string;
  badge: string;
  badgeColor: string;
  badgeBorder: string;
  badgeText: string;
}

const DEMO_ROLES: readonly DemoRoleInfo[] = [
  {
    role: "PATIENT",
    label: "Bệnh nhân",
    icon: "user",
    email: "patient@healthcare.com",
    badge: "Quyền bệnh nhân: xem hồ sơ, đặt khám và Chatbot AI",
    badgeColor: "#ecfeff",
    badgeBorder: "#a5f3fc",
    badgeText: "#0e7490",
  },
  {
    role: "DOCTOR",
    label: "Bác sĩ",
    icon: "stethoscope",
    email: "doctor@healthcare.com",
    badge: "Quyền bác sĩ: quản lý lịch khám và tư vấn",
    badgeColor: "#f0fdf4",
    badgeBorder: "#bbf7d0",
    badgeText: "#15803d",
  },
  {
    role: "ADMIN",
    label: "Quản trị viên",
    icon: "shield-check",
    email: "admin@healthcare.com",
    badge: "Quyền quản trị: vận hành bác sĩ, cơ sở và hệ thống",
    badgeColor: "#f0fdfa",
    badgeBorder: "#99f6e4",
    badgeText: "#0f766e",
  },
] as const;

export default function LoginPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<string | null>("PATIENT");
  const [email, setEmail] = useState("patient@healthcare.com");
  const [password, setPassword] = useState("HealthCare@2026");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);

  const selectedRoleInfo = DEMO_ROLES.find((item) => item.role === selectedRole);

  const handleRoleSelect = (item: DemoRoleInfo) => {
    setSelectedRole(item.role);
    setEmail(item.email);
    setPassword("HealthCare@2026");
    setErrorMessage(null);
    setFieldErrors({});
  };

  const handleCustomInput = (field: "email" | "password", value: string) => {
    if (field === "email") {
      setEmail(value);
      const match = DEMO_ROLES.find((r) => r.email === value.trim().toLowerCase());
      setSelectedRole(match ? match.role : null);
    } else {
      setPassword(value);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);
    setFieldErrors({});
    setVerificationEmail(null);

    try {
      const session = await login({ email: email.trim(), password });
      const nextPath = safeAuthNextPath(new URLSearchParams(window.location.search).get("next"));
      const target = hasRole(session.user, "PATIENT") && nextPath?.startsWith("/patient")
        ? nextPath
        : hasRole(session.user, "DOCTOR") && nextPath?.startsWith("/doctor")
          ? nextPath
          : hasRole(session.user, "PATIENT")
            ? "/patient/dashboard"
            : hasRole(session.user, "DOCTOR")
              ? "/doctor/dashboard"
              : hasRole(session.user, "ADMIN")
                ? "/admin"
                : "/";
      router.replace(target);
    } catch (error) {
      setFieldErrors(authFieldErrors(error));
      if (error instanceof ApiError && error.code === "EMAIL_VERIFICATION_REQUIRED") {
        setVerificationEmail(email.trim());
        setErrorMessage("Email này chưa được xác minh. Hãy nhập mã trong email để tiếp tục.");
      } else {
        setErrorMessage(authErrorMessage(error, "Email hoặc mật khẩu chưa chính xác."));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className={`auth-page ${styles.page}`}>
      <a className="skip-link" href="#login-title">Bỏ qua điều hướng</a>
      <section aria-labelledby="login-title" className={`auth-card ${styles.card}`}>
        <Link className="auth-card__back" href="/">← Về trang chính</Link>
        <div className="auth-card__brand">
          <BrandMark tagline="Đăng nhập an toàn" />
        </div>
        <p className="section-note">CỔNG THÔNG TIN CÁ NHÂN</p>
        <h1 id="login-title">Đăng nhập tài khoản</h1>
        <p className="auth-card__intro">
          Tài khoản được xác thực bởi máy chủ HealthCare. Không nhập thông tin y tế vào biểu mẫu này.
        </p>

        {/* Modern Segmented Role Selector */}
        <div className={styles.roleGroup}
          aria-label="Chọn tài khoản kiểm thử"
          role="group"
        >
          {DEMO_ROLES.map((item) => {
            const active = selectedRole === item.role;
            return (
              <button
                aria-pressed={active}
                className={`${styles.roleButton} ${active ? styles.roleButtonActive : ""}`}
                key={item.role}
                onClick={() => handleRoleSelect(item)}
                type="button"
              >
                <Icon name={item.icon} size={17} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Role Info Pill */}
        {selectedRoleInfo ? (
          <div className={styles.roleBadge}>
            <span>{selectedRoleInfo.badge}</span>
            <span className={styles.rolePassword}>
              Mật khẩu mẫu: <code>HealthCare@2026</code>
            </span>
          </div>
        ) : null}

        <form className="auth-form" onSubmit={handleSubmit}>
          {errorMessage ? (
            <div aria-live="assertive" className="auth-form__error" role="alert">
              <p>{errorMessage}</p>
              {verificationEmail ? (
                <Link className="auth-form__error-link" href={`/auth/verify-email?email=${encodeURIComponent(verificationEmail)}`}>
                  Xác minh email
                </Link>
              ) : null}
            </div>
          ) : null}
          <div className="auth-form__field">
            <label htmlFor="login-email">Email</label>
            <input aria-describedby={fieldErrors.email ? "login-email-error" : undefined} aria-invalid={Boolean(fieldErrors.email)} autoComplete="username" id="login-email" name="email" onChange={(event) => handleCustomInput("email", event.target.value)} placeholder="ten@healthcare.com" required type="email" value={email} />
            {fieldErrors.email ? <small className="auth-form__field-error" id="login-email-error">{fieldErrors.email}</small> : null}
          </div>
          <div className="auth-form__field">
            <div className="auth-form__label-row">
              <label htmlFor="login-password">Mật khẩu</label>
              <Link href="/auth/forgot-password">Quên mật khẩu?</Link>
            </div>
            <div className={styles.passwordWrap}>
              <input aria-describedby={fieldErrors.password ? "login-password-error" : undefined} aria-invalid={Boolean(fieldErrors.password)} autoComplete="current-password" className={styles.passwordInput} id="login-password" name="password" onChange={(event) => handleCustomInput("password", event.target.value)} required type={showPassword ? "text" : "password"} value={password} />
              <button aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} className={styles.passwordToggle} onClick={() => setShowPassword(!showPassword)} type="button">
                <Icon name={showPassword ? "eye-off" : "eye"} size={18} />
              </button>
            </div>
            {fieldErrors.password ? <small className="auth-form__field-error" id="login-password-error">{fieldErrors.password}</small> : null}
          </div>
          <button className={`${styles.submit} button button--primary auth-form__submit`} disabled={submitting} type="submit">
            {submitting ? "Đang xác thực bảo mật..." : "Đăng nhập"}
          </button>
        </form>

        <div className={styles.register}>
          <span>Chưa có tài khoản bệnh nhân?</span>
          <Link className={styles.registerLink} href="/auth/register">Tạo tài khoản mới →</Link>
        </div>
      </section>
    </main>
  );
}
