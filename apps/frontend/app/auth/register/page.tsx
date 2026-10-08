"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import BrandMark from "../../../components/BrandMark";
import { isGoogleSignInEnabled } from "../../../components/GoogleSignInButton";
import GoogleSignInFlow from "../../../components/google-sign-in-flow";
import { register, resendVerificationEmail } from "../../../lib/api-client";
import { authErrorMessage, authFieldErrors, maskEmail, registrationPasswordError, REGISTRATION_PASSWORD_HELP, authSessionDestination, type AuthFieldErrors } from "../../../lib/auth-flow";

// Query-driven prefill (the /tra-cuu bridge appends ?phone=&email=) requires
// the same Suspense boundary pattern as the verify-email and reset-password
// routes.
function RegisterForm() {
  const searchParams = useSearchParams();
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState(searchParams.get("phone") ?? "");
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setResendCooldown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || googleBusy) return;
    const submitted = new FormData(event.currentTarget);
    const submittedDisplayName = String(submitted.get("displayName") ?? "");
    const submittedPhone = String(submitted.get("phone") ?? "");
    const submittedEmail = String(submitted.get("email") ?? "");
    const submittedPassword = String(submitted.get("password") ?? "");
    const submittedConfirmPassword = String(submitted.get("confirmPassword") ?? "");
    setDisplayName(submittedDisplayName);
    setPhone(submittedPhone);
    setEmail(submittedEmail);
    setPassword(submittedPassword);
    setConfirmPassword(submittedConfirmPassword);
    setErrorMessage(null);
    setFieldErrors({});
    setResendError(null);
    setResendMessage(null);
    const clientErrors: AuthFieldErrors = {};
    const passwordError = registrationPasswordError(submittedPassword);
    if (passwordError) clientErrors.password = passwordError;
    if (submittedPassword !== submittedConfirmPassword) clientErrors.confirmPassword = "Mật khẩu xác nhận chưa khớp.";
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      setErrorMessage("Vui lòng kiểm tra lại các trường được đánh dấu.");
      document.getElementById(passwordError ? "register-password" : "register-confirm")?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const pending = await register({
        displayName: submittedDisplayName.trim(),
        phone: submittedPhone.trim(),
        email: submittedEmail.trim(),
        password: submittedPassword,
      });
      setPendingEmail(pending.email);
      setResendCooldown(pending.resendAfterSeconds);
      setResendMessage("Mã xác minh đã được gửi. Kiểm tra cả thư mục thư rác nếu cần.");
    } catch (error) {
      setFieldErrors(authFieldErrors(error));
      setErrorMessage(authErrorMessage(error, "Chưa thể tạo tài khoản. Vui lòng thử lại."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!pendingEmail || resendCooldown > 0 || resending) return;
    setResending(true);
    setResendError(null);
    setResendMessage(null);
    try {
      await resendVerificationEmail({ email: pendingEmail });
      setResendCooldown(60);
      setResendMessage("Mã xác minh mới đã được gửi.");
    } catch (error) {
      setResendError(authErrorMessage(error, "Chưa thể gửi lại mã. Vui lòng thử lại."));
    } finally {
      setResending(false);
    }
  };

  return (
    <main className="auth-page">
      <section aria-labelledby="register-title" className="auth-card auth-card--wide">
        <Link className="auth-card__back" href="/auth/login">← Đã có tài khoản</Link>
        <div className="auth-card__brand"><BrandMark tagline="Tài khoản bệnh nhân" /></div>
        <p className="section-note">ĐĂNG KÝ AN TOÀN</p>
        <h1 id="register-title">Tạo tài khoản bệnh nhân</h1>
        <p className="auth-card__intro">Dùng đúng SĐT VÀ email bạn đã dùng khi đặt lịch (kể cả đặt với tư cách khách) để lịch cũ tự xuất hiện trong cổng.</p>

        {pendingEmail ? (
          <section aria-live="polite" className="auth-status auth-status--success" role="status">
            <span aria-hidden="true" className="auth-status__mark">✓</span>
            <div>
              <h2>Kiểm tra email để tiếp tục</h2>
              <p>Mã xác minh đã được gửi tới <strong>{maskEmail(pendingEmail)}</strong>. Tài khoản sẽ chưa đăng nhập cho đến khi email được xác minh.</p>
              {resendMessage ? <p className="auth-status__notice">{resendMessage}</p> : null}
              {resendError ? <p className="auth-status__error" role="alert">{resendError}</p> : null}
              <div className="auth-status__actions">
                <Link className="button button--primary" href={`/auth/verify-email?email=${encodeURIComponent(pendingEmail)}&resendAfterSeconds=${Math.max(resendCooldown, 0)}`}>Nhập mã xác minh</Link>
                <button className="outline-button" disabled={resending || resendCooldown > 0} onClick={() => void handleResend()} type="button">
                  {resending ? "Đang gửi..." : resendCooldown > 0 ? `Gửi lại sau ${resendCooldown}s` : "Gửi lại mã"}
                </button>
                <button className="text-button auth-status__edit" onClick={() => setPendingEmail(null)} type="button">Đổi thông tin</button>
              </div>
              <p style={{ margin: "0.75rem 0 0", fontSize: "0.8rem", color: "#0f766e" }}>
                Hệ thống đã gửi mã OTP 6 chữ số tới email của bạn. Vui lòng kiểm tra cả hộp thư Đến và mục Spam để lấy mã xác minh.
              </p>
              <p className="auth-card__note">Sau khi xác minh, bạn có thể <Link href="/auth/login?next=/patient/dashboard">đăng nhập vào cổng bệnh nhân</Link>.</p>
            </div>
          </section>
        ) : (
          <form autoComplete="on" className="auth-form" onSubmit={handleSubmit}>
            {errorMessage ? <p aria-live="assertive" className="auth-form__error" role="alert">{errorMessage}</p> : null}
            <div className="auth-form__field">
              <label htmlFor="register-name">Họ và tên</label>
              <input aria-describedby={fieldErrors.displayName ? "register-name-error" : undefined} aria-invalid={Boolean(fieldErrors.displayName)} autoComplete="name" id="register-name" maxLength={160} minLength={2} name="displayName" onChange={(event) => setDisplayName(event.target.value)} required value={displayName} />
              {fieldErrors.displayName ? <small className="auth-form__field-error" id="register-name-error">{fieldErrors.displayName}</small> : null}
            </div>
            <div className="auth-form__field">
              <label htmlFor="register-phone">Số điện thoại</label>
              <input aria-describedby={fieldErrors.phone ? "register-phone-error" : undefined} aria-invalid={Boolean(fieldErrors.phone)} autoComplete="tel" id="register-phone" maxLength={20} name="phone" onChange={(event) => setPhone(event.target.value)} pattern="[\\+0-9\\(\\) .\\-]*[0-9][\\+0-9\\(\\) .\\-]*" required type="tel" value={phone} />
              {fieldErrors.phone ? <small className="auth-form__field-error" id="register-phone-error">{fieldErrors.phone}</small> : null}
            </div>
            <div className="auth-form__field">
              <label htmlFor="register-email">Email</label>
              <input aria-describedby={fieldErrors.email ? "register-email-error" : undefined} aria-invalid={Boolean(fieldErrors.email)} autoComplete="email" id="register-email" maxLength={320} name="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
              {fieldErrors.email ? <small className="auth-form__field-error" id="register-email-error">{fieldErrors.email}</small> : null}
            </div>
            <div className="auth-form__field">
              <label htmlFor="register-password">Mật khẩu</label>
              <input aria-describedby={`register-password-help${fieldErrors.password ? " register-password-error" : ""}`} aria-invalid={Boolean(fieldErrors.password)} autoComplete="new-password" id="register-password" maxLength={128} minLength={8} name="password" onChange={(event) => { setPassword(event.target.value); setFieldErrors((current) => ({ ...current, password: undefined })); }} required type="password" value={password} />
              <small id="register-password-help">{REGISTRATION_PASSWORD_HELP}</small>
              {fieldErrors.password ? <small className="auth-form__field-error" id="register-password-error">{fieldErrors.password}</small> : null}
            </div>
            <div className="auth-form__field">
              <label htmlFor="register-confirm">Xác nhận mật khẩu</label>
              <input aria-describedby={fieldErrors.confirmPassword ? "register-confirm-error" : undefined} aria-invalid={Boolean(fieldErrors.confirmPassword)} autoComplete="new-password" id="register-confirm" name="confirmPassword" onChange={(event) => setConfirmPassword(event.target.value)} required type="password" value={confirmPassword} />
              {fieldErrors.confirmPassword ? <small className="auth-form__field-error" id="register-confirm-error">{fieldErrors.confirmPassword}</small> : null}
            </div>
            <button className="button button--primary auth-form__submit" disabled={submitting || googleBusy} type="submit">{googleBusy ? "Đang đăng nhập Google…" : submitting ? "Đang tạo tài khoản..." : "Tạo tài khoản"}</button>
            {isGoogleSignInEnabled() ? (
              <div style={{ marginTop: 20 }}>
                <div className="auth-form__divider" role="separator" aria-hidden="true"><span>hoặc</span></div>
                <GoogleSignInFlow disabled={submitting} onBusyChange={setGoogleBusy} onAuthenticated={(session) => {
                  window.location.assign(authSessionDestination(session.user.roles));
                }} />
              </div>
            ) : null}
          </form>
        )}
      </section>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<main className="auth-page"><div aria-live="polite" className="auth-route-loading" role="status">Đang mở trang đăng ký...</div></main>}>
      <RegisterForm />
    </Suspense>
  );
}
