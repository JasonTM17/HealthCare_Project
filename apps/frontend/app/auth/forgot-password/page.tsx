"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { requestPasswordReset } from "../../../lib/api-client";
import { authErrorMessage, authFieldErrors, type AuthFieldErrors } from "../../../lib/auth-flow";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setSubmitted(false);
    setErrorMessage(null);
    setFieldErrors({});
    try {
      await requestPasswordReset({ email: email.trim() });
      setSubmitted(true);
    } catch (error) {
      setFieldErrors(authFieldErrors(error));
      setErrorMessage(authErrorMessage(error, "Chưa thể gửi yêu cầu đặt lại mật khẩu. Vui lòng thử lại."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section aria-labelledby="forgot-password-title" className="auth-card">
        <Link className="auth-card__back" href="/auth/login">← Về đăng nhập</Link>
        <div className="auth-card__brand"><span aria-hidden="true" className="portal-brand__mark">+</span><span><strong>HealthCare</strong><small>Khôi phục tài khoản</small></span></div>
        <p className="section-note">KHÔI PHỤC AN TOÀN</p>
        <h1 id="forgot-password-title">Quên mật khẩu?</h1>
        <p className="auth-card__intro">Nhập email đã đăng ký. Nếu tài khoản tồn tại, chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu.</p>

        {submitted ? (
          <section aria-live="polite" className="auth-status auth-status--success" role="status">
            <span aria-hidden="true" className="auth-status__mark">✓</span>
            <div>
              <h2>Kiểm tra hộp thư</h2>
              <p>Nếu email này thuộc về một tài khoản HealthCare, hướng dẫn đặt lại mật khẩu sẽ được gửi tới bạn. Liên kết chỉ dùng một lần và có thời hạn.</p>
              <div className="auth-status__actions">
                <Link className="button button--primary" href={`/auth/reset-password?email=${encodeURIComponent(email.trim())}`}>Nhập mã đặt lại</Link>
                <Link className="outline-button" href="/auth/login">Quay lại đăng nhập</Link>
              </div>
            </div>
          </section>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            {errorMessage ? <p aria-live="assertive" className="auth-form__error" role="alert">{errorMessage}</p> : null}
            <div className="auth-form__field">
              <label htmlFor="forgot-email">Email</label>
              <input aria-describedby={fieldErrors.email ? "forgot-email-error" : "forgot-email-help"} aria-invalid={Boolean(fieldErrors.email)} autoComplete="email" id="forgot-email" name="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
              {fieldErrors.email ? <small className="auth-form__field-error" id="forgot-email-error">{fieldErrors.email}</small> : <small id="forgot-email-help">Chúng tôi không tiết lộ email có tài khoản hay không.</small>}
            </div>
            <button className="button button--primary auth-form__submit" disabled={submitting} type="submit">
              {submitting ? "Đang gửi..." : "Gửi hướng dẫn"}
            </button>
          </form>
        )}
        <p className="auth-card__note">Nhớ mật khẩu? <Link href="/auth/login">Đăng nhập</Link>.</p>
      </section>
    </main>
  );
}
