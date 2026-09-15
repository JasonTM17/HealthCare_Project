import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const allowIndexing = process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true";
  return {
    rules: { userAgent: "*", allow: allowIndexing ? "/" : undefined, disallow: allowIndexing ? ["/api/", "/patient/", "/doctor/", "/admin/"] : "/" },
    sitemap: allowIndexing ? `${SITE_URL}/sitemap.xml` : undefined,
  };
}
