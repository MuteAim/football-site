import Link from "next/link";
import { cacheLife } from "next/cache";
import { ViewTransition, type ReactNode } from "react";
import { competitionOrder, getCompetition } from "@/lib/competitions";
import { getMatchesBetween, type Match } from "@/lib/football-data";
import { isLive, roundLabel } from "@/lib/match-display";
import {
  addDays,
  diffDays,
  formatMonthDayLong,
  formatWeekdayLong,
  relativeDayLabel,
  toKstDateKey,
  todayKst,
} from "@/lib/time";
import { Crest } from "./Crest";
import { DateStrip } from "./DateStrip";
import { EmptyState } from "./EmptyState";
import { ChevronRightIcon } from "./Icons";
import { LinkPending } from "./LinkPending";
import { MatchRow } from "./MatchRow";
import { cardClass, cardHeadingClass, cardListClass } from "./ui";

const MAX_DISTANCE_DAYS = 60;

// DateStrip이 날짜 링크에 붙인 방향대로 경기 목록이 밀려 들어와요.
// 방향이 없는 이동(브라우저 뒤로 가기, 새로 불러오기)에서는 움직이지 않아요.
const SLIDE = { "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" };

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

function DayHeading({ date, today, children }: { date: string; today: string; children?: ReactNode }) {
  const relative = relativeDayLabel(date, today);
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          {relative ? (
            <span className="text-emerald-600 dark:text-emerald-400">{relative} · </span>
          ) : null}
          {formatWeekdayLong(date)}
        </p>
        <h1 className="mt-0.5 text-2xl font-bold tracking-tight">{formatMonthDayLong(date)}</h1>
      </div>
      {children ? <div className="flex shrink-0 items-center gap-1.5 pb-1">{children}</div> : null}
    </div>
  );
}

/** 대회 이름 줄. 순위표로 가는 링크라 줄 전체를 누를 수 있어요. */
function CompetitionHeading({ code, list }: { code: string; list: Match[] }) {
  const info = getCompetition(code);
  const content = (
    <>
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-zinc-950/5 dark:ring-white/10">
        <Crest src={info?.emblem ?? list[0].competition.emblem} size={18} />
      </span>
      <span className="truncate">{info?.name ?? list[0].competition.name}</span>
      <span className="ml-auto shrink-0 text-xs font-normal text-zinc-400 dark:text-zinc-500">
        {list.length}경기
      </span>
    </>
  );

  return (
    <h2 className={cardHeadingClass}>
      {info ? (
        <Link
          href={`/league/${code}`}
          prefetch={false}
          className="group relative flex min-w-0 flex-1 items-center gap-2.5 self-stretch"
        >
          {content}
          <ChevronRightIcon className="-mr-1 size-4 shrink-0 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-zinc-500 dark:text-zinc-600 dark:group-hover:text-zinc-400" />
          <LinkPending className="-mx-2 rounded-lg bg-emerald-500/15" />
        </Link>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-2.5">{content}</span>
      )}
    </h2>
  );
}

/** 하루치 전체 대회 경기. date를 비우면 오늘이에요. */
export async function DayMatches({ date }: { date?: string }) {
  "use cache";
  cacheLife("matches");

  const today = todayKst();
  const selected = date ?? today;

  let body: ReactNode;
  if (Math.abs(diffDays(selected, today)) > MAX_DISTANCE_DAYS) {
    body = (
      <>
        <DayHeading date={selected} today={today} />
        <EmptyState>오늘 기준 앞뒤 {MAX_DISTANCE_DAYS}일 안의 경기만 볼 수 있어요.</EmptyState>
      </>
    );
  } else {
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
    const liveCount = matches.filter(isLive).length;

    body = (
      <>
        <DayHeading date={selected} today={today}>
          {liveCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-600 dark:text-red-400">
              <span className="size-1.5 rounded-full bg-red-500" />
              진행 중 {liveCount}
            </span>
          ) : null}
          {matches.length > 0 ? (
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-white/10">
              {matches.length}경기
            </span>
          ) : null}
        </DayHeading>
        {ordered.length === 0 ? (
          <EmptyState>이날은 경기가 없어요.</EmptyState>
        ) : (
          <div className="space-y-3">
            {ordered.map(([code, list]) => (
              <section key={code} className={cardClass}>
                <CompetitionHeading code={code} list={list} />
                <ul className={cardListClass}>
                  {list.map((match) => (
                    <MatchRow key={match.id} match={match} caption={roundLabel(match)} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <DateStrip selected={selected} today={today} />
      <ViewTransition enter={SLIDE} exit={SLIDE} default="none">
        <div>{body}</div>
      </ViewTransition>
    </>
  );
}
