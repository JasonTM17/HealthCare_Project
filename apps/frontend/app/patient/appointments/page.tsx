import { redirect } from "next/navigation";

/** Compatibility alias for the patient appointments route; the dashboard owns the live data. */
export default function PatientAppointmentsPage(): never {
  redirect("/patient/dashboard#appointments");
}
