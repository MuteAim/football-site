import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EmptyState } from "@/components/EmptyState";
import { MatchDayList } from "@/components/MatchDayList";
import { ListSkeleton } from "@/components/Skeletons";
import { getCompetition } from "@/lib/competitions";
import { getCompetitionMatches } from "@/lib/football-data";
import { isFinished } from "@/lib/match-display";
import { groupByKstDate, takeWholeDays, toKstDateKey, todayKst } from "@/lib/time";

const SHOW_AT_LEAST = 30;

export async function generateMetadata({
  params,
}: PageProps<"/league/[code]/fixtures">): Promise<Metadata> {
  const { code } = await params;
  const competition = getCompetition(code);
  return { title: competition ? `${competition.name} 경기 일정` : "대회를 찾을 수 없어요" };
}

// 오늘 날짜를 써서 "오늘/내일" 표시를 하므로 화면 단위로 캐시해요.
async function Fixtures({ code }: { code: string }) {
  "use cache";
  cacheLife("matches");

  const today = todayKst();
  const { matches } = await getCompetitionMatches(code);
  const upcoming = matches
    .filter((match) => !isFinished(match) && match.status !== "CANCELLED")
    .filter((match) => match.status !== "POSTPONED" || toKstDateKey(match.utcDate) >= today)
    .sort((a, b) => a.utcDate.localeCompare(b.utcDate));

  if (upcoming.length === 0) return <EmptyState>남은 경기 일정이 없어요.</EmptyState>;
  return <MatchDayList days={groupByKstDate(takeWholeDays(upcoming, SHOW_AT_LEAST))} today={today} />;
}

async function FixturesForParams({
  params,
}: {
  params: PageProps<"/league/[code]/fixtures">["params"];
}) {
  const { code } = await params;
  const competition = getCompetition(code);
  if (!competition) notFound();
  return <Fixtures code={competition.code} />;
}

export default function FixturesPage({ params }: PageProps<"/league/[code]/fixtures">) {
  return (
    <Suspense fallback={<ListSkeleton rows={10} />}>
      <FixturesForParams params={params} />
    </Suspense>
  );
}
