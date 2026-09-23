import type { Metadata } from "next";
import type { ReactNode } from "react";
import { createPublicRouteMetadata } from "../../../lib/public-route-metadata";
import {
  articleCanonicalPath,
  authoritativeDate,
  getArticleBySlug,
  isPublicArticleSlug,
} from "./article-seo";

interface ArticleLayoutProps {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}

const FALLBACK_TITLE = "Cẩm nang sức khỏe";
const FALLBACK_DESCRIPTION =
  "Đọc nội dung sức khỏe dễ hiểu để chuẩn bị câu hỏi và chủ động hơn trước khi gặp bác sĩ.";

function cleanText(value: string | null | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized || fallback;
}

export async function generateMetadata({ params }: ArticleLayoutProps): Promise<Metadata> {
  const { slug } = await params;
  const canonical = articleCanonicalPath(slug);
  const article = isPublicArticleSlug(slug) ? await getArticleBySlug(slug) : null;

  // The public API only returns APPROVED articles, so a missing response means
  // the slug is unknown, still pending review, rejected or unpublished. The
  // client page renders a shell for those, so keep it out of the index.
  if (!article) {
    return {
      ...createPublicRouteMetadata({
        title: FALLBACK_TITLE,
        description: FALLBACK_DESCRIPTION,
        keywords: ["cẩm nang sức khỏe", "kiến thức y khoa"],
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
      keywords: ["cẩm nang sức khỏe", "kiến thức y khoa"],
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

export default function ArticleLayout({ children }: ArticleLayoutProps) {
  return children;
}
