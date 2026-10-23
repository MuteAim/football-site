import { attrLabels, type SeasonRecord } from "@/lib/career/engine";
import type { SeasonJournal } from "@/lib/career/journal";
import { mutedClass } from "../ui";

const changeClass = (value: number) => value > 0 ? "text-emerald-700 dark:text-emerald-300" : value < 0 ? "text-rose-600 dark:text-rose-300" : mutedClass;
const signed = (value: number) => value > 0 ? `+${value}` : value < 0 ? `${value}` : "변화 없음";

export function SeasonStats({ season, previous, journal }: { season: SeasonRecord; previous?: SeasonRecord; journal?: SeasonJournal }) {
  const keeper = season.pos === "GK";
  const tiles = [
    { label: "출전", value: season.apps, old: previous?.apps, unit: "경기" },
    { label: keeper ? "무실점" : "골", value: keeper ? season.cleanSheets : season.goals, old: previous ? keeper ? previous.cleanSheets : previous.goals : undefined, unit: keeper ? "경기" : "골" },
    { label: "도움", value: season.assists, old: previous?.assists, unit: "도움" },
    { label: "평점", value: season.apps ? (season.rating / 10).toFixed(1) : "—", old: previous?.apps && season.apps ? previous.rating : undefined, unit: "" },
  ];
  const ovr = season.ovrEnd - season.ovrBefore;
  return (
    <div className="space-y-4 px-4 py-4 sm:px-6" data-season-stats={season.year}>
      <p className={`text-[11px] ${mutedClass}`}>1군 클럽 성적 · 국가대표와 2군 기록은 별도로 표시해요</p>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map((tile) => {
          const diff = tile.old === undefined ? null : tile.label === "평점" ? (season.rating - tile.old) / 10 : Number(tile.value) - tile.old;
          return (
            <div key={tile.label} className="rounded-2xl bg-zinc-50 px-3 py-3 dark:bg-white/[0.04]">
              <dt className={`text-xs ${mutedClass}`}>{tile.label}</dt>
              <dd className="mt-1 text-3xl font-black tracking-tight tabular-nums">
                {tile.value}<span className={`ml-1 text-[10px] font-medium tracking-normal ${mutedClass}`}>{tile.unit}</span>
                <p className={`mt-1 text-[10px] font-semibold tracking-normal ${diff === null ? mutedClass : changeClass(diff)}`}>
                  {diff === null ? previous ? "비교 기록 없음" : "첫 시즌" : `지난 시즌 대비 ${diff === 0 ? "동일" : `${diff > 0 ? "+" : ""}${tile.label === "평점" ? diff.toFixed(1) : diff}`}`}
                </p>
              </dd>
            </div>
          );
        })}
      </dl>
      <p className={`text-xs leading-relaxed ${mutedClass}`}>
        선발 <strong>{season.starts}</strong> · 교체 <strong>{season.apps - season.starts}</strong> · 출전 시간 <strong>{season.minutes.toLocaleString("ko-KR")}분</strong> · 부상 결장 <strong>{season.missed}경기</strong>
      </p>
      {season.reserve ? <p className="rounded-xl bg-zinc-50 px-3 py-2 text-xs dark:bg-white/[0.04]">2군에서 {season.reserve.apps}경기 · {season.reserve.goals}골 · {season.reserve.assists}도움으로 경험을 쌓았어요.</p> : null}
      <div className="rounded-2xl border border-emerald-700/15 bg-emerald-500/[0.04] p-4 dark:border-emerald-300/15">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><h3 className="text-sm font-extrabold">시즌 능력치 변화</h3><p className={`mt-0.5 text-[10px] ${mutedClass}`}>프리시즌 훈련 전 → 시즌 종료</p></div>
          <p className="text-xl font-black tabular-nums"><span className={`mr-2 text-xs ${mutedClass}`}>OVR</span>{season.ovrBefore} <span className={mutedClass}>→</span> {season.ovrEnd} <span className={`text-sm ${changeClass(ovr)}`}>({signed(ovr)})</span></p>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
          {attrLabels(season.pos).map((label, index) => {
            const growth = season.growth[index];
            const before = journal?.attrsBefore[index];
            const after = journal?.attrsAfter[index];
            return (
              <div key={label}>
                <div className="flex flex-wrap items-baseline justify-between gap-1 text-xs">
                  <dt className="font-semibold">{label}</dt>
                  <dd className="font-bold tabular-nums">
                    {before !== undefined && after !== undefined ? <><span className={mutedClass}>{before} → </span>{after} </> : null}
                    <span className={changeClass(growth)}>{growth ? `(${signed(growth)})` : "—"}<span className="sr-only">{growth === 0 ? " 변화 없음" : ""}</span></span>
                  </dd>
                </div>
                {before !== undefined && after !== undefined ? (
                  <div aria-hidden="true" className="relative mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-white/10">
                    <div className={`absolute inset-y-0 left-0 rounded-full ${growth < 0 ? "bg-rose-300/70" : "bg-emerald-300/60"}`} style={{ width: `${Math.max(before, after)}%` }} />
                    <div className="absolute inset-y-0 left-0 rounded-full bg-emerald-600 dark:bg-emerald-400" style={{ width: `${Math.min(before, after)}%` }} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </dl>
      </div>
    </div>
  );
}
