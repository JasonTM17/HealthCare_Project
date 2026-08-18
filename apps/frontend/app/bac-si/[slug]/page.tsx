import { redirect } from "next/navigation";

/** Compatibility alias for old Vietnamese links; the canonical route owns the live data. */
export default async function LegacyDoctorDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<never> {
  const { slug } = await params;
  redirect(`/doctors/${encodeURIComponent(slug)}`);
}
