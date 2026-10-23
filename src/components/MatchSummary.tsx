import Link from "next/link";
import { getCompetition } from "@/lib/competitions";
import type { Match, Team } from "@/lib/football-data";
import { isFinished, isLive, matchScore, roundLabel, statusLabel } from "@/lib/match-display";
import { teamName } from "@/lib/teams-ko";
import { formatDayHeading, formatKickoff, toKstDateKey } from "@/lib/time";
import { Crest } from "./Crest";
import { PitchLines } from "./Icons";

function TeamColumn({ team, side }: { team: Team; side: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-white shadow-lg shadow-black/10 sm:size-20">
        <Crest src={team.crest} size={48} />
      </span>
      <span className="w-full text-sm leading-snug font-bold break-keep sm:text-base">{teamName(team)}</span>
      <span className="rounded-md border border-white/15 px-2 py-0.5 text-[10px] font-semibold text-white/60">{side}</span>
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
    <section className="stadium-panel overflow-hidden rounded-3xl px-4 pt-4 pb-7 sm:px-8 sm:pt-6 sm:pb-8">
      <PitchLines className="pointer-events-none absolute top-0 left-1/2 h-full w-[650px] -translate-x-1/2 text-white/[0.05]" />
      <div className="relative flex items-center justify-between gap-3 border-b border-white/10 pb-4 text-xs text-white/65">
        {competition ? (
          <Link href={`/league/${competition.code}`} prefetch={false} className="flex min-w-0 items-center gap-2 font-semibold hover:text-white">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-white"><Crest src={competition.emblem} size={16} /></span>
            <span className="truncate">
              {competition.name} · {roundLabel(match)}
            </span>
          </Link>
        ) : (
          <span className="truncate font-semibold">{match.competition.name}</span>
        )}
        <span className="shrink-0">{formatDayHeading(toKstDateKey(match.utcDate))}</span>
      </div>

      <div className="relative mx-auto mt-6 flex max-w-xl items-start gap-2 sm:mt-8 sm:gap-6">
        <TeamColumn team={match.homeTeam} side="홈" />
        <div className="flex w-24 shrink-0 flex-col items-center pt-3 sm:w-36">
          {score ? (
            <p className="score-digits flex items-baseline gap-2 text-4xl sm:gap-4 sm:text-6xl">
              {score.home}
              <span className="text-2xl font-normal text-white/30">:</span>
              {score.away}
            </p>
          ) : (
            <p className="score-digits text-3xl sm:text-4xl">{formatKickoff(match.utcDate)}</p>
          )}
          <p className="mt-1.5 text-xs font-semibold">
            {live ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#d4f77d]/10 px-2 py-1 text-[#d4f77d] dark:bg-emerald-400/10 dark:text-emerald-300">
                <span className="size-1.5 rounded-full bg-current" />
                진행 중
              </span>
            ) : label ? (
              <span className="text-amber-300">{label}</span>
            ) : finished ? (
              <span className="text-white/65">
                {score?.note ? `${score.note} 종료` : "종료"}
                {score?.homePenalties != null ? ` (${score.homePenalties}:${score.awayPenalties})` : ""}
              </span>
            ) : (
              <span className="text-white/65">킥오프 · KST</span>
            )}
          </p>
        </div>
        <TeamColumn team={match.awayTeam} side="원정" />
      </div>
    </section>
  );
}
