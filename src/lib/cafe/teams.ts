import "server-only";
import { cacheLife } from "next/cache";
import { getCompetition } from "../competitions";
import { getCompetitionMatches, getStandings, type Match } from "../football-data";
import { isFinished, isLive } from "../match-display";
import { teamName } from "../teams-ko";
import type { FanTeam, LeagueTeams } from "./types";

/** 응원팀으로 고를 수 있는 리그. 카페에 게시판이 있는 5대 리그예요. */
const TEAM_LEAGUES = ["PL", "PD", "BL1", "SA", "FL1"];

/**
 * 리그별 이번 시즌 팀 목록. 리그 화면의 순위표 캐시를 같이 써서 API를 따로 부르지 않아요.
 * API 한도에 걸려 못 불러온 리그는 빼고 돌려줘요.
 */
export async function getTeamChoices(): Promise<LeagueTeams[]> {
  const results = await Promise.allSettled(TEAM_LEAGUES.map((code) => getStandings(code)));

  return TEAM_LEAGUES.flatMap((code, i) => {
    const result = results[i];
    if (result.status === "rejected") {
      console.error(result.reason);
      return [];
    }
    if (!result.value) return [];

    const teams = new Map<number, FanTeam>();
    for (const { team } of result.value.tables.flatMap((table) => table.table)) {
      if (team.id == null || !team.crest) continue;
      teams.set(team.id, { id: team.id, name: teamName(team), crest: team.crest });
    }
    return [
      {
        code,
        name: getCompetition(code)?.short ?? code,
        teams: [...teams.values()].sort((a, b) => a.name.localeCompare(b.name, "ko")),
      },
    ];
  });
}

/** 고를 수 있는 팀이면 그 팀을, 아니면 null을 돌려줘요. */
export async function findTeamChoice(id: number): Promise<FanTeam | null> {
  const leagues = await getTeamChoices();
  return leagues.flatMap((league) => league.teams).find((team) => team.id === id) ?? null;
}

export type TeamOutcome = "win" | "draw" | "loss";

/** 홈 화면 "내 팀" 카드에 쓰는 요약 */
export type TeamDigest = {
  team: FanTeam;
  league: { code: string; name: string };
  standing: { position: number; points: number; played: number } | null;
  /** 진행 중이거나 다음에 열릴 경기 */
  next: Match | null;
  /** 최근 끝난 경기. 오래된 경기부터 순서대로예요. */
  recent: { match: Match; outcome: TeamOutcome }[];
};

const RECENT_COUNT = 5;

/**
 * 응원팀의 리그 순위, 다음 경기, 최근 결과. 리그와 챔스 경기를 같이 봐요.
 * 순위표·리그 일정 화면과 같은 캐시를 써서 API 호출이 거의 늘지 않고, 팀마다 5분 동안 계산해 둬요.
 * 5대 리그 팀이 아니면 null이에요.
 */
export async function getTeamDigest(teamId: number): Promise<TeamDigest | null> {
  "use cache";
  cacheLife("matches");

  const league = (await getTeamChoices()).find((l) => l.teams.some((team) => team.id === teamId));
  const team = league?.teams.find((t) => t.id === teamId);
  if (!league || !team) return null;

  const [standings, leagueMatches, championsLeague] = await Promise.all([
    getStandings(league.code).catch(() => null),
    getCompetitionMatches(league.code),
    // 챔스에 나가지 않는 팀이 더 많고, 챔스 일정을 못 불러와도 리그 경기는 보여 줘요.
    getCompetitionMatches("CL").catch(() => null),
  ]);

  const row = standings?.tables.flatMap((table) => table.table).find((r) => r.team.id === teamId);
  const plays = (match: Match) => match.homeTeam.id === teamId || match.awayTeam.id === teamId;
  const matches = [...leagueMatches.matches, ...(championsLeague?.matches ?? [])]
    .filter(plays)
    .sort((a, b) => a.utcDate.localeCompare(b.utcDate));

  // 연기·취소된 경기는 건너뛰고, 진행 중인 경기가 있으면 그 경기를 보여 줘요.
  const next =
    matches.find((match) => isLive(match) || match.status === "SCHEDULED" || match.status === "TIMED") ?? null;
  const recent = matches
    .filter(isFinished)
    .slice(-RECENT_COUNT)
    .map((match) => {
      // 승부차기로 갈린 경기도 API가 정한 승자를 따라요.
      const side = match.homeTeam.id === teamId ? "HOME_TEAM" : "AWAY_TEAM";
      const { winner } = match.score;
      const outcome: TeamOutcome = winner === side ? "win" : winner === "DRAW" || winner === null ? "draw" : "loss";
      return { match, outcome };
    });

  return {
    team,
    league: { code: league.code, name: getCompetition(league.code)?.short ?? league.name },
    standing: row ? { position: row.position, points: row.points, played: row.playedGames } : null,
    next,
    recent,
  };
}
