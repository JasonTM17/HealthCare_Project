"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ApiError, hasRole, login } from "../../../lib/api-client";

function safeNextPath(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const session = await login({ email: email.trim(), password });
      const nextPath = safeNextPath(new URLSearchParams(window.location.search).get("next"));
      const target = hasRole(session.user, "PATIENT") && nextPath?.startsWith("/patient")
        ? nextPath
        : hasRole(session.user, "DOCTOR") && nextPath?.startsWith("/doctor")
          ? nextPath
          : hasRole(session.user, "PATIENT")
            ? "/patient/dashboard"
            : hasRole(session.user, "DOCTOR")
              ? "/doctor/dashboard"
              : "/";
      router.replace(target);
    } catch (error) {
      if (error instanceof ApiError && error.status >= 500) {
        setErrorMessage("Dịch vụ xác thực hiện chưa sẵn sàng. Vui lòng thử lại sau.");
      } else {
        setErrorMessage("Email hoặc mật khẩu chưa chính xác.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section aria-labelledby="login-title" className="auth-card">
        <Link className="auth-card__back" href="/">← Về trang chính</Link>
        <div className="auth-card__brand">
          <span aria-hidden="true" className="portal-brand__mark">+</span>
          <span>
            <strong>HealthCare</strong>
            <small>Đăng nhập an toàn</small>
          </span>
        </div>
        <p className="section-note">CỔNG THÔNG TIN CÁ NHÂN</p>
        <h1 id="login-title">Đăng nhập tài khoản</h1>
        <p className="auth-card__intro">
          Tài khoản được xác thực bởi máy chủ HealthCare. Không nhập thông tin y tế vào biểu mẫu này.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {errorMessage ? <p aria-live="assertive" className="auth-form__error" role="alert">{errorMessage}</p> : null}
          <div className="auth-form__field">
            <label htmlFor="login-email">Email</label>
            <input
              autoComplete="username"
              id="login-email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </div>
          <div className="auth-form__field">
            <label htmlFor="login-password">Mật khẩu</label>
            <input
              autoComplete="current-password"
              id="login-password"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </div>
          <button className="button button--primary auth-form__submit" disabled={submitting} type="submit">
            {submitting ? "Đang xác thực..." : "Đăng nhập"}
          </button>
        </form>

        <p className="auth-card__note">
          Chưa có tài khoản? Đăng ký hiện vẫn do backend quản lý; bản giao diện này chưa tự tạo tài khoản bác sĩ.
        </p>
      </section>
    </main>
  );
}
