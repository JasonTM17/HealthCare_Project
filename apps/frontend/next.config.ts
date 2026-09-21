import type { NextConfig } from "next";

const distDir = process.env.NEXT_DIST_DIR || ".next";
const development = process.env.NODE_ENV !== "production";
const productionBuild = !development && process.argv.some((argument) => argument === "build");

// A production build without a real site URL silently ships placeholder
// canonical/OG domains (`healthcare-beta.example`) and a disabled sitemap.
// Fail the build instead of discovering the SEO outage in production.
if (productionBuild) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!siteUrl || siteUrl.includes("healthcare-beta.example")) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL must be set to the production origin for production builds "
      + "(canonical URLs, sitemap and Open Graph metadata derive from it).",
    );
  }
}

// Static pages retain CDN caching, so this release uses the documented
// non-nonce Next.js CSP profile. `unsafe-inline` is limited to scripts/styles
// required by the framework; external hosts remain explicitly allowlisted.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' blob: data: https://images.unsplash.com https://images.pexels.com https://img.vietqr.io",
  "font-src 'self' data: https://fonts.gstatic.com",
  `connect-src 'self' https://img.vietqr.io${development ? " ws://localhost:* ws://127.0.0.1:*" : ""}`,
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-src https://www.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(development ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
];

// Build-time media and image assets change only by shipping a new file under a
// new name (nothing writes into `public/` at runtime), so the URL is immutable
// for practical purposes. Without this rule Next/Vercel answer `/media/**` with
// `Cache-Control: max-age=0, must-revalidate` and the CDN MISSes on every view
// — expensive for 0.7-0.9 MB posters and doctor photos.
const immutableAssetCacheControl = "public, max-age=31536000, immutable";
const immutableAssetHeaders = [
  { key: "Cache-Control", value: immutableAssetCacheControl },
];

const nextConfig: NextConfig = {
  distDir,
  reactStrictMode: true,
  devIndicators: false,
  experimental: {
    cpus: 1,
  },
  async redirects() {
    return [
      {
        source: "/booking",
        destination: "/dat-lich",
        permanent: true,
      },
      {
        source: "/appointment-lookup",
        destination: "/tra-cuu",
        permanent: true,
      },
      {
        source: "/tra-cuu-lich-hen",
        destination: "/tra-cuu",
        permanent: true,
      },
      {
        source: "/portal/patient",
        destination: "/patient",
        permanent: true,
      },
      {
        source: "/portal/doctor",
        destination: "/doctor",
        permanent: true,
      },
      {
        source: "/portal/admin",
        destination: "/admin",
        permanent: true,
      },
      {
        source: "/chuyen-khoa",
        destination: "/specialties",
        permanent: true,
      },
      {
        source: "/bac-si",
        destination: "/doctors",
        permanent: true,
      },
      {
        source: "/goi-kham",
        destination: "/packages",
        permanent: true,
      },
      {
        source: "/dich-vu",
        destination: "/services",
        permanent: true,
      },
      {
        source: "/co-so-y-te",
        destination: "/branches",
        permanent: true,
      },
      {
        source: "/ve-chung-toi",
        destination: "/about",
        permanent: true,
      },
      {
        source: "/articles/dot-quy-nhan-biet-gio-vang",
        destination: "/articles/phong-ngua-dot-quy-o-nguoi-tre-va-trung-nien",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/media/:path*",
        headers: immutableAssetHeaders,
      },
      {
        source: "/images/:path*",
        headers: immutableAssetHeaders,
      },
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  images: {
    // Next's default derivative TTL is 4 hours. The sources are 0.7-0.9 MB, so
    // re-optimizing them on every weekend-old cache miss is the expensive path;
    // retain the derivative for a week instead.
    minimumCacheTTL: 604800,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "images.pexels.com",
      },
      {
        protocol: "https",
        hostname: "img.vietqr.io",
      },
    ],
  },
};

export default nextConfig;
