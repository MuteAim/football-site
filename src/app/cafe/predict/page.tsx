import type { Metadata } from "next";
import { after, connection } from "next/server";
import { Suspense } from "react";
import { Avatar, LevelBadge, NameBadge } from "@/components/cafe/Avatar";
import { PostListSkeleton } from "@/components/cafe/CafeSkeletons";
import { EmptyState } from "@/components/EmptyState";
import { TrophyIcon } from "@/components/Icons";
import { cardClass, cardListClass, mutedClass } from "@/components/ui";
import { settlePredictions } from "@/lib/cafe/goals";
import { getPredictionRanking, rankOf } from "@/lib/cafe/predictions";
import { nameColorClass } from "@/lib/cafe/shop";
import type { RankingEntry } from "@/lib/cafe/types";
import { getViewer } from "@/lib/cafe/viewer";

export const metadata: Metadata = { title: "승부 예측 순위" };

/** 순위표에는 이만큼만 보여 주고, 내 순위는 따로 알려 줘요. */
const SHOW = 50;

// 1~3위는 금·은·동 색으로 칠해요.
const MEDAL = ["bg-amber-400 text-amber-950", "bg-zinc-300 text-zinc-800", "bg-orange-300 text-orange-950"];

function percent(entry: RankingEntry) {
  return Math.round((entry.hits / entry.settled) * 100);
}

function RankRow({ entry, rank, mine }: { entry: RankingEntry; rank: number; mine: boolean }) {
  return (
    <li className={`flex items-center gap-3 py-2.5 ${mine ? "-mx-4 bg-emerald-500/[0.07] px-4" : ""}`}>
      <span
        className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold tabular-nums ${
          rank <= 3 ? MEDAL[rank - 1] : "text-zinc-500 dark:text-zinc-400"
        }`}
      >
        {rank}
      </span>
      <Avatar id={entry.author.id} nickname={entry.author.nickname} team={entry.author.team} frame={entry.author.frame} size="md" />
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className={`truncate text-[15px] font-semibold ${nameColorClass(entry.author.nameColor)}`}>
          {entry.author.nickname}
        </span>
        <LevelBadge goals={entry.author.goals} />
        {entry.author.isManager ? <NameBadge>매니저</NameBadge> : null}
        {mine ? <NameBadge tone="zinc">나</NameBadge> : null}
      </div>
      <div className="shrink-0 text-right tabular-nums">
        <p className="text-[15px] font-bold">
          {entry.hits}
          <span className={`text-xs font-medium ${mutedClass}`}> / {entry.settled}</span>
        </p>
        <p className={`text-xs ${mutedClass}`}>적중률 {percent(entry)}%</p>
      </div>
    </li>
  );
}

async function Ranking() {
  // 빌드할 때 순위를 미리 계산해 두지 않게, 요청 시점 작업이라고 먼저 알려 둬요.
  await connection();
  // 순위를 보러 온 김에 끝난 경기 예측을 정산해서 골을 줘요. 화면을 다 보낸 뒤에 해요.
  after(settlePredictions);
  const [entries, viewer] = await Promise.all([getPredictionRanking(), getViewer()]);
  if (entries.length === 0) {
    return <EmptyState>아직 결과가 나온 예측이 없어요. 경기 화면에서 승부를 예측해 보세요.</EmptyState>;
  }

  const ranks = rankOf(entries);
  const myIndex = viewer ? entries.findIndex((entry) => entry.author.id === viewer.id) : -1;

  return (
    <>
      {myIndex >= 0 ? (
        <p className={`${cardClass} mb-3 px-4 py-3 text-[15px]`}>
          내 순위 <span className="font-bold text-emerald-700 dark:text-emerald-400">{ranks[myIndex]}위</span>
          <span className={mutedClass}>
            {" "}
            · {entries[myIndex].settled}경기 중 {entries[myIndex].hits}경기 적중 ({percent(entries[myIndex])}%)
          </span>
        </p>
      ) : null}
      <ol className={`${cardClass} ${cardListClass}`}>
        {entries.slice(0, SHOW).map((entry, i) => (
          <RankRow key={entry.author.id} entry={entry} rank={ranks[i]} mine={i === myIndex} />
        ))}
      </ol>
    </>
  );
}

export default function PredictRankingPage() {
  return (
    <div className="break-keep">
      <div className="mb-4">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <TrophyIcon className="size-6 text-amber-500" />
          승부 예측 순위
        </h1>
        <p className={`mt-1 text-sm ${mutedClass}`}>
          이번 시즌 끝난 경기 중 킥오프 전에 고른 예측만 세요. 적중 수가 같으면 적중률이 높은 순서예요. 5분마다 새로
          계산해요.
        </p>
      </div>
      <Suspense fallback={<PostListSkeleton rows={8} />}>
        <Ranking />
      </Suspense>
    </div>
  );
}
