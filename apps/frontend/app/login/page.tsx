import { redirect } from "next/navigation";

/**
 * Compatibility route for links shared before the auth pages moved under
 * `/auth`. Keep the original `next` destination when it is a safe local path
 * so an old bookmark never becomes a dead end.
 */
export default async function LegacyLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = typeof params.next === "string"
    && params.next.startsWith("/")
    && !params.next.startsWith("//")
    ? params.next
    : null;
  redirect(next ? `/auth/login?next=${encodeURIComponent(next)}` : "/auth/login");
}
