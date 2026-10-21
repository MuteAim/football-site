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
import { groupByKstDate, takeWholeDays, todayKst } from "@/lib/time";

const SHOW_AT_LEAST = 30;

export async function generateMetadata({
  params,
}: PageProps<"/league/[code]/results">): Promise<Metadata> {
  const { code } = await params;
  const competition = getCompetition(code);
  return { title: competition ? `${competition.name} 경기 결과` : "대회를 찾을 수 없어요" };
}

// 오늘 날짜를 써서 "오늘/어제" 표시를 하므로 화면 단위로 캐시해요.
async function Results({ code }: { code: string }) {
  "use cache";
  cacheLife("matches");

  const today = todayKst();
  const { matches } = await getCompetitionMatches(code);
  const finished = matches
    .filter(isFinished)
    .sort((a, b) => b.utcDate.localeCompare(a.utcDate));

  if (finished.length === 0) return <EmptyState>아직 끝난 경기가 없어요.</EmptyState>;
  return <MatchDayList days={groupByKstDate(takeWholeDays(finished, SHOW_AT_LEAST))} today={today} />;
}

async function ResultsForParams({
  params,
}: {
  params: PageProps<"/league/[code]/results">["params"];
}) {
  const { code } = await params;
  const competition = getCompetition(code);
  if (!competition) notFound();
  return <Results code={competition.code} />;
}

export default function ResultsPage({ params }: PageProps<"/league/[code]/results">) {
  return (
    <Suspense fallback={<ListSkeleton rows={10} />}>
      <ResultsForParams params={params} />
    </Suspense>
  );
}
