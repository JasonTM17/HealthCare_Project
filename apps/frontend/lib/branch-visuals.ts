import type { Branch } from "../types/hospital";

export const DISTINCT_BRANCH_IMAGES = [
  "/media/branches/branch-hospital.jpg",
  "/media/branches/branch-hospital-exterior.jpg",
  "/media/branches/branch-building.jpg",
  "/media/branches/branch-clinic.jpg",
  "/media/branches/branch-clinic-2.jpg",
  "/media/branches/branch-clinic-hall.jpg",
  "/media/branches/branch-reception.jpg",
] as const;

export const BRANCH_IMAGES: Record<string, string> = {
  // Hospital Headquarters & Flagship Branches
  "benh-vien-an-tam-trung-tam": "/media/branches/branch-hospital.jpg",
  "cs-1": "/media/branches/branch-hospital.jpg",
  "cs-2": "/media/branches/branch-hospital-exterior.jpg",
  "cs-3": "/media/branches/branch-building.jpg",
  "cs-4": "/media/branches/branch-clinic.jpg",
  "cs-5": "/media/branches/branch-clinic-2.jpg",
  "cs-6": "/media/branches/branch-clinic-hall.jpg",
  "cs-7": "/media/branches/branch-reception.jpg",
  "cs-8": "/media/branches/branch-hospital.jpg",
  "cs-9": "/media/branches/branch-hospital-exterior.jpg",
  "cs-10": "/media/branches/branch-building.jpg",
  "cs-11": "/media/branches/branch-clinic.jpg",
  "cs-12": "/media/branches/branch-clinic-2.jpg",
  "cs-13": "/media/branches/branch-clinic-hall.jpg",
  "cs-14": "/media/branches/branch-reception.jpg",
  "cs-15": "/media/branches/branch-hospital.jpg",
  "cs-16": "/media/branches/branch-hospital-exterior.jpg",
  "cs-17": "/media/branches/branch-building.jpg",
  "cs-18": "/media/branches/branch-clinic.jpg",
  "cs-19": "/media/branches/branch-clinic-2.jpg",
  "cs-20": "/media/branches/branch-clinic-hall.jpg",
  // Clinics
  "phong-kham-an-tam-thao-dien": "/media/branches/branch-building.jpg",
  "phong-kham-an-tam-phu-nhuan": "/media/branches/branch-clinic.jpg",
  "benh-vien-sai-gon-xanh": "/media/branches/branch-hospital.jpg",
  "phong-kham-thao-dien": "/media/branches/branch-building.jpg",
};

/**
 * Returns a deterministic, verified image URL for a given branch.
 */
export function getBranchImage(branch: Branch, index: number = 0): string {
  if (branch.slug && BRANCH_IMAGES[branch.slug]) {
    return BRANCH_IMAGES[branch.slug];
  }
  return DISTINCT_BRANCH_IMAGES[index % DISTINCT_BRANCH_IMAGES.length];
}
