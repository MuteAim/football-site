import Link from "next/link";
import { getCompetition } from "@/lib/competitions";
import type { Match, Team } from "@/lib/football-data";
import { isFinished, isLive, matchScore, roundLabel, statusLabel } from "@/lib/match-display";
import { teamName } from "@/lib/teams-ko";
import { formatDayHeading, formatKickoff, toKstDateKey } from "@/lib/time";
import { Crest } from "./Crest";
import { cardClass } from "./ui";

function TeamColumn({ team, side }: { team: Team; side: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-white ring-1 ring-zinc-950/5 dark:ring-white/10">
        <Crest src={team.crest} size={44} />
      </span>
      <span className="w-full truncate text-[15px] font-semibold">{teamName(team)}</span>
      <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{side}</span>
    </div>
  );
}

/** 경기 화면 맨 위 카드. 두 팀 엠블럼과 점수(시작 전이면 킥오프 시각)를 크게 보여 줘요. */
export function MatchSummary({ match }: { match: Match }) {
  const competition = getCompetition(match.competition.code);
  const finished = isFinished(match);
  const live = isLive(match);
  const score = finished || live ? matchScore(match) : null;
  const label = statusLabel(match);

  return (
    <section className={`${cardClass} px-4 pt-4 pb-5`}>
      <div className="flex items-center justify-between gap-3 text-xs text-zinc-500 dark:text-zinc-400">
        {competition ? (
          <Link href={`/league/${competition.code}`} prefetch={false} className="flex min-w-0 items-center gap-1.5 font-semibold hover:text-zinc-900 dark:hover:text-white">
            <Crest src={competition.emblem} size={16} />
            <span className="truncate">
              {competition.name} · {roundLabel(match)}
            </span>
          </Link>
        ) : (
          <span className="truncate font-semibold">{match.competition.name}</span>
        )}
        <span className="shrink-0">{formatDayHeading(toKstDateKey(match.utcDate))}</span>
      </div>

      <div className="mt-4 flex items-start gap-2">
        <TeamColumn team={match.homeTeam} side="홈" />
        <div className="flex w-28 shrink-0 flex-col items-center pt-3">
          {score ? (
            <p className="flex items-baseline gap-2 text-4xl font-bold tracking-tight tabular-nums">
              {score.home}
              <span className="text-2xl text-zinc-300 dark:text-zinc-600">:</span>
              {score.away}
            </p>
          ) : (
            <p className="text-3xl font-bold tracking-tight tabular-nums">{formatKickoff(match.utcDate)}</p>
          )}
          <p className="mt-1.5 text-xs font-semibold">
            {live ? (
              <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                <span className="size-1.5 rounded-full bg-red-500" />
                진행 중
              </span>
            ) : label ? (
              <span className="text-amber-600 dark:text-amber-400">{label}</span>
            ) : finished ? (
              <span className="text-zinc-500 dark:text-zinc-400">
                {score?.note ? `${score.note} 종료` : "종료"}
                {score?.homePenalties != null ? ` (${score.homePenalties}:${score.awayPenalties})` : ""}
              </span>
            ) : (
              <span className="text-zinc-500 dark:text-zinc-400">킥오프</span>
            )}
          </p>
        </div>
        <TeamColumn team={match.awayTeam} side="원정" />
      </div>
    </section>
  );
}
