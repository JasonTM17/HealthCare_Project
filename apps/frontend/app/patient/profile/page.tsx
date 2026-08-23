import { redirect } from "next/navigation";

/** Compatibility alias for the patient profile route; the dashboard owns the live data. */
export default function PatientProfilePage(): never {
  redirect("/patient/dashboard#profile");
}
