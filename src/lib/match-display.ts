import type { Match } from "./football-data";

const LIVE_STATUSES = new Set(["IN_PLAY", "PAUSED", "LIVE", "EXTRA_TIME", "PENALTY_SHOOTOUT"]);

export function isLive(match: Match): boolean {
  return LIVE_STATUSES.has(match.status);
}

export function isFinished(match: Match): boolean {
  return match.status === "FINISHED" || match.status === "AWARDED";
}

const STATUS_LABEL: Record<string, string> = {
  POSTPONED: "연기",
  SUSPENDED: "중단",
  CANCELLED: "취소",
  AWARDED: "몰수",
};

export function statusLabel(match: Match): string | null {
  return STATUS_LABEL[match.status] ?? null;
}

export type MatchScore = {
  home: number;
  away: number;
  homePenalties: number | null;
  awayPenalties: number | null;
  note: string | null;
};

/**
 * 점수 표시. API의 fullTime은 승부차기 골까지 더한 값이라,
 * 승부차기 경기는 정규 시간과 연장 점수를 따로 계산하고 승부차기 점수는 괄호로 보여 줘요.
 */
export function matchScore(match: Match): MatchScore {
  const { score } = match;
  if (score.duration === "PENALTY_SHOOTOUT" && score.regularTime && score.penalties) {
    return {
      home: (score.regularTime.home ?? 0) + (score.extraTime?.home ?? 0),
      away: (score.regularTime.away ?? 0) + (score.extraTime?.away ?? 0),
      homePenalties: score.penalties.home ?? 0,
      awayPenalties: score.penalties.away ?? 0,
      note: "승부차기",
    };
  }
  return {
    home: score.fullTime.home ?? 0,
    away: score.fullTime.away ?? 0,
    homePenalties: null,
    awayPenalties: null,
    note: score.duration === "EXTRA_TIME" ? "연장" : null,
  };
}

const STAGE_LABEL: Record<string, string> = {
  REGULAR_SEASON: "정규 시즌",
  LEAGUE_STAGE: "리그 페이즈",
  GROUP_STAGE: "조별리그",
  PRELIMINARY_ROUND: "예선",
  QUALIFICATION: "예선",
  QUALIFICATION_ROUND_1: "예선 1라운드",
  QUALIFICATION_ROUND_2: "예선 2라운드",
  QUALIFICATION_ROUND_3: "예선 3라운드",
  PLAYOFF_ROUND: "플레이오프",
  PLAYOFFS: "플레이오프",
  ROUND_1: "1라운드",
  ROUND_2: "2라운드",
  ROUND_3: "3라운드",
  LAST_64: "64강",
  LAST_32: "32강",
  LAST_16: "16강",
  QUARTER_FINALS: "8강",
  SEMI_FINALS: "4강",
  THIRD_PLACE: "3·4위전",
  FINAL: "결승",
};

export function stageLabel(stage: string): string {
  return STAGE_LABEL[stage] ?? stage.replaceAll("_", " ");
}

export function groupLabel(group: string | null): string | null {
  if (!group) return null;
  const match = /^GROUP_([A-Z])$/.exec(group);
  return match ? `${match[1]}조` : group;
}

/** 예: 8R, 3차전, A조, 16강 */
export function roundLabel(match: Match): string {
  if (match.stage === "REGULAR_SEASON" && match.matchday) return `${match.matchday}R`;
  if (match.stage === "LEAGUE_STAGE" && match.matchday) return `${match.matchday}차전`;
  if (match.stage === "GROUP_STAGE") return groupLabel(match.group) ?? "조별리그";
  return stageLabel(match.stage);
}

/**
 * 승부 예측에 쓰는 결과. 연장까지의 점수로 정하고, 승부차기로 갈린 경기는 무승부로 쳐요.
 * 끝나지 않은 경기는 null이에요.
 */
export function matchResult(match: Match): "home" | "draw" | "away" | null {
  if (!isFinished(match)) return null;
  const { home, away } = matchScore(match);
  return home > away ? "home" : home < away ? "away" : "draw";
}

/** 승부 예측을 받을 수 있는지. 일정이 잡힌 경기를 킥오프 전까지만 받아요. */
export function isPredictionOpen(match: Match, now: number): boolean {
  return (match.status === "SCHEDULED" || match.status === "TIMED") && now < Date.parse(match.utcDate);
}

export function isKoreanPlayer(nationality: string | null): boolean {
  if (!nationality) return false;
  return /korea/i.test(nationality) && !/north|dpr/i.test(nationality);
}
