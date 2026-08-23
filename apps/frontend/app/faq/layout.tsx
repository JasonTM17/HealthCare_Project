import { createPublicRouteMetadata } from "../../lib/public-route-metadata";

export { default } from "../../components/PublicRouteLayout";

export const metadata = createPublicRouteMetadata({
  title: "Câu hỏi thường gặp",
  description: "Giải đáp các câu hỏi thường gặp về đặt lịch, chuẩn bị đi khám và hỗ trợ tại HealthCare.",
  keywords: ["hỏi đáp bệnh viện", "hướng dẫn khám"],
});
