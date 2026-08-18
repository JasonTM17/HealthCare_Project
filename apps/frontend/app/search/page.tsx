import SearchPageClient from "./SearchPageClient";

interface SearchPageProps {
  searchParams: Promise<{ q?: string | string[] }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps): Promise<React.ReactElement> {
  const params = await searchParams;
  const rawQuery = params.q;
  const initialQuery = Array.isArray(rawQuery) ? rawQuery[0] ?? "" : rawQuery ?? "";
  return <SearchPageClient initialQuery={initialQuery} key={initialQuery} />;
}
