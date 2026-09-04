"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { uploadMediaAsset } from "../lib/api-client";
import UiIcon from "./UiIcon";
import styles from "./ImageUpload.module.css";

interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  label?: string;
  purpose?: "ARTICLE_COVER" | "DOCTOR_PORTRAIT" | "PATIENT_AVATAR" | "GENERAL";
  aspectRatio?: "banner" | "square";
  helperText?: string;
}

export default function ImageUpload({
  value,
  onChange,
  label = "Tải ảnh lên",
  purpose = "GENERAL",
  aspectRatio = "banner",
  helperText = "Hỗ trợ định dạng PNG, JPG, WEBP (Tối đa 10 MB)",
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleProcessFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, WEBP, GIF).");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Kích thước tệp quá lớn. Giới hạn tối đa là 10 MB.");
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const response = await uploadMediaAsset(file, purpose);
      onChange(response.url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Tải ảnh lên máy chủ thất bại.";
      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleProcessFile(file);
    }
    // reset input value so re-uploading same file triggers change
    e.target.value = "";
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleProcessFile(file);
    }
  };

  const handleRemove = () => {
    onChange("");
    setError(null);
  };

  return (
    <div className={styles.container}>
      {label && <span className={styles.label}>{label}</span>}

      {uploading ? (
        <div className={styles.uploadingOverlay}>
          <div className={styles.spinner} />
          <p className={styles.uploadingText}>Đang tải ảnh an toàn lên máy chủ...</p>
        </div>
      ) : value ? (
        <div className={styles.previewWrapper}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt="Xem trước hình ảnh"
            className={aspectRatio === "square" ? styles.previewSquare : styles.previewBanner}
            onError={() => setError("Không thể tải bản xem trước hình ảnh.")}
            src={value}
          />
          <div className={styles.previewActions}>
            <div className={styles.actionButtons}>
              <button
                className={styles.changeBtn}
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                <UiIcon name="sparkles" size={13} />
                <span>Đổi ảnh khác</span>
              </button>
              <button
                className={styles.removeBtn}
                onClick={handleRemove}
                type="button"
              >
                <UiIcon name="trash" size={13} />
                <span>Gỡ ảnh</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          className={`${styles.dropzone} ${isDragging ? styles.dropzoneDragging : ""}`}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          role="button"
          tabIndex={0}
        >
          <div className={styles.dropzoneIcon}>
            <UiIcon name="plus" size={20} />
          </div>
          <p className={styles.dropzoneText}>Kéo thả ảnh vào đây hoặc bấm để chọn tệp</p>
          <p className={styles.dropzoneHint}>{helperText}</p>
        </div>
      )}

      {error && <p className={styles.errorText}>{error}</p>}

      <input
        accept="image/png,image/jpeg,image/webp,image/gif"
        className={styles.hiddenInput}
        onChange={handleFileChange}
        ref={fileInputRef}
        type="file"
      />
    </div>
  );
}
