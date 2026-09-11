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
  "hô hấp": {
    imageSrc: "https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=1000&q=85",
    tagColor: "bg-cyan-950/80 text-cyan-100",
  },
  "tai mũi họng": {
    imageSrc: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=85",
    tagColor: "bg-teal-950/80 text-teal-100",
  },
  "da liễu": {
    imageSrc: "https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1000&q=85",
    tagColor: "bg-amber-950/80 text-amber-100",
  },
  "ung bướu": {
    imageSrc: "https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1000&q=85",
    tagColor: "bg-violet-950/80 text-violet-100",
  },
  "phòng bệnh chủ động": {
    imageSrc: "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=1000&q=85",
    tagColor: "bg-teal-950/80 text-teal-100",
  },
  "cấp cứu": {
    imageSrc: "https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?auto=format&fit=crop&w=1000&q=85",
    tagColor: "bg-red-950/80 text-red-100",
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

  if (/tim|mạch|huyết áp|cardio|suy tim|rung nhĩ|mạch vành/i.test(identity)) {
    return CATEGORY_VISUALS["tim mạch"].imageSrc;
  }
  if (/nhi|trẻ|em bé|pediatric|sốt co giật|biếng ăn/i.test(identity)) {
    return CATEGORY_VISUALS["nhi khoa"].imageSrc;
  }
  if (/dinh dưỡng|ăn uống|thực đơn|nutrition|muối|dash|béo phì|giảm cân/i.test(identity)) {
    return CATEGORY_VISUALS["dinh dưỡng"].imageSrc;
  }
  if (/tiểu đường|đái tháo đường|nội tiết|hba1c|metabolic|mỡ máu|cholesterol|insulin/i.test(identity)) {
    return CATEGORY_VISUALS["nội tiết"].imageSrc;
  }
  if (/khớp|cột sống|lưng|xương|cơ|gối|đĩa đệm|gút|loãng xương/i.test(identity)) {
    return CATEGORY_VISUALS["cơ xương khớp"].imageSrc;
  }
  if (/dạ dày|tiêu hóa|ruột|gan|mật|gastro|hp|vi khuẩn hp|gerd|trào ngược|nội soi/i.test(identity)) {
    return CATEGORY_VISUALS["tiêu hóa"].imageSrc;
  }
  if (/thần kinh|đột quỵ|não|chóng mặt|neuro|migraine|đau đầu|fast/i.test(identity)) {
    return CATEGORY_VISUALS["thần kinh"].imageSrc;
  }
  if (/phụ khoa|sinh sản|mang thai|thai kỳ|women|mãn kinh|nipt|tiền sản/i.test(identity)) {
    return CATEGORY_VISUALS["sản phụ khoa"].imageSrc;
  }
  if (/hô hấp|hen|phế quản|phổi|thở|respiratory/i.test(identity)) {
    return CATEGORY_VISUALS["hô hấp"].imageSrc;
  }
  if (/xoang|mũi|họng|tai|ent/i.test(identity)) {
    return CATEGORY_VISUALS["tai mũi họng"].imageSrc;
  }
  if (/da|mụn|dị ứng da|mẩn ngứa|dermatology|skin/i.test(identity)) {
    return CATEGORY_VISUALS["da liễu"].imageSrc;
  }
  if (/ung bướu|tầm soát ung thư|u cục|khối u|oncology/i.test(identity)) {
    return CATEGORY_VISUALS["ung bướu"].imageSrc;
  }
  if (/cấp cứu|sơ cứu|cpr|115/i.test(identity)) {
    return CATEGORY_VISUALS["cấp cứu"].imageSrc;
  }
  if (/phòng bệnh|tiêm chủng|vắc xin|vaccine/i.test(identity)) {
    return CATEGORY_VISUALS["phòng bệnh chủ động"].imageSrc;
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
