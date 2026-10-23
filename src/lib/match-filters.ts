import type { Match } from "./football-data";
import { isFinished, isLive } from "./match-display";

export type MatchFilter = "all" | "live" | "scheduled" | "finished";

export function filterMatches(matches: Match[], status: MatchFilter, competition: string, teamId: number | null): Match[] {
  return matches.filter((match) => {
    if (competition && match.competition.code !== competition) return false;
    if (teamId !== null && match.homeTeam.id !== teamId && match.awayTeam.id !== teamId) return false;
    if (status === "live") return isLive(match);
    if (status === "finished") return isFinished(match);
    if (status === "scheduled") return match.status === "SCHEDULED" || match.status === "TIMED";
    return true;
  });
}
