/**
 * Doctor portrait resolution.
 *
 * The catalog is authoritative: a doctor renders their own `photoUrl` when the
 * backend supplies one, and otherwise renders the neutral initials avatar.
 * This module never assigns one clinician's photograph to another — earlier
 * drafts mapped slugs/names to shared local portraits and hash-distributed the
 * leftovers, which could publish a stranger's face on a real doctor's card.
 * Stock-photography hosts are still rejected because a stock face is not a
 * photograph of the named clinician.
 */

/**
 * Hosts that serve generic stock photography. A portrait from one of these is
 * not a photograph of the named clinician, so it is never published as one.
 */
const STOCK_PHOTO_HOST_PATTERN =
  /(?:images\.unsplash\.com|unsplash\.com|images\.pexels\.com|pexels\.com|cdn\.pixabay\.com|pixabay\.com|shutterstock\.com|istockphoto\.com|gettyimages\.com|freepik\.com|placehold\.co|placekitten\.com|picsum\.photos|loremflickr\.com)/i;

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
 * Resolve a doctor's own portrait from the catalog, or null when the doctor
 * has none. Callers render the initials avatar (see {@link getDoctorInitials})
 * for the null case instead of substituting someone else's photograph.
 */
export function getDoctorPhoto(doctor?: {
  photoUrl?: string;
} | null): string | null {
  const candidate = doctor?.photoUrl?.trim() ?? "";
  if (!candidate || candidate.includes("404")) return null;
  if (STOCK_PHOTO_HOST_PATTERN.test(candidate)) return null;
  return candidate;
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
