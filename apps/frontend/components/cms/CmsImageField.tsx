"use client";

import { useState, type ChangeEvent, type ReactElement } from "react";
import { isSafeCmsImageUrl } from "../../lib/cms-client";
import ImageUpload from "../ImageUpload";

interface CmsImageFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  id: string;
  onBusyChange?: (busy: boolean) => void;
}

// Advisory mirror of the write-time rule in lib/cms-client (the backend
// validator stays authoritative): root-relative /… paths or HTTPS on the
// CSP img-src hosts (Unsplash, Pexels, VietQR).
function isProbablySafeImageUrl(url: string): boolean {
  return isSafeCmsImageUrl(url);
}

function CmsImagePreview({ src }: { src: string }): ReactElement | null {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <figure className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
      {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary CMS URL, remote patterns unknowable at build time */}
      <img
        alt="Xem trước hình ảnh CMS"
        className="max-h-48 w-full object-cover"
        onError={() => setFailed(true)}
        src={src}
      />
      <figcaption className="px-2 py-1 text-xs text-slate-500">
        Xem trước ảnh sẽ hiển thị ({src.slice(0, 80)}
        {src.length > 80 ? "…" : ""})
      </figcaption>
    </figure>
  );
}

/**
 * Image field for CMS payload payloads: file upload through the shared
 * media endpoint, a manual URL override, and a live preview thumbnail so the
 * admin sees the rendered result before publishing. The stored value stays a
 * plain URL string, exactly matching the backend HERO/IMAGE_CARD contract.
 */
export default function CmsImageField({
  value,
  onChange,
  disabled = false,
  required = false,
  id,
  onBusyChange,
}: CmsImageFieldProps): ReactElement {
  const effectiveValue = value.trim();
  const showPreview = effectiveValue.length > 0 && isProbablySafeImageUrl(effectiveValue);

  const handleManualChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    // Always commit the visible draft so what the admin sees is exactly what
    // will be saved; the backend SafeLink validator is the authoritative
    // rejection for unsafe values (the inline warning is advisory only).
    onChange(next);
  };

  return (
    <div className="grid gap-2" id={id}>
      <ImageUpload
        disabled={disabled}
        onBusyChange={onBusyChange}
        value={value}
        onChange={onChange}
        purpose="GENERAL"
        aspectRatio="banner"
        helperText="Tải ảnh lên hoặc dán đường dẫn /… hoặc HTTPS thuộc nguồn được phép (Unsplash, Pexels, VietQR). PNG, JPG, WEBP, GIF tối đa 5 MB."
      />
      <label className="block text-xs font-medium text-slate-600" htmlFor={`${id}-manual`}>
        <span>URL hình ảnh{required ? " (bắt buộc)" : ""}</span>
        <input
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          disabled={disabled}
          id={`${id}-manual`}
          onChange={handleManualChange}
          placeholder="/media/hospital-team-landscape.jpg hoặc https://…"
          type="text"
          value={effectiveValue}
        />
      </label>
      {showPreview ? <CmsImagePreview key={effectiveValue} src={effectiveValue} /> : null}
      {effectiveValue.length > 0 && !isProbablySafeImageUrl(effectiveValue) ? (
        <p className="text-xs font-medium text-amber-700" role="alert">
          Đường dẫn ảnh phải là /… trên hệ thống hoặc HTTPS thuộc nguồn được phép (Unsplash, Pexels, VietQR).
        </p>
      ) : null}
    </div>
  );
}
