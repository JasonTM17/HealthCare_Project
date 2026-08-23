import { ApiError } from "../../../lib/api-client";

export interface AdminErrorCopy {
  title: string;
  description: string;
}
function getStatus(error: unknown): number | undefined {
  if (error instanceof ApiError) return error.status;
  if (!(error instanceof Error)) return undefined;
  const match = error.message.match(/(?:API\s+|mã\s+)(\d{3})/i);
  return match ? Number(match[1]) : undefined;
}

export function describeAdminError(error: unknown): AdminErrorCopy {
  const status = getStatus(error);

  if (status === 401) {
    return {
      title: "Phiên đăng nhập đã hết hạn",
      description: "Hãy đăng nhập lại bằng tài khoản quản trị rồi thực hiện thao tác một lần nữa.",
    };
  }

  if (status === 403) {
    return {
      title: "Tài khoản không có quyền quản trị",
      description: "Tài khoản hiện tại không được phép xem hoặc thay đổi nội dung này.",
    };
  }

  if (status === 404) {
    return { title: "Không tìm thấy dữ liệu", description: "Bản ghi có thể đã được thay đổi hoặc không còn tồn tại." };
  }

  if (status === 409) {
    return { title: "Dữ liệu vừa được cập nhật", description: "Hãy tải lại danh sách trước khi lưu thay đổi mới." };
  }

  if (status === 400 || status === 422) {
    return { title: "Thông tin chưa hợp lệ", description: "Hãy kiểm tra các trường bắt buộc và thử lại." };
  }

  if (status === 429) {
    return { title: "Có quá nhiều yêu cầu", description: "Vui lòng chờ một lát trước khi thao tác lại." };
  }

  if (status !== undefined && status >= 500) {
    return { title: "Dịch vụ tạm thời không khả dụng", description: "Kết nối đang gián đoạn. Vui lòng thử lại sau ít phút." };
  }

  return {
    title: "Không thể hoàn tất thao tác",
    description: "Dịch vụ chưa trả về thông tin lỗi có thể hiển thị. Vui lòng thử lại.",
  };
}
