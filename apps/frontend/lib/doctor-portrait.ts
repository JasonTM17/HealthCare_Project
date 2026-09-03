const DOCTOR_PORTRAITS = [
  "/media/doctors/doctor-1.jpg",
  "/media/doctors/doctor-2.jpg",
  "/media/doctors/doctor-3.jpg",
  "/media/doctors/doctor-4.jpg",
  "/media/doctors/doctor-5.jpg",
  "/media/doctors/doctor-6.jpg",
];

export function getDoctorPhoto(doctor: { id?: string; fullName?: string; photoUrl?: string; slug?: string }): string {
  if (doctor.photoUrl && doctor.photoUrl.trim()) {
    return doctor.photoUrl;
  }
  const name = (doctor.fullName || "").toLowerCase();
  const slug = (doctor.slug || "").toLowerCase();
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
