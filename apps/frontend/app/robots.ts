import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const allowIndexing = process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true";
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://healthcare-beta.example").replace(/\/$/u, "");
  return {
    rules: { userAgent: "*", allow: allowIndexing ? "/" : undefined, disallow: allowIndexing ? ["/api/", "/patient/", "/doctor/", "/admin/"] : "/" },
    sitemap: allowIndexing ? `${baseUrl}/sitemap.xml` : undefined,
  };
}
