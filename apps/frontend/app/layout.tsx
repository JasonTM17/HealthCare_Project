import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Be_Vietnam_Pro } from "next/font/google";
import { SITE_URL, indexingAllowed } from "../lib/site-url";
import "./styles.css";
import "./effects.css";
import "./typography.css";
import "./branches/maps.css";
import "./brand-experience.css";
import "./catalog-directory.css";
import "./cms-native-preview.css";
import BackendWarmup from "../components/BackendWarmup";
import DeferredClientWidgets from "../components/DeferredClientWidgets";
import OfflineNetworkIndicator from "../components/OfflineNetworkIndicator";

// Self-hosted via next/font: removes the render-blocking Google Fonts
// stylesheet + third-party DNS/TLS from every page's critical path.
const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-next-bvp",
  display: "swap",
});


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
  metadataBase: new URL(SITE_URL),
  title: {
    default: "HealthCare | Bệnh viện đa khoa",
    template: "%s | HealthCare",
  },
  description:
    "Tìm hiểu chuyên khoa, bác sĩ, cơ sở và chủ động đặt lịch khám tại HealthCare.",
  keywords: ["y tế", "bệnh viện", "khám bệnh", "đặt lịch", "chuyên khoa"],
  // `./` is resolved against the current request pathname, so the root default
  // is a self-referencing canonical/og:url for every route that does not set
  // its own. Pinning SITE_URL here would canonicalise every page (specialties,
  // doctors, articles, ...) to the homepage.
  alternates: { canonical: "./" },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "HealthCare",
  },
  robots: indexingAllowed()
    ? { index: true, follow: true }
    : { index: false, follow: false },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    siteName: "HealthCare",
    url: "./",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" data-scroll-behavior="smooth" suppressHydrationWarning
      className={beVietnamPro.variable}>
      <body suppressHydrationWarning>
        <Script id="cms-preview-readonly" src="/cms-preview-guard.js" strategy="beforeInteractive" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: safeJsonLdStringify({
              "@context": "https://schema.org",
              "@type": "MedicalOrganization",
              name: "HealthCare",
              url: SITE_URL,
              description: "Cổng thông tin và đặt lịch khám của HealthCare.",
            }),
          }}
        />
        {children}
        <OfflineNetworkIndicator />
        <DeferredClientWidgets />
        <BackendWarmup />
      </body>
    </html>
  );
}
