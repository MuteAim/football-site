import type { CompetitionInfo } from "@/lib/competitions";
import { Crest } from "./Crest";
import { PitchLines } from "./Icons";
import { LeagueTabs } from "./LeagueTabs";

/** 대회 페이지 머리. 대회 고유색 바탕에 엠블럼과 이름을 크게 보여 줘요. */
export function LeagueHeader({ competition }: { competition: CompetitionInfo }) {
  return (
    <div className="mb-5">
      <div
        className="relative flex min-h-36 items-center overflow-hidden rounded-3xl px-5 py-6 text-white sm:px-7"
        style={{ backgroundColor: competition.color }}
      >
        <div
          aria-hidden
          className="absolute inset-0 bg-linear-to-r from-black/25 to-transparent"
        />
        <PitchLines className="absolute top-1/2 -right-12 h-60 w-96 -translate-y-1/2 -rotate-12 text-white/10" />
        <div className="relative flex min-w-0 items-center gap-4 sm:gap-5">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-white shadow-lg shadow-black/20">
            <Crest src={competition.emblem} size={44} />
          </div>
          <div className="min-w-0">
            <p className="sport-eyebrow mb-1 text-white/60">LEAGUE CENTER</p>
            <h1 className="truncate text-2xl font-extrabold tracking-tight sm:text-3xl">{competition.name}</h1>
            <p className="mt-1 text-xs font-medium text-white/75">{competition.region} · 순위와 경기 기록</p>
          </div>
        </div>
      </div>
      <LeagueTabs code={competition.code} />
    </div>
  );
}
