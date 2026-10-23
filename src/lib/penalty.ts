/** 승부차기 규칙. DB의 penalty_finish와 함께 바꾸고 채점 일치 테스트를 실행해요. */
export const PENALTY = { shots: 10, shotMs: 3500, feedbackMs: 750, minShotMs: 120, maxScore: 2250 } as const;

export type Shot = { elapsed: number | null; position: number; grade: "perfect" | "goal" | "saved" | "timeout"; points: number; streak: number };
export type PenaltyResult = { score: number; goals: number; perfects: number; bestStreak: number };
export type PenaltyLeader = { nickname: string; score: number; goals: number; perfects: number; rank: number; isMe: boolean };
export type PenaltyBoard = { leaders: PenaltyLeader[]; personal: { score: number; rank: number } | null; participants: number };
export type PenaltySnapshot = { day: string; member: boolean; available: boolean; board: PenaltyBoard };

export function penaltyDay(now = new Date()): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** 같은 날짜에는 모두 같은 목표·속도·출발 위치로 겨뤄요. 좌표 범위는 0~1000이에요. */
export function shotSetup(day: string, index: number) {
  const seed = Number(day.replaceAll("-", ""));
  return {
    target: 220 + (seed * 37 + index * 193) % 560,
    width: 260 - index * 10,
    period: 1900 - index * 80 + seed % 150,
    phase: (seed * 53 + index * 211) % (1900 - index * 80 + seed % 150),
  };
}

export function shotPosition(day: string, index: number, elapsed: number): number {
  const { period, phase } = shotSetup(day, index);
  const progress = ((Math.max(0, elapsed) + phase) % period) / period;
  return Math.round((progress <= 0.5 ? progress * 2 : (1 - progress) * 2) * 1000);
}

export function judgeShot(day: string, index: number, elapsed: number | null, previousStreak: number): Shot {
  const position = shotPosition(day, index, elapsed ?? PENALTY.shotMs);
  if (elapsed === null || elapsed < PENALTY.minShotMs || elapsed >= PENALTY.shotMs) {
    return { elapsed: null, position, grade: "timeout", points: 0, streak: 0 };
  }
  const { target, width } = shotSetup(day, index);
  const distance = Math.abs(position - target);
  const grade = distance <= width / 6 ? "perfect" : distance <= width / 2 ? "goal" : "saved";
  const streak = grade === "saved" ? 0 : previousStreak + 1;
  const points = streak ? (grade === "perfect" ? 150 : 100) + Math.min(streak - 1, 4) * 25 : 0;
  return { elapsed, position, grade, points, streak };
}

export function summarizeShots(shots: Shot[]): PenaltyResult {
  return {
    score: shots.reduce((sum, shot) => sum + shot.points, 0),
    goals: shots.filter((shot) => shot.streak > 0).length,
    perfects: shots.filter((shot) => shot.grade === "perfect").length,
    bestStreak: Math.max(0, ...shots.map((shot) => shot.streak)),
  };
}

export function penaltyTitle(score: number): string {
  return score >= 2000 ? "월드 클래스" : score >= 1500 ? "승부차기 에이스" : score >= 900 ? "클러치 플레이어" : score >= 400 ? "떠오르는 유망주" : "다음 슛의 주인공";
}

/** 공유 링크의 점수는 도전 목표로만 사용해요. 순위에는 저장하지 않아요. */
export function readChallenge(score: string | null, day: string | null): { score: number; day: string } | null {
  if (!score || !/^\d{1,4}$/.test(score) || !day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const value = Number(score);
  const date = new Date(`${day}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== day || value > PENALTY.maxScore) return null;
  return { score: value, day };
}
