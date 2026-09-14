import { createPublicRouteMetadata } from "../../../lib/public-route-metadata";

export { default } from "../../../components/PublicRouteLayout";

export const metadata = createPublicRouteMetadata({
  title: "Xác thực email",
  description:
    "Xác thực địa chỉ email để hoàn tất kích hoạt tài khoản bệnh nhân HealthCare.",
});
