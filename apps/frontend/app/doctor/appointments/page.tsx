import { redirect } from "next/navigation";

/** Compatibility alias for the doctor appointments route; the dashboard owns the live data. */
export default function DoctorAppointmentsPage(): never {
  redirect("/doctor/dashboard#daily-appointments");
}
