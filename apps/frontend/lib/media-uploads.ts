// Mirrors the backend `storage.upload-enabled` posture. Hosted beta currently
// runs with media uploads disabled, so editor and upload surfaces must say so
// up front instead of offering controls that can only end in a 503.
export const MEDIA_UPLOADS_ENABLED =
  process.env.NEXT_PUBLIC_STORAGE_UPLOAD_ENABLED !== "false";

export const MEDIA_UPLOADS_DISABLED_MESSAGE =
  "Tính năng tải ảnh lên hiện chưa được bật trên máy chủ. Vui lòng dán liên kết ảnh (https://…) hoặc liên hệ quản trị viên để bật kho media.";

// The same object store backs server-rendered clinical PDFs, so document
// generation is unavailable for exactly the same reason media upload is.
export const DOCUMENT_GENERATION_ENABLED = MEDIA_UPLOADS_ENABLED;

export const DOCUMENT_GENERATION_DISABLED_MESSAGE =
  "Tính năng tạo tài liệu PDF hiện chưa được bật trên máy chủ vì chưa có kho lưu trữ. Hồ sơ và đơn thuốc của bạn vẫn xem bình thường; liên hệ quản trị viên để bật kho tài liệu.";
