import type { StandingRow } from "@/lib/football-data";
import { teamName } from "@/lib/teams-ko";
import { Crest } from "./Crest";
import { cardClass, cardHeadingClass } from "./ui";

const num = "w-7 text-center sm:w-9";
// 승점 칸은 옅은 바탕으로 따로 띄워서 눈이 먼저 가게 해요.
const pointsCell = "w-11 bg-zinc-50 text-center dark:bg-white/[0.03]";

export function StandingsTable({ title, rows }: { title?: string | null; rows: StandingRow[] }) {
  return (
    <section className={cardClass}>
      {title ? <h2 className={cardHeadingClass}>{title}</h2> : null}
      <table className="w-full text-sm tabular-nums">
        <thead className="text-[11px] text-zinc-400 dark:text-zinc-500">
          <tr className="h-9 border-b border-zinc-100 dark:border-white/[0.07]">
            <th scope="col" className="w-9 pl-4 text-left font-medium">#</th>
            <th scope="col" className="text-left font-medium">팀</th>
            <th scope="col" className={`${num} font-medium`}>경기</th>
            <th scope="col" className={`${num} font-medium`}>승</th>
            <th scope="col" className={`${num} font-medium`}>무</th>
            <th scope="col" className={`${num} font-medium`}>패</th>
            <th scope="col" className={`${num} hidden font-medium sm:table-cell`}>득점</th>
            <th scope="col" className={`${num} hidden font-medium sm:table-cell`}>실점</th>
            <th scope="col" className="w-9 text-center font-medium sm:w-11">득실</th>
            <th scope="col" className={`${pointsCell} font-semibold text-zinc-500 dark:text-zinc-400`}>승점</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.06]">
          {rows.map((row) => (
            <tr
              key={row.team.id ?? row.position}
              className="h-11 transition-colors hover:bg-zinc-50/70 dark:hover:bg-white/[0.02]"
            >
              <td className="pl-4 font-medium text-zinc-400 dark:text-zinc-500">{row.position}</td>
              <td className="max-w-0">
                <div className="flex items-center gap-2">
                  <Crest src={row.team.crest} />
                  <span className="truncate font-medium">{teamName(row.team)}</span>
                </div>
              </td>
              <td className={num}>{row.playedGames}</td>
              <td className={num}>{row.won}</td>
              <td className={num}>{row.draw}</td>
              <td className={num}>{row.lost}</td>
              <td className={`${num} hidden sm:table-cell`}>{row.goalsFor}</td>
              <td className={`${num} hidden sm:table-cell`}>{row.goalsAgainst}</td>
              <td className="text-center text-zinc-500 dark:text-zinc-400">
                {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
              </td>
              <td className={`${pointsCell} text-[15px] font-bold`}>{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
