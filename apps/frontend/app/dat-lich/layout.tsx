import { createPublicRouteMetadata } from "../../lib/public-route-metadata";

export { default } from "../../components/PublicRouteLayout";

export const metadata = createPublicRouteMetadata({
  title: "Đặt lịch khám",
  description: "Chọn chuyên khoa, bác sĩ, cơ sở và khung giờ để đặt lịch khám tại HealthCare.",
  keywords: ["đặt lịch khám", "lịch khám bệnh"],
});
