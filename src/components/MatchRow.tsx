import type { Match, Team } from "@/lib/football-data";
import { isFinished, isLive, matchScore, statusLabel } from "@/lib/match-display";
import { teamName } from "@/lib/teams-ko";
import { formatKickoff } from "@/lib/time";
import { Crest } from "./Crest";

type Outcome = "won" | "lost" | null;

function TeamLine({
  team,
  score,
  penalties,
  outcome,
}: {
  team: Team;
  score: number | null;
  penalties: number | null;
  outcome: Outcome;
}) {
  // 끝난 경기는 이긴 팀을 굵게, 진 팀을 흐리게 보여 줘서 결과가 한눈에 들어와요.
  const tone =
    outcome === "won"
      ? "font-semibold"
      : outcome === "lost"
        ? "text-zinc-500 dark:text-zinc-400"
        : "";

  return (
    <div className={`flex h-6 items-center gap-2.5 ${tone}`}>
      <Crest src={team.crest} size={22} />
      <span className="min-w-0 flex-1 truncate text-[15px]">{teamName(team)}</span>
      {score != null ? (
        <span className="flex shrink-0 items-baseline gap-1 tabular-nums">
          {penalties != null ? (
            <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">({penalties})</span>
          ) : null}
          <span className={`min-w-5 text-right text-base ${outcome === "won" ? "font-bold" : "font-semibold"}`}>
            {score}
          </span>
        </span>
      ) : null}
    </div>
  );
}

/** 경기 상태 칸. 시작 전이면 킥오프 시각, 진행 중이면 빨간 점, 끝났으면 종료를 보여 줘요. */
function MatchState({ match, note }: { match: Match; note: string | null }) {
  const label = statusLabel(match);

  if (isLive(match)) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 dark:text-red-400">
        <span className="relative flex size-1.5">
          <span className="absolute inset-0 animate-ping rounded-full bg-red-500 opacity-75 motion-reduce:hidden" />
          <span className="relative size-1.5 rounded-full bg-red-500" />
        </span>
        진행 중
      </span>
    );
  }
  if (label) return <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">{label}</span>;
  if (isFinished(match)) {
    return <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{note ?? "종료"}</span>;
  }
  return <span className="text-[15px] font-semibold tabular-nums">{formatKickoff(match.utcDate)}</span>;
}

/** 한 경기. 휴대폰에서도 팀 이름이 잘리지 않게 홈팀과 원정팀을 두 줄로 보여 줘요. */
export function MatchRow({ match, caption }: { match: Match; caption?: string | null }) {
  const finished = isFinished(match);
  const live = isLive(match);
  const score = finished || live ? matchScore(match) : null;
  const winner = finished ? match.score.winner : null;

  function outcome(side: "HOME_TEAM" | "AWAY_TEAM"): Outcome {
    if (winner !== "HOME_TEAM" && winner !== "AWAY_TEAM") return null;
    return winner === side ? "won" : "lost";
  }

  return (
    <li className="flex items-center gap-3 py-3">
      <div className="flex w-14 shrink-0 flex-col gap-1 leading-tight">
        <MatchState match={match} note={score?.note ?? null} />
        {caption ? (
          <span className="truncate text-[11px] text-zinc-400 dark:text-zinc-500">{caption}</span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <TeamLine
          team={match.homeTeam}
          score={score?.home ?? null}
          penalties={score?.homePenalties ?? null}
          outcome={outcome("HOME_TEAM")}
        />
        <TeamLine
          team={match.awayTeam}
          score={score?.away ?? null}
          penalties={score?.awayPenalties ?? null}
          outcome={outcome("AWAY_TEAM")}
        />
      </div>
    </li>
  );
}
