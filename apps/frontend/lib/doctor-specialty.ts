import type { Doctor, Specialty } from "./api-client";

/**
 * Resolves the catalog specialty that best identifies a doctor's primary
 * specialty. Kept in lib/ so catalog pages can use it without pulling the
 * lazily-loaded booking modal into their initial bundle.
 */
export function specialtyIdForDoctor(doctor: Doctor | undefined, specialties: Specialty[]): string {
  if (!doctor) return "";

  const docRecord = doctor as unknown as Record<string, unknown>;
  if (typeof docRecord.specialtyId === "string" && docRecord.specialtyId) {
    return docRecord.specialtyId;
  }
  if (Array.isArray(docRecord.specialties) && docRecord.specialties.length > 0) {
    const first = docRecord.specialties[0] as { id?: string } | undefined;
    if (first?.id) return first.id;
  }

  const primaryName = doctor.specialtyName?.trim().toLocaleLowerCase("vi-VN");
  if (primaryName) {
    const byName = specialties.find((specialty) => (
      specialty.name.trim().toLocaleLowerCase("vi-VN") === primaryName
    ));
    if (byName) return byName.id;
    const byPartialName = specialties.find((specialty) => {
      const specName = specialty.name.trim().toLocaleLowerCase("vi-VN");
      return primaryName.includes(specName) || specName.includes(primaryName);
    });
    if (byPartialName) return byPartialName.id;
  }

  return doctor.specialtySlugs?.map((slug) => specialties.find((specialty) => specialty.slug === slug))
    .find((specialty): specialty is Specialty => Boolean(specialty))?.id ?? "";
}
