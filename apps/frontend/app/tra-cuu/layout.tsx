import { createPublicRouteMetadata } from "../../lib/public-route-metadata";

export { default } from "../../components/PublicRouteLayout";

export const metadata = createPublicRouteMetadata({
  title: "Tra cứu lịch hẹn",
  description: "Tra cứu trạng thái và thông tin lịch hẹn HealthCare bằng mã lịch hẹn và thông tin xác thực.",
  keywords: ["tra cứu lịch hẹn", "mã lịch hẹn"],
});
