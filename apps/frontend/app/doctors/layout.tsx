import { createPublicRouteMetadata } from "../../lib/public-route-metadata";

export { default } from "../../components/PublicRouteLayout";

export const metadata = createPublicRouteMetadata({
  title: "Đội ngũ bác sĩ",
  description: "Tìm bác sĩ theo chuyên khoa, cơ sở và xem thông tin chuyên môn trước khi đặt lịch.",
  keywords: ["bác sĩ", "tìm bác sĩ", "bác sĩ chuyên khoa"],
});
