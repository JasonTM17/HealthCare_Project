import type { Metadata } from "next";

interface PublicRouteMetadataInput {
  title: string;
  description: string;
  keywords?: string[];
}

/** Keeps public catalog metadata consistent while preserving the root robots policy. */
export function createPublicRouteMetadata({
  title,
  description,
  keywords = [],
}: PublicRouteMetadataInput): Metadata {
  return {
    title,
    description,
    keywords: ["HealthCare", "bệnh viện", ...keywords],
    openGraph: {
      title,
      description,
      type: "website",
      locale: "vi_VN",
      siteName: "HealthCare",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}
