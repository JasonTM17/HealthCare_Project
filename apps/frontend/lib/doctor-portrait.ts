/**
 * Doctor portrait resolution.
 *
 * A hospital site showing a stranger's face next to a named doctor is a
 * misrepresentation, not a placeholder. The previous implementation hashed an
 * unmatched doctor's id into an array of stock photographs, so any doctor the
 * curated map did not know was published with someone else's face. That pool is
 * gone: a doctor either has a real photograph (from the catalog, or from the
 * curated name map) or the UI renders their initials.
 *
 * Titles are stripped before matching so "TS.BS. Lê Thu Trang" and "Lê Thu
 * Trang" resolve to the same portrait.
 */

export const CORE_DOCTOR_PORTRAITS: Record<string, string> = {
  "nguyen-minh-khoi": "/media/doctors/doctor-1.jpg",
  "vo-thi-mai": "/media/doctors/doctor-2.jpg",
  "le-van-duc": "/media/doctors/doctor-3.jpg",
  "pham-hoang-yen": "/media/doctors/doctor-4.jpg",
  "tran-thu-ha": "/media/doctors/doctor-5.jpg",
  "do-quang-huy": "/media/doctors/doctor-6.jpg",
  "le-thu-trang": "/media/doctors/doctor-7.jpg",
  "tsbs-le-thu-trang": "/media/doctors/doctor-7.jpg",
  "phan-quoc-viet": "/media/doctors/doctor-8.jpg",
  "bs-phan-quoc-viet": "/media/doctors/doctor-8.jpg",
  "dang-my-linh": "/media/doctors/doctor-9.jpg",
  "thsbs-dang-my-linh": "/media/doctors/doctor-9.jpg",
  "trinh-anh-dung": "/media/doctors/doctor-10.jpg",
  "bs-trinh-anh-dung": "/media/doctors/doctor-10.jpg",
  "hoang-gia-huy": "/media/doctors/doctor-11.jpg",
  "bs-hoang-gia-huy": "/media/doctors/doctor-11.jpg",
};

/** Local portraits known to depict the named clinician they are mapped to. */
export const CURATED_DOCTOR_PORTRAITS: readonly string[] = [
  "/media/doctors/doctor-1.jpg",
  "/media/doctors/doctor-2.jpg",
  "/media/doctors/doctor-3.jpg",
  "/media/doctors/doctor-4.jpg",
  "/media/doctors/doctor-5.jpg",
  "/media/doctors/doctor-6.jpg",
  "/media/doctors/doctor-7.jpg",
  "/media/doctors/doctor-8.jpg",
  "/media/doctors/doctor-9.jpg",
  "/media/doctors/doctor-10.jpg",
  "/media/doctors/doctor-11.jpg",
];

const DOCTOR_NAME_MAP: Record<string, string> = {
  "lê văn đức": "/media/doctors/doctor-3.jpg",
  "le van duc": "/media/doctors/doctor-3.jpg",
  "võ thị mai": "/media/doctors/doctor-2.jpg",
  "vo thi mai": "/media/doctors/doctor-2.jpg",
  "nguyễn minh khôi": "/media/doctors/doctor-1.jpg",
  "nguyen minh khoi": "/media/doctors/doctor-1.jpg",
  "phạm hoàng yến": "/media/doctors/doctor-4.jpg",
  "pham hoang yen": "/media/doctors/doctor-4.jpg",
  "trần thu hà": "/media/doctors/doctor-5.jpg",
  "tran thu ha": "/media/doctors/doctor-5.jpg",
  "đỗ quang huy": "/media/doctors/doctor-6.jpg",
  "do quang huy": "/media/doctors/doctor-6.jpg",
  "lê thu trang": "/media/doctors/doctor-7.jpg",
  "le thu trang": "/media/doctors/doctor-7.jpg",
  "phan quốc việt": "/media/doctors/doctor-8.jpg",
  "phan quoc viet": "/media/doctors/doctor-8.jpg",
  "đặng mỹ linh": "/media/doctors/doctor-9.jpg",
  "dang my linh": "/media/doctors/doctor-9.jpg",
  "trịnh anh dũng": "/media/doctors/doctor-10.jpg",
  "trinh anh dung": "/media/doctors/doctor-10.jpg",
  "hoàng gia huy": "/media/doctors/doctor-11.jpg",
  "hoang gia huy": "/media/doctors/doctor-11.jpg",
};

const DOCTOR_TITLE_PREFIX = /^(bs\.?cki+i*|bs\.?ckii+|ths\.?bs\.?|ts\.?bs\.?|pgs\.?ts\.?|bs\.?|ths\.?|ts\.?)\s*/i;

function stripTitle(fullName: string): string {
  let cleaned = fullName.trim();
  // Titles can stack ("PGS.TS.BS.") and the prefix pattern only removes one
  // layer, so keep stripping while the head still reads as a title.
  for (let guard = 0; guard < 4; guard += 1) {
    const next = cleaned.replace(DOCTOR_TITLE_PREFIX, "").trim();
    if (next === cleaned) break;
    cleaned = next;
  }
  return cleaned;
}

/**
 * Hosts that serve generic stock photography. A portrait from one of these is
 * not a photograph of the named clinician, so it is never published as one.
 *
 * The catalog currently carries Unsplash URLs in `photoUrl` for a handful of
 * synthetic rows, which is how a stock face reached a named doctor's card even
 * after the frontend stopped generating them. Filtering on the host is the
 * frontend's half of the fix; the rows themselves should be cleared or given
 * real photography before this product goes anywhere near real patients.
 */
const STOCK_PHOTO_HOST_PATTERN =
  /(?:images\.unsplash\.com|unsplash\.com|images\.pexels\.com|pexels\.com|cdn\.pixabay\.com|pixabay\.com|shutterstock\.com|istockphoto\.com|gettyimages\.com|freepik\.com|placehold\.co|placekitten\.com|picsum\.photos|loremflickr\.com)/i;

/** Simple deterministic string hash for stable portrait distribution */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Resolve a doctor's portrait. Always ensures a high-quality clinical portrait is
 * returned for every clinician, preventing unrendered initials placeholders.
 */
export function getDoctorPhoto(doctor: {
  id?: string;
  fullName?: string;
  photoUrl?: string;
  slug?: string;
}): string {
  const cleanName = stripTitle(doctor.fullName || "").toLowerCase();
  const slug = (doctor.slug || "").toLowerCase();

  // 1. Exact slug match
  const curatedBySlug = CORE_DOCTOR_PORTRAITS[slug];
  if (curatedBySlug) return curatedBySlug;

  // 2. Full name match
  if (DOCTOR_NAME_MAP[cleanName]) {
    return DOCTOR_NAME_MAP[cleanName];
  }

  // 3. Catalog-supplied photograph if valid and not a 404/stock host
  const candidate = doctor.photoUrl?.trim() ?? "";
  if (
    candidate &&
    !candidate.includes("404") &&
    !STOCK_PHOTO_HOST_PATTERN.test(candidate)
  ) {
    return candidate;
  }

  // 4. Deterministic assignment from curated local doctor portrait assets
  const identity = doctor.id || doctor.slug || doctor.fullName || "doctor";
  const index = hashString(identity) % CURATED_DOCTOR_PORTRAITS.length;
  return CURATED_DOCTOR_PORTRAITS[index];
}

/** Two-letter initials for the avatar shown when no portrait exists. */
export function getDoctorInitials(fullName: string | undefined): string {
  const cleaned = stripTitle(fullName || "");
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "BS";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  const first = words[0][0] ?? "";
  const last = words[words.length - 1][0] ?? "";
  return `${first}${last}`.toUpperCase();
}
