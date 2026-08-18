import DoctorsPageClient from "./DoctorsPageClient";

type SearchParamValue = string | string[] | undefined;

interface DoctorsPageProps {
  searchParams: Promise<{
    specialty?: SearchParamValue;
    branch?: SearchParamValue;
  }>;
}

function firstValue(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DoctorsPage({ searchParams }: DoctorsPageProps) {
  const params = await searchParams;
  return (
    <DoctorsPageClient
      branchSlug={firstValue(params.branch)}
      specialtySlug={firstValue(params.specialty)}
    />
  );
}
