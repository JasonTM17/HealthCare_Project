import { createPublicRouteMetadata } from "../../lib/public-route-metadata";

export { default } from "../../components/PublicRouteLayout";

export const metadata = createPublicRouteMetadata({
  title: "Dịch vụ y tế",
  description: "Khám phá các dịch vụ y tế và chọn bước chăm sóc phù hợp trước khi đặt lịch tại HealthCare.",
  keywords: ["dịch vụ y tế", "dịch vụ bệnh viện"],
});
