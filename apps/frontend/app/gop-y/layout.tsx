import { createPublicRouteMetadata } from "../../lib/public-route-metadata";

export { default } from "../../components/PublicRouteLayout";

export const metadata = createPublicRouteMetadata({
  title: "Góp ý",
  description: "Gửi góp ý, báo lỗi hoặc đề xuất tính năng cho đội ngũ HealthCare. Yêu cầu đăng nhập.",
  keywords: ["góp ý bệnh viện", "báo lỗi hệ thống", "phản hồi dịch vụ"],
});
