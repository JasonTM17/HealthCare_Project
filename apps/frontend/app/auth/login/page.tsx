"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import BrandMark from "../../../components/BrandMark";
import { ApiError, hasRole, login } from "../../../lib/api-client";
import { authErrorMessage, authFieldErrors, safeAuthNextPath, type AuthFieldErrors } from "../../../lib/auth-flow";

const DEMO_ACCOUNTS = [
  { role: "ADMIN", label: "Quản trị viên (Admin)", email: "admin@healthcare.com" },
  { role: "DOCTOR", label: "Bác sĩ (Doctor)", email: "doctor@healthcare.com" },
  { role: "PATIENT", label: "Bệnh nhân (Patient)", email: "patient@healthcare.com" },
] as const;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);

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

        <div style={{
          margin: "1.25rem 0",
          padding: "0.85rem 1rem",
          background: "var(--color-paper-muted, #f0fdfa)",
          border: "1px solid var(--color-mint-light, #ccfbf1)",
          borderRadius: "10px"
        }}>
          <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.8rem", fontWeight: 700, color: "var(--color-teal-800, #0f766e)" }}>
            💡 Tài khoản kiểm thử nhanh (Dự án học tập):
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.role}
                type="button"
                onClick={() => {
                  setEmail(acc.email);
                  setPassword("HealthCare@2026");
                  setErrorMessage(null);
                }}
                style={{
                  padding: "0.35rem 0.65rem",
                  fontSize: "0.775rem",
                  fontWeight: 600,
                  background: "#ffffff",
                  border: "1px solid var(--color-teal-600, #0d9488)",
                  borderRadius: "6px",
                  color: "var(--color-teal-900, #0f766e)",
                  cursor: "pointer"
                }}
              >
                {acc.label}
              </button>
            ))}
          </div>
        </div>

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
              onChange={(event) => setEmail(event.target.value)}
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
            <input
              aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
              aria-invalid={Boolean(fieldErrors.password)}
              autoComplete="current-password"
              id="login-password"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
            {fieldErrors.password ? <small className="auth-form__field-error" id="login-password-error">{fieldErrors.password}</small> : null}
          </div>
          <button className="button button--primary auth-form__submit" disabled={submitting} type="submit">
            {submitting ? "Đang xác thực..." : "Đăng nhập"}
          </button>
        </form>

        <p className="auth-card__note">
          Chưa có tài khoản bệnh nhân? <Link href="/auth/register">Đăng ký tại đây</Link>. Tài khoản bác sĩ và quản trị viên do cơ sở y tế cấp.
        </p>
      </section>
    </main>
  );
}
