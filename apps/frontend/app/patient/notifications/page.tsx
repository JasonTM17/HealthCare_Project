import { redirect } from "next/navigation";

/** Compatibility alias for the patient notifications route; the dashboard owns the live data. */
export default function PatientNotificationsPage(): never {
  redirect("/patient/dashboard#notifications");
}
