import { cacheLife } from "next/cache";
import { getMatchesSnapshot, type Match } from "./football-data";
import { isWithinRange, queryRange } from "./match-dates";
import { toKstDateKey, todayKst } from "./time";

export { isWithinRange, MAX_DISTANCE_DAYS, queryRange, matchHref } from "./match-dates";

/**
 * 경기 화면의 경기 하나. 날짜별 경기 화면과 같은 API 응답에서 찾아서 API 호출이 늘지 않아요.
 * 범위를 벗어난 날짜나 그날 없는 경기는 null이에요.
 */
export async function getMatchOnDay(date: string, id: number): Promise<Match | null> {
  return (await getMatchOnDaySnapshot(date, id))?.match ?? null;
}

export async function getMatchOnDaySnapshot(date: string, id: number) {
  "use cache";
  cacheLife("matches");

  const today = todayKst();
  if (!isWithinRange(date, today)) return null;
  const { from, to } = queryRange(date, today);
  const { matches, checkedAt } = await getMatchesSnapshot(from, to);
  const match = matches.find((match) => match.id === id && toKstDateKey(match.utcDate) === date);
  return match ? { match, checkedAt } : null;
}
