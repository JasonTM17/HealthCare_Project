import { redirect } from "next/navigation";

/** Compatibility alias for the patient prescriptions route; the dashboard owns the live data. */
export default function PatientPrescriptionsPage(): never {
  redirect("/patient/dashboard#prescriptions");
}
