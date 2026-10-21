import Link from "next/link";
import { addDays, dayOfMonth, formatWeekday, relativeDayLabel } from "@/lib/time";
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

/**
 * 어제부터 5일 뒤까지의 날짜 버튼. 화살표로는 선택한 날짜의 앞뒤로 이동해요.
 * 날짜 페이지들은 같은 API 응답을 나눠 쓰기 때문에 미리 불러와도 API 호출이 늘지 않아요.
 */
export function DateStrip({ selected, today }: { selected: string; today: string }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 1));
  const prev = addDays(selected, -1);
  const next = addDays(selected, 1);

  return (
    <nav aria-label="날짜 선택" className={`mb-5 flex items-center gap-0.5 p-1.5 ${cardClass}`}>
      <Link
        href={hrefFor(prev, today)}
        transitionTypes={slideTypes(prev, selected)}
        aria-label="이전 날"
        className={arrowClass}
      >
        <ChevronLeftIcon />
        <LinkPending className="rounded-xl bg-emerald-500/20" />
      </Link>
      <div className="grid flex-1 grid-cols-7 gap-0.5">
        {days.map((date) => {
          const active = date === selected;
          const weekday = formatWeekday(date);
          const relative = relativeDayLabel(date, today);
          let labelColor = weekdayColor(weekday);
          if (active) labelColor = "text-white/70 dark:text-zinc-900/60";
          else if (date === today) labelColor = "text-emerald-600 dark:text-emerald-400";

          return (
            <Link
              key={date}
              href={hrefFor(date, today)}
              transitionTypes={slideTypes(date, selected)}
              aria-current={active ? "date" : undefined}
              className={`relative flex h-14 flex-col items-center justify-center gap-1 rounded-xl transition active:scale-95 ${
                active
                  ? "bg-zinc-900 text-white shadow-sm dark:bg-white dark:text-zinc-900"
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
      <Link
        href={hrefFor(next, today)}
        transitionTypes={slideTypes(next, selected)}
        aria-label="다음 날"
        className={arrowClass}
      >
        <ChevronRightIcon />
        <LinkPending className="rounded-xl bg-emerald-500/20" />
      </Link>
    </nav>
  );
}
