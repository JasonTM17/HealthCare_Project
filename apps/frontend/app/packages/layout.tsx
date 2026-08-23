import { createPublicRouteMetadata } from "../../lib/public-route-metadata";

export { default } from "../../components/PublicRouteLayout";

export const metadata = createPublicRouteMetadata({
  title: "Gói khám sức khỏe",
  description: "So sánh nội dung, chi phí và lựa chọn gói khám phù hợp tại HealthCare.",
  keywords: ["gói khám", "khám sức khỏe tổng quát", "chi phí khám"],
});
