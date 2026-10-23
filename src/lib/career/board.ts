import type { NationCode, Pos } from "./data";

// 레전드 로드 순위 화면에서 쓰는 모양이에요. DB의 career_board가 같은 모양으로 돌려줘요.
export type CareerLeader = {
  nickname: string; name: string; position: Pos; nation: NationCode; club: string;
  score: number; ballonDor: number; peakOvr: number; goals: number; rank: number; isMe: boolean;
};
export type CareerElevenEntry = { position: Pos; slot: number; name: string; nickname: string; score: number; peakOvr: number; ballonDor: number };
export type CareerBoard = {
  leaders: CareerLeader[];
  personal: { score: number; rank: number } | null;
  participants: number;
  eleven: CareerElevenEntry[];
};
export type CareerSnapshot = { day: string; member: boolean; available: boolean; board: CareerBoard };

export const EMPTY_CAREER_BOARD: CareerBoard = { leaders: [], personal: null, participants: 0, eleven: [] };

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
