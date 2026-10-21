import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton } from "@/components/Skeletons";
import { StandingsTable } from "@/components/StandingsTable";
import { getCompetition } from "@/lib/competitions";
import { getStandings } from "@/lib/football-data";
import { groupLabel, stageLabel } from "@/lib/match-display";
import { seasonLabel } from "@/lib/time";

export async function generateMetadata({ params }: PageProps<"/league/[code]">): Promise<Metadata> {
  const { code } = await params;
  const competition = getCompetition(code);
  return { title: competition ? `${competition.name} 순위` : "대회를 찾을 수 없어요" };
}

async function Standings({ params }: { params: PageProps<"/league/[code]">["params"] }) {
  const { code } = await params;
  const competition = getCompetition(code);
  if (!competition) notFound();

  const data = await getStandings(competition.code);
  if (!data || data.tables.length === 0) {
    return <EmptyState>지금은 볼 수 있는 순위표가 없어요.</EmptyState>;
  }

  const multiple = data.tables.length > 1;
  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{seasonLabel(data.season)}</p>
      {data.tables.map((table, index) => (
        <StandingsTable
          key={`${table.stage}-${table.group ?? index}`}
          title={multiple ? (groupLabel(table.group) ?? stageLabel(table.stage)) : null}
          rows={table.table}
        />
      ))}
    </div>
  );
}

export default function StandingsPage({ params }: PageProps<"/league/[code]">) {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <Standings params={params} />
    </Suspense>
  );
}
