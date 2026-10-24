import { clubName, legacyScore, overall, seasonLabel, type CareerState } from "@/lib/career/engine";
import { mutedClass } from "../ui";
import type { ReactNode } from "react";

export type TurnResult = { label: string; summary: string; changes: string[]; moment: string | null };

/** 선택 직후 치른 경기와 성장까지 포함한 실제 진행 결과예요. */
export function turnResult(before: CareerState, after: CareerState, index: number): TurnResult {
  const season = after.history.length > before.history.length ? after.history.at(-1) : null;
  const period = season ?? after.draft;
  const changes: string[] = [];
  const previousOvr = overall(before.attrs, before.pos);
  const nextOvr = overall(after.attrs, after.pos);
  if (previousOvr !== nextOvr) changes.push(`OVR ${previousOvr} → ${nextOvr}`);
  const trust = after.trust - before.trust;
  if (trust) changes.push(`감독 신뢰 ${trust > 0 ? "+" : ""}${trust}`);
  const score = legacyScore(after) - legacyScore(before);
  if (score) changes.push(`레전드 점수 ${score > 0 ? "+" : ""}${score.toLocaleString("ko-KR")}`);
  // 결승의 결정적 순간에서 멈췄다면 시즌 중간이라도 '결승 진출'로 알려요.
  const final = after.pending?.id === "moment" ? after.draft?.moment?.name : null;
  const stage = season ? "시즌 종료" : final ? `${final} 결승 진출` : "전반기 종료";
  const summary = after.phase === "retired" ? `${after.age}세에 은퇴했어요. 나의 최종 기록을 확인해 보세요.`
    : before.pending?.kind === "offseason" ? `${clubName(after.club)}에서 ${seasonLabel(after.year)} 시즌을 준비해요.`
      : period ? `${seasonLabel(period.year)} ${stage} · ${period.apps}경기 · ${after.pos === "GK" ? `무실점 ${period.cleanSheets}` : `${period.goals}골 ${period.assists}도움`}`
        : "선택이 커리어에 반영됐어요.";
  return { label: before.pending!.options[index].label, summary, changes, moment: before.pending?.id === "moment" ? after.lastMoment : null };
}

export function TurnHeader({ state, result, quick, onQuick, children }: {
  state: CareerState; result: TurnResult | null; quick: boolean; onQuick: (value: boolean) => void; children: ReactNode;
}) {
  const step = state.phase === "training" ? 0 : state.phase === "event" ? 1 : 2;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ol aria-label="시즌 진행 단계" className="flex items-center gap-2 text-[11px] font-bold sm:text-xs">
          {["훈련", "시즌 중 사건", "이적·재계약"].map((label, index) => (
            <li key={label} aria-current={index === step ? "step" : undefined}
              className={index === step ? "text-emerald-700 dark:text-emerald-300" : mutedClass}>
              {index ? <span aria-hidden="true" className="mr-2 text-zinc-400">›</span> : null}{label}
            </li>
          ))}
        </ol>
        <label className={`flex min-h-9 cursor-pointer items-center gap-2 text-xs ${mutedClass}`} title="시즌 진행 연출을 생략해요">
          <input type="checkbox" checked={quick} onChange={(event) => onQuick(event.target.checked)} className="size-4 accent-emerald-700" />
          빠른 진행
        </label>
      </div>
      {children}
      <div id="career-turn-result" role="status" aria-live="polite" aria-atomic="true" className="flex min-h-24 flex-col justify-center rounded-2xl bg-emerald-500/[0.07] px-4 py-3 text-xs leading-relaxed dark:bg-emerald-400/[0.07]">
        {result ? (
          <>
            <p className="font-bold text-emerald-800 dark:text-emerald-200">지난 선택 · {result.label}</p>
            {result.moment ? <p className="mt-1 text-sm font-black text-amber-700 dark:text-amber-300">{result.moment}</p> : null}
            <p className={`mt-1 ${mutedClass}`}>{result.summary}</p>
            {result.changes.length ? <p className="mt-1 font-bold">{result.changes.join(" · ")}</p> : null}
          </>
        ) : (
          <>
            <p className="font-bold">이번 시즌, 어떤 길을 고를까요?</p>
            <p className={`mt-1 ${mutedClass}`}>선택 후 경기 결과와 변화를 여기에 보여 드려요. 진행 상황은 자동 저장돼요.</p>
          </>
        )}
      </div>
    </div>
  );
}
