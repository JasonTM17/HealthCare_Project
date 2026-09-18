import type { HealthPackage } from "../types/hospital";

export interface PackageVisual {
  imageSrc: string;
  imageAlt: string;
  category: string;
  sourceHref: string;
  sourceLabel: string;
  tone:
    | "general"
    | "cardio"
    | "metabolic"
    | "women"
    | "children"
    | "digestive"
    | "bone-joint"
    | "neurological"
    | "cancer"
    | "geriatric"
    | "men"
    | "respiratory"
    | "premarital"
    | "executive";
}

export const ALL_PACKAGE_TONES: readonly PackageVisual["tone"][] = [
  "general",
  "cardio",
  "metabolic",
  "women",
  "children",
  "digestive",
  "bone-joint",
  "neurological",
  "cancer",
  "geriatric",
  "men",
  "respiratory",
  "premarital",
  "executive",
] as const;

export const VISUALS: Record<PackageVisual["tone"], Omit<PackageVisual, "tone">> = {
  general: {
    imageSrc: "/images/packages/general-checkup.jpg",
    imageAlt: "Người bệnh trao đổi nhu cầu sức khỏe trong phòng khám",
    category: "Khám tổng quát",
    sourceHref: "https://www.pexels.com/photo/people-woman-sitting-doctor-7088494/",
    sourceLabel: "MART PRODUCTION / Pexels",
  },
  cardio: {
    imageSrc: "/images/packages/heart-screening.jpg",
    imageAlt: "Người bệnh thực hiện kiểm tra tim mạch dưới sự theo dõi của nhân viên y tế",
    category: "Tim mạch & Huyết áp",
    sourceHref: "https://www.pexels.com/photo/patient-during-a-procedure-in-a-hospital-8460226/",
    sourceLabel: "Los Muertos Crew / Pexels",
  },
  metabolic: {
    imageSrc: "/images/packages/diabetes-screening.jpg",
    imageAlt: "Nhân viên y tế hướng dẫn kiểm tra đường huyết bằng máy đo",
    category: "Tầm soát chuyển hóa",
    sourceHref: "https://www.pexels.com/photo/glucose-meter-in-doctor-hands-7653129/",
    sourceLabel: "Pavel Danilyuk / Pexels",
  },
  women: {
    imageSrc: "/images/packages/womens-health.jpg",
    imageAlt: "Người bệnh được kiểm tra huyết áp trong buổi tư vấn sức khỏe phụ nữ",
    category: "Sức khỏe phụ nữ",
    sourceHref: "https://www.pexels.com/photo/woman-consulting-a-doctor-5215008/",
    sourceLabel: "AI25.Studio / Pexels",
  },
  children: {
    imageSrc: "/images/packages/child-checkup.jpg",
    imageAlt: "Bác sĩ khám sức khỏe cho trẻ bằng ống nghe",
    category: "Nhi khoa & Trẻ em",
    sourceHref: "https://www.pexels.com/photo/a-doctor-examining-a-child-patient-5998455/",
    sourceLabel: "Pavel Danilyuk / Pexels",
  },
  digestive: {
    imageSrc: "/images/packages/digestive-health.jpg",
    imageAlt: "Bác sĩ chuyên khoa thăm khám và tư vấn hệ tiêu hóa",
    category: "Tiêu hóa & Gan mật",
    sourceHref: "https://www.pexels.com/license/",
    sourceLabel: "HealthCare Clinical Asset",
  },
  "bone-joint": {
    imageSrc: "/images/packages/bone-joint.jpg",
    imageAlt: "Đo mật độ xương DEXA và tầm soát bệnh lý cơ xương khớp",
    category: "Cơ xương khớp",
    sourceHref: "https://www.pexels.com/license/",
    sourceLabel: "HealthCare Clinical Asset",
  },
  neurological: {
    imageSrc: "/images/packages/neurological-health.jpg",
    imageAlt: "Tầm soát chức năng thần kinh, não bộ và phòng ngừa đột quỵ",
    category: "Thần kinh & Não bộ",
    sourceHref: "https://www.pexels.com/license/",
    sourceLabel: "HealthCare Clinical Asset",
  },
  cancer: {
    imageSrc: "/images/packages/cancer-screening.jpg",
    imageAlt: "Hệ thống chẩn đoán hình ảnh và tầm soát sớm ung bướu kỹ thuật cao",
    category: "Tầm soát ung bướu",
    sourceHref: "https://www.pexels.com/license/",
    sourceLabel: "HealthCare Clinical Asset",
  },
  geriatric: {
    imageSrc: "/images/packages/geriatric-health.jpg",
    imageAlt: "Chăm sóc sức khỏe toàn diện và quản lý bệnh lý mãn tính cho người cao tuổi",
    category: "Lão khoa & Cao tuổi",
    sourceHref: "https://www.pexels.com/license/",
    sourceLabel: "HealthCare Clinical Asset",
  },
  men: {
    imageSrc: "/images/packages/mens-health.jpg",
    imageAlt: "Khám và tầm soát chuyên sâu sức khỏe phái mạnh, nội tiết và nam học",
    category: "Sức khỏe nam giới",
    sourceHref: "https://www.pexels.com/license/",
    sourceLabel: "HealthCare Clinical Asset",
  },
  respiratory: {
    imageSrc: "/images/packages/respiratory-health.jpg",
    imageAlt: "Thăm khám chức năng hô hấp, tầm soát bệnh lý phổi và phế quản",
    category: "Hô hấp & Phổi",
    sourceHref: "https://www.pexels.com/license/",
    sourceLabel: "HealthCare Clinical Asset",
  },
  premarital: {
    imageSrc: "/images/packages/premarital-checkup.jpg",
    imageAlt: "Tư vấn và kiểm tra sức khỏe tiền hôn nhân cho các cặp đôi",
    category: "Tiền hôn nhân",
    sourceHref: "https://www.pexels.com/license/",
    sourceLabel: "HealthCare Clinical Asset",
  },
  executive: {
    imageSrc: "/images/packages/executive-checkup.jpg",
    imageAlt: "Khám sức khỏe tổng quát chuyên sâu cao cấp cho doanh nhân",
    category: "Khám chuyên sâu VIP",
    sourceHref: "https://www.pexels.com/license/",
    sourceLabel: "HealthCare Clinical Asset",
  },
};

/** Deterministic string hash for stable visual allocation across package collections */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Recognize clinical specialty from package name or slug keywords.
 * Returns the matching tone, or null if it's a general or unclassified package.
 */
export function resolveTone(packageItem: Pick<HealthPackage, "slug" | "name">): PackageVisual["tone"] | null {
  const identity = `${packageItem.slug} ${packageItem.name}`.toLocaleLowerCase("vi-VN");

  // 1. Cardio / Tim mạch & Huyết áp
  if (/tim|mạch|cardio|huyết áp|huyet-ap|mạch vành|đo điện tim|ecg|holter|xơ vữa/.test(identity)) {
    return "cardio";
  }

  // 2. Metabolic & Diabetes / Chuyển hóa & Tiểu đường
  if (/tiểu đường|tieu-duong|đường huyết|duong-huyet|chuyển hóa|chuyen-hoa|tuyến giáp|tuyen-giap|gút|gout|mỡ máu|lipid|đái tháo đường|dinh dưỡng/.test(identity)) {
    return "metabolic";
  }

  // 3. Premarital / Tiền hôn nhân & Cặp đôi (evaluated before women to keep couples distinct)
  if (/tiền hôn nhân|tien-hon-nhan|cặp đôi|cap-doi|hôn nhân|hon-nhan|sinh sản cặp đôi|chuẩn bị kết hôn/.test(identity)) {
    return "premarital";
  }

  // 4. Women's Health / Sản phụ khoa & Sức khỏe phụ nữ
  if (/phụ nữ|phu-nu|phụ khoa|phu-khoa|thai sản|thai-san|sản|san-khoa|sinh sản|tử cung|buồng trứng|nhũ ảnh|tầm soát vú|mammography|cổ tử cung|pap smear/.test(identity)) {
    return "women";
  }

  // 5. Pediatrics / Nhi khoa & Trẻ em
  if (/trẻ em|tre-em|nhi|nhi-khoa|cho bé|cho-be|trẻ nhỏ|tre-nho|tiêm chủng|tiem-chung|sơ sinh|so-sinh|phát triển trẻ/.test(identity)) {
    return "children";
  }

  // 6. Digestive & Hepatobiliary / Tiêu hóa & Gan mật
  if (/tiêu hóa|tieu-hoa|dạ dày|da-day|gan mật|gan-mat|đại tràng|dai-trang|vi khuẩn hp|nội soi|trào ngược|gerd|viêm gan|men gan|trĩ|ruột/.test(identity)) {
    return "digestive";
  }

  // 7. Musculoskeletal & Bone-Joint / Cơ xương khớp
  if (/xương khớp|xuong-khop|cơ xương khớp|co-xuong-khop|loãng xương|loang-xuong|cột sống|cot-song|thoái hóa|khớp|gân|thoát vị|thoat-vi|dexa|mật độ xương/.test(identity)) {
    return "bone-joint";
  }

  // 8. Neurology & Stroke / Thần kinh & Đột quỵ
  if (/thần kinh|than-kinh|đột quỵ|dot-quy|não|nao-bo|tai biến|tiền đình|mất ngủ|đau đầu|stress|mạch máu não/.test(identity)) {
    return "neurological";
  }

  // 9. Oncology & Cancer Screening / Ung bướu & Tầm soát ung thư
  if (/ung bướu|ung-buou|ung thư|ung-thu|tầm soát u|tam-soat-u|sinh thiết|marker ung thư|khối u|oncology|tầm soát sớm ung thư/.test(identity)) {
    return "cancer";
  }

  // 10. Geriatrics / Lão khoa & Người cao tuổi
  if (/cao tuổi|cao-tuoi|lão khoa|lao-khoa|người già|nguoi-gia|hưu trí|tuổi vàng|người cao tuổi|an dưỡng/.test(identity)) {
    return "geriatric";
  }

  // 11. Men's Health / Nam khoa & Phái mạnh
  if (/nam giới|nam-gioi|nam khoa|nam-khoa|phái mạnh|tuyến tiền liệt|nam học|andrology|sinh lý nam/.test(identity)) {
    return "men";
  }

  // 12. Respiratory / Hô hấp & Phổi
  if (/hô hấp|ho-hap|phổi|phoi|phế quản|phe-quan|hen suyễn|xoang|chức năng hô hấp|viêm phế quản/.test(identity)) {
    return "respiratory";
  }

  // 13. Executive / VIP & Doanh nhân
  if (/vip|doanh nhân|doanh-nhan|lãnh đạo|executive|hạng thương gia|premium|platinum|diamond/.test(identity)) {
    return "executive";
  }

  return null;
}

/** Extract rank, level, or numeric identifier from package name and slug */
function extractRankOrIndex(packageItem: Pick<HealthPackage, "slug" | "name">): number | null {
  const name = packageItem.name || "";
  const slug = packageItem.slug || "";

  // Explicit rank, tier, grade, or count in Vietnamese or English
  const nameMatch = name.match(/(?:Hạng|Hang|Cấp\s+[A-Z]\s+#|#|lần|lựa chọn|số|Gói)\s*(\d+)/i);
  if (nameMatch) {
    const num = parseInt(nameMatch[1], 10);
    if (!Number.isNaN(num) && num > 0) return num;
  }

  // Slug patterns (e.g. "goi-1", "goi-kham-2", "pkg-3", "package-4", "so-5", "-6")
  const slugMatch = slug.match(/(?:goi|pkg|package|so|kham|hang)[-_](\d+)/i) || slug.match(/[-_](\d+)$/);
  if (slugMatch) {
    const num = parseInt(slugMatch[1], 10);
    if (!Number.isNaN(num) && num > 0) return num;
  }

  return null;
}

/** Intra-specialty tone variants to prevent identical imagery on multi-tiered packages */
const SPECIALTY_VARIANTS: Partial<Record<PackageVisual["tone"], readonly PackageVisual["tone"][]>> = {
  executive: ["executive", "cardio", "cancer", "neurological", "digestive", "geriatric"],
  women: ["women", "premarital", "cancer", "metabolic"],
  "bone-joint": ["bone-joint", "geriatric", "neurological"],
  cardio: ["cardio", "metabolic", "executive"],
  digestive: ["digestive", "cancer", "metabolic"],
};

/**
 * Deterministically allocate vivid, distinct images for health packages.
 *
 * Guarantees that packages on catalog and detail pages never collapse into
 * duplicate default fallbacks, rotating smoothly across all 14+ clinical tones.
 */
export function getPackageVisual(
  packageItem?: (Pick<HealthPackage, "slug" | "name"> & { id?: string }) | null
): PackageVisual {
  if (!packageItem) {
    return { ...VISUALS.general, tone: "general" };
  }

  const recognizedTone = resolveTone(packageItem);
  const rankNum = extractRankOrIndex(packageItem);

  // 1. Explicit specialty recognized from clinical keywords
  if (recognizedTone) {
    const variants = SPECIALTY_VARIANTS[recognizedTone];
    if (variants && rankNum !== null && rankNum > 1) {
      const variantTone = variants[(rankNum - 1) % variants.length];
      return { ...VISUALS[variantTone], tone: variantTone };
    }
    return { ...VISUALS[recognizedTone], tone: recognizedTone };
  }

  // 2. Ranked or numbered general packages: cycle deterministically across all 14 tones
  if (rankNum !== null) {
    const tone = ALL_PACKAGE_TONES[(rankNum - 1) % ALL_PACKAGE_TONES.length];
    return { ...VISUALS[tone], tone };
  }

  // 3. Unranked packages: deterministically allocate across all 14 tones by identity hash
  const identity = packageItem.id || packageItem.slug || packageItem.name || "package";
  const index = hashString(identity) % ALL_PACKAGE_TONES.length;
  const tone = ALL_PACKAGE_TONES[index];
  return { ...VISUALS[tone], tone };
}
