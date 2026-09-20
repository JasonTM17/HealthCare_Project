import type { Doctor } from "../types/hospital";

/**
 * Public catalog presentation helpers.
 *
 * The catalog is authored server-side: article, service and package records
 * render exactly what the backend returns. This module intentionally contains
 * no content substitution — earlier drafts rewrote seeded placeholder rows
 * ("Bài viết y khoa số N", "dv-N", "goi-N") with frontend templates, which
 * masked backend data quality instead of fixing it. The backend now owns real
 * clinical copy; any remaining placeholder must be fixed at the source.
 */
export function dedupePublicDoctors(doctors: Doctor[]): Doctor[] {
  const seen = new Set<string>();
  return doctors.filter((doctor) => {
    const key = [
      doctor.fullName.trim().toLocaleLowerCase("vi-VN"),
      doctor.bio.trim().toLocaleLowerCase("vi-VN"),
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function presentPublicPage<T, P extends { content: T[] }>(page: P, transform: (value: T) => T): P {
  return { ...page, content: page.content.map(transform) };
}
