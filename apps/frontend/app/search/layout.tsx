import { createPublicRouteMetadata } from "../../lib/public-route-metadata";

export { default } from "../../components/PublicRouteLayout";

export const metadata = createPublicRouteMetadata({
  title: "Tìm kiếm HealthCare",
  description: "Tìm nhanh bác sĩ, chuyên khoa, dịch vụ, gói khám và cơ sở trong hệ thống HealthCare.",
  keywords: ["tìm kiếm bệnh viện", "tìm chuyên khoa", "tìm dịch vụ y tế"],
});
