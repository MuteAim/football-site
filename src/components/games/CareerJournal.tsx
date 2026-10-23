import { useState } from "react";
import { clubName, seasonLabel } from "@/lib/career/engine";
import type { SeasonJournal } from "@/lib/career/journal";
import { cardClass, mutedClass, secondaryButtonClass } from "../ui";
import { SeasonReport } from "./CareerParts";

export function CareerJournal({ seasons }: { seasons: SeasonJournal[] }) {
  const [expanded, setExpanded] = useState<number[]>([]);
  if (!seasons.length) return null;
  return (
    <section id="career-journal" aria-labelledby="career-journal-title" className="scroll-mt-24 space-y-3">
      <div className={`${cardClass} p-5 sm:p-6`}>
        <p className="sport-eyebrow text-emerald-700 dark:text-emerald-400">CAREER JOURNAL</p>
        <h2 id="career-journal-title" className="mt-1 text-xl font-black">시즌별 기록과 이야기</h2>
        <p className={`mt-2 text-xs leading-relaxed ${mutedClass}`}>{seasons.length}시즌 동안의 성적, 능력치 변화, 훈련·사건·이적 선택을 모두 돌아보세요.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => setExpanded(seasons.map(({ season }) => season.year))} className={secondaryButtonClass}>모든 시즌 펼치기</button>
          <button type="button" onClick={() => setExpanded([])} className={secondaryButtonClass}>모두 접기</button>
        </div>
      </div>
      {seasons.map((journal, index) => {
        const { season } = journal;
        const open = expanded.includes(season.year);
        const honors = [...season.trophies, ...season.awards];
        return (
          <details key={season.year} data-journal-season={season.year} open={open}
            onToggle={(event) => {
              const isOpen = event.currentTarget.open;
              setExpanded((current) => isOpen === current.includes(season.year) ? current : isOpen ? [...current, season.year] : current.filter((year) => year !== season.year));
            }}
            className={`${cardClass} overflow-hidden`}>
            <summary className="cursor-pointer list-none p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-black">{seasonLabel(season.year)} <span className={`ml-1 text-xs font-medium ${mutedClass}`}>{season.age}세 · {season.pos}</span></p>
                  <p className={`mt-1 text-xs ${mutedClass}`}>{clubName(season.club)}{season.loan ? " · 임대" : season.military ? " · 군 복무" : ""}</p>
                </div>
                <span className={`shrink-0 text-xs ${mutedClass}`}>{open ? "접기 −" : "상세 +"}</span>
              </div>
              <p className="mt-3 text-sm font-bold tabular-nums">
                {season.apps}경기 · {season.pos === "GK" ? `무실점 ${season.cleanSheets}` : `${season.goals}골 ${season.assists}도움`} · 평점 {season.apps ? (season.rating / 10).toFixed(1) : "—"}
              </p>
              <p className={`mt-1 text-xs ${mutedClass}`}>OVR {season.ovrBefore} → {season.ovrEnd} · 선택 {journal.entries.length}회 · 주요 장면 {season.highlights.length}건</p>
              {honors.length ? <p className="mt-2 text-xs font-semibold text-amber-800 dark:text-amber-200">🏆 {honors.map((honor) => honor.label).join(" · ")}</p> : null}
            </summary>
            {open ? <div className="border-t border-zinc-100 p-2 sm:p-3 dark:border-white/[0.07]"><SeasonReport season={season} previous={seasons[index - 1]?.season} journal={journal} expandedDetails /></div> : null}
          </details>
        );
      })}
    </section>
  );
}
