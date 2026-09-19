import { JoinCard } from "@/components/session/entry-cards";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string | string[] }>;
}) {
  const { t } = await searchParams;
  return <JoinCard token={typeof t === "string" && t.length > 0 ? t : null} />;
}
