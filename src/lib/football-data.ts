import "server-only";
import { cacheLife } from "next/cache";
import { CACHE_PROFILES } from "./cache-profiles";

// football-data.org v4 API 연결부예요.
// 무료 플랜은 분당 10회까지만 호출할 수 있어서 캐시를 두 겹으로 둡니다.
// 1. 각 조회 함수의 "use cache"는 화면을 미리 만들어 저장하는 데 쓰여요.
// 2. fetch의 force-cache는 API 응답 자체를 저장해요. Vercel에서는 이 저장소를 모든 서버가 같이 써서,
//    여러 서버가 동시에 페이지를 만들어도 같은 API 주소는 정해진 간격에 한 번만 불러요.
const BASE_URL = "https://api.football-data.org/v4";

export class FootballDataError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "FootballDataError";
    this.status = status;
  }
}

async function request<T>(path: string, revalidate: number): Promise<T> {
  return (await requestSnapshot<T>(path, revalidate)).data;
}

async function requestSnapshot<T>(path: string, revalidate: number): Promise<{ data: T; checkedAt: string }> {
  const token = process.env.FOOTBALL_DATA_API_KEY;
  if (!token) {
    throw new FootballDataError(
      "FOOTBALL_DATA_API_KEY 환경 변수가 없어요. .env.local 파일을 확인해 주세요.",
      500,
    );
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "X-Auth-Token": token },
    cache: "force-cache",
    next: { revalidate },
  });

  if (!res.ok) {
    if (res.status === 429) {
      const reset = res.headers.get("X-RequestCounter-Reset") ?? "60";
      throw new FootballDataError(
        `API 호출 한도를 넘었어요. ${reset}초 뒤에 다시 시도해 주세요.`,
        429,
      );
    }
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new FootballDataError(
      `football-data.org 요청 실패 ${res.status}: ${body?.message ?? res.statusText}`,
      res.status,
    );
  }

  // 캐시된 응답을 읽을 때도 원래 응답 시각을 표시해 최신 데이터로 오해하지 않게 해요.
  const responseDate = res.headers.get("date");
  const checkedAt = responseDate && Number.isFinite(Date.parse(responseDate))
    ? new Date(responseDate).toISOString()
    : new Date().toISOString();
  return { data: (await res.json()) as T, checkedAt };
}

// ---------- 타입 ----------

export type Team = {
  id: number | null;
  name: string | null;
  shortName: string | null;
  tla: string | null;
  crest: string | null;
};

export type ScoreLine = { home: number | null; away: number | null };

export type MatchStatus =
  | "SCHEDULED"
  | "TIMED"
  | "IN_PLAY"
  | "PAUSED"
  | "LIVE"
  | "EXTRA_TIME"
  | "PENALTY_SHOOTOUT"
  | "FINISHED"
  | "SUSPENDED"
  | "POSTPONED"
  | "CANCELLED"
  | "AWARDED";

export type Match = {
  id: number;
  utcDate: string;
  status: MatchStatus;
  matchday: number | null;
  stage: string;
  group: string | null;
  competition: { code: string; name: string; emblem: string | null };
  homeTeam: Team;
  awayTeam: Team;
  score: {
    winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
    duration: "REGULAR" | "EXTRA_TIME" | "PENALTY_SHOOTOUT";
    fullTime: ScoreLine;
    regularTime?: ScoreLine;
    extraTime?: ScoreLine;
    penalties?: ScoreLine;
  };
};

export type Season = {
  startDate: string;
  endDate: string;
  currentMatchday: number | null;
};

export type StandingRow = {
  position: number;
  team: Team;
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
};

export type StandingTable = {
  stage: string;
  group: string | null;
  table: StandingRow[];
};

export type Scorer = {
  player: { id: number; name: string; nationality: string | null };
  team: Team;
  playedMatches: number | null;
  goals: number | null;
  assists: number | null;
  penalties: number | null;
};

// API 응답에는 배당률, 심판 같은 필드도 있어서 화면에 필요한 값만 남겨 캐시 크기를 줄여요.
type RawMatch = Match & { season?: Season };
type RawStandingTable = StandingTable & { type: "TOTAL" | "HOME" | "AWAY" };

function slimTeam(team: Team): Team {
  return {
    id: team.id,
    name: team.name,
    shortName: team.shortName,
    tla: team.tla,
    crest: team.crest,
  };
}

function slimSeason(season: Season): Season {
  return {
    startDate: season.startDate,
    endDate: season.endDate,
    currentMatchday: season.currentMatchday,
  };
}

function slimMatch(match: RawMatch): Match {
  const { score } = match;
  return {
    id: match.id,
    utcDate: match.utcDate,
    status: match.status,
    matchday: match.matchday,
    stage: match.stage,
    group: match.group,
    competition: {
      code: match.competition.code,
      name: match.competition.name,
      emblem: match.competition.emblem,
    },
    homeTeam: slimTeam(match.homeTeam),
    awayTeam: slimTeam(match.awayTeam),
    score: {
      winner: score.winner,
      duration: score.duration,
      fullTime: score.fullTime,
      regularTime: score.regularTime,
      extraTime: score.extraTime,
      penalties: score.penalties,
    },
  };
}

function isNotFound(error: unknown) {
  return error instanceof FootballDataError && error.status === 404;
}

// ---------- 데이터 조회 ----------

/** 대회 순위표. 끝난 토너먼트처럼 순위표가 없으면 null을 돌려줘요. */
export async function getStandings(
  code: string,
): Promise<{ season: Season; tables: StandingTable[] } | null> {
  "use cache";
  cacheLife("standings");

  try {
    const data = await request<{ season: Season; standings: RawStandingTable[] }>(
      `/competitions/${code}/standings`,
      CACHE_PROFILES.standings.revalidate,
    );
    return {
      season: slimSeason(data.season),
      tables: data.standings
        .filter((t) => t.type === "TOTAL")
        .map((t) => ({
          stage: t.stage,
          group: t.group,
          table: t.table.map((row) => ({
            position: row.position,
            team: slimTeam(row.team),
            playedGames: row.playedGames,
            won: row.won,
            draw: row.draw,
            lost: row.lost,
            points: row.points,
            goalsFor: row.goalsFor,
            goalsAgainst: row.goalsAgainst,
            goalDifference: row.goalDifference,
          })),
        })),
    };
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

/** 대회의 이번 시즌 전체 경기. 일정 탭과 결과 탭이 같은 캐시를 같이 써요. */
export async function getCompetitionMatches(
  code: string,
): Promise<{ season: Season | null; matches: Match[] }> {
  "use cache";
  cacheLife("matches");

  const data = await request<{ matches: RawMatch[] }>(
    `/competitions/${code}/matches`,
    CACHE_PROFILES.matches.revalidate,
  );
  const season = data.matches[0]?.season;
  return {
    season: season ? slimSeason(season) : null,
    matches: data.matches.map(slimMatch),
  };
}

/** 득점 순위 상위 20명. */
export async function getScorers(
  code: string,
): Promise<{ season: Season; scorers: Scorer[] } | null> {
  "use cache";
  cacheLife("scorers");

  try {
    const data = await request<{ season: Season; scorers: Scorer[] }>(
      `/competitions/${code}/scorers?limit=20`,
      CACHE_PROFILES.scorers.revalidate,
    );
    return {
      season: slimSeason(data.season),
      scorers: data.scorers.map((s) => ({
        player: { id: s.player.id, name: s.player.name, nationality: s.player.nationality },
        team: slimTeam(s.team),
        playedMatches: s.playedMatches,
        goals: s.goals,
        assists: s.assists,
        penalties: s.penalties,
      })),
    };
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

/**
 * 모든 대회의 경기를 날짜 범위로 조회해요.
 * dateTo는 포함되지 않고, 범위는 최대 10일까지만 돼요.
 */
export async function getMatchesBetween(dateFrom: string, dateTo: string): Promise<Match[]> {
  return (await getMatchesSnapshot(dateFrom, dateTo)).matches;
}

export async function getMatchesSnapshot(dateFrom: string, dateTo: string): Promise<{ matches: Match[]; checkedAt: string }> {
  "use cache";
  cacheLife("matches");

  const { data, checkedAt } = await requestSnapshot<{ matches: RawMatch[] }>(
    `/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`,
    CACHE_PROFILES.matches.revalidate,
  );
  return { matches: data.matches.map(slimMatch), checkedAt };
}
