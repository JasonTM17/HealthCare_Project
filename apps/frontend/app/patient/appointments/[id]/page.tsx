import { redirect } from "next/navigation";

/** Compatibility alias for a patient appointment detail route; the dashboard owns the live data. */
export default async function PatientAppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<never> {
  const { id } = await params;
  redirect(`/patient/dashboard?appointmentId=${encodeURIComponent(id)}#appointments`);
}
