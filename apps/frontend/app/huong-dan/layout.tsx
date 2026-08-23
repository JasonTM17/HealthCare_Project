import { createPublicRouteMetadata } from "../../lib/public-route-metadata";

export { default } from "../../components/PublicRouteLayout";

export const metadata = createPublicRouteMetadata({
  title: "Hướng dẫn khám",
  description: "Theo dõi các bước chọn chuyên khoa, đặt lịch và chuẩn bị thông tin trước khi đến HealthCare.",
  keywords: ["hướng dẫn đặt khám", "chuẩn bị đi khám"],
});
