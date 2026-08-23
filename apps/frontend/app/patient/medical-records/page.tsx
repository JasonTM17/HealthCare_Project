import { redirect } from "next/navigation";

/** Compatibility alias for the patient medical-records route; the dashboard owns the live data. */
export default function PatientMedicalRecordsPage(): never {
  redirect("/patient/dashboard#records");
}
