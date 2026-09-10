import type { Article } from "../types/hospital";

export interface ArticleVisual {
  imageSrc: string;
  imageAlt: string;
  category: string;
  tagColor: string;
}

const CATEGORY_VISUALS: Record<string, { imageSrc: string; tagColor: string }> = {
  "tim mạch": {
    imageSrc: "/media/articles/5-dau-hieu-tim-mach.jpg",
    tagColor: "bg-rose-950/80 text-rose-100",
  },
  "nhi khoa": {
    imageSrc: "/media/articles/tre-bieng-an.jpg",
    tagColor: "bg-amber-950/80 text-amber-100",
  },
  "dinh dưỡng": {
    imageSrc: "/media/articles/dinh-duong-tang-huyet-ap.jpg",
    tagColor: "bg-emerald-950/80 text-emerald-100",
  },
  "sức khỏe gia đình": {
    imageSrc: "/media/articles/cham-soc-suc-khoe-tong-quat.jpg",
    tagColor: "bg-teal-950/80 text-teal-100",
  },
  "cơ xương khớp": {
    imageSrc: "/media/articles/thoai-hoa-cot-song.jpg",
    tagColor: "bg-sky-950/80 text-sky-100",
  },
  "nội tiết": {
    imageSrc: "/media/articles/tam-soat-tieu-duong.jpg",
    tagColor: "bg-indigo-950/80 text-indigo-100",
  },
  "tiêu hóa": {
    imageSrc: "/media/articles/viem-loet-da-day.jpg",
    tagColor: "bg-orange-950/80 text-orange-100",
  },
  "thần kinh": {
    imageSrc: "/media/articles/phong-ngua-dot-quy.jpg",
    tagColor: "bg-purple-950/80 text-purple-100",
  },
  "sản phụ khoa": {
    imageSrc: "/images/packages/womens-health.jpg",
    tagColor: "bg-pink-950/80 text-pink-100",
  },
  "tổng quát": {
    imageSrc: "/media/articles/cham-soc-suc-khoe-tong-quat.jpg",
    tagColor: "bg-teal-950/80 text-teal-100",
  },
};

const DEFAULT_COVER = "/media/articles/cham-soc-suc-khoe-tong-quat.jpg";

/**
 * Resolves a high-quality clinical cover image for an article.
 * Falls back to curated medical photography based on article category, slug, or title.
 */
export function resolveArticleCoverImage(
  article?: Partial<Pick<Article, "coverImageUrl" | "category" | "slug" | "title">> | null,
): string {
  if (article?.coverImageUrl && article.coverImageUrl.trim()) {
    return article.coverImageUrl.trim();
  }

  const identity = `${article?.category ?? ""} ${article?.slug ?? ""} ${article?.title ?? ""}`.toLocaleLowerCase("vi-VN");

  if (/tim|mạch|huyết áp|cardio/i.test(identity)) {
    return CATEGORY_VISUALS["tim mạch"].imageSrc;
  }
  if (/nhi|trẻ|em bé|pediatric/i.test(identity)) {
    return CATEGORY_VISUALS["nhi khoa"].imageSrc;
  }
  if (/dinh dưỡng|ăn uống|thực đơn|nutrition/i.test(identity)) {
    return CATEGORY_VISUALS["dinh dưỡng"].imageSrc;
  }
  if (/tiểu đường|đái tháo đường|nội tiết|hba1c|metabolic/i.test(identity)) {
    return CATEGORY_VISUALS["nội tiết"].imageSrc;
  }
  if (/khớp|cột sống|lưng|xương|cơ/i.test(identity)) {
    return CATEGORY_VISUALS["cơ xương khớp"].imageSrc;
  }
  if (/dạ dày|tiêu hóa|ruột|gan|mật|gastro/i.test(identity)) {
    return CATEGORY_VISUALS["tiêu hóa"].imageSrc;
  }
  if (/thần kinh|đột quỵ|não|chóng mặt|neuro/i.test(identity)) {
    return CATEGORY_VISUALS["thần kinh"].imageSrc;
  }
  if (/phụ khoa|sinh sản|mang thai|thai kỳ|women/i.test(identity)) {
    return CATEGORY_VISUALS["sản phụ khoa"].imageSrc;
  }

  return DEFAULT_COVER;
}

/**
 * Returns accessible image alt text for an article cover.
 */
export function resolveArticleAlt(
  article?: Partial<Pick<Article, "title" | "category">> | null,
): string {
  if (article?.title) {
    return `Ảnh chuyên đề: ${article.title}`;
  }
  if (article?.category) {
    return `Ảnh chuyên đề y khoa - ${article.category}`;
  }
  return "Ảnh chuyên đề sức khỏe y khoa";
}
