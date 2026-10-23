import { addDays, diffDays } from "./time";

/** 날짜 선택과 경기 링크가 함께 쓰는 조회 범위예요. */
export const MAX_DISTANCE_DAYS = 60;

export function isWithinRange(date: string, today: string): boolean {
  return Math.abs(diffDays(date, today)) <= MAX_DISTANCE_DAYS;
}

export function dateWindow(selected: string, today: string): string[] {
  const offset = Math.max(-MAX_DISTANCE_DAYS, Math.min(MAX_DISTANCE_DAYS, diffDays(selected, today)));
  const start = Math.max(-MAX_DISTANCE_DAYS, Math.min(MAX_DISTANCE_DAYS - 6, offset - 3));
  return Array.from({ length: 7 }, (_, i) => addDays(today, start + i));
}

// 한국 날짜 하루는 UTC로 전날 15시부터 그날 15시까지예요.
// 오늘 근처 날짜들은 같은 API 응답을 나눠 쓰고, dateTo는 포함하지 않아요.
export function queryRange(selected: string, today: string) {
  const offset = diffDays(selected, today);
  if (offset >= -1 && offset <= 5) {
    return { from: addDays(today, -2), to: addDays(today, 7) };
  }
  return { from: addDays(selected, -1), to: addDays(selected, 2) };
}

export function matchHref(date: string, id: number, today: string): string | null {
  return isWithinRange(date, today) ? `/matches/${date}/${id}` : null;
}
