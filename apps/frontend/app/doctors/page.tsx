import DoctorsPageClient from "./DoctorsPageClient";

/**
 * Prerender the doctor directory like its catalog siblings (specialties,
 * packages, branches, ...) and refresh the cached document every five minutes.
 *
 * Reading `searchParams` on the server is what previously kept this route
 * dynamic — every visit paid a server render while `/specialties` was served
 * from the CDN. The interactive specialty/branch filters are resolved
 * client-side from the URL by `DoctorsPageClient`, so the route keeps a single
 * cached document for every query-string variant and the UX is unchanged.
 */
export const revalidate = 300;

export default function DoctorsPage() {
  return <DoctorsPageClient />;
}
