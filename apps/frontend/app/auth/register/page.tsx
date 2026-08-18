"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ApiError, register } from "../../../lib/api-client";

export default function RegisterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    if (password !== confirmPassword) {
      setErrorMessage("Mật khẩu xác nhận chưa khớp.");
      return;
    }
    setSubmitting(true);
    try {
      await register({ displayName: displayName.trim(), phone: phone.trim(), email: email.trim(), password });
      router.replace("/patient/dashboard");
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "Chưa thể tạo tài khoản. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  return <main className="auth-page"><section aria-labelledby="register-title" className="auth-card">
    <Link className="auth-card__back" href="/auth/login">← Đã có tài khoản</Link>
    <div className="auth-card__brand"><span aria-hidden="true" className="portal-brand__mark">+</span><span><strong>HealthCare</strong><small>Tài khoản bệnh nhân</small></span></div>
    <p className="section-note">ĐĂNG KÝ AN TOÀN</p><h1 id="register-title">Tạo tài khoản bệnh nhân</h1>
    <p className="auth-card__intro">Số điện thoại giúp liên kết đúng lịch hẹn với hồ sơ của bạn. Không nhập triệu chứng hoặc dữ liệu khám bệnh tại đây.</p>
    <form className="auth-form" onSubmit={handleSubmit}>
      {errorMessage ? <p aria-live="assertive" className="auth-form__error" role="alert">{errorMessage}</p> : null}
      <div className="auth-form__field"><label htmlFor="register-name">Họ và tên</label><input autoComplete="name" id="register-name" maxLength={160} minLength={2} onChange={(event) => setDisplayName(event.target.value)} required value={displayName} /></div>
      <div className="auth-form__field"><label htmlFor="register-phone">Số điện thoại</label><input autoComplete="tel" id="register-phone" maxLength={20} onChange={(event) => setPhone(event.target.value)} pattern="[+0-9() .-]+" required type="tel" value={phone} /></div>
      <div className="auth-form__field"><label htmlFor="register-email">Email</label><input autoComplete="email" id="register-email" maxLength={320} onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></div>
      <div className="auth-form__field"><label htmlFor="register-password">Mật khẩu</label><input autoComplete="new-password" id="register-password" maxLength={128} minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /><small>Ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.</small></div>
      <div className="auth-form__field"><label htmlFor="register-confirm">Xác nhận mật khẩu</label><input autoComplete="new-password" id="register-confirm" onChange={(event) => setConfirmPassword(event.target.value)} required type="password" value={confirmPassword} /></div>
      <button className="button button--primary auth-form__submit" disabled={submitting} type="submit">{submitting ? "Đang tạo tài khoản…" : "Tạo tài khoản"}</button>
    </form>
  </section></main>;
}
