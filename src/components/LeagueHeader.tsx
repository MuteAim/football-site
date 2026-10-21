import type { CompetitionInfo } from "@/lib/competitions";
import { Crest } from "./Crest";
import { LeagueTabs } from "./LeagueTabs";

export function LeagueHeader({ competition }: { competition: CompetitionInfo }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-700">
          <Crest src={competition.emblem} size={36} />
        </div>
        <div>
          <h1 className="text-xl font-bold">{competition.name}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{competition.region}</p>
        </div>
      </div>
      <LeagueTabs code={competition.code} />
    </div>
  );
}
