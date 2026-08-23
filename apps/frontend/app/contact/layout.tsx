import { createPublicRouteMetadata } from "../../lib/public-route-metadata";

export { default } from "../../components/PublicRouteLayout";

export const metadata = createPublicRouteMetadata({
  title: "Liên hệ bệnh viện",
  description: "Tìm đúng hotline, địa chỉ và đầu mối hỗ trợ tại các cơ sở HealthCare.",
  keywords: ["hotline bệnh viện", "liên hệ bệnh viện"],
});
