import Link from "next/link";
import { cacheLife } from "next/cache";
import { competitionOrder, getCompetition } from "@/lib/competitions";
import { getMatchesBetween, type Match } from "@/lib/football-data";
import { roundLabel } from "@/lib/match-display";
import {
  addDays,
  diffDays,
  formatDayHeading,
  relativeDayLabel,
  toKstDateKey,
  todayKst,
} from "@/lib/time";
import { Crest } from "./Crest";
import { DateStrip } from "./DateStrip";
import { EmptyState } from "./EmptyState";
import { cardClass, cardHeadingClass } from "./MatchDayList";
import { LinkPending } from "./LinkPending";
import { MatchRow } from "./MatchRow";

const MAX_DISTANCE_DAYS = 60;

// 한국 날짜 하루는 UTC로 전날 15시부터 그날 15시까지예요.
// 날짜 띠에 보이는 어제부터 5일 뒤까지는 한 번의 호출로 묶어서 같은 캐시를 같이 써요.
// API의 dateTo는 포함되지 않고, 조회 범위는 최대 10일이에요.
function queryRange(selected: string, today: string) {
  const offset = diffDays(selected, today);
  if (offset >= -1 && offset <= 5) {
    return { from: addDays(today, -2), to: addDays(today, 7) };
  }
  return { from: addDays(selected, -1), to: addDays(selected, 2) };
}

/** 하루치 전체 대회 경기. date를 비우면 오늘이에요. */
export async function DayMatches({ date }: { date?: string }) {
  "use cache";
  cacheLife("matches");

  const today = todayKst();
  const selected = date ?? today;
  const relative = relativeDayLabel(selected, today);

  const header = (
    <>
      <DateStrip selected={selected} today={today} />
      <h1 className="mb-4 text-xl font-bold">
        {formatDayHeading(selected)}
        {relative ? (
          <span className="ml-2 text-base font-medium text-emerald-600 dark:text-emerald-400">
            {relative}
          </span>
        ) : null}
      </h1>
    </>
  );

  if (Math.abs(diffDays(selected, today)) > MAX_DISTANCE_DAYS) {
    return (
      <>
        {header}
        <EmptyState>오늘 기준 앞뒤 {MAX_DISTANCE_DAYS}일 안의 경기만 볼 수 있어요.</EmptyState>
      </>
    );
  }

  const { from, to } = queryRange(selected, today);
  const matches = (await getMatchesBetween(from, to))
    .filter((match) => toKstDateKey(match.utcDate) === selected)
    .sort((a, b) => a.utcDate.localeCompare(b.utcDate));

  const groups = new Map<string, Match[]>();
  for (const match of matches) {
    const list = groups.get(match.competition.code);
    if (list) list.push(match);
    else groups.set(match.competition.code, [match]);
  }
  const ordered = [...groups.entries()].sort(
    ([a], [b]) => competitionOrder(a) - competitionOrder(b),
  );

  return (
    <>
      {header}
      {ordered.length === 0 ? (
        <EmptyState>이날은 경기가 없어요.</EmptyState>
      ) : (
        <div className="space-y-4">
          {ordered.map(([code, list]) => {
            const info = getCompetition(code);
            return (
              <section key={code} className={cardClass}>
                <h2 className={cardHeadingClass}>
                  <span className="flex h-5 w-5 items-center justify-center rounded dark:bg-white">
                    <Crest src={info?.emblem ?? list[0].competition.emblem} size={16} />
                  </span>
                  {info ? (
                    <Link href={`/league/${code}`} prefetch={false} className="relative hover:underline">
                      {info.name}
                      <LinkPending className="rounded bg-emerald-500/20" />
                    </Link>
                  ) : (
                    list[0].competition.name
                  )}
                  <span className="ml-auto text-xs font-normal text-zinc-500">{list.length}경기</span>
                </h2>
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {list.map((match) => (
                    <MatchRow key={match.id} match={match} caption={roundLabel(match)} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
