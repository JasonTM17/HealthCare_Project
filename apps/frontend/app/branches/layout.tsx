import { createPublicRouteMetadata } from "../../lib/public-route-metadata";

export { default } from "../../components/PublicRouteLayout";

export const metadata = createPublicRouteMetadata({
  title: "Cơ sở HealthCare",
  description: "Xem địa chỉ, giờ làm việc, hotline, tiện ích và chỉ đường đến các cơ sở HealthCare.",
  keywords: ["cơ sở bệnh viện", "địa chỉ bệnh viện", "giờ làm việc"],
});
