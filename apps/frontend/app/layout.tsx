import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Inter } from "next/font/google";
import "./styles.css";

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-be-vietnam-pro",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0d5c63",
};

export const metadata: Metadata = {
  title: {
    default: "HealthCare: Chăm sóc sức khỏe toàn diện",
    template: "%s | HealthCare",
  },
  description:
    "Nền tảng y tế số đang được xây dựng cho trải nghiệm bệnh nhân an toàn, dễ hiểu và thân thiện trên mọi thiết bị.",
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
    <html
      lang="vi"
      className={`${beVietnamPro.variable} ${inter.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}

