"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { dateWindow, isWithinRange, MAX_DISTANCE_DAYS } from "@/lib/match-dates";
import { addDays, dayOfMonth, formatWeekday, isDateKey, relativeDayLabel } from "@/lib/time";
import { ChevronLeftIcon, ChevronRightIcon } from "./Icons";
import { LinkPending } from "./LinkPending";
import { cardClass } from "./ui";

function hrefFor(date: string, today: string) {
  return date === today ? "/" : `/matches/${date}`;
}

/** 뒷날로 가면 경기 목록이 오른쪽에서, 앞날로 가면 왼쪽에서 들어와요. 애니메이션은 DayMatches에 있어요. */
function slideTypes(to: string, from: string) {
  if (to === from) return undefined;
  return [to > from ? "nav-forward" : "nav-back"];
}

/** 토요일은 파란색, 일요일은 빨간색으로 보여 줘요. */
function weekdayColor(weekday: string) {
  if (weekday === "토") return "text-sky-600 dark:text-sky-400";
  if (weekday === "일") return "text-rose-600 dark:text-rose-400";
  return "text-zinc-500 dark:text-zinc-400";
}

const arrowClass =
  "relative flex h-14 w-8 shrink-0 items-center justify-center rounded-xl text-zinc-400 transition hover:bg-zinc-950/5 hover:text-zinc-900 active:scale-95 dark:text-zinc-500 dark:hover:bg-white/10 dark:hover:text-white";

/** 선택한 날짜를 따라 움직이는 일주일과 달력으로 날짜를 골라요. */
export function DateStrip({ selected, today }: { selected: string; today: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const days = dateWindow(selected, today);
  const prev = addDays(selected, -1);
  const next = addDays(selected, 1);

  function jump(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const date = String(new FormData(event.currentTarget).get("date") ?? "");
    if (!isDateKey(date) || !isWithinRange(date, today)) {
      setError(`오늘 기준 앞뒤 ${MAX_DISTANCE_DAYS}일 안에서 골라 주세요.`);
      return;
    }
    setError(null);
    startTransition(() => router.push(hrefFor(date, today), { transitionTypes: slideTypes(date, selected) }));
  }

  return (
    <div className={`mb-5 ${cardClass}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-3 py-2 dark:border-white/[0.07]">
        <form onSubmit={jump} className="flex min-w-0 items-center gap-2">
          <label className="sr-only" htmlFor="match-date">경기 날짜</label>
          <input
            key={selected}
            id="match-date"
            name="date"
            type="date"
            required
            defaultValue={selected}
            min={addDays(today, -MAX_DISTANCE_DAYS)}
            max={addDays(today, MAX_DISTANCE_DAYS)}
            className="h-10 min-w-0 max-w-40 rounded-lg bg-zinc-100 px-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:bg-white/5"
          />
          <button type="submit" disabled={pending} className="h-10 shrink-0 rounded-lg px-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-500/10 disabled:opacity-50 dark:text-emerald-300">
            {pending ? "이동 중…" : "이동"}
          </button>
        </form>
        <Link href="/" prefetch={false} transitionTypes={slideTypes(today, selected)} className="flex h-10 shrink-0 items-center rounded-lg px-3 text-sm font-semibold hover:bg-zinc-100 dark:hover:bg-white/10">
          오늘
        </Link>
      </div>
      {error ? <p role="alert" className="px-3 pt-2 text-xs text-rose-600 dark:text-rose-400">{error}</p> : null}
      <nav aria-label="날짜 선택" className="flex items-center gap-0.5 p-1.5">
        {isWithinRange(prev, today) ? (
          <Link href={hrefFor(prev, today)} prefetch={false} transitionTypes={slideTypes(prev, selected)} aria-label="이전 날" className={arrowClass}>
            <ChevronLeftIcon />
            <LinkPending className="rounded-xl bg-emerald-500/20" />
          </Link>
        ) : <span aria-disabled="true" aria-label="이전 날 없음" className={`${arrowClass} opacity-30`}><ChevronLeftIcon /></span>}
        <div className="grid min-w-0 flex-1 grid-cols-7 gap-0.5">
          {days.map((date) => {
            const active = date === selected;
            const weekday = formatWeekday(date);
            const relative = relativeDayLabel(date, today);
            let labelColor = weekdayColor(weekday);
            if (active) labelColor = "text-emerald-100 dark:text-zinc-600";
            else if (date === today) labelColor = "text-emerald-600 dark:text-emerald-400";

            return (
              <Link
                key={date}
                href={hrefFor(date, today)}
                prefetch={false}
                transitionTypes={slideTypes(date, selected)}
                aria-current={active ? "date" : undefined}
                className={`relative flex h-14 flex-col items-center justify-center gap-1 rounded-xl transition active:scale-95 ${
                  active
                    ? "bg-emerald-700 text-white shadow-sm shadow-emerald-900/15 dark:bg-zinc-100 dark:text-zinc-950 dark:shadow-none"
                    : "hover:bg-zinc-950/5 dark:hover:bg-white/10"
                }`}
              >
                <span className={`text-[11px] leading-none font-medium ${labelColor}`}>{relative ?? weekday}</span>
                <span className="text-[17px] leading-none font-bold tabular-nums">
                  <span className="sr-only">{Number(date.slice(5, 7))}월 </span>
                  {dayOfMonth(date)}
                  <span className="sr-only">일</span>
                </span>
                <LinkPending className="rounded-xl bg-emerald-500/20" />
              </Link>
            );
          })}
        </div>
        {isWithinRange(next, today) ? (
          <Link href={hrefFor(next, today)} prefetch={false} transitionTypes={slideTypes(next, selected)} aria-label="다음 날" className={arrowClass}>
            <ChevronRightIcon />
            <LinkPending className="rounded-xl bg-emerald-500/20" />
          </Link>
        ) : <span aria-disabled="true" aria-label="다음 날 없음" className={`${arrowClass} opacity-30`}><ChevronRightIcon /></span>}
      </nav>
    </div>
  );
}
