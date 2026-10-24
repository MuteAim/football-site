import type { NationCode, Pos } from "./data";
import { FLANKS, type CareerSummary, type Side } from "./engine";

// 레전드 로드 순위 화면에서 쓰는 모양이에요. DB의 career_board가 같은 모양으로 돌려줘요.
export type CareerLeader = {
  /** side는 윙어·풀백의 측면이에요. number·side는 schema.sql을 다시 실행하기 전에는 없어요. */
  nickname: string; name: string; position: Pos; side?: Side | null; number?: number | null; nation: NationCode; club: string;
  score: number; ballonDor: number; peakOvr: number; goals: number; rank: number; isMe: boolean;
};
export type CareerElevenEntry = { position: Pos; side?: Side | null; number?: number | null; slot: number; name: string; nickname: string; score: number; peakOvr: number; ballonDor: number };
export type CareerBoard = {
  leaders: CareerLeader[];
  personal: { score: number; rank: number } | null;
  participants: number;
  eleven: CareerElevenEntry[];
};
export type CareerSnapshot = { day: string; member: boolean; available: boolean; board: CareerBoard };

export const EMPTY_CAREER_BOARD: CareerBoard = { leaders: [], personal: null, participants: 0, eleven: [] };

/** 순위 화면에 보이는 인원. DB의 career_board가 상위 20명을 돌려줘요. */
export const BOARD_SIZE = 20;

/**
 * 이 점수가 오늘의 순위에 올랐다면 몇 위인지. 연습 커리어에 "순위 도전이었다면"을 보여 줄 때 써요.
 * 같은 점수는 공동 순위예요. 상위 20명 안에 들지 못하면 null이에요.
 */
export function wouldRank(board: CareerBoard, score: number): number | null {
  const ahead = board.leaders.filter((leader) => leader.score > score).length;
  return ahead < BOARD_SIZE ? ahead + 1 : null;
}

/** 레전드 점수 상한. DB의 career_records 점수 조건과 같아요. */
export const MAX_CAREER_SCORE = 100000;

/** 순위는 은퇴한 날의 한국 날짜로 모아요. */
export function careerDay(now = new Date()): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** 도전장 링크의 점수는 목표로만 보여 주고 순위에는 넣지 않아요. */
export function readCareerChallenge(score: string | null, day: string | null): { score: number; day: string } | null {
  if (!score || !/^\d{1,6}$/.test(score) || !day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const value = Number(score);
  const date = new Date(`${day}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== day || value > MAX_CAREER_SCORE) return null;
  return { score: value, day };
}

/** DB의 career_record에 보내는 은퇴 기록. 서버가 다시 계산한 요약으로만 만들어요. 측면은 윙어·풀백으로 은퇴했을 때만 남겨요. */
export function careerRecordOf(summary: CareerSummary) {
  return {
    position: summary.pos, side: FLANKS.includes(summary.pos) ? summary.side : null, number: summary.number, foot: summary.foot,
    name: summary.name, nation: summary.nation, club: summary.lastClub,
    score: summary.score, ballonDor: summary.ballonDor, peakOvr: summary.peakOvr,
    goals: summary.goals, assists: summary.assists, apps: summary.apps, trophies: summary.trophies, seasons: summary.seasons,
  };
}
