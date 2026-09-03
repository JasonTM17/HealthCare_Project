const DOCTOR_PORTRAITS = [
  "/media/doctors/doctor-1.jpg",
  "/media/doctors/doctor-2.jpg",
  "/media/doctors/doctor-3.jpg",
  "/media/doctors/doctor-4.jpg",
  "/media/doctors/doctor-5.jpg",
  "/media/doctors/doctor-6.jpg",
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
};

export function getDoctorPhoto(doctor: { id?: string; fullName?: string; photoUrl?: string; slug?: string }): string {
  if (doctor.photoUrl && doctor.photoUrl.trim() && !doctor.photoUrl.includes("404")) {
    return doctor.photoUrl;
  }
  const cleanName = (doctor.fullName || "")
    .toLowerCase()
    .replace(/^(bs\.?cki+|bs\.?ckii+|ths\.?bs\.?|ts\.?bs\.?|pgs\.?ts\.?|bs\.?)\s*/i, "")
    .trim();
  if (DOCTOR_NAME_MAP[cleanName]) {
    return DOCTOR_NAME_MAP[cleanName];
  }
  const slug = (doctor.slug || "").toLowerCase();
  for (const [key, photo] of Object.entries(DOCTOR_NAME_MAP)) {
    if (slug.includes(key.replace(/\s+/g, "-"))) return photo;
  }
  const name = (doctor.fullName || "").toLowerCase();
  if (name.includes("khôi") || slug.includes("khoi")) return "/media/doctors/doctor-1.jpg";
  if (name.includes("mai")) return "/media/doctors/doctor-2.jpg";
  if (name.includes("đức") || slug.includes("duc")) return "/media/doctors/doctor-3.jpg";
  if (name.includes("yến") || slug.includes("yen")) return "/media/doctors/doctor-4.jpg";
  if (name.includes("hà") || slug.includes("ha")) return "/media/doctors/doctor-5.jpg";
  if (name.includes("huy")) return "/media/doctors/doctor-6.jpg";
  const key = doctor.id || doctor.fullName || "doctor";
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % DOCTOR_PORTRAITS.length;
  return DOCTOR_PORTRAITS[index];
}
