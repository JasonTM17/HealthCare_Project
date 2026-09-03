"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import BrandMark from "../../../components/BrandMark";
import { ApiError, hasRole, login } from "../../../lib/api-client";
import { authErrorMessage, authFieldErrors, safeAuthNextPath, type AuthFieldErrors } from "../../../lib/auth-flow";

interface DemoRoleInfo {
  role: string;
  label: string;
  icon: string;
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
    icon: "👤",
    email: "patient@healthcare.com",
    badge: "👤 Quyền Bệnh nhân: Xem hồ sơ, đặt khám & Chatbot AI",
    badgeColor: "#ecfeff",
    badgeBorder: "#a5f3fc",
    badgeText: "#0e7490",
  },
  {
    role: "DOCTOR",
    label: "Bác sĩ",
    icon: "🩺",
    email: "doctor@healthcare.com",
    badge: "🩺 Quyền Bác sĩ: BS. Lê Quốc Hà - Quản lý lịch khám & tư vấn",
    badgeColor: "#f0fdf4",
    badgeBorder: "#bbf7d0",
    badgeText: "#15803d",
  },
  {
    role: "ADMIN",
    label: "Quản trị viên",
    icon: "🛡️",
    email: "admin@healthcare.com",
    badge: "🛡️ Quyền Quản trị: Quản trị bác sĩ, cơ sở & vận hành hệ thống",
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
    <main className="auth-page">
      <a className="skip-link" href="#login-title">Bỏ qua điều hướng</a>
      <section aria-labelledby="login-title" className="auth-card">
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
        <div
          aria-label="Chọn tài khoản kiểm thử"
          role="group"
          style={{
            margin: "1.25rem 0 0.85rem",
            padding: "0.25rem",
            background: "#f1f5f9",
            borderRadius: "12px",
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "4px",
          }}
        >
          {DEMO_ROLES.map((item) => {
            const active = selectedRole === item.role;
            return (
              <button
                aria-pressed={active}
                key={item.role}
                onClick={() => handleRoleSelect(item)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.35rem",
                  padding: "0.55rem 0.25rem",
                  fontSize: "0.8rem",
                  fontWeight: active ? 700 : 500,
                  color: active ? "#0f766e" : "#64748b",
                  background: active ? "#ffffff" : "transparent",
                  border: active ? "1px solid rgba(15, 118, 110, 0.18)" : "1px solid transparent",
                  borderRadius: "8px",
                  boxShadow: active ? "0 2px 6px rgba(0, 0, 0, 0.06)" : "none",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                type="button"
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Role Info Pill */}
        {selectedRoleInfo ? (
          <div
            style={{
              marginBottom: "1.25rem",
              padding: "0.55rem 0.85rem",
              background: selectedRoleInfo.badgeColor,
              border: `1px solid ${selectedRoleInfo.badgeBorder}`,
              borderRadius: "8px",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.25rem",
              fontSize: "0.775rem",
              color: selectedRoleInfo.badgeText,
              fontWeight: 600,
            }}
          >
            <span>{selectedRoleInfo.badge}</span>
            <span style={{ opacity: 0.8, fontSize: "0.725rem", fontWeight: 500 }}>
              (Pass: <code>HealthCare@2026</code>)
            </span>
          </div>
        ) : null}

        <form className="auth-form" onSubmit={handleSubmit}>
          {errorMessage ? (
            <div aria-live="assertive" className="auth-form__error" role="alert">
              <p>{errorMessage}</p>
              {verificationEmail ? (
                <Link
                  className="auth-form__error-link"
                  href={`/auth/verify-email?email=${encodeURIComponent(verificationEmail)}`}
                >
                  Xác minh email
                </Link>
              ) : null}
            </div>
          ) : null}
          <div className="auth-form__field">
            <label htmlFor="login-email">Email</label>
            <input
              aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
              aria-invalid={Boolean(fieldErrors.email)}
              autoComplete="username"
              id="login-email"
              name="email"
              onChange={(event) => handleCustomInput("email", event.target.value)}
              placeholder="ten@healthcare.com"
              required
              type="email"
              value={email}
            />
            {fieldErrors.email ? <small className="auth-form__field-error" id="login-email-error">{fieldErrors.email}</small> : null}
          </div>
          <div className="auth-form__field">
            <div className="auth-form__label-row">
              <label htmlFor="login-password">Mật khẩu</label>
              <Link href="/auth/forgot-password">Quên mật khẩu?</Link>
            </div>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <input
                aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
                aria-invalid={Boolean(fieldErrors.password)}
                autoComplete="current-password"
                id="login-password"
                name="password"
                onChange={(event) => handleCustomInput("password", event.target.value)}
                required
                style={{ width: "100%", paddingRight: "2.75rem" }}
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <button
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "0.5rem",
                  background: "transparent",
                  border: "none",
                  padding: "0.35rem",
                  cursor: "pointer",
                  color: "#64748b",
                  fontSize: "1rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                type="button"
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
            {fieldErrors.password ? <small className="auth-form__field-error" id="login-password-error">{fieldErrors.password}</small> : null}
          </div>
          <button
            className="button button--primary auth-form__submit"
            disabled={submitting}
            style={{
              minHeight: "48px",
              fontWeight: 700,
              fontSize: "0.95rem",
              borderRadius: "10px",
              cursor: submitting ? "not-allowed" : "pointer",
              transition: "all 0.15s ease",
            }}
            type="submit"
          >
            {submitting ? "Đang xác thực bảo mật..." : "Đăng nhập vào hệ thống →"}
          </button>
        </form>

        <div
          style={{
            marginTop: "1.5rem",
            paddingTop: "1.25rem",
            borderTop: "1px solid var(--color-line, #e2e8f0)",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
            fontSize: "0.85rem",
            color: "var(--color-ink-muted, #64748b)",
          }}
        >
          <span>Chưa có tài khoản bệnh nhân?</span>
          <Link
            href="/auth/register"
            style={{
              fontWeight: 700,
              color: "#0f766e",
              background: "#f0fdfa",
              padding: "0.4rem 0.85rem",
              borderRadius: "8px",
              border: "1px solid #ccfbf1",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
            }}
          >
            Tạo tài khoản mới →
          </Link>
        </div>
      </section>
    </main>
  );
}
