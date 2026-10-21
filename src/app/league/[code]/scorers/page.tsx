import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Crest } from "@/components/Crest";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton } from "@/components/Skeletons";
import { cardClass, mutedClass } from "@/components/ui";
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

// 1~3위는 금·은·동 동그라미로 보여 줘요.
const MEDAL: Record<number, string> = {
  1: "bg-amber-300 text-amber-950",
  2: "bg-zinc-300 text-zinc-800",
  3: "bg-orange-300 text-orange-950",
};

function Rank({ rank }: { rank: number }) {
  const medal = MEDAL[rank];
  if (!medal) return <span className="inline-block w-6 text-center">{rank}</span>;
  return (
    <span className={`inline-flex size-6 items-center justify-center rounded-full text-xs font-bold ${medal}`}>
      {rank}
    </span>
  );
}

const num = "w-9 text-center";
// 골 칸은 옅은 바탕으로 따로 띄워서 눈이 먼저 가게 해요.
const goalsCell = "w-11 bg-zinc-50 text-center dark:bg-white/[0.03]";

function ScorersTable({ scorers }: { scorers: Scorer[] }) {
  const rankList = ranks(scorers);
  return (
    <div className={cardClass}>
      <table className="w-full text-sm tabular-nums">
        <thead className="text-[11px] text-zinc-400 dark:text-zinc-500">
          <tr className="h-9 border-b border-zinc-100 dark:border-white/[0.07]">
            <th scope="col" className="w-12 pl-3 text-left font-medium"><span className="inline-block w-6 text-center">#</span></th>
            <th scope="col" className="text-left font-medium">선수</th>
            <th scope="col" className={`${goalsCell} font-semibold text-zinc-500 dark:text-zinc-400`}>골</th>
            <th scope="col" className={`${num} font-medium`}>도움</th>
            <th scope="col" className={`${num} hidden font-medium sm:table-cell`}>PK</th>
            <th scope="col" className={`${num} pr-2 font-medium`}>경기</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.06]">
          {scorers.map((scorer, index) => (
            <tr key={scorer.player.id} className="transition-colors hover:bg-zinc-50/70 dark:hover:bg-white/[0.02]">
              <td className="py-2.5 pl-3 font-medium text-zinc-400 dark:text-zinc-500">
                <Rank rank={rankList[index]} />
              </td>
              <td className="max-w-0 py-2.5">
                <div className="truncate font-semibold">
                  {scorer.player.name}
                  {isKoreanPlayer(scorer.player.nationality) ? (
                    <span className="ml-1" title="한국 선수">🇰🇷</span>
                  ) : null}
                </div>
                <div className={`mt-0.5 flex items-center gap-1.5 text-xs ${mutedClass}`}>
                  <Crest src={scorer.team.crest} size={14} />
                  <span className="truncate">{teamName(scorer.team)}</span>
                </div>
              </td>
              <td className={`${goalsCell} text-base font-bold`}>{scorer.goals ?? 0}</td>
              <td className={num}>{scorer.assists ?? "-"}</td>
              <td className={`${num} hidden sm:table-cell`}>{scorer.penalties ?? "-"}</td>
              <td className={`${num} pr-2 text-zinc-500 dark:text-zinc-400`}>{scorer.playedMatches ?? "-"}</td>
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
      <p className={`text-sm font-medium ${mutedClass}`}>
        {seasonLabel(data.season)} · 상위 {data.scorers.length}명
      </p>
      <ScorersTable scorers={data.scorers} />
    </div>
  );
}

export default function ScorersPage({ params }: PageProps<"/league/[code]/scorers">) {
  return (
    <Suspense fallback={<TableSkeleton rows={10} rowClass="h-[58px]" />}>
      <Scorers params={params} />
    </Suspense>
  );
}
