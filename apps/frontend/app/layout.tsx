import type { Metadata, Viewport } from "next";
import "./styles.css";
import "./effects.css";
import "./typography.css";
import "./branches/maps.css";
import "./brand-experience.css";
import FloatingHealthAssistant from "../components/FloatingHealthAssistant";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#087b78",
};

export const metadata: Metadata = {
  title: {
    default: "HealthCare | Bệnh viện đa khoa",
    template: "%s | HealthCare",
  },
  description:
    "Tìm hiểu chuyên khoa, bác sĩ, cơ sở và chủ động đặt lịch khám tại HealthCare.",
  keywords: ["y tế", "bệnh viện", "khám bệnh", "đặt lịch", "chuyên khoa"],
  robots: { index: false, follow: false }, // foundation phase: not for indexing yet
  openGraph: {
    type: "website",
    locale: "vi_VN",
    siteName: "HealthCare",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>
        {children}
        <FloatingHealthAssistant />
      </body>
    </html>
  );
}
