import type { Match, Team } from "@/lib/football-data";
import { isFinished, isLive, matchScore, statusLabel } from "@/lib/match-display";
import { teamName } from "@/lib/teams-ko";
import { formatKickoff } from "@/lib/time";
import { Crest } from "./Crest";

function TeamLine({
  team,
  score,
  penalties,
  won,
  live,
}: {
  team: Team;
  score: number | null;
  penalties: number | null;
  won: boolean;
  live: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Crest src={team.crest} />
      <span className={`min-w-0 flex-1 truncate ${won ? "font-semibold" : ""}`}>{teamName(team)}</span>
      {score != null ? (
        <span
          className={`shrink-0 tabular-nums ${won ? "font-bold" : "font-medium"} ${
            live ? "text-red-600 dark:text-red-400" : ""
          }`}
        >
          {penalties != null ? (
            <span className="mr-1 text-xs font-normal text-zinc-500 dark:text-zinc-400">({penalties})</span>
          ) : null}
          {score}
        </span>
      ) : null}
    </div>
  );
}

/** 한 경기. 휴대폰에서도 팀 이름이 잘리지 않게 홈팀과 원정팀을 두 줄로 보여 줘요. */
export function MatchRow({ match, caption }: { match: Match; caption?: string | null }) {
  const finished = isFinished(match);
  const live = isLive(match);
  const label = statusLabel(match);
  const score = finished || live ? matchScore(match) : null;
  const winner = finished ? match.score.winner : null;

  let state;
  if (live) state = <span className="font-semibold text-red-600 dark:text-red-400">진행 중</span>;
  else if (label) state = <span className="font-medium text-amber-600 dark:text-amber-400">{label}</span>;
  else if (finished) state = <span>{score?.note ?? "종료"}</span>;
  else {
    state = (
      <span className="font-semibold text-zinc-800 dark:text-zinc-100">{formatKickoff(match.utcDate)}</span>
    );
  }

  return (
    <li className="flex items-center gap-3 px-3 py-2.5 text-sm">
      <div className="w-14 shrink-0 text-xs leading-snug tabular-nums text-zinc-500 dark:text-zinc-400">
        <div>{state}</div>
        {caption ? <div className="truncate text-[11px] text-zinc-400 dark:text-zinc-500">{caption}</div> : null}
      </div>
      <div className="min-w-0 flex-1 space-y-1.5 border-l border-zinc-100 pl-3 dark:border-zinc-800">
        <TeamLine
          team={match.homeTeam}
          score={score?.home ?? null}
          penalties={score?.homePenalties ?? null}
          won={winner === "HOME_TEAM"}
          live={live}
        />
        <TeamLine
          team={match.awayTeam}
          score={score?.away ?? null}
          penalties={score?.awayPenalties ?? null}
          won={winner === "AWAY_TEAM"}
          live={live}
        />
      </div>
    </li>
  );
}
