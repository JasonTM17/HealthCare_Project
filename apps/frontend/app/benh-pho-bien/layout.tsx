import { createPublicRouteMetadata } from "../../lib/public-route-metadata";

export { default } from "../../components/PublicRouteLayout";

export const metadata = createPublicRouteMetadata({
  title: "Bệnh phổ biến",
  description:
    "Hiểu đúng các bệnh thường gặp, dấu hiệu cần đi khám và hướng dẫn chăm sóc trước khi đặt lịch với bác sĩ.",
  keywords: ["bệnh phổ biến", "dấu hiệu bệnh", "hướng dẫn sức khỏe"],
});
