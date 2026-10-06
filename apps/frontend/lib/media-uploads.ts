// Mirrors the backend `storage.upload-enabled` posture. Hosted beta currently
// runs with media uploads disabled, so editor and upload surfaces must say so
// up front instead of offering controls that can only end in a 503.
export const MEDIA_UPLOADS_ENABLED =
  process.env.NEXT_PUBLIC_STORAGE_UPLOAD_ENABLED !== "false";

export const MEDIA_UPLOADS_DISABLED_MESSAGE =
  "Tính năng tải ảnh lên hiện chưa được bật trên máy chủ. Vui lòng dán liên kết ảnh từ images.unsplash.com, images.pexels.com hoặc img.vietqr.io, hoặc liên hệ quản trị viên để bật kho media.";

// The same object store backs server-rendered clinical PDFs, so document
// generation is unavailable for exactly the same reason media upload is.
export const DOCUMENT_GENERATION_ENABLED = MEDIA_UPLOADS_ENABLED;

export const DOCUMENT_GENERATION_DISABLED_MESSAGE =
  "Tính năng tạo tài liệu PDF hiện chưa được bật trên máy chủ vì chưa có kho lưu trữ. Hồ sơ và đơn thuốc của bạn vẫn xem bình thường; liên hệ quản trị viên để bật kho tài liệu.";

// Remote image hosts the CSP `img-src` directive actually allows
// (apps/frontend/next.config.ts). An arbitrary https URL inserts fine into a
// form and then renders as a permanently dead image on the public page, so
// every stored image URL — editor insert, article cover — must come through
// this one gate (editor deep-review wave-14 F3/F9).
export const ALLOWED_EXTERNAL_IMAGE_HOSTS = new Set([
  "images.unsplash.com",
  "images.pexels.com",
  "img.vietqr.io",
]);

export const PUBLIC_IMAGE_URL_MESSAGE =
  "Chỉ chấp nhận đường dẫn ảnh nội bộ bắt đầu bằng \"/\", hoặc ảnh https từ images.unsplash.com, images.pexels.com, img.vietqr.io.";

/**
 * Normalize a user-typed image URL for storage on the public site.
 * Root-relative paths ('self' under the CSP) and https URLs on the
 * allowlisted hosts pass; everything else — javascript:, data:, http://,
 * protocol-relative, backslash tricks, unlisted hosts — returns null.
 * Empty input returns "" so callers can distinguish "cleared" from "invalid".
 */
export function normalizedPublicImageUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return "";
  // WHATWG treats "\\" as "/", so /\\host or \\/path would escape the origin.
  if (trimmed.startsWith("//") || trimmed.includes("\\")) return null;
  if (trimmed.startsWith("/")) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "https:" && ALLOWED_EXTERNAL_IMAGE_HOSTS.has(parsed.hostname)) {
      return trimmed;
    }
  } catch {
    return null;
  }
  return null;
}
