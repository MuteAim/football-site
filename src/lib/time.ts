// API의 경기 시각은 모두 UTC예요. 화면에는 항상 한국 시간으로 바꿔서 보여 줍니다.
const TIME_ZONE = "Asia/Seoul";

const dateKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const kickoffFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const headingFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: TIME_ZONE,
  month: "long",
  day: "numeric",
  weekday: "short",
});
const weekdayFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: TIME_ZONE,
  weekday: "short",
});
const longWeekdayFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: TIME_ZONE,
  weekday: "long",
});
const longMonthDayFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: TIME_ZONE,
  month: "long",
  day: "numeric",
});

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** UTC 시각을 한국 날짜 키(YYYY-MM-DD)로 바꿔요. 날짜별 묶음은 꼭 이 값을 기준으로 합니다. */
export function toKstDateKey(input: string | Date): string {
  return dateKeyFormat.format(new Date(input));
}

export function todayKst(): string {
  return toKstDateKey(new Date());
}

export function addDays(key: string, days: number): string {
  const date = new Date(`${key}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);
}

export function isDateKey(value: string): boolean {
  if (!DATE_KEY.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function kstNoon(key: string): Date {
  return new Date(`${key}T12:00:00+09:00`);
}

/** 예: 04:00 */
export function formatKickoff(utcDate: string): string {
  return kickoffFormat.format(new Date(utcDate));
}

/** 예: 10월 25일 (일) */
export function formatDayHeading(key: string): string {
  return headingFormat.format(kstNoon(key));
}

/** 예: 일 */
export function formatWeekday(key: string): string {
  return weekdayFormat.format(kstNoon(key));
}

/** 예: 일요일 */
export function formatWeekdayLong(key: string): string {
  return longWeekdayFormat.format(kstNoon(key));
}

/** 예: 10월 25일 */
export function formatMonthDayLong(key: string): string {
  return longMonthDayFormat.format(kstNoon(key));
}

/** 예: 25 */
export function dayOfMonth(key: string): number {
  return Number(key.slice(8, 10));
}

export function relativeDayLabel(key: string, today: string): string | null {
  if (key === today) return "오늘";
  if (key === addDays(today, 1)) return "내일";
  if (key === addDays(today, -1)) return "어제";
  return null;
}

export function groupByKstDate<T extends { utcDate: string }>(
  items: T[],
): { date: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = toKstDateKey(item.utcDate);
    const list = groups.get(key);
    if (list) list.push(item);
    else groups.set(key, [item]);
  }
  return [...groups.entries()].map(([date, list]) => ({ date, items: list }));
}

/** 앞에서부터 최소 count개를 고르되, 마지막 날짜의 경기는 잘리지 않게 끝까지 포함해요. */
export function takeWholeDays<T extends { utcDate: string }>(items: T[], count: number): T[] {
  if (items.length <= count) return items;
  const lastKey = toKstDateKey(items[count - 1].utcDate);
  let end = count;
  while (end < items.length && toKstDateKey(items[end].utcDate) === lastKey) end += 1;
  return items.slice(0, end);
}

// ---------- 카페 글 시각 ----------

/** 예: 2026.10.22 14:03 */
export function formatDateTime(iso: string): string {
  return `${toKstDateKey(iso).replaceAll("-", ".")} ${formatKickoff(iso)}`;
}

/** 글 목록용. 오늘 글은 14:03, 올해 글은 10.21, 그 전 글은 25.10.21처럼 보여 줘요. */
export function formatPostTime(iso: string, now: Date): string {
  const key = toKstDateKey(iso);
  const today = toKstDateKey(now);
  if (key === today) return formatKickoff(iso);
  if (key.slice(0, 4) === today.slice(0, 4)) return key.slice(5).replace("-", ".");
  return key.slice(2).replaceAll("-", ".");
}

/** 댓글용. 하루 안이면 "3분 전"처럼, 그보다 오래되면 날짜와 시각을 보여 줘요. */
export function formatRelativeTime(iso: string, now: Date): string {
  const minutes = Math.floor((now.getTime() - Date.parse(iso)) / 60_000);
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}시간 전`;
  return formatDateTime(iso);
}

export function seasonLabel(season: { startDate: string; endDate: string }): string {
  const start = season.startDate.slice(0, 4);
  const end = season.endDate.slice(0, 4);
  return start === end ? `${start} 시즌` : `${start}-${end.slice(2)} 시즌`;
}
