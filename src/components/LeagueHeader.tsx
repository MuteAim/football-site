import type { CompetitionInfo } from "@/lib/competitions";
import { Crest } from "./Crest";
import { PitchLines } from "./Icons";
import { LeagueTabs } from "./LeagueTabs";

/** 대회 페이지 머리. 대회 고유색 바탕에 엠블럼과 이름을 크게 보여 줘요. */
export function LeagueHeader({ competition }: { competition: CompetitionInfo }) {
  return (
    <div className="mb-5">
      <div
        className="relative h-[104px] overflow-hidden rounded-3xl px-5 text-white shadow-sm"
        style={{ backgroundColor: competition.color }}
      >
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(120%_120%_at_100%_0%,rgb(255_255_255/0.22),transparent_60%)]"
        />
        <PitchLines className="absolute top-1/2 -right-16 size-56 -translate-y-1/2 text-white/10" />
        <div className="relative flex h-full items-center gap-4">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-white shadow-lg shadow-black/20">
            <Crest src={competition.emblem} size={44} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white/80">{competition.region}</p>
            <h1 className="truncate text-2xl font-bold tracking-tight">{competition.name}</h1>
          </div>
        </div>
      </div>
      <LeagueTabs code={competition.code} />
    </div>
  );
}
