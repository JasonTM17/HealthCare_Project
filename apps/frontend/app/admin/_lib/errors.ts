export interface AdminErrorCopy {
  title: string;
  description: string;
}
function getStatus(error: unknown): number | undefined {
  if (!(error instanceof Error)) return undefined;
  const match = error.message.match(/(?:API\s+|mã\s+)(\d{3})/i);
  return match ? Number(match[1]) : undefined;
}

export function describeAdminError(error: unknown): AdminErrorCopy {
  const status = getStatus(error);

  if (status === 401) {
    return {
      title: "Cần phiên đăng nhập ADMIN",
      description: "Backend yêu cầu bearer token cho thao tác này. Frontend baseline chưa có luồng phiên xác thực dùng chung.",
    };
  }

  if (status === 403) {
    return {
      title: "Tài khoản không có quyền ADMIN",
      description: "Quyền được kiểm tra ở backend. Hãy dùng tài khoản có role ADMIN trước khi thử lại.",
    };
  }

  if (error instanceof Error && error.message) {
    return { title: "Không thể hoàn tất thao tác", description: error.message };
  }

  return {
    title: "Không thể hoàn tất thao tác",
    description: "Dịch vụ chưa trả về thông tin lỗi có thể hiển thị. Vui lòng thử lại.",
  };
}
