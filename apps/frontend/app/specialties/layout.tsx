import { createPublicRouteMetadata } from "../../lib/public-route-metadata";

export { default } from "../../components/PublicRouteLayout";

export const metadata = createPublicRouteMetadata({
  title: "Chuyên khoa",
  description: "Tìm hiểu phạm vi chăm sóc, bác sĩ và dịch vụ của từng chuyên khoa tại HealthCare.",
  keywords: ["chuyên khoa", "khám chuyên khoa"],
});
