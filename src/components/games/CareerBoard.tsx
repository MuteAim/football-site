"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { CareerElevenEntry, CareerSnapshot } from "@/lib/career/board";
import type { Pos } from "@/lib/career/data";
import { FLANKS, positionCode, positionName, type Side } from "@/lib/career/engine";
import { TrophyIcon } from "../Icons";
import { cardClass, mutedClass, secondaryButtonClass } from "../ui";

/** 4-3-3 자리. 긴 이름은 한 줄로 줄이고, 상세창에서 전체 이름과 기록을 보여 줘요. */
const ELEVEN: { pos: Pos; side?: Side; slot: number; row: number; column: number; span: number; offset?: number }[] = [
  { pos: "WG", side: "L", slot: 1, row: 1, column: 1, span: 4, offset: 16 },
  { pos: "ST", slot: 1, row: 1, column: 5, span: 4 },
  { pos: "WG", side: "R", slot: 1, row: 1, column: 9, span: 4, offset: 16 },
  { pos: "CM", slot: 1, row: 2, column: 1, span: 4 },
  { pos: "DM", slot: 1, row: 2, column: 5, span: 4, offset: 16 },
  { pos: "AM", slot: 1, row: 2, column: 9, span: 4 },
  { pos: "FB", side: "L", slot: 1, row: 3, column: 1, span: 3 },
  { pos: "CB", slot: 1, row: 3, column: 4, span: 3, offset: 12 },
  { pos: "CB", slot: 2, row: 3, column: 7, span: 3, offset: 12 },
  { pos: "FB", side: "R", slot: 1, row: 3, column: 10, span: 3 },
  { pos: "GK", slot: 1, row: 4, column: 5, span: 4 },
];

/** DB가 측면을 아직 돌려주지 않으면(schema.sql 적용 전) 윙어·풀백 1·2위를 왼쪽·오른쪽에 세워요. */
function elevenKey(entry: CareerSnapshot["board"]["eleven"][number]): string {
  if (entry.side) return `${positionCode(entry.position, entry.side)}-${entry.slot}`;
  if (FLANKS.includes(entry.position)) return `${positionCode(entry.position, entry.slot === 1 ? "L" : "R")}-1`;
  return `${entry.position}-${entry.slot}`;
}

export function CareerBoard({ snapshot }: { snapshot: CareerSnapshot }) {
  const { board } = snapshot;
  const [selected, setSelected] = useState<{ entry: CareerElevenEntry; side?: Side } | null>(null);
  const closeDetails = useCallback(() => setSelected(null), []);
  const filled = new Map(board.eleven.map((entry) => [elevenKey(entry), entry]));
  return (
    <aside className="space-y-4">
      <section className={`${cardClass} p-5`}>
        <div className="flex items-center gap-2"><TrophyIcon className="size-5 text-amber-500" /><h2 className="font-extrabold">오늘의 레전드</h2></div>
        <p className={`mt-1 text-xs ${mutedClass}`}>{snapshot.day.slice(5).replace("-", ".")} · 오늘 은퇴한 선수로 겨뤄요</p>
        {snapshot.available ? (
          <>
            <p className={`mt-4 text-xs ${mutedClass}`}>{board.participants}명 참여 · 상위 20명</p>
            {board.leaders.length ? (
              <ol className="mt-2 divide-y divide-zinc-100 dark:divide-white/5">
                {board.leaders.map((leader) => (
                  <li key={`${leader.nickname}-${leader.rank}`} className={`flex items-center gap-2 py-2.5 ${leader.isMe ? "text-emerald-700 dark:text-emerald-300" : ""}`}>
                    <span className={`w-6 shrink-0 text-sm font-black tabular-nums ${leader.rank <= 3 ? "text-amber-600 dark:text-amber-300" : mutedClass}`}>{leader.rank}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{leader.number ? <span className="mr-1 tabular-nums">{leader.number}</span> : null}{leader.name} <span className={`text-[11px] font-semibold ${mutedClass}`}>{positionCode(leader.position, leader.side)}</span></span>
                      <span className={`block truncate text-[11px] ${mutedClass}`}>{leader.nickname}{leader.isMe ? " (나)" : ""}{leader.ballonDor ? ` · 발롱도르 ${leader.ballonDor}회` : ""} · OVR {leader.peakOvr}</span>
                    </span>
                    <span className="shrink-0 text-sm font-extrabold tabular-nums">{leader.score.toLocaleString("ko-KR")}</span>
                  </li>
                ))}
              </ol>
            ) : <p className={`py-8 text-center text-sm ${mutedClass}`}>오늘의 첫 레전드가 되어 보세요.</p>}
            {board.personal ? <p className="mt-3 rounded-xl bg-emerald-500/10 p-3 text-center text-sm font-semibold">내 최고 {board.personal.score.toLocaleString("ko-KR")}점 · {board.personal.rank}위</p> : null}
          </>
        ) : (
          <p className={`py-6 text-sm leading-relaxed ${mutedClass}`}>지금은 순위를 불러올 수 없어요. 연습 커리어와 친구 도전장은 그대로 즐길 수 있어요.</p>
        )}
        <p className={`mt-3 text-[11px] leading-relaxed ${mutedClass}`}>회원마다 그날 최고 레전드 점수 하나로 겨뤄요. 같은 점수는 공동 순위예요.</p>
      </section>

      <section className={`${cardClass} p-5`}>
        <h2 className="font-extrabold">오늘의 베스트 11</h2>
        <p className={`mt-1 text-xs ${mutedClass}`}>4-3-3 · 포지션마다 오늘 가장 높은 점수</p>
        <div className="relative mx-auto mt-4 grid min-h-[400px] w-full max-w-sm grid-cols-12 content-between gap-x-1 gap-y-4 overflow-hidden rounded-2xl bg-[#17442f] px-2 py-5" role="list" aria-label="오늘의 베스트 11">
          <svg viewBox="0 0 300 400" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full text-white/15" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="12" y="12" width="276" height="376" rx="4" />
            <path d="M12 200h276M95 12v52h110V12M95 388v-52h110v52M125 12v20h50V12M125 388v-20h50v20" />
            <circle cx="150" cy="200" r="38" />
          </svg>
          {ELEVEN.map(({ pos, side, slot, row, column, span, offset }) => {
            const code = positionCode(pos, side);
            const entry = filled.get(`${code}-${slot}`);
            const label = positionName(pos, side);
            return (
              <div key={`${code}-${slot}`} role="listitem" className="relative min-w-0" style={{ gridColumn: `${column} / span ${span}`, gridRow: row, paddingTop: offset }}>
                <button type="button" disabled={!entry} data-eleven-player={entry ? `${code}-${slot}` : undefined}
                  aria-haspopup={entry ? "dialog" : undefined} aria-label={entry ? `${label} ${entry.name}, ${entry.nickname}, ${entry.score}점 · 상세 보기` : `${label} 빈자리`}
                  onClick={() => entry && setSelected({ entry, side })}
                  className="flex w-full min-w-0 cursor-pointer flex-col items-center rounded-xl px-0.5 py-1 text-center transition enabled:hover:bg-white/10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-lime-200 disabled:cursor-default">
                  <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${entry ? "bg-[#d4f77d] text-[#102c26]" : "border border-dashed border-white/30 text-white/40"}`}>{code}</span>
                  <span data-eleven-name className="mt-1 w-full truncate text-[10px] leading-[1.4] font-bold text-white">{entry ? entry.name : "비어 있음"}</span>
                  {entry ? <>
                    <span data-eleven-nickname className="mt-0.5 w-full truncate text-[9px] leading-[1.4] text-white/60">{entry.nickname}</span>
                    <span data-eleven-score className="mt-1 text-[10px] leading-[1.4] font-extrabold text-[#d4f77d] tabular-nums">{entry.score.toLocaleString("ko-KR")}점</span>
                  </> : null}
                </button>
              </div>
            );
          })}
        </div>
        <p className={`mt-3 text-[11px] ${mutedClass}`}>선수를 누르면 전체 이름과 상세 기록을 볼 수 있어요.</p>
      </section>

      <section className={`${cardClass} p-5`}>
        <h2 className="font-bold">이렇게 즐겨요</h2>
        <ol className="mt-4 space-y-3 text-sm leading-relaxed">
          <li><strong className="mr-2 text-emerald-600 dark:text-emerald-400">01</strong>유스 선수 셋 중 한 명을 골라 17세에 출발해요.</li>
          <li><strong className="mr-2 text-emerald-600 dark:text-emerald-400">02</strong>시즌마다 <strong>훈련·사건·이적</strong>을 골라요. 출전 시간이 성장을 좌우해요.</li>
          <li><strong className="mr-2 text-emerald-600 dark:text-emerald-400">03</strong>은퇴하면 트로피·수상·기록으로 <strong>레전드 점수</strong>가 매겨져요.</li>
        </ol>
        <p className={`mt-4 border-t border-zinc-100 pt-3 text-xs leading-relaxed dark:border-white/10 ${mutedClass}`}>
          한국 선수는 28세 전에 아시안게임 금메달이나 올림픽 메달을 따지 못하면 김천 상무에서 군 복무를 해요. 구단·능력치는 게임용 가상 수치예요.
        </p>
      </section>
      <Link href="/games/penalty" prefetch={false} className={`block rounded-xl px-2 py-2 text-center text-sm ${mutedClass} hover:underline`}>손끝 감각도 자신 있다면? 승부차기 러시 →</Link>
      {selected ? <ElevenPlayerDetails entry={selected.entry} side={selected.side} day={snapshot.day} onClose={closeDetails} /> : null}
    </aside>
  );
}

function ElevenPlayerDetails({ entry, side, day, onClose }: { entry: CareerElevenEntry; side?: Side; day: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const finished = useRef(false);
  const title = useId();
  const close = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    dialog.current?.close();
    onClose();
  }, [onClose]);
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);
  return (
    <dialog ref={dialog} data-eleven-details aria-labelledby={title} onClose={close}
      onCancel={(event) => { event.preventDefault(); close(); }}
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto rounded-3xl bg-white p-0 text-zinc-900 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm dark:bg-[#191a1e] dark:text-zinc-100">
      <div className="p-6">
        <p className="sport-eyebrow text-emerald-700 dark:text-emerald-300">BEST 11 · {day.slice(5).replace("-", ".")}</p>
        <h2 id={title} className="mt-3 text-2xl leading-snug font-black [overflow-wrap:anywhere]">{entry.name}</h2>
        <p data-eleven-detail-nickname className={`mt-1 text-sm [overflow-wrap:anywhere] ${mutedClass}`}>{entry.nickname}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-full bg-emerald-500/10 px-3 py-1.5 text-emerald-800 dark:text-emerald-200">{positionCode(entry.position, side)} · {positionName(entry.position, side)}</span>
          {entry.number ? <span className="rounded-full bg-zinc-100 px-3 py-1.5 dark:bg-white/5">등번호 {entry.number}</span> : null}
        </div>
        <div className="mt-5 rounded-2xl bg-[#102c26] p-5 text-white">
          <p className="text-xs text-white/65">레전드 점수</p>
          <p data-eleven-detail-score className="mt-1 text-3xl font-black text-[#d4f77d] tabular-nums">{entry.score.toLocaleString("ko-KR")}<span className="ml-1 text-base">점</span></p>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-zinc-100 p-4 dark:bg-white/5"><dt className={`text-xs ${mutedClass}`}>최고 OVR</dt><dd data-eleven-detail-ovr className="mt-1 text-xl font-extrabold tabular-nums">{entry.peakOvr}</dd></div>
          <div className="rounded-2xl bg-zinc-100 p-4 dark:bg-white/5"><dt className={`text-xs ${mutedClass}`}>발롱도르</dt><dd data-eleven-detail-ballon-dor className="mt-1 text-xl font-extrabold tabular-nums">{entry.ballonDor}회</dd></div>
        </dl>
        <button type="button" data-eleven-details-close onClick={close} className={`mt-5 w-full ${secondaryButtonClass}`}>닫기</button>
      </div>
    </dialog>
  );
}
