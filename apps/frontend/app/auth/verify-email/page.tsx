"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import BrandMark from "../../../components/BrandMark";
import { hasRole, resendVerificationEmail, verifyEmail } from "../../../lib/api-client";
import { useRouter } from "next/navigation";
import { authErrorMessage, authFieldErrors, type AuthFieldErrors } from "../../../lib/auth-flow";

const RESEND_COOLDOWN_SECONDS = 30;

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [code, setCode] = useState(searchParams.get("code") ?? searchParams.get("token") ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [verified, setVerified] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);
    setMessage(null);
    setFieldErrors({});
    try {
      const session = await verifyEmail({ email: email.trim(), code: code.trim() });
      if (hasRole(session.user, "PATIENT")) {
        router.replace("/patient/dashboard");
      } else {
        router.replace("/");
      }
      setVerified(true);
    } catch (error) {
      setFieldErrors(authFieldErrors(error));
      setErrorMessage(authErrorMessage(error, "Mã xác minh chưa được chấp nhận. Vui lòng kiểm tra và thử lại."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!email.trim() || cooldown > 0 || resending) return;
    setResending(true);
    setErrorMessage(null);
    setMessage(null);
    try {
      await resendVerificationEmail({ email: email.trim() });
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setMessage("Mã xác minh mới đã được gửi.");
    } catch (error) {
      setErrorMessage(authErrorMessage(error, "Chưa thể gửi lại mã. Vui lòng thử lại."));
    } finally {
      setResending(false);
    }
  };

  return (
    <main className="auth-page">
      <section aria-labelledby="verify-email-title" className="auth-card">
        <Link className="auth-card__back" href="/auth/login">← Về đăng nhập</Link>
        <div className="auth-card__brand"><BrandMark tagline="Xác minh email" /></div>
        <p className="section-note">BẢO VỆ TÀI KHOẢN</p>
        <h1 id="verify-email-title">Xác minh email</h1>
        <p className="auth-card__intro">Nhập mã xác minh đã được gửi tới email đăng ký. Mã chỉ dùng một lần và có thời hạn.</p>

        {verified ? (
          <section aria-live="polite" className="auth-status auth-status--success" role="status">
            <span aria-hidden="true" className="auth-status__mark">✓</span>
            <div>
              <h2>Email đã được xác minh</h2>
              <p>Tài khoản bệnh nhân đã sẵn sàng. Đang mở cổng thông tin của bạn.</p>
              <Link className="button button--primary" href="/patient/dashboard">Mở cổng bệnh nhân</Link>
            </div>
          </section>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            {errorMessage ? <p aria-live="assertive" className="auth-form__error" role="alert">{errorMessage}</p> : null}
            {message ? <p aria-live="polite" className="auth-form__success" role="status">{message}</p> : null}
            <div className="auth-form__field">
              <label htmlFor="verify-email">Email</label>
              <input aria-describedby={fieldErrors.email ? "verify-email-error" : undefined} aria-invalid={Boolean(fieldErrors.email)} autoComplete="email" id="verify-email" name="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
              {fieldErrors.email ? <small className="auth-form__field-error" id="verify-email-error">{fieldErrors.email}</small> : null}
            </div>
            <div className="auth-form__field">
              <label htmlFor="verify-code">Mã xác minh</label>
              <input aria-describedby={fieldErrors.code ? "verify-code-error" : "verify-code-help"} aria-invalid={Boolean(fieldErrors.code)} autoComplete="one-time-code" id="verify-code" inputMode="numeric" maxLength={8} minLength={4} name="code" onChange={(event) => setCode(event.target.value)} pattern="[0-9A-Za-z-]+" required value={code} />
              {fieldErrors.code ? <small className="auth-form__field-error" id="verify-code-error">{fieldErrors.code}</small> : <small id="verify-code-help">Mã gồm 6 chữ số đã được gửi qua hòm thư email của bạn (kiểm tra cả mục Hộp thư đến và Spam).</small>}
            </div>
            <button className="button button--primary auth-form__submit" disabled={submitting} type="submit">
              {submitting ? "Đang xác minh..." : "Xác minh email"}
            </button>
            <button className="outline-button auth-form__secondary" disabled={resending || cooldown > 0 || !email.trim()} onClick={() => void handleResend()} type="button">
              {resending ? "Đang gửi..." : cooldown > 0 ? `Gửi lại sau ${cooldown}s` : "Gửi lại mã"}
            </button>
          </form>
        )}

        {errorMessage && errorMessage.includes("hết hạn") ? <p className="auth-card__note"><Link href="/auth/forgot-password">Yêu cầu email mới</Link></p> : null}
      </section>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<main className="auth-page"><div aria-live="polite" className="auth-route-loading" role="status">Đang mở xác minh email...</div></main>}>
      <VerifyEmailForm />
    </Suspense>
  );
}
