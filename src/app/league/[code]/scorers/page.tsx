import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Crest } from "@/components/Crest";
import { EmptyState } from "@/components/EmptyState";
import { cardClass } from "@/components/MatchDayList";
import { TableSkeleton } from "@/components/Skeletons";
import { getCompetition } from "@/lib/competitions";
import { getScorers, type Scorer } from "@/lib/football-data";
import { isKoreanPlayer } from "@/lib/match-display";
import { teamName } from "@/lib/teams-ko";
import { seasonLabel } from "@/lib/time";

export async function generateMetadata({
  params,
}: PageProps<"/league/[code]/scorers">): Promise<Metadata> {
  const { code } = await params;
  const competition = getCompetition(code);
  return { title: competition ? `${competition.name} 득점 순위` : "대회를 찾을 수 없어요" };
}

/** 골 수가 같으면 같은 순위를 줘요. 예: 1, 2, 2, 4 */
function ranks(scorers: Scorer[]): number[] {
  return scorers.reduce<number[]>((acc, scorer, index) => {
    const tied = index > 0 && scorer.goals === scorers[index - 1].goals;
    acc.push(tied ? acc[index - 1] : index + 1);
    return acc;
  }, []);
}

const num = "w-9 py-2 text-center";

function ScorersTable({ scorers }: { scorers: Scorer[] }) {
  const rankList = ranks(scorers);
  return (
    <div className={cardClass}>
      <table className="w-full text-sm tabular-nums">
        <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-900/60 dark:text-zinc-400">
          <tr>
            <th scope="col" className="w-8 py-2 pl-3 text-left font-medium">#</th>
            <th scope="col" className="py-2 text-left font-medium">선수</th>
            <th scope="col" className={`${num} font-medium`}>골</th>
            <th scope="col" className={`${num} font-medium`}>도움</th>
            <th scope="col" className={`${num} hidden font-medium sm:table-cell`}>PK</th>
            <th scope="col" className={`${num} pr-3 font-medium`}>경기</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {scorers.map((scorer, index) => (
            <tr key={scorer.player.id}>
              <td className="py-2 pl-3 text-zinc-500">{rankList[index]}</td>
              <td className="max-w-0 py-2">
                <div className="truncate font-medium">
                  {scorer.player.name}
                  {isKoreanPlayer(scorer.player.nationality) ? (
                    <span className="ml-1" title="한국 선수">🇰🇷</span>
                  ) : null}
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                  <Crest src={scorer.team.crest} size={14} />
                  <span className="truncate">{teamName(scorer.team)}</span>
                </div>
              </td>
              <td className={`${num} font-bold`}>{scorer.goals ?? 0}</td>
              <td className={num}>{scorer.assists ?? "-"}</td>
              <td className={`${num} hidden sm:table-cell`}>{scorer.penalties ?? "-"}</td>
              <td className={`${num} pr-3`}>{scorer.playedMatches ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function Scorers({ params }: { params: PageProps<"/league/[code]/scorers">["params"] }) {
  const { code } = await params;
  const competition = getCompetition(code);
  if (!competition) notFound();

  const data = await getScorers(competition.code);
  if (!data || data.scorers.length === 0) {
    return <EmptyState>아직 득점 기록이 없어요.</EmptyState>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {seasonLabel(data.season)} · 상위 {data.scorers.length}명
      </p>
      <ScorersTable scorers={data.scorers} />
    </div>
  );
}

export default function ScorersPage({ params }: PageProps<"/league/[code]/scorers">) {
  return (
    <Suspense fallback={<TableSkeleton rows={10} />}>
      <Scorers params={params} />
    </Suspense>
  );
}
