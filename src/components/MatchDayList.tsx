import type { Match } from "@/lib/football-data";
import { roundLabel } from "@/lib/match-display";
import { formatDayHeading, relativeDayLabel } from "@/lib/time";
import { MatchRow } from "./MatchRow";

export const cardClass =
  "overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900";
export const cardHeadingClass =
  "flex items-center gap-2 border-b border-zinc-100 bg-zinc-50 px-3 py-2 text-sm font-semibold dark:border-zinc-800 dark:bg-zinc-900/60";

export function MatchDayList({
  days,
  today,
}: {
  days: { date: string; items: Match[] }[];
  today: string;
}) {
  return (
    <div className="space-y-4">
      {days.map(({ date, items }) => {
        const relative = relativeDayLabel(date, today);
        return (
          <section key={date} className={cardClass}>
            <h2 className={cardHeadingClass}>
              {formatDayHeading(date)}
              {relative ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                  {relative}
                </span>
              ) : null}
            </h2>
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {items.map((match) => (
                <MatchRow key={match.id} match={match} caption={roundLabel(match)} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
