import "server-only";
import { getCompetition } from "../competitions";
import { getStandings } from "../football-data";
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
