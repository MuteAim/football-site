import type { RetiredCareer } from "./archive";
import { CLUBS, MILITARY_CLUB, POSITIONS, type Pos } from "./data";

// 내 기록실의 업적 배지예요. 은퇴 보관함 요약만으로 계산해서 예전 기록에도 똑같이 붙어요.
export type Badge = {
  id: string; label: string; detail: string;
  /** 지금까지의 최고 진행값과 목표. 목표에 닿으면 달성이에요. */
  value: number; target: number;
  /** 처음 달성한 선수 */
  by: string | null;
};

const BIG_LEAGUES = new Set(["ENG", "ESP", "GER", "ITA", "FRA"]);
const leaguesOf = (entry: RetiredCareer) => new Set(entry.clubs.filter((club) => club.club !== MILITARY_CLUB).map((club) => CLUBS[club.club]?.league).filter(Boolean));
const teams = (entry: RetiredCareer) => entry.clubs.filter((club) => club.club !== MILITARY_CLUB).length;
const won = (entry: RetiredCareer, test: (label: string) => boolean) => entry.honors.filter((honor) => test(honor.label)).reduce((sum, honor) => sum + honor.count, 0);

/** 선수 한 명이 이루는 업적. 진행값은 그 선수의 기록이에요. */
const CAREER_BADGES: { id: string; label: string; detail: string; target: number; value: (entry: RetiredCareer) => number }[] = [
  { id: "ballon", label: "발롱도르 위너", detail: "발롱도르를 받은 선수", target: 1, value: (e) => e.totals.ballonDor },
  { id: "ballon5", label: "황금의 시대", detail: "한 선수로 발롱도르 5회", target: 5, value: (e) => e.totals.ballonDor },
  { id: "goat", label: "GOAT", detail: "레전드 점수 9,000점", target: 9000, value: (e) => e.score },
  { id: "worldcup", label: "월드컵 챔피언", detail: "월드컵 우승", target: 1, value: (e) => won(e, (label) => label === "월드컵 우승") },
  { id: "ucl", label: "빅이어", detail: "챔피언스리그 우승", target: 1, value: (e) => won(e, (label) => label.endsWith("챔피언스리그 우승") && !label.startsWith("AFC")) },
  { id: "goals", label: "골 머신", detail: "통산 400골", target: 400, value: (e) => e.totals.goals },
  { id: "assists", label: "플레이메이커", detail: "통산 200도움", target: 200, value: (e) => e.totals.assists },
  { id: "sheets", label: "통곡의 벽", detail: "통산 무실점 200경기", target: 200, value: (e) => e.totals.cleanSheets },
  { id: "caps", label: "센추리 클럽", detail: "A매치 100경기", target: 100, value: (e) => e.totals.caps },
  { id: "iron", label: "철인", detail: "20시즌 이상 현역", target: 20, value: (e) => e.totals.seasons },
  { id: "oneclub", label: "원클럽맨", detail: "한 팀에서만 12시즌 이상", target: 12, value: (e) => (teams(e) === 1 ? e.totals.seasons : 0) },
  { id: "journey", label: "저니맨", detail: "9개 팀을 거친 선수", target: 9, value: teams },
  { id: "k2big", label: "K리그에서 빅리그로", detail: "K리그1과 유럽 5대 리그를 모두 뛴 선수", target: 1, value: (e) => { const set = leaguesOf(e); return set.has("KOR") && [...set].some((code) => BIG_LEAGUES.has(code!)) ? 1 : 0; } },
  { id: "big3", label: "유럽 정복", detail: "유럽 5대 리그 중 3곳에서 뛴 선수", target: 3, value: (e) => [...leaguesOf(e)].filter((code) => BIG_LEAGUES.has(code!)).length },
];

export function careerBadges(entries: RetiredCareer[]): Badge[] {
  // 처음 달성한 선수를 찾으려고 은퇴 순서대로 봐요.
  const ordered = [...entries].sort((a, b) => Date.parse(a.retiredAt) - Date.parse(b.retiredAt));
  const positions = new Set(ordered.map((entry) => entry.pos));
  const collection: Badge[] = [
    { id: "first", label: "첫 은퇴식", detail: "선수 한 명을 은퇴까지", value: ordered.length, target: 1, by: ordered[0]?.name ?? null },
    { id: "hall10", label: "명예의 전당 관장", detail: "선수 10명을 은퇴까지", value: ordered.length, target: 10, by: ordered[9]?.name ?? null },
    { id: "allpos", label: "만능 스카우트", detail: "8개 포지션 모두 은퇴까지", value: positions.size, target: 8, by: positions.size >= 8 ? ordered.at(-1)!.name : null },
  ];
  return [...collection, ...CAREER_BADGES.map(({ value, ...badge }) => {
    const first = ordered.find((entry) => value(entry) >= badge.target);
    return { ...badge, value: Math.max(0, ...ordered.map(value)), by: first?.name ?? null };
  })];
}

export type CareerRecords = {
  players: number; bestScore: RetiredCareer | null;
  goals: number; assists: number; ballonDor: number; trophies: number; seasons: number;
  /** 포지션마다 가장 높은 레전드 점수의 선수 */
  byPosition: { pos: Pos; entry: RetiredCareer | null }[];
};

export function careerRecords(entries: RetiredCareer[]): CareerRecords {
  const best = (list: RetiredCareer[]) => list.reduce<RetiredCareer | null>((top, entry) => (!top || entry.score > top.score ? entry : top), null);
  const sum = (key: "goals" | "assists" | "ballonDor" | "trophies" | "seasons") => entries.reduce((total, entry) => total + entry.totals[key], 0);
  return {
    players: entries.length, bestScore: best(entries),
    goals: sum("goals"), assists: sum("assists"), ballonDor: sum("ballonDor"), trophies: sum("trophies"), seasons: sum("seasons"),
    byPosition: (Object.keys(POSITIONS) as Pos[]).map((pos) => ({ pos, entry: best(entries.filter((entry) => entry.pos === pos)) })),
  };
}
