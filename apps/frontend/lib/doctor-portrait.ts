const DOCTOR_PORTRAITS = [
  "/media/doctors/doctor-1.jpg",
  "/media/doctors/doctor-2.jpg",
  "/media/doctors/doctor-3.jpg",
  "/media/doctors/doctor-4.jpg",
];

export function getDoctorPhoto(doctor: { id?: string; fullName?: string; photoUrl?: string }): string {
  if (doctor.photoUrl && doctor.photoUrl.trim()) {
    return doctor.photoUrl;
  }
  const key = doctor.id || doctor.fullName || "doctor";
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % DOCTOR_PORTRAITS.length;
  return DOCTOR_PORTRAITS[index];
}
