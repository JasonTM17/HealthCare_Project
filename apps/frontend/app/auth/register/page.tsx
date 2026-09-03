"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import BrandMark from "../../../components/BrandMark";
import { register, resendVerificationEmail } from "../../../lib/api-client";
import { authErrorMessage, authFieldErrors, maskEmail, type AuthFieldErrors } from "../../../lib/auth-flow";

export default function RegisterPage() {
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
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
    setErrorMessage(null);
    setFieldErrors({});
    setResendError(null);
    setResendMessage(null);
    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: "Mật khẩu xác nhận chưa khớp." });
      setErrorMessage("Vui lòng kiểm tra lại các trường được đánh dấu.");
      return;
    }

    setSubmitting(true);
    try {
      const pending = await register({
        displayName: displayName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        password,
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
        <p className="auth-card__intro">Số điện thoại giúp liên kết đúng lịch hẹn với hồ sơ của bạn. Không nhập triệu chứng hoặc dữ liệu khám bệnh tại đây.</p>

        {pendingEmail ? (
          <section aria-live="polite" className="auth-status auth-status--success" role="status">
            <span aria-hidden="true" className="auth-status__mark">✓</span>
            <div>
              <h2>Kiểm tra email để tiếp tục</h2>
              <p>Mã xác minh đã được gửi tới <strong>{maskEmail(pendingEmail)}</strong>. Tài khoản sẽ chưa đăng nhập cho đến khi email được xác minh.</p>
              {resendMessage ? <p className="auth-status__notice">{resendMessage}</p> : null}
              {resendError ? <p className="auth-status__error" role="alert">{resendError}</p> : null}
              <div className="auth-status__actions">
                <Link className="button button--primary" href={`/auth/verify-email?email=${encodeURIComponent(pendingEmail)}`}>Nhập mã xác minh</Link>
                <button className="outline-button" disabled={resending || resendCooldown > 0} onClick={() => void handleResend()} type="button">
                  {resending ? "Đang gửi..." : resendCooldown > 0 ? `Gửi lại sau ${resendCooldown}s` : "Gửi lại mã"}
                </button>
                <button className="text-button auth-status__edit" onClick={() => setPendingEmail(null)} type="button">Đổi thông tin</button>
              </div>
              <p style={{ margin: "0.75rem 0 0", fontSize: "0.8rem", color: "#0f766e" }}>
                📧 Hệ thống đã gửi mã OTP 6 chữ số về hòm thư của bạn. Vui lòng kiểm tra email (cả hộp thư Đến và mục Spam) để lấy mã xác minh.
              </p>
              <p className="auth-card__note">Sau khi xác minh, bạn có thể <Link href="/auth/login?next=/patient/dashboard">đăng nhập vào cổng bệnh nhân</Link>.</p>
            </div>
          </section>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            {errorMessage ? <p aria-live="assertive" className="auth-form__error" role="alert">{errorMessage}</p> : null}
            <div className="auth-form__field">
              <label htmlFor="register-name">Họ và tên</label>
              <input aria-describedby={fieldErrors.displayName ? "register-name-error" : undefined} aria-invalid={Boolean(fieldErrors.displayName)} autoComplete="name" id="register-name" maxLength={160} minLength={2} onChange={(event) => setDisplayName(event.target.value)} required value={displayName} />
              {fieldErrors.displayName ? <small className="auth-form__field-error" id="register-name-error">{fieldErrors.displayName}</small> : null}
            </div>
            <div className="auth-form__field">
              <label htmlFor="register-phone">Số điện thoại</label>
              <input aria-describedby={fieldErrors.phone ? "register-phone-error" : undefined} aria-invalid={Boolean(fieldErrors.phone)} autoComplete="tel" id="register-phone" maxLength={20} onChange={(event) => setPhone(event.target.value)} pattern="[+0-9() .-]+" required type="tel" value={phone} />
              {fieldErrors.phone ? <small className="auth-form__field-error" id="register-phone-error">{fieldErrors.phone}</small> : null}
            </div>
            <div className="auth-form__field">
              <label htmlFor="register-email">Email</label>
              <input aria-describedby={fieldErrors.email ? "register-email-error" : undefined} aria-invalid={Boolean(fieldErrors.email)} autoComplete="email" id="register-email" maxLength={320} onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
              {fieldErrors.email ? <small className="auth-form__field-error" id="register-email-error">{fieldErrors.email}</small> : null}
            </div>
            <div className="auth-form__field">
              <label htmlFor="register-password">Mật khẩu</label>
              <input aria-describedby={fieldErrors.password ? "register-password-error" : "register-password-help"} aria-invalid={Boolean(fieldErrors.password)} autoComplete="new-password" id="register-password" maxLength={128} minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
              {fieldErrors.password ? <small className="auth-form__field-error" id="register-password-error">{fieldErrors.password}</small> : <small id="register-password-help">Ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.</small>}
            </div>
            <div className="auth-form__field">
              <label htmlFor="register-confirm">Xác nhận mật khẩu</label>
              <input aria-describedby={fieldErrors.confirmPassword ? "register-confirm-error" : undefined} aria-invalid={Boolean(fieldErrors.confirmPassword)} autoComplete="new-password" id="register-confirm" onChange={(event) => setConfirmPassword(event.target.value)} required type="password" value={confirmPassword} />
              {fieldErrors.confirmPassword ? <small className="auth-form__field-error" id="register-confirm-error">{fieldErrors.confirmPassword}</small> : null}
            </div>
            <button className="button button--primary auth-form__submit" disabled={submitting} type="submit">{submitting ? "Đang tạo tài khoản..." : "Tạo tài khoản"}</button>
          </form>
        )}
      </section>
    </main>
  );
}
