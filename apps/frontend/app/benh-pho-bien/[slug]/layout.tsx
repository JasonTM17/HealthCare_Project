import type { Metadata } from "next";
import type { ReactNode } from "react";
import { createPublicRouteMetadata } from "../../../lib/public-route-metadata";
import {
  authoritativeDate,
  diseaseGuideCanonicalPath,
  getDiseaseGuideBySlug,
  isPublicDiseaseGuideSlug,
} from "./disease-guide-seo";

interface DiseaseGuideLayoutProps {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}

const FALLBACK_TITLE = "Hướng dẫn bệnh phổ biến";
const FALLBACK_DESCRIPTION =
  "Thông tin sức khỏe dễ hiểu giúp bạn nhận biết dấu hiệu cần lưu ý và chuẩn bị câu hỏi trước khi đi khám.";

function cleanText(value: string | null | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized || fallback;
}

export async function generateMetadata({ params }: DiseaseGuideLayoutProps): Promise<Metadata> {
  const { slug } = await params;
  const canonical = diseaseGuideCanonicalPath(slug);
  const article = isPublicDiseaseGuideSlug(slug) ? await getDiseaseGuideBySlug(slug) : null;

  if (!article) {
    return {
      ...createPublicRouteMetadata({
        title: FALLBACK_TITLE,
        description: FALLBACK_DESCRIPTION,
        keywords: ["bệnh phổ biến", "hướng dẫn sức khỏe"],
      }),
      alternates: { canonical },
      robots: { index: false, follow: true },
    };
  }

  const title = cleanText(article.seoTitle, article.title);
  const description = cleanText(article.seoDescription, article.summary);
  const publishedTime = authoritativeDate(article.publishedAt);
  const modifiedTime = authoritativeDate(article.updatedAt ?? article.publishedAt);
  const authorName = article.authorName?.trim();

  return {
    ...createPublicRouteMetadata({
      title,
      description,
      keywords: ["bệnh phổ biến", "kiến thức y khoa", "hướng dẫn sức khỏe"],
    }),
    alternates: { canonical },
    openGraph: {
      title,
      description,
      type: "article",
      locale: "vi_VN",
      siteName: "HealthCare",
      url: canonical,
      publishedTime,
      modifiedTime,
      authors: authorName ? [authorName] : undefined,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default function DiseaseGuideLayout({ children }: DiseaseGuideLayoutProps) {
  return children;
}
