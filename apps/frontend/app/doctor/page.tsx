import { redirect } from "next/navigation";

/** Compatibility alias for the doctor portal root; the dashboard owns the live data. */
export default function DoctorPortalIndexPage(): never {
  redirect("/doctor/dashboard");
}
