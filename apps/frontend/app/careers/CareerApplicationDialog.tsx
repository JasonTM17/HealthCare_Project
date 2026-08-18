"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Icon from "../../components/UiIcon";
import { ApiError, submitJobApplication } from "../../lib/api-client";
import type { JobApplicationReceipt, JobPosition } from "../../types/hospital";
import styles from "./careers.module.css";

interface Props {
  position: JobPosition;
  onClose: () => void;
}

export default function CareerApplicationDialog({ position, onClose }: Props): React.ReactElement {
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<JobApplicationReceipt | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    firstInputRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape" && !submittingRef.current) onCloseRef.current();
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href]",
      ));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      returnFocusRef.current?.focus();
    };
  }, []);

  useEffect(() => {
    if (receipt) dialogRef.current?.focus();
  }, [receipt]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const experience = String(data.get("yearsExperience") || "").trim();

    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    try {
      const result = await submitJobApplication(position.slug, {
        fullName: String(data.get("fullName") || "").trim(),
        email: String(data.get("email") || "").trim(),
        phone: String(data.get("phone") || "").trim(),
        yearsExperience: experience ? Number(experience) : undefined,
        coverLetter: String(data.get("coverLetter") || "").trim(),
        resumeUrl: String(data.get("resumeUrl") || "").trim(),
        privacyConsent: data.get("privacyConsent") === "on",
      });
      setReceipt(result);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        setError("Hồ sơ cho vị trí này đã được tiếp nhận gần đây. Vui lòng kiểm tra email hoặc liên hệ bộ phận tuyển dụng.");
      } else if (caught instanceof ApiError && caught.status === 404) {
        setError("Vị trí này không còn nhận hồ sơ. Vui lòng đóng biểu mẫu và chọn vị trí khác.");
      } else if (caught instanceof ApiError && caught.status === 400) {
        setError("Thông tin ứng tuyển chưa hợp lệ. Vui lòng kiểm tra lại các trường bắt buộc.");
      } else if (caught instanceof ApiError && caught.status === 429) {
        setError("Bạn đã gửi nhiều yêu cầu trong thời gian ngắn. Vui lòng thử lại sau ít phút.");
      } else {
        setError("Hồ sơ chưa được gửi. Vui lòng kiểm tra kết nối và thử lại.");
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div
      className={styles.dialogBackdrop}
      onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) onClose(); }}
    >
      <div
        aria-describedby="career-dialog-description"
        aria-labelledby="career-dialog-title"
        aria-modal="true"
        className={styles.dialog}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <button aria-label="Đóng biểu mẫu ứng tuyển" className={styles.dialogClose} disabled={submitting} onClick={onClose} type="button">
          <Icon name="x" size={22} />
        </button>

        {receipt ? (
          <div className={styles.successState} role="status">
            <span className={styles.successIcon}><Icon name="check" size={32} strokeWidth={2.2} /></span>
            <span className={styles.eyebrow}>Đã tiếp nhận hồ sơ</span>
            <h2 id="career-dialog-title">Cảm ơn bạn đã ứng tuyển</h2>
            <p id="career-dialog-description">{receipt.message}</p>
            <div className={styles.receiptCode}>
              <span>Mã hồ sơ</span>
              <strong>{receipt.applicationCode}</strong>
            </div>
            <p className={styles.privacyText}>Hãy lưu mã này để thuận tiện khi trao đổi với bộ phận tuyển dụng.</p>
            <button className={styles.primaryButton} onClick={onClose} type="button">Hoàn tất</button>
          </div>
        ) : (
          <>
            <header className={styles.dialogHeader}>
              <span className={styles.eyebrow}>Ứng tuyển trực tuyến</span>
              <h2 id="career-dialog-title">{position.title}</h2>
              <p id="career-dialog-description">{position.department} · {position.location}</p>
            </header>
            <form className={styles.applicationForm} onSubmit={handleSubmit}>
              <div className={styles.formGrid}>
                <label className={styles.fullField}>
                  <span>Họ và tên <b aria-hidden="true">*</b></span>
                  <input autoComplete="name" maxLength={160} minLength={2} name="fullName" ref={firstInputRef} required />
                </label>
                <label>
                  <span>Email <b aria-hidden="true">*</b></span>
                  <input autoComplete="email" maxLength={254} name="email" required type="email" />
                </label>
                <label>
                  <span>Số điện thoại <b aria-hidden="true">*</b></span>
                  <input autoComplete="tel" inputMode="tel" name="phone" pattern="(?:\+84|0)(?:[ .-]?\d){9,10}" placeholder="Ví dụ: 0901 234 567" required type="tel" />
                </label>
                <label>
                  <span>Số năm kinh nghiệm</span>
                  <input max={60} min={0} name="yearsExperience" placeholder="Không bắt buộc" type="number" />
                </label>
                <label>
                  <span>Liên kết CV / hồ sơ</span>
                  <input inputMode="url" maxLength={1000} name="resumeUrl" pattern="https://.*" placeholder="https://drive.google.com/..." type="url" />
                </label>
                <label className={styles.fullField}>
                  <span>Giới thiệu ngắn <b aria-hidden="true">*</b></span>
                  <textarea
                    maxLength={4000}
                    minLength={20}
                    name="coverLetter"
                    placeholder="Chia sẻ kinh nghiệm phù hợp và lý do bạn muốn đồng hành cùng bệnh viện."
                    required
                    rows={5}
                  />
                  <small>Tối thiểu 20 ký tự. Không cần ghi thông tin sức khỏe cá nhân.</small>
                </label>
              </div>
              <label className={styles.consentField}>
                <input name="privacyConsent" required type="checkbox" />
                <span>Tôi đồng ý để bệnh viện sử dụng thông tin trên cho mục đích tuyển dụng và liên hệ về hồ sơ này.</span>
              </label>
              {error ? <p className={styles.formError} role="alert"><Icon name="alert-triangle" size={18} /> {error}</p> : null}
              <div className={styles.formFooter}>
                <p><Icon name="shield-check" size={17} /> Thông tin chỉ được dùng cho quy trình tuyển dụng.</p>
                <button className={styles.primaryButton} disabled={submitting} type="submit">
                  {submitting ? "Đang gửi hồ sơ…" : "Gửi hồ sơ ứng tuyển"}
                  {!submitting ? <Icon name="arrow-right" size={18} /> : null}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
