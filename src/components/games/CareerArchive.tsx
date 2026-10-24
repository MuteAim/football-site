"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { careerBadges, careerRecords, type Badge } from "@/lib/career/badges";
import { NATIONS, POSITIONS, type Pos } from "@/lib/career/data";
import { FOOT_NAMES, positionCode, positionName } from "@/lib/career/engine";
import { exportRetirements, importRetirements, type RetiredCareer } from "@/lib/career/archive";
import { LockIcon, TrophyIcon } from "../Icons";
import { cardClass, mutedClass, secondaryButtonClass, textButtonClass } from "../ui";
import { ClubBadge } from "./CareerParts";

/** 계정 보관함 상태. local은 비회원이거나 계정 보관을 아직 쓸 수 없는 경우예요. */
export type CloudState = "local" | "syncing" | "synced" | "failed";
type Sort = "recent" | "score";
const PAGE = 10;

/** 레전드 등급마다 점수 배지 색을 달리해요. 높은 등급일수록 금빛이에요. */
export function gradeTone(score: number): string {
  return score >= 6000 ? "bg-amber-300 text-amber-950" : score >= 2500 ? "bg-[#d4f77d] text-[#102c26]"
    : score >= 800 ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-400/15 dark:text-emerald-200" : "bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-200";
}

export function CareerArchive({ entries, error, member, cloud, onCloudRetry, onImport, onRetry }: {
  entries: RetiredCareer[]; error: string; member: boolean; cloud: CloudState; onCloudRetry: () => void;
  onImport: (entries: RetiredCareer[]) => boolean; onRetry: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [importing, setImporting] = useState(false);
  const [sort, setSort] = useState<Sort>("recent");
  const [pos, setPos] = useState<Pos | "all">("all");
  const [shown, setShown] = useState(PAGE);
  const [allBadges, setAllBadges] = useState(false);
  const records = useMemo(() => careerRecords(entries), [entries]);
  // 달성한 배지를 먼저, 나머지는 목표에 가까운 순서로 보여 줘요.
  const badges = useMemo(() => careerBadges(entries).sort((a, b) => Math.min(1, b.value / b.target) - Math.min(1, a.value / a.target)), [entries]);
  const list = useMemo(() => {
    const filtered = pos === "all" ? entries : entries.filter((entry) => entry.pos === pos);
    return sort === "score" ? [...filtered].sort((a, b) => b.score - a.score) : filtered;
  }, [entries, pos, sort]);

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

  const earned = badges.filter((badge) => badge.value >= badge.target).length;
  return (
    <section id="career-archive" aria-labelledby="career-archive-heading" className={`${cardClass} scroll-mt-24 overflow-hidden`}>
      <div className="px-5 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="sport-eyebrow text-emerald-700 dark:text-emerald-400">MY LEGENDS</p>
            <h2 id="career-archive-heading" className="mt-1 text-xl font-black tracking-tight">내 기록실 <span className="text-emerald-600 dark:text-emerald-400">{entries.length}명</span></h2>
          </div>
          <CloudBadge member={member} cloud={cloud} />
        </div>
        <p className={`mt-2 text-xs leading-relaxed ${mutedClass}`}>{member && cloud !== "local"
          ? "은퇴하면 통산 기록·팀별 성적·수상 내역·칭호를 내 계정에 자동 보관해요. 다른 기기에서 로그인해도 볼 수 있어요."
          : "은퇴하면 통산 기록·팀별 성적·수상 내역·칭호를 이 브라우저에 자동 보관해요. 새 커리어를 시작해도 남아요. 브라우저 데이터를 지우기 전에는 파일로 백업해 주세요."}</p>
        {!member ? <p className={`mt-2 text-xs leading-relaxed ${mutedClass}`}><Link href="/cafe/login?next=%2Fgames%2Fcareer" prefetch={false} className="font-bold text-emerald-700 underline dark:text-emerald-300">로그인</Link>하면 이 브라우저의 기록까지 계정에 저장돼 어느 기기에서든 볼 수 있어요.</p> : null}
        {member && cloud === "failed" ? <div role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:bg-amber-300/10 dark:text-amber-100">
          <p>계정 보관함에 저장하지 못했어요. 기록은 이 브라우저에 남아 있어요.</p>
          <button type="button" onClick={onCloudRetry} className="mt-2 min-h-10 font-bold underline">계정 저장 다시 시도</button>
        </div> : null}
        {error ? <div role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-xs leading-relaxed text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
          <p>{error}</p><button type="button" onClick={onRetry} className="mt-2 min-h-10 font-bold underline">보관 다시 시도</button>
        </div> : null}
      </div>

      {!entries.length ? (
        <div className="mx-5 mt-4 mb-5 rounded-2xl border border-dashed border-zinc-200 px-4 py-8 text-center dark:border-white/10">
          <TrophyIcon className="mx-auto size-8 text-zinc-300 dark:text-zinc-600" />
          <p className="mt-2 text-sm font-bold">첫 선수가 은퇴하면 여기에 기록돼요.</p>
          <p className={`mt-1 text-xs ${mutedClass}`}>통산 기록과 업적 배지가 선수마다 쌓여요.</p>
        </div>
      ) : (
        <>
          <dl className="mx-5 mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[["은퇴 선수", `${records.players}명`], ["통산 골", records.goals.toLocaleString("ko-KR")], ["발롱도르", `${records.ballonDor}회`], ["트로피", `${records.trophies}개`]].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-zinc-50 px-3 py-2.5 dark:bg-white/5">
                <dt className={`text-[11px] ${mutedClass}`}>{label}</dt>
                <dd className="mt-0.5 text-lg font-black tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          {records.bestScore ? (
            <p className="mx-5 mt-2 rounded-xl bg-[#102c26] px-4 py-3 text-xs text-white/75">
              최고 레전드 <strong className="text-sm text-white">{records.bestScore.number}번 {records.bestScore.name}</strong> · {positionCode(records.bestScore.pos as Pos, records.bestScore.side)} · 「{records.bestScore.title}」
              <span className="ml-1 font-black text-[#d4f77d] tabular-nums">{records.bestScore.score.toLocaleString("ko-KR")}점</span>
            </p>
          ) : null}

          <div className="mt-5 px-5">
            <h3 className="text-sm font-bold">포지션별 최고 선수</h3>
            <ul className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {records.byPosition.map(({ pos: code, entry }) => (
                <li key={code} className={`min-w-0 rounded-xl border px-3 py-2 ${entry ? "border-zinc-200 dark:border-white/10" : "border-dashed border-zinc-200 dark:border-white/10"}`}>
                  <span className="text-[10px] font-black tracking-wider text-emerald-700 dark:text-emerald-400">{code}</span>
                  {entry ? <>
                    <span className="block truncate text-xs font-bold">{entry.name}</span>
                    <span className={`block text-[11px] tabular-nums ${mutedClass}`}>{entry.score.toLocaleString("ko-KR")}점</span>
                  </> : <span className={`block text-xs ${mutedClass}`}>아직 없어요</span>}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-5 px-5">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-bold">업적 배지</h3>
              <span className={`text-xs font-semibold tabular-nums ${mutedClass}`}>{earned} / {badges.length}</span>
            </div>
            <ul className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {(allBadges ? badges : badges.slice(0, Math.max(6, earned + 3))).map((badge) => <BadgeTile key={badge.id} badge={badge} />)}
            </ul>
            {!allBadges && badges.length > Math.max(6, earned + 3) ? (
              <button type="button" onClick={() => setAllBadges(true)} className={`mt-1 ${textButtonClass}`}>배지 모두 보기</button>
            ) : null}
          </div>

          <div className="mt-6 border-t border-zinc-100 px-5 pt-4 dark:border-white/[0.07]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold">은퇴 선수 목록</h3>
              <div className="flex items-center gap-1.5">
                <label className="sr-only" htmlFor="career-archive-pos">포지션</label>
                <select id="career-archive-pos" value={pos} onChange={(event) => { setPos(event.target.value as Pos | "all"); setShown(PAGE); }}
                  className="h-9 rounded-lg bg-zinc-100 px-2 text-xs font-semibold dark:bg-white/[0.06]">
                  <option value="all">전체 포지션</option>
                  {(Object.keys(POSITIONS) as Pos[]).map((code) => <option key={code} value={code}>{POSITIONS[code].name}</option>)}
                </select>
                <div role="group" aria-label="정렬" className="flex rounded-lg bg-zinc-100 p-0.5 text-xs font-semibold dark:bg-white/[0.06]">
                  {([["recent", "최신순"], ["score", "점수순"]] as const).map(([value, label]) => (
                    <button key={value} type="button" aria-pressed={sort === value} onClick={() => setSort(value)}
                      className={`h-8 rounded-md px-2.5 ${sort === value ? "bg-white shadow-sm dark:bg-white/15" : mutedClass}`}>{label}</button>
                  ))}
                </div>
              </div>
            </div>
            {list.length ? (
              <div className="mt-3 space-y-2">
                {list.slice(0, shown).map((entry) => <ArchiveEntry key={entry.id} entry={entry} />)}
              </div>
            ) : <p className={`mt-3 text-sm ${mutedClass}`}>이 포지션으로 은퇴한 선수가 아직 없어요.</p>}
            {list.length > shown ? (
              <button type="button" onClick={() => setShown((count) => count + PAGE)} className={`mt-3 w-full ${secondaryButtonClass}`}>
                더 보기 ({(list.length - shown).toLocaleString("ko-KR")}명)
              </button>
            ) : null}
          </div>
        </>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-1 border-t border-zinc-100 px-3 py-2 dark:border-white/[0.07]">
        <span className={`px-2 text-xs ${mutedClass}`}>파일 백업</span>
        <button type="button" disabled={!entries.length} onClick={download} className={textButtonClass}>보관함 백업</button>
        <button type="button" disabled={importing} onClick={() => input.current?.click()} className={textButtonClass}>{importing ? "불러오는 중…" : "백업 불러오기"}</button>
        <input ref={input} type="file" accept="application/json,.json" aria-label="은퇴 보관함 백업 파일" className="hidden" onChange={(event) => void upload(event.target.files?.[0])} />
      </div>
      {message ? <p role="status" className={`px-5 pb-4 text-xs leading-relaxed ${mutedClass}`}>{message}</p> : null}
    </section>
  );
}

function CloudBadge({ member, cloud }: { member: boolean; cloud: CloudState }) {
  if (!member || cloud === "local" || cloud === "failed") return null;
  return cloud === "syncing"
    ? <span role="status" className={`rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold dark:bg-white/10 ${mutedClass}`}>계정과 맞추는 중…</span>
    : <span role="status" className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">계정에 저장됨</span>;
}

function BadgeTile({ badge }: { badge: Badge }) {
  const done = badge.value >= badge.target;
  const ratio = Math.min(1, badge.value / badge.target);
  return (
    <li data-badge={badge.id} data-earned={done || undefined}
      className={`min-w-0 rounded-xl px-3 py-2.5 ${done ? "bg-amber-50 ring-1 ring-amber-200 dark:bg-amber-300/10 dark:ring-amber-300/20" : "bg-zinc-50 dark:bg-white/[0.04]"}`}>
      <span className="flex items-center gap-1.5">
        {done ? <TrophyIcon className="size-3.5 shrink-0 text-amber-600 dark:text-amber-300" /> : <LockIcon className="size-3.5 shrink-0 text-zinc-400" />}
        <span className={`truncate text-xs font-extrabold ${done ? "text-amber-900 dark:text-amber-100" : ""}`}>{badge.label}</span>
      </span>
      <span className={`mt-0.5 block text-[11px] leading-snug ${mutedClass}`}>{done && badge.by ? `${badge.by} 달성` : badge.detail}</span>
      {!done && badge.target > 1 ? (
        <span className="mt-1.5 block" aria-label={`진행 ${badge.value.toLocaleString("ko-KR")} / ${badge.target.toLocaleString("ko-KR")}`}>
          <span className="block h-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-white/10"><span className="block h-full rounded-full bg-emerald-500" style={{ width: `${ratio * 100}%` }} /></span>
          <span className={`mt-0.5 block text-[10px] tabular-nums ${mutedClass}`}>{badge.value.toLocaleString("ko-KR")} / {badge.target.toLocaleString("ko-KR")}</span>
        </span>
      ) : null}
    </li>
  );
}

function ArchiveEntry({ entry }: { entry: RetiredCareer }) {
  const t = entry.totals;
  const stats: [string, number][] = [["시즌", t.seasons], ["경기", t.apps], ["골", t.goals], ["도움", t.assists], ["무실점", t.cleanSheets], ["최고 OVR", t.peakOvr], ["A매치", t.caps], ["대표팀 골", t.intlGoals]];
  return (
    <details data-retired-career={entry.id} className="group rounded-2xl border border-zinc-200 dark:border-white/10">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm">
        <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-xl bg-[#102c26] text-[#d4f77d]">
          <span className="text-sm leading-none font-black tabular-nums">{entry.number}</span>
          <span className="mt-0.5 text-[9px] leading-none font-black">{positionCode(entry.pos as Pos, entry.side)}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-extrabold">{entry.name}{t.ballonDor ? <span className="ml-1.5 text-xs font-bold text-amber-600 dark:text-amber-300">발롱도르 {t.ballonDor}</span> : null}</span>
          <span className={`block truncate text-xs ${mutedClass}`}>「{entry.title}」 · {t.seasons}시즌 · {t.firstYear}–{t.lastYear}</span>
        </span>
        <span className={`shrink-0 rounded-lg px-2 py-1 text-xs font-black tabular-nums ${gradeTone(entry.score)}`}>{entry.score.toLocaleString("ko-KR")}</span>
        <span aria-hidden="true" className={`shrink-0 text-xs transition group-open:rotate-180 ${mutedClass}`}>▾</span>
      </summary>
      <div className="space-y-4 border-t border-zinc-100 p-4 dark:border-white/10">
        <p className={`text-xs leading-relaxed ${mutedClass}`}>{NATIONS[entry.nation as keyof typeof NATIONS]?.name ?? entry.nation} · {entry.number}번 · {Object.hasOwn(POSITIONS, entry.pos) ? positionName(entry.pos as Pos, entry.side) : entry.pos} · {FOOT_NAMES[entry.foot]} · {t.retiredAge}세 은퇴 · {entry.grade}<br />{new Date(entry.retiredAt).toLocaleDateString("ko-KR")} 보관 · {entry.ranked ? "순위 도전 커리어" : "연습 커리어"}</p>
        <div>
          <h4 className="text-sm font-bold">통산 기록</h4>
          <dl className="mt-2 grid grid-cols-4 gap-2 rounded-xl bg-zinc-50 p-3 text-center dark:bg-white/5">
            {stats.map(([label, value]) => <div key={label}><dt className={`text-[10px] ${mutedClass}`}>{label}</dt><dd className="mt-1 text-base font-extrabold tabular-nums">{value.toLocaleString("ko-KR")}</dd></div>)}
          </dl>
        </div>
        <div>
          <h4 className="text-sm font-bold">팀별 기록</h4>
          <p className={`mt-1 text-[11px] ${mutedClass}`}>임대·군 복무는 실제 뛴 팀 기준이며, 같은 팀에 복귀한 시즌은 합산해요.</p>
          <ClubTable name={entry.name} clubs={entry.clubs} />
        </div>
        <div>
          <h4 className="text-sm font-bold">수상·우승 내역</h4>
          <p className={`mt-1 text-xs ${mutedClass}`}>발롱도르 {t.ballonDor}회 · 개인 수상 {t.awards}회 · 트로피 {t.trophies}개</p>
          <HonorList honors={entry.honors} />
        </div>
      </div>
    </details>
  );
}

export function ClubTable({ name, clubs }: { name: string; clubs: RetiredCareer["clubs"] }) {
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full text-xs tabular-nums">
        <caption className="sr-only">{name}의 팀별 시즌 수와 경기·골·도움</caption>
        <thead className={mutedClass}><tr>{["팀", "시즌", "경기", "골", "도움"].map((label, i) => <th key={label} scope="col" className={`py-2 ${i ? "pl-2 text-right whitespace-nowrap" : "text-left"}`}>{label}</th>)}</tr></thead>
        <tbody>{clubs.map((club) => <tr key={club.club} className="border-t border-zinc-100 dark:border-white/5"><th scope="row" className="py-2 text-left font-semibold break-words"><span className="flex items-center gap-1.5"><ClubBadge name={club.name} size={18} />{club.name}</span></th>{[club.seasons, club.apps, club.goals, club.assists].map((value, i) => <td key={i} className="py-2 pl-2 text-right">{value.toLocaleString("ko-KR")}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export function HonorList({ honors }: { honors: RetiredCareer["honors"] }) {
  return honors.length
    ? <ul className="mt-2 flex flex-wrap gap-1.5">{honors.map((honor) => <li key={honor.label} className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-semibold break-words text-amber-900 dark:bg-amber-300/10 dark:text-amber-200">{honor.label} ×{honor.count}</li>)}</ul>
    : <p className={`mt-2 text-xs ${mutedClass}`}>수상 기록이 없어요.</p>;
}
