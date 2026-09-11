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

export const DIVERSE_DOCTOR_PORTRAITS = [
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
  "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=600&h=750&q=85",
  "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=600&h=750&q=85",
  "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=600&h=750&q=85",
  "https://images.unsplash.com/photo-1622902046580-2b47f47f5471?auto=format&fit=crop&w=600&h=750&q=85",
  "https://images.unsplash.com/photo-1651008376811-b90baee60c1f?auto=format&fit=crop&w=600&h=750&q=85",
  "https://images.unsplash.com/photo-1638202993928-7267aad84c31?auto=format&fit=crop&w=600&h=750&q=85",
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

export function getDoctorPhoto(doctor: { id?: string; fullName?: string; photoUrl?: string; slug?: string }): string {
  const cleanName = (doctor.fullName || "")
    .toLowerCase()
    .replace(/^(bs\.?cki+|bs\.?ckii+|ths\.?bs\.?|ts\.?bs\.?|pgs\.?ts\.?|bs\.?)\s*/i, "")
    .trim();
  const slug = (doctor.slug || "").toLowerCase();

  // 1. Check if this is one of the 6 core clinical leaders
  for (const [leaderSlug, photo] of Object.entries(CORE_DOCTOR_PORTRAITS)) {
    if (slug.includes(leaderSlug)) return photo;
  }
  if (DOCTOR_NAME_MAP[cleanName]) {
    return DOCTOR_NAME_MAP[cleanName];
  }
  if (/\b(nguyễn minh khôi|nguyen minh khoi)\b/i.test(cleanName)) return "/media/doctors/doctor-1.jpg";
  if (/\b(võ thị mai|vo thi mai)\b/i.test(cleanName)) return "/media/doctors/doctor-2.jpg";
  if (/\b(lê văn đức|le van duc)\b/i.test(cleanName)) return "/media/doctors/doctor-3.jpg";
  if (/\b(phạm hoàng yến|pham hoang yen)\b/i.test(cleanName)) return "/media/doctors/doctor-4.jpg";
  if (/\b(trần thu hà|tran thu ha)\b/i.test(cleanName)) return "/media/doctors/doctor-5.jpg";
  if (/\b(đỗ quang huy|do quang huy)\b/i.test(cleanName)) return "/media/doctors/doctor-6.jpg";

  // 2. If photoUrl is set and it's NOT a recycled local doctor-[1-6].jpg avatar, trust it
  if (
    doctor.photoUrl &&
    doctor.photoUrl.trim() &&
    !doctor.photoUrl.includes("404") &&
    !/^\/media\/doctors\/doctor-[1-6]\.jpg$/i.test(doctor.photoUrl.trim())
  ) {
    return doctor.photoUrl;
  }

  // 3. Deterministic hash into diverse Unsplash doctor portraits pool (guaranteed no overlap with 6 core leaders)
  const key = doctor.id || doctor.slug || doctor.fullName || "doctor";
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % DIVERSE_DOCTOR_PORTRAITS.length;
  return DIVERSE_DOCTOR_PORTRAITS[index];
}
