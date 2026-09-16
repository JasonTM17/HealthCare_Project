// Mirrors the backend `storage.upload-enabled` posture. Hosted beta currently
// runs with media uploads disabled, so editor and upload surfaces must say so
// up front instead of offering controls that can only end in a 503.
export const MEDIA_UPLOADS_ENABLED =
  process.env.NEXT_PUBLIC_STORAGE_UPLOAD_ENABLED !== "false";

export const MEDIA_UPLOADS_DISABLED_MESSAGE =
  "Tính năng tải ảnh lên hiện chưa được bật trên máy chủ. Vui lòng dán liên kết ảnh (https://…) hoặc liên hệ quản trị viên để bật kho media.";
