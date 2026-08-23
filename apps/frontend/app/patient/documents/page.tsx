import { redirect } from "next/navigation";

/** Compatibility alias for the patient documents route; the dashboard groups file access in records. */
export default function PatientDocumentsPage(): never {
  redirect("/patient/dashboard#records");
}
