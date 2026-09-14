import { createPublicRouteMetadata } from "../../../lib/public-route-metadata";

export { default } from "../../../components/PublicRouteLayout";

export const metadata = createPublicRouteMetadata({
  title: "Đặt lại mật khẩu",
  description:
    "Đặt lại mật khẩu mới cho tài khoản HealthCare sau khi xác thực email khôi phục.",
});
