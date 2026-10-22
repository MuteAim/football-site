// 골에 따른 회원 등급이에요. 닉네임 옆 배지와 내 정보 화면에 써요.
// 골 규칙(출석 10골, 7일 연속 30골, 예측 적중 10골 등)은 supabase/schema.sql의 check_in, settle_match에 있어요.

export type Level = {
  name: string;
  /** 이 등급이 되는 골 */
  min: number;
  /** 배지 색. Tailwind가 찾을 수 있게 문자열 그대로 적어 둬요. */
  className: string;
};

export const LEVELS: Level[] = [
  { name: "새싹", min: 0, className: "bg-lime-500/15 text-lime-700 dark:text-lime-300" },
  { name: "유망주", min: 100, className: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  { name: "주전", min: 300, className: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300" },
  { name: "에이스", min: 800, className: "bg-amber-500/20 text-amber-800 dark:text-amber-300" },
  { name: "레전드", min: 2000, className: "bg-linear-to-r from-amber-400 to-rose-500 text-white" },
];

export function levelOf(goals: number): Level {
  return LEVELS.findLast((level) => goals >= level.min) ?? LEVELS[0];
}

/** 다음 등급. 이미 가장 높은 등급이면 null이에요. */
export function nextLevel(goals: number): Level | null {
  return LEVELS.find((level) => level.min > goals) ?? null;
}
