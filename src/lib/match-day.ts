import { cacheLife } from "next/cache";
import { getMatchesBetween, type Match } from "./football-data";
import { addDays, diffDays, toKstDateKey, todayKst } from "./time";

/** 날짜별 경기와 경기 화면은 오늘 기준 앞뒤 이만큼의 날짜만 보여 줘요. */
export const MAX_DISTANCE_DAYS = 60;

export function isWithinRange(date: string, today: string): boolean {
  return Math.abs(diffDays(date, today)) <= MAX_DISTANCE_DAYS;
}

// 한국 날짜 하루는 UTC로 전날 15시부터 그날 15시까지예요.
// 날짜 띠에 보이는 어제부터 5일 뒤까지는 한 번의 호출로 묶어서 같은 캐시를 같이 써요.
// API의 dateTo는 포함되지 않고, 조회 범위는 최대 10일이에요.
export function queryRange(selected: string, today: string) {
  const offset = diffDays(selected, today);
  if (offset >= -1 && offset <= 5) {
    return { from: addDays(today, -2), to: addDays(today, 7) };
  }
  return { from: addDays(selected, -1), to: addDays(selected, 2) };
}

/**
 * 경기 화면의 경기 하나. 날짜별 경기 화면과 같은 API 응답에서 찾아서 API 호출이 늘지 않아요.
 * 범위를 벗어난 날짜나 그날 없는 경기는 null이에요.
 */
export async function getMatchOnDay(date: string, id: number): Promise<Match | null> {
  "use cache";
  cacheLife("matches");

  const today = todayKst();
  if (!isWithinRange(date, today)) return null;
  const { from, to } = queryRange(date, today);
  const matches = await getMatchesBetween(from, to);
  return matches.find((match) => match.id === id && toKstDateKey(match.utcDate) === date) ?? null;
}

/** 경기 화면 주소. 볼 수 있는 날짜 범위를 벗어난 경기는 null이에요. */
export function matchHref(date: string, id: number, today: string): string | null {
  return isWithinRange(date, today) ? `/matches/${date}/${id}` : null;
}
