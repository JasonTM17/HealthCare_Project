import { redirect } from "next/navigation";

/** Compatibility alias for the patient portal root; the dashboard owns the live data. */
export default function PatientPortalIndexPage(): never {
  redirect("/patient/dashboard");
}
