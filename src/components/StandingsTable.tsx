import type { StandingRow } from "@/lib/football-data";
import { teamName } from "@/lib/teams-ko";
import { Crest } from "./Crest";
import { cardClass, cardHeadingClass } from "./MatchDayList";

const num = "w-7 py-2 text-center sm:w-9";

export function StandingsTable({ title, rows }: { title?: string | null; rows: StandingRow[] }) {
  return (
    <section className={cardClass}>
      {title ? <h2 className={cardHeadingClass}>{title}</h2> : null}
      <table className="w-full text-sm tabular-nums">
        <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-900/60 dark:text-zinc-400">
          <tr>
            <th scope="col" className="w-8 py-2 pl-3 text-left font-medium">#</th>
            <th scope="col" className="py-2 text-left font-medium">팀</th>
            <th scope="col" className={`${num} font-medium`}>경기</th>
            <th scope="col" className={`${num} font-medium`}>승</th>
            <th scope="col" className={`${num} font-medium`}>무</th>
            <th scope="col" className={`${num} font-medium`}>패</th>
            <th scope="col" className={`${num} hidden font-medium sm:table-cell`}>득점</th>
            <th scope="col" className={`${num} hidden font-medium sm:table-cell`}>실점</th>
            <th scope="col" className="w-9 py-2 text-center font-medium sm:w-10">득실</th>
            <th scope="col" className="w-11 py-2 pr-3 text-center font-medium">승점</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {rows.map((row) => (
            <tr key={row.team.id ?? row.position}>
              <td className="py-2 pl-3 text-zinc-500">{row.position}</td>
              <td className="max-w-0 py-2">
                <div className="flex items-center gap-2">
                  <Crest src={row.team.crest} />
                  <span className="truncate">{teamName(row.team)}</span>
                </div>
              </td>
              <td className={num}>{row.playedGames}</td>
              <td className={num}>{row.won}</td>
              <td className={num}>{row.draw}</td>
              <td className={num}>{row.lost}</td>
              <td className={`${num} hidden sm:table-cell`}>{row.goalsFor}</td>
              <td className={`${num} hidden sm:table-cell`}>{row.goalsAgainst}</td>
              <td className="py-2 text-center">
                {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
              </td>
              <td className="py-2 pr-3 text-center font-bold">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
