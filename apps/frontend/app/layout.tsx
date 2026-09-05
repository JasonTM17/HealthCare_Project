import type { Metadata, Viewport } from "next";
import "./styles.css";
import "./effects.css";
import "./typography.css";
import "./branches/maps.css";
import "./brand-experience.css";
import "./catalog-directory.css";
import FloatingHealthAssistant from "../components/FloatingHealthAssistant";

function safeJsonLdStringify(data: unknown): string {
  return JSON.stringify(data)
    .replace(/&/g, "\\u0026")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#003336",
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://healthcare-beta.example"),
  title: {
    default: "HealthCare | Bệnh viện đa khoa",
    template: "%s | HealthCare",
  },
  description:
    "Tìm hiểu chuyên khoa, bác sĩ, cơ sở và chủ động đặt lịch khám tại HealthCare.",
  keywords: ["y tế", "bệnh viện", "khám bệnh", "đặt lịch", "chuyên khoa"],
  robots: process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true"
    ? { index: true, follow: true }
    : { index: false, follow: false },
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
    <html lang="vi" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: safeJsonLdStringify({
              "@context": "https://schema.org",
              "@type": "MedicalOrganization",
              name: "HealthCare",
              url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://healthcare-beta.example",
              description: "Cổng thông tin và đặt lịch khám của HealthCare.",
            }),
          }}
        />
        {children}
        <FloatingHealthAssistant />
      </body>
    </html>
  );
}
