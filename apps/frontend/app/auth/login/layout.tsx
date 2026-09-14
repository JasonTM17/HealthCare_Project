import { createPublicRouteMetadata } from "../../../lib/public-route-metadata";

export { default } from "../../../components/PublicRouteLayout";

export const metadata = createPublicRouteMetadata({
  title: "Đăng nhập",
  description:
    "Đăng nhập cổng bệnh nhân, bác sĩ hoặc quản trị của HealthCare để theo dõi lịch khám và hồ sơ sức khỏe.",
});
