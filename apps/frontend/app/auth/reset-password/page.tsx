"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import BrandMark from "../../../components/BrandMark";
import { resetPassword } from "../../../lib/api-client";
import { authErrorMessage, authFieldErrors, type AuthFieldErrors } from "../../../lib/auth-flow";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [code, setCode] = useState(searchParams.get("token") ?? searchParams.get("code") ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setFieldErrors({});
    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: "Mật khẩu xác nhận chưa khớp." });
      setErrorMessage("Vui lòng kiểm tra lại các trường được đánh dấu.");
      return;
    }
    if (!email.trim() || !code.trim()) {
      setFieldErrors({
        ...(email.trim() ? {} : { email: "Nhập email đã yêu cầu đặt lại." }),
        ...(code.trim() ? {} : { code: "Nhập mã đặt lại trong email của bạn." }),
      });
      setErrorMessage("Cần có email và mã đặt lại để tiếp tục.");
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword({ email: email.trim(), code: code.trim(), password });
      setComplete(true);
    } catch (error) {
      setFieldErrors(authFieldErrors(error));
      setErrorMessage(authErrorMessage(error, "Liên kết đặt lại không còn hợp lệ. Vui lòng yêu cầu email mới."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section aria-labelledby="reset-password-title" className="auth-card">
        <Link className="auth-card__back" href="/auth/forgot-password">← Yêu cầu mã mới</Link>
        <div className="auth-card__brand"><BrandMark tagline="Đặt lại mật khẩu" /></div>
        <p className="section-note">KHÔI PHỤC AN TOÀN</p>
        <h1 id="reset-password-title">Tạo mật khẩu mới</h1>
        <p className="auth-card__intro">Chọn một mật khẩu mới cho tài khoản bệnh nhân. Các phiên đăng nhập cũ sẽ được yêu cầu xác thực lại.</p>

        {complete ? (
          <section aria-live="polite" className="auth-status auth-status--success" role="status">
            <span aria-hidden="true" className="auth-status__mark">✓</span>
            <div>
              <h2>Đã cập nhật mật khẩu</h2>
              <p>Mật khẩu mới đã được lưu. Hãy đăng nhập lại để tiếp tục sử dụng HealthCare.</p>
              <Link className="button button--primary" href="/auth/login">Đăng nhập</Link>
            </div>
          </section>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            {errorMessage ? <p aria-live="assertive" className="auth-form__error" role="alert">{errorMessage}</p> : null}
            <div className="auth-form__field">
              <label htmlFor="reset-email">Email</label>
              <input aria-describedby={fieldErrors.email ? "reset-email-error" : undefined} aria-invalid={Boolean(fieldErrors.email)} autoComplete="email" id="reset-email" name="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
              {fieldErrors.email ? <small className="auth-form__field-error" id="reset-email-error">{fieldErrors.email}</small> : null}
            </div>
            {!searchParams.get("token") && !searchParams.get("code") ? (
              <div className="auth-form__field">
                <label htmlFor="reset-token">Mã đặt lại</label>
                <input aria-describedby={fieldErrors.code ? "reset-code-error" : "reset-code-help"} aria-invalid={Boolean(fieldErrors.code)} autoComplete="one-time-code" id="reset-token" name="code" onChange={(event) => setCode(event.target.value)} required value={code} />
                {fieldErrors.code ? <small className="auth-form__field-error" id="reset-code-error">{fieldErrors.code}</small> : <small id="reset-code-help">Nhập mã được gửi tới email của bạn.</small>}
              </div>
            ) : null}
            <div className="auth-form__field">
              <label htmlFor="reset-password">Mật khẩu mới</label>
              <input aria-describedby={fieldErrors.password ? "reset-password-error" : "reset-password-help"} aria-invalid={Boolean(fieldErrors.password)} autoComplete="new-password" id="reset-password" maxLength={128} minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
              {fieldErrors.password ? <small className="auth-form__field-error" id="reset-password-error">{fieldErrors.password}</small> : <small id="reset-password-help">Ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.</small>}
            </div>
            <div className="auth-form__field">
              <label htmlFor="reset-confirm">Xác nhận mật khẩu mới</label>
              <input aria-describedby={fieldErrors.confirmPassword ? "reset-confirm-error" : undefined} aria-invalid={Boolean(fieldErrors.confirmPassword)} autoComplete="new-password" id="reset-confirm" onChange={(event) => setConfirmPassword(event.target.value)} required type="password" value={confirmPassword} />
              {fieldErrors.confirmPassword ? <small className="auth-form__field-error" id="reset-confirm-error">{fieldErrors.confirmPassword}</small> : null}
            </div>
            <button className="button button--primary auth-form__submit" disabled={submitting} type="submit">
              {submitting ? "Đang cập nhật..." : "Lưu mật khẩu mới"}
            </button>
          </form>
        )}
        <p className="auth-card__note">Cần bắt đầu lại? <Link href="/auth/forgot-password">Yêu cầu email đặt lại</Link>.</p>
      </section>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="auth-page"><div aria-live="polite" className="auth-route-loading" role="status">Đang mở khôi phục mật khẩu...</div></main>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
