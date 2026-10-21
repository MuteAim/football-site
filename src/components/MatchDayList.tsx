import type { Match } from "@/lib/football-data";
import { roundLabel } from "@/lib/match-display";
import { formatDayHeading, relativeDayLabel } from "@/lib/time";
import { MatchRow } from "./MatchRow";
import { cardClass, cardHeadingClass, cardListClass } from "./ui";

export function MatchDayList({
  days,
  today,
}: {
  days: { date: string; items: Match[] }[];
  today: string;
}) {
  return (
    <div className="space-y-3">
      {days.map(({ date, items }) => {
        const relative = relativeDayLabel(date, today);
        return (
          <section key={date} className={cardClass}>
            <h2 className={cardHeadingClass}>
              {formatDayHeading(date)}
              {relative ? (
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                  {relative}
                </span>
              ) : null}
              <span className="ml-auto text-xs font-normal text-zinc-400 dark:text-zinc-500">
                {items.length}경기
              </span>
            </h2>
            <ul className={cardListClass}>
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
