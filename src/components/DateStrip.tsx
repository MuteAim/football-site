import Link from "next/link";
import { addDays, formatMonthDay, formatWeekday, relativeDayLabel } from "@/lib/time";
import { LinkPending } from "./LinkPending";

function hrefFor(date: string, today: string) {
  return date === today ? "/" : `/matches/${date}`;
}

const arrowClass =
  "relative flex h-12 w-8 shrink-0 items-center justify-center rounded-lg text-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800";

/**
 * 어제부터 5일 뒤까지의 날짜 버튼. 화살표로는 선택한 날짜의 앞뒤로 이동해요.
 * 날짜 페이지들은 같은 API 응답을 나눠 쓰기 때문에 미리 불러와도 API 호출이 늘지 않아요.
 */
export function DateStrip({ selected, today }: { selected: string; today: string }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 1));

  return (
    <nav aria-label="날짜 선택" className="mb-5 flex items-center gap-1">
      <Link href={hrefFor(addDays(selected, -1), today)} aria-label="이전 날" className={arrowClass}>
        ‹
        <LinkPending className="rounded-lg bg-emerald-500/20" />
      </Link>
      <div className="grid flex-1 grid-cols-7 gap-1">
        {days.map((date) => {
          const active = date === selected;
          return (
            <Link
              key={date}
              href={hrefFor(date, today)}
              aria-current={active ? "date" : undefined}
              className={`relative flex h-12 flex-col items-center justify-center rounded-lg leading-tight ${
                active
                  ? "bg-emerald-600 text-white"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              <span className="text-[11px]">{relativeDayLabel(date, today) ?? formatWeekday(date)}</span>
              <span className="text-xs font-semibold tabular-nums sm:text-sm">{formatMonthDay(date)}</span>
              <LinkPending className="rounded-lg bg-emerald-500/20" />
            </Link>
          );
        })}
      </div>
      <Link href={hrefFor(addDays(selected, 1), today)} aria-label="다음 날" className={arrowClass}>
        ›
        <LinkPending className="rounded-lg bg-emerald-500/20" />
      </Link>
    </nav>
  );
}
