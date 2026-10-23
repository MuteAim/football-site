"use client";

import { useRef, useState } from "react";
import { NATIONS, POSITIONS } from "@/lib/career/data";
import { exportRetirements, importRetirements, type RetiredCareer } from "@/lib/career/archive";
import { cardClass, mutedClass, secondaryButtonClass } from "../ui";

export function CareerArchive({ entries, error, onImport, onRetry }: {
  entries: RetiredCareer[]; error: string; onImport: (entries: RetiredCareer[]) => boolean; onRetry: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [importing, setImporting] = useState(false);

  function download() {
    const url = URL.createObjectURL(new Blob([exportRetirements(entries)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `legend-road-retirements-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("백업 파일을 다운로드했어요. ‘백업 불러오기’로 다른 브라우저에서도 기록을 볼 수 있어요.");
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setImporting(true);
    setMessage("");
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error("20MB 이하의 보관함 백업 파일을 골라 주세요.");
      const incoming = importRetirements(await file.text());
      if (onImport(incoming)) setMessage("백업 기록을 보관함에 합쳤어요. 같은 선수 기록은 중복해서 넣지 않아요.");
    } catch (reason) {
      setMessage(reason instanceof Error ? `불러오기 실패: ${reason.message}` : "백업 파일을 불러오지 못했어요.");
    } finally {
      setImporting(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <section id="career-archive" aria-labelledby="career-archive-heading" className={`${cardClass} scroll-mt-24 p-5`}>
      <h2 id="career-archive-heading" className="font-extrabold">은퇴 선수 보관함 <span className="text-emerald-600 dark:text-emerald-400">{entries.length}명</span></h2>
      <p className={`mt-2 text-xs leading-relaxed ${mutedClass}`}>은퇴하면 통산 기록·팀별 성적·수상 내역·칭호를 이 브라우저에 자동 보관해요. 새 커리어를 시작해도 남아요. 계정 동기화는 지원하지 않으며, 브라우저 데이터를 지우기 전에는 파일로 백업해 주세요.</p>
      {error ? <div role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-xs leading-relaxed text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
        <p>{error}</p><button type="button" onClick={onRetry} className="mt-2 min-h-10 font-bold underline">보관 다시 시도</button>
      </div> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={!entries.length} onClick={download} className={secondaryButtonClass}>보관함 백업</button>
        <button type="button" disabled={importing} onClick={() => input.current?.click()} className={secondaryButtonClass}>{importing ? "불러오는 중…" : "백업 불러오기"}</button>
        <input ref={input} type="file" accept="application/json,.json" aria-label="은퇴 보관함 백업 파일" className="hidden" onChange={(event) => void upload(event.target.files?.[0])} />
      </div>
      {message ? <p role="status" className={`mt-2 text-xs leading-relaxed ${mutedClass}`}>{message}</p> : null}
      {!entries.length ? <p className={`mt-5 text-sm ${mutedClass}`}>첫 선수가 은퇴하면 여기에 기록돼요.</p> : (
        <div className="mt-4 space-y-2">
          {entries.map((entry) => <ArchiveEntry key={entry.id} entry={entry} />)}
        </div>
      )}
    </section>
  );
}

function ArchiveEntry({ entry }: { entry: RetiredCareer }) {
  const t = entry.totals;
  const stats: [string, number][] = [["시즌", t.seasons], ["경기", t.apps], ["골", t.goals], ["도움", t.assists], ["무실점", t.cleanSheets], ["최고 OVR", t.peakOvr], ["A매치", t.caps], ["대표팀 골", t.intlGoals]];
  return (
    <details data-retired-career={entry.id} className="rounded-2xl border border-zinc-200 dark:border-white/10">
      <summary className="cursor-pointer px-4 py-3 text-sm">
        <span className="font-extrabold break-words">{entry.name}</span><span className={`ml-2 text-xs ${mutedClass}`}>{entry.pos} · {t.seasons}시즌 · {entry.score.toLocaleString("ko-KR")}점</span>
        <span className={`mt-1 block text-xs leading-relaxed break-words ${mutedClass}`}>「{entry.title}」 · {entry.grade}</span>
      </summary>
      <div className="space-y-4 border-t border-zinc-100 p-4 dark:border-white/10">
        <p className={`text-xs leading-relaxed ${mutedClass}`}>{NATIONS[entry.nation as keyof typeof NATIONS]?.name ?? entry.nation} · {POSITIONS[entry.pos as keyof typeof POSITIONS]?.name ?? entry.pos} · {t.firstYear}–{t.lastYear} · {t.retiredAge}세 은퇴<br />{new Date(entry.retiredAt).toLocaleDateString("ko-KR")} 보관 · {entry.ranked ? "순위 도전 커리어" : "연습 커리어"}</p>
        <div>
          <h3 className="text-sm font-bold">통산 기록</h3>
          <dl className="mt-2 grid grid-cols-4 gap-2 rounded-xl bg-zinc-50 p-3 text-center dark:bg-white/5">
            {stats.map(([label, value]) => <div key={label}><dt className={`text-[10px] ${mutedClass}`}>{label}</dt><dd className="mt-1 text-base font-extrabold tabular-nums">{value.toLocaleString("ko-KR")}</dd></div>)}
          </dl>
        </div>
        <div>
          <h3 className="text-sm font-bold">팀별 기록</h3>
          <p className={`mt-1 text-[11px] ${mutedClass}`}>임대·군 복무는 실제 뛴 팀 기준이며, 같은 팀에 복귀한 시즌은 합산해요.</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs tabular-nums">
              <caption className="sr-only">{entry.name}의 팀별 시즌 수와 경기·골·도움</caption>
              <thead className={mutedClass}><tr>{["팀", "시즌", "경기", "골", "도움"].map((label, i) => <th key={label} scope="col" className={`py-2 ${i ? "pl-2 text-right whitespace-nowrap" : "text-left"}`}>{label}</th>)}</tr></thead>
              <tbody>{entry.clubs.map((club) => <tr key={club.club} className="border-t border-zinc-100 dark:border-white/5"><th scope="row" className="py-2 text-left font-semibold break-words">{club.name}</th>{[club.seasons, club.apps, club.goals, club.assists].map((value, i) => <td key={i} className="py-2 pl-2 text-right">{value.toLocaleString("ko-KR")}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </div>
        <div>
          <h3 className="text-sm font-bold">수상·우승 내역</h3>
          <p className={`mt-1 text-xs ${mutedClass}`}>발롱도르 {t.ballonDor}회 · 개인 수상 {t.awards}회 · 트로피 {t.trophies}개</p>
          {entry.honors.length ? <ul className="mt-2 flex flex-wrap gap-1.5">{entry.honors.map((honor) => <li key={honor.label} className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-semibold break-words text-amber-900 dark:bg-amber-300/10 dark:text-amber-200">{honor.label} ×{honor.count}</li>)}</ul> : <p className={`mt-2 text-xs ${mutedClass}`}>수상 기록이 없어요.</p>}
        </div>
      </div>
    </details>
  );
}
