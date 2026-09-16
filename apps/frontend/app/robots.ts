import type { MetadataRoute } from "next";
import { SITE_URL, indexingAllowed } from "../lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const allowIndexing = indexingAllowed();
  return {
    rules: { userAgent: "*", allow: allowIndexing ? "/" : undefined, disallow: allowIndexing ? ["/api/", "/patient/", "/doctor/", "/admin/"] : "/" },
    sitemap: allowIndexing ? `${SITE_URL}/sitemap.xml` : undefined,
  };
}
