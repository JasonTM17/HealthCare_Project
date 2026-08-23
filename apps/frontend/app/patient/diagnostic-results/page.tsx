import { redirect } from "next/navigation";

/** Compatibility alias for the patient diagnostic-results route; the dashboard owns the live data. */
export default function PatientDiagnosticResultsPage(): never {
  redirect("/patient/dashboard#diagnostics");
}
