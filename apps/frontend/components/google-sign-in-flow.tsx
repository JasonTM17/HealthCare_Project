"use client";

import { useEffect, useId, useRef, useState } from "react";
import GoogleSignInButton from "./GoogleSignInButton";
import { ApiError, loginWithGoogle, requestGoogleEmailProof, type AuthSession } from "../lib/api-client";
import { authErrorMessage, maskEmail } from "../lib/auth-flow";
import styles from "./google-sign-in.module.css";

interface Props {
  onAuthenticated: (session: AuthSession) => void;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}

/** Provider credentials are short-lived component memory, never browser storage. */
export default function GoogleSignInFlow({ onAuthenticated, disabled = false, onBusyChange }: Props) {
  const inputId = useId();
  const descriptionId = `${inputId}-description`;
  const errorId = `${inputId}-error`;
  const credentialRef = useRef<string | null>(null);
  const proofInputRef = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const generation = useRef(0);
  const [busy, setBusy] = useState(false);
  const [proofMode, setProofMode] = useState<"email" | "password" | null>(null);
  const [proofValue, setProofValue] = useState("");
  const [email, setEmail] = useState("");
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => { generation.current += 1; credentialRef.current = null; }, []);
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  useEffect(() => {
    if (proofMode) proofInputRef.current?.focus();
  }, [proofMode]);
  useEffect(() => {
    if (!expiresAt) return;
    const timer = window.setTimeout(() => {
      generation.current += 1;
      credentialRef.current = null;
      inFlight.current = false;
      setBusy(false);
      setProofMode(null);
      setProofValue("");
      setExpiresAt(null);
      setError("Phiên xác minh đã hết hạn. Vui lòng chọn tài khoản Google lại.");
    }, Math.max(0, expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [expiresAt]);

  const attempt = async (credential: string, completing = false) => {
    if (inFlight.current || disabled) return;
    if (!credential) { setError("Google chưa trả về phiên hợp lệ. Vui lòng thử lại."); return; }
    const submittedProof = completing ? proofInputRef.current?.value ?? "" : "";
    if (completing) {
      if (proofMode === "email" && !/^\d{6}$/.test(submittedProof.trim())) {
        setError("Vui lòng nhập mã xác minh gồm 6 chữ số.");
        proofInputRef.current?.focus();
        return;
      }
      if (proofMode === "password" && !submittedProof) {
        setError("Vui lòng nhập mật khẩu HealthCare hiện tại.");
        proofInputRef.current?.focus();
        return;
      }
      setProofValue(submittedProof);
    }
    inFlight.current = true;
    setBusy(true);
    setError(null);
    const current = ++generation.current;
    credentialRef.current = credential;
    try {
      const session = await loginWithGoogle(credential, completing
        ? proofMode === "email" ? { code: submittedProof.trim() } : { password: submittedProof }
        : {});
      if (generation.current !== current) return;
      credentialRef.current = null;
      setProofValue("");
      setExpiresAt(null);
      onAuthenticated(session);
    } catch (failure) {
      if (generation.current !== current) return;
      if (!completing && failure instanceof ApiError && failure.code === "GOOGLE_EMAIL_PROOF_REQUIRED") {
        try {
          const pending = await requestGoogleEmailProof(credential);
          if (generation.current !== current) return;
          setEmail(pending.email);
          setProofMode("email");
          setProofValue("");
          setExpiresAt(Date.now() + Math.min(600, pending.expiresInSeconds) * 1000);
        } catch (proofFailure) {
          credentialRef.current = null;
          setError(authErrorMessage(proofFailure, "Chưa thể gửi mã xác minh. Vui lòng thử lại."));
        }
      } else if (!completing && failure instanceof ApiError && failure.code === "GOOGLE_REAUTH_REQUIRED") {
        setProofMode("password");
        setProofValue("");
        setExpiresAt(Date.now() + 5 * 60 * 1000);
      } else {
        setError(authErrorMessage(failure, "Chưa thể đăng nhập Google. Vui lòng thử lại."));
        if (!completing) credentialRef.current = null;
      }
    } finally {
      if (generation.current === current) { inFlight.current = false; setBusy(false); }
    }
  };

  const cancel = () => {
    generation.current += 1;
    credentialRef.current = null;
    inFlight.current = false;
    setBusy(false);
    setProofMode(null);
    setProofValue("");
    setExpiresAt(null);
    setError(null);
  };

  return (
    <section className={styles.flow} aria-label="Đăng nhập bằng Google" aria-busy={busy}>
      {proofMode ? (
        <div className={`auth-form__field ${styles.proof}`}>
          <h2>{proofMode === "email" ? "Xác minh email của bạn" : "Liên kết tài khoản Google"}</h2>
          <p id={descriptionId} className="auth-form__note">{proofMode === "email"
            ? `Nhập mã vừa gửi tới ${maskEmail(email)} để xác minh email và tiếp tục bằng Google.`
            : "Nhập mật khẩu HealthCare hiện tại để liên kết an toàn tài khoản của bạn với Google."}</p>
          <label htmlFor={inputId}>{proofMode === "email" ? "Mã xác minh Google" : "Mật khẩu HealthCare hiện tại"}</label>
          <input id={inputId} aria-describedby={`${descriptionId}${error ? ` ${errorId}` : ""}`} aria-invalid={Boolean(error)} ref={proofInputRef} name="googleProof" autoComplete={proofMode === "email" ? "one-time-code" : "current-password"}
            type={proofMode === "email" ? "text" : "password"} inputMode={proofMode === "email" ? "numeric" : undefined}
            maxLength={proofMode === "email" ? 6 : 128} disabled={busy || disabled} value={proofValue}
            onChange={(event) => { setProofValue(event.target.value); setError(null); }}
            onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); if (credentialRef.current) void attempt(credentialRef.current, true); } }} />
          <button className="button button--primary" type="button" disabled={busy || disabled}
            onClick={() => { if (credentialRef.current) void attempt(credentialRef.current, true); }}>{busy ? "Đang xác minh…" : "Xác minh và đăng nhập Google"}</button>
          <button className={styles.cancel} type="button" disabled={busy || disabled} onClick={cancel}>Chọn lại tài khoản Google</button>
        </div>
      ) : <GoogleSignInButton busy={busy || disabled} onCredential={(credential) => { void attempt(credential); }} />}
      {busy ? <p className={styles.status} role="status">Đang xác thực với Google…</p> : null}
      {disabled ? <p className={styles.status} role="status">Đang xử lý thông tin đăng nhập. Vui lòng chờ…</p> : null}
      {error ? <p id={errorId} className={`auth-form__error ${styles.error}`} role="alert">{error}</p> : null}
    </section>
  );
}
