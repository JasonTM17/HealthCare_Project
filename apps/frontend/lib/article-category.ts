/**
 * Article category labels.
 *
 * Category values arrive from the catalog as uppercase tokens ("CARDIOLOGY"),
 * so rendering them directly surfaces machine vocabulary in the Vietnamese
 * interface. The `/benh-pho-bien` hub already mapped them; the article listing
 * and detail pages did not, which meant the same article was titled "Khoa Tim
 * mạch" in one place and "Khoa CARDIOLOGY" in another. Both now resolve through
 * this module.
 *
 * An unrecognised token is title-cased rather than dropped, so a category added
 * to the catalog still reads as words instead of shouting in capitals.
 */

export const ARTICLE_CATEGORY_LABELS: Record<string, string> = {
  CARDIOLOGY: "Tim mạch",
  DERMATOLOGY: "Da liễu",
  ENDOCRINOLOGY: "Nội tiết",
  GASTROENTEROLOGY: "Tiêu hóa",
  GENERAL: "Sức khỏe tổng quát",
  GYNECOLOGY: "Sản phụ khoa",
  NEUROLOGY: "Thần kinh",
  ONCOLOGY: "Ung bướu",
  PEDIATRICS: "Nhi khoa",
  RESPIRATORY: "Hô hấp",
  UROLOGY: "Tiết niệu",
  MUSCULOSKELETAL: "Cơ xương khớp",
  OPHTHALMOLOGY: "Mắt",
  OTOLARYNGOLOGY: "Tai Mũi Họng",
  PSYCHIATRY: "Tâm thần",
  NEPHROLOGY: "Thận - Tiết niệu",
};

function titleCaseToken(token: string): string {
  return token
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Resolve a category token to its Vietnamese label.
 *
 * Returns ``fallback`` when the value is absent. Already-humanised values pass
 * through unchanged so a catalog that stores "Tim mạch" is not mangled.
 */
export function resolveArticleCategoryLabel(
  category: string | null | undefined,
  fallback = "Cẩm nang y tế",
): string {
  const value = (category ?? "").trim();
  if (!value) return fallback;

  const mapped = ARTICLE_CATEGORY_LABELS[value.toUpperCase()];
  if (mapped) return mapped;

  // A token with no lowercase letters is machine vocabulary; anything else is
  // already written for humans.
  return /^[A-Z0-9_\s-]+$/.test(value) ? titleCaseToken(value) : value;
}
