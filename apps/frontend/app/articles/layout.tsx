import { createPublicRouteMetadata } from "../../lib/public-route-metadata";

export { default } from "../../components/PublicRouteLayout";

export const metadata = createPublicRouteMetadata({
  title: "Cẩm nang sức khỏe",
  description: "Đọc nội dung sức khỏe dễ hiểu để chuẩn bị câu hỏi và chủ động hơn trước khi gặp bác sĩ.",
  keywords: ["cẩm nang sức khỏe", "kiến thức y khoa"],
});
