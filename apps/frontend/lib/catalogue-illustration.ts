import identity from "./catalogue-illustration.json";
import type { Branch } from "../types/hospital";

const IDS = new Set(identity.ids);
export const ILLUSTRATIVE_BOOKING_NOTICE = identity.notice;

export function isIllustrativeCatalogue(item?: { id?: string | null; slug?: string | null } | null): boolean {
  return Boolean(item && ((item.id && IDS.has(item.id.toLowerCase())) || item.slug?.startsWith(identity.slugPrefix)));
}

export function isIllustrativeSelection(selection?: { doctorId?: string; branchId?: string; packageId?: string }): boolean {
  return Boolean(selection && [selection.doctorId, selection.branchId, selection.packageId].some((id) => isIllustrativeCatalogue({ id })));
}

export function bookableBranches(branches: Branch[]): Branch[] {
  return branches.filter((branch) => !isIllustrativeCatalogue(branch)).map((branch) => ({
    ...branch, doctors: branch.doctors?.filter((doctor) => !isIllustrativeCatalogue(doctor)),
  }));
}
