"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { CLUBS, CONTINENTALS, LEAGUES, MILITARY_CLUB, NATIONS, POSITIONS, type Pos } from "@/lib/career/data";
import {
  attrLabels, careerTotals, clubName, CONTINENTAL_STAGES, CUP_STAGES, expectedRole, formatValue, legacyScore, marketValue, overall,
  roleName, seasonLabel, starterLine, type CareerState, type Choice, type Decision, type LegacyBreakdown, type SeasonRecord,
} from "@/lib/career/engine";
import { BallIcon, TrophyIcon } from "../Icons";
import { cardClass, mutedClass } from "../ui";
import type { SeasonJournal } from "@/lib/career/journal";
import { SeasonStats } from "./CareerSeasonStats";
import styles from "./career.module.css";

// 레전드 로드 화면 조각이에요. 상태는 CareerGame이 들고, 여기서는 그리기만 해요.

/** 구단 엠블럼 대신 쓰는 동그란 표시. 이름에서 색을 정해서 같은 구단은 늘 같은 색이에요. */
export function ClubBadge({ name, className = "size-7 text-xs" }: { name: string; className?: string }) {
  let hue = 0;
  for (const char of name) hue = (hue * 31 + char.charCodeAt(0)) % 360;
  const initial = name.replace(/^(FC|AC|AS)\s+/, "").charAt(0);
  return (
    <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center rounded-full font-black text-white ring-2 ring-white/25 ${className}`} style={{ backgroundColor: `hsl(${hue} 45% 34%)` }}>
      {initial}
    </span>
  );
}

/** 스카우트 별점. value는 별 반 개 단위(10이 다섯 개)예요. */
export function Stars({ value }: { value: number }) {
  const id = useId().replace(/[^a-zA-Z0-9-]/g, "");
  return (
    <span role="img" aria-label={`스카우트 평가 별 ${value / 2}개`} className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => {
        const fill = value >= (i + 1) * 2 ? 1 : value === i * 2 + 1 ? 0.5 : 0;
        return (
          <svg key={i} viewBox="0 0 20 20" className="size-3.5" aria-hidden="true">
            <defs>
              <linearGradient id={`${id}-${i}`}>
                <stop offset={fill} stopColor="#f5b70a" />
                <stop offset={fill} stopColor="currentColor" stopOpacity=".22" />
              </linearGradient>
            </defs>
            <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.8l-5.2 2.8 1-5.8L1.5 7.7l5.9-.9z" fill={`url(#${id}-${i})`} />
          </svg>
        );
      })}
    </span>
  );
}

function attrColor(value: number): string {
  return value >= 85 ? "#c5f36b" : value >= 75 ? "#6ee7a8" : value >= 65 ? "#fcd765" : value >= 50 ? "#fbab6b" : "#f8928f";
}

/** 능력치 막대. 포지션 오버롤에 크게 들어가는 능력치는 이름을 굵게 보여요. */
export function AttrBars({ attrs, pos, growth, light = false }: { attrs: number[]; pos: Pos; growth?: number[]; light?: boolean }) {
  const weights = POSITIONS[pos].weights;
  return (
    <dl className="grid grid-cols-2 gap-x-5 gap-y-2.5">
      {attrLabels(pos).map((label, i) => (
        <div key={label} className="min-w-0">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <dt className={weights[i] >= 18 ? "font-bold" : light ? mutedClass : "text-white/60"}>{label}</dt>
            <dd className="font-black tabular-nums">
              {attrs[i]}
              {growth?.[i] ? <span className={`ml-1 text-[10px] font-bold ${growth[i] > 0 ? (light ? "text-emerald-600 dark:text-emerald-400" : "text-lime-300") : "text-rose-400"}`}>{growth[i] > 0 ? `+${growth[i]}` : growth[i]}</span> : null}
            </dd>
          </div>
          <div className={`mt-1 h-1.5 overflow-hidden rounded-full ${light ? "bg-zinc-200 dark:bg-white/10" : "bg-white/10"}`}>
            <div className="h-full rounded-full" style={{ width: `${attrs[i]}%`, backgroundColor: attrColor(attrs[i]) }} />
          </div>
        </div>
      ))}
    </dl>
  );
}

const TRAIT_TEXT = {
  growth: (state: CareerState) => state.traits.peak <= (state.pos === "GK" ? 26 : 24) ? "조기 개화형" : state.traits.peak >= (state.pos === "GK" ? 31 : 29) ? "대기만성형" : "표준 성장형",
  injury: (state: CareerState) => (state.traits.injury === 2 ? "유리몸" : "강철 체력"),
  clutch: (state: CareerState) => (state.traits.clutch > 0 ? "큰 경기 체질" : "새가슴"),
};
const TRUST_WORDS = ["바닥", "낮음", "조금 낮음", "보통", "높음", "절대적"];
const FORM_WORDS = ["최악", "부진", "조금 부진", "보통", "좋음", "상승세", "절정"];

/** 감독 신뢰(-10~10)를 다섯 칸으로 보여 줘요. 출전 시간과 주전 경쟁에 영향을 줘요. */
function TrustMeter({ trust }: { trust: number }) {
  const level = Math.min(5, Math.max(0, Math.round((trust + 10) / 4)));
  return (
    <span className="inline-flex items-center gap-1.5" aria-label={`감독 신뢰 ${TRUST_WORDS[level]}`}>
      <span className="text-white/55">감독 신뢰</span>
      <span className="inline-flex gap-0.5" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => <span key={i} className={`h-2 w-3 rounded-sm ${i < level ? "bg-[#d4f77d]" : "bg-white/15"}`} />)}
      </span>
      <span className="font-semibold text-white/80">{TRUST_WORDS[level]}</span>
    </span>
  );
}

export function PlayerCard({ state }: { state: CareerState }) {
  const ovr = overall(state.attrs, state.pos);
  const retired = state.phase === "retired";
  const totals = careerTotals(state.history);
  const league = LEAGUES[CLUBS[state.club].league];
  const lastGrowth = state.phase === "offseason" ? state.history.at(-1)?.growth : undefined;
  const role = state.phase === "event" && state.draft ? state.draft.role : expectedRole(state, state.club);
  const line = starterLine(state, state.club);
  const military = state.nation === "KOR" ? { pending: "병역 미필", exempt: "병역 면제", served: "병역 필", none: "" }[state.military] : "";
  const traits = state.revealed.map((key) => TRAIT_TEXT[key as keyof typeof TRAIT_TEXT]?.(state)).filter(Boolean);
  const score = legacyScore(state);
  return (
    <section className="overflow-hidden rounded-3xl bg-[#102c26] text-white shadow-xl shadow-emerald-950/10" aria-label="내 선수">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3 sm:px-6">
        <p className="min-w-0 truncate text-[10px] font-bold tracking-[.18em] text-lime-200/70">
          <span className="hidden sm:inline">LEGEND ROAD · </span>
          {retired ? `${state.startYear}–${state.year}` : `${seasonLabel(state.year)} · ${state.history.length + 1}번째 시즌`}
        </p>
        <p className="shrink-0 text-xs text-white/60">레전드 점수 <strong className="font-extrabold text-white tabular-nums">{score.toLocaleString("ko-KR")}</strong></p>
      </div>
      <div className="flex gap-4 px-5 pt-5 sm:px-6">
        <div className="flex w-[4.75rem] shrink-0 flex-col items-center justify-center rounded-2xl bg-[#d4f77d] py-3 text-[#102c26]">
          <span className="text-[2.5rem] leading-none font-black tracking-tight tabular-nums">{ovr}</span>
          <span className="mt-1 text-[11px] font-black tracking-wider">{state.pos}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-2xl font-black tracking-tight">{state.name}</h2>
          <p className="mt-0.5 truncate text-xs text-white/70">{POSITIONS[state.pos].name} · {state.age}세 · {NATIONS[state.nation].name} · {state.style}</p>
          <p className="mt-3 flex min-w-0 items-center gap-2 text-sm font-bold">
            <ClubBadge name={clubName(state.club)} className="size-6 text-[11px]" />
            <span className="truncate">{clubName(state.club)}</span>
            <span className="shrink-0 text-xs font-normal text-white/55">{league.name} · 전력 {CLUBS[state.club].rating}</span>
          </p>
          <p className="mt-1.5 text-xs text-white/65">
            {retired ? `마지막 소속팀 · 최고 오버롤 ${state.peak} (${state.peakAge}세)` : (
              <>
                {state.club === MILITARY_CLUB ? "군 복무 중 · " : state.parent ? `${clubName(state.parent)}에서 임대 · ` : ""}
                <strong className="font-bold text-white">{roleName(role, state.age)}</strong>
                {ovr >= line ? " · 주전 경쟁 우위" : ` · 주전까지 오버롤 +${line - ovr}`} · 계약 {Math.max(state.contract, 0)}년 · 몸값 {formatValue(marketValue(ovr, state.age, state.potential))}
              </>
            )}
          </p>
        </div>
      </div>
      <div className="px-5 pt-5 pb-4 sm:px-6"><AttrBars attrs={state.attrs} pos={state.pos} growth={lastGrowth} /></div>
      {!retired ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 pb-4 text-[11px] sm:px-6">
          <TrustMeter trust={state.trust} />
          {state.phase === "event" ? <span><span className="text-white/55">폼</span> <span className="font-semibold text-white/80">{FORM_WORDS[state.form + 3]}</span></span> : null}
        </div>
      ) : null}
      {traits.length || military ? (
        <div className="flex flex-wrap gap-1.5 px-5 pb-4 sm:px-6">
          {traits.map((trait) => <span key={trait} className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-lime-100">{trait}</span>)}
          {military ? <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/80">{military}</span> : null}
        </div>
      ) : null}
      <dl className="grid grid-cols-4 divide-x divide-white/10 border-t border-white/10 py-3 text-center">
        {[["경기", totals.apps], [state.pos === "GK" ? "무실점" : "골", state.pos === "GK" ? totals.cleanSheets : totals.goals], ["트로피", totals.trophies], ["발롱도르", totals.ballonDor]].map(([label, value]) => (
          <div key={label}><dt className="text-[10px] text-white/55">{label}</dt><dd className={`mt-0.5 text-lg font-extrabold tabular-nums ${label === "발롱도르" && Number(value) > 0 ? "text-amber-300" : ""}`}>{Number(value).toLocaleString("ko-KR")}</dd></div>
        ))}
      </dl>
    </section>
  );
}

const TONE_CLASS: Record<Choice["tone"], string> = {
  good: "ring-emerald-600/30 bg-emerald-500/[0.06] hover:bg-emerald-500/[0.12] dark:ring-emerald-400/25",
  risk: "ring-amber-500/40 bg-amber-400/[0.07] hover:bg-amber-400/[0.14] dark:ring-amber-300/25",
  neutral: "ring-zinc-950/10 bg-white hover:bg-zinc-50 dark:bg-white/[0.03] dark:ring-white/10 dark:hover:bg-white/[0.07]",
};
const KIND_LABEL: Record<Decision["kind"], string> = { training: "PRE-SEASON · 훈련 선택", event: "MID-SEASON · 시즌 중 사건", offseason: "TRANSFER WINDOW · 이적 시장" };

/** 결승의 결정적 순간은 금색 테두리로 다른 결정과 구분해요. */
const momentCardClass = "overflow-hidden rounded-2xl bg-amber-50 ring-2 ring-amber-400/70 dark:bg-amber-300/[0.06] dark:ring-amber-300/40";

export function DecisionCard({ decision, onPick, disabled }: { decision: Decision; onPick: (index: number, time: number, keyboard: boolean) => void; disabled: boolean }) {
  const list = decision.kind === "offseason";
  const moment = decision.id === "moment";
  // 결정적 순간의 스카우팅 리포트는 본문과 떼어 눈에 띄게 보여 줘요.
  const [story, report] = moment ? decision.body.split(" 스카우팅 리포트: ") : [decision.body];
  // 남는 것 말고는 고를 게 없으면 결정 대신 다음 시즌으로 넘어가는 버튼으로 보여 줘요.
  const only = list && decision.options.length === 1 && decision.options[0].value === "stay" ? decision.options[0] : null;
  return (
    <section className={`${moment ? momentCardClass : cardClass} p-5 sm:p-6`} aria-labelledby="career-decision">
      <p className={`sport-eyebrow flex items-center gap-1.5 ${moment ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-400"}`}>
        {moment ? <><TrophyIcon className="size-3.5" />BIG MOMENT · 결정적 순간</> : KIND_LABEL[decision.kind]}
      </p>
      <h2 id="career-decision" tabIndex={-1} className="mt-1 text-xl font-black tracking-tight outline-none">{decision.title}</h2>
      <p className={`mt-2 text-sm leading-relaxed ${mutedClass}`}>{story}</p>
      {report ? (
        <p className="mt-3 rounded-xl bg-white/80 px-3 py-2 text-[13px] leading-relaxed ring-1 ring-amber-400/40 dark:bg-black/20 dark:ring-amber-300/25">
          <strong className="font-black text-amber-800 dark:text-amber-200">스카우팅 리포트</strong> · {report}
        </p>
      ) : null}
      {only ? (
        <>
          <button type="button" disabled={disabled} onClick={(event) => onPick(0, event.timeStamp, event.detail === 0)}
            className="mt-4 flex h-14 w-full items-center justify-center rounded-2xl bg-[#d4f77d] text-base font-black text-[#152d21] shadow-[0_4px_0_#83aa45] transition hover:bg-lime-200 active:translate-y-0.5 active:shadow-none disabled:opacity-50">
            다음 시즌으로 →
          </button>
          <p className={`mt-2 text-center text-xs ${mutedClass}`}>{only.label} · {only.detail}</p>
        </>
      ) : (
        <div className={`mt-4 grid gap-2 ${list ? "" : decision.options.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          {decision.options.map((option, index) => (
            <button key={`${option.value}-${option.club ?? index}`} type="button" disabled={disabled} onClick={(event) => onPick(index, event.timeStamp, event.detail === 0)}
              className={`flex min-h-16 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left ring-1 transition active:scale-[0.99] disabled:opacity-50 ${TONE_CLASS[option.tone]}`}>
              {option.club ? <ClubBadge name={clubName(option.club)} className="size-9 text-sm" /> : null}
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] leading-snug font-extrabold">{option.label}</span>
                <span className={`mt-0.5 block text-xs leading-relaxed ${mutedClass}`}>{option.detail}</span>
              </span>
              {option.tone === "risk" ? <span className="shrink-0 rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-black text-amber-800 dark:text-amber-200">모험</span> : null}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/** 라이벌 카드. 지금 소속과 통산 기록, 나와의 맞대결 전적, 지난 시즌 성적을 보여 줘요. */
export function RivalCard({ state }: { state: CareerState }) {
  const rv = state.rival;
  const last = state.history.at(-1)?.rival ?? null;
  const gap = overall(state.attrs, state.pos) - rv.ovr;
  const retired = rv.retiredAge !== null;
  return (
    <section className={`${cardClass} px-4 py-3.5 sm:px-5`} aria-label="라이벌">
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-zinc-900 text-white dark:bg-white/10">
          <span className="sr-only">라이벌 오버롤 </span>
          <span className="text-lg leading-none font-black tabular-nums">{rv.ovr}</span>
          <span aria-hidden="true" className="text-[8px] font-bold text-zinc-300">OVR</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="sport-eyebrow text-rose-600 dark:text-rose-400">RIVAL · 평생의 라이벌</p>
          <p className="truncate text-sm font-extrabold">{rv.name} <span className={`text-xs font-semibold ${mutedClass}`}>{NATIONS[rv.nation].name} · {POSITIONS[rv.pos].name}</span></p>
          <p className={`truncate text-xs ${mutedClass}`}>
            {retired ? `${rv.retiredAge}세에 은퇴` : clubName(rv.club)} · {rv.pos === "GK" ? `트로피 ${rv.trophies}` : `통산 ${rv.goals}골 · 트로피 ${rv.trophies}`}{rv.ballonDor ? ` · 발롱도르 ${rv.ballonDor}회` : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className={`text-[10px] ${mutedClass}`}>맞대결</p>
          <p className="text-sm font-black tabular-nums">{rv.h2h.won}승 {rv.h2h.drawn}무 {rv.h2h.lost}패</p>
          {!retired ? <p className={`text-[10px] font-bold ${gap > 0 ? "text-emerald-600 dark:text-emerald-400" : gap < 0 ? "text-rose-500" : mutedClass}`}>{gap > 0 ? `오버롤 ${gap} 앞섬` : gap < 0 ? `오버롤 ${-gap} 뒤짐` : "오버롤 동률"}</p> : null}
        </div>
      </div>
      {last ? <p className={`mt-2 border-t border-zinc-100 pt-2 text-xs dark:border-white/[0.07] ${mutedClass}`}>지난 시즌 · {rivalLine(last, rv.pos === "GK")}</p> : null}
    </section>
  );
}

function rivalLine(season: NonNullable<SeasonRecord["rival"]>, keeper: boolean): string {
  return [
    `${clubName(season.club)} ${season.apps}경기${keeper ? "" : ` ${season.goals}골 ${season.assists}도움`}`,
    ...season.trophies,
    season.ballon ? `발롱도르 ${season.ballon === 1 ? "수상" : `${season.ballon}위`}` : "",
    season.meeting ? `맞대결 ${season.meeting}` : "",
    season.moved ?? "",
    season.retired ? "은퇴" : "",
  ].filter(Boolean).join(" · ");
}

function reserveText(reserve: { apps: number; goals: number; assists: number }): string {
  return `2군 ${reserve.apps}경기${reserve.goals || reserve.assists ? ` ${reserve.goals}골 ${reserve.assists}도움` : ""}`;
}

/** 시즌 중 사건이 왔을 때 보여 주는 전반기 성적 */
export function HalfSeason({ state }: { state: CareerState }) {
  const draft = state.draft;
  if (!draft) return null;
  const rating = draft.apps ? (draft.ratingSum / draft.apps / 10).toFixed(1) : "-";
  return (
    <p id="career-half" className={`${cardClass} flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm`}>
      <span className="font-bold">{seasonLabel(draft.year)} {state.pending?.id === "moment" ? "결승 전까지" : "전반기"}</span>
      <span className={mutedClass}>
        {draft.apps}경기 · {state.pos === "GK" ? `무실점 ${draft.cleanSheets}` : `${draft.goals}골 ${draft.assists}도움`} · 평점 {rating} · {roleName(draft.role, draft.age)}
        {draft.reserveApps ? ` · ${reserveText({ apps: draft.reserveApps, goals: draft.reserveGoals, assists: draft.reserveAssists })}` : ""}
      </span>
    </p>
  );
}

function seasonGrade(season: SeasonRecord): string {
  if (season.apps < 5) return "-";
  return season.rating >= 78 ? "S" : season.rating >= 73 ? "A" : season.rating >= 68 ? "B" : season.rating >= 63 ? "C" : "D";
}

/** [대회, 팀 성적] 목록. 리그 순위는 팀 성적이라 출전이 적어도 그대로 보여요. */
function competitionLine(season: SeasonRecord): [string, string][] {
  const league = LEAGUES[CLUBS[season.club].league];
  const parts: [string, string][] = [[league.name, season.rank === 1 ? "우승" : `${season.rank}위`], [league.cup, CUP_STAGES[season.cup]]];
  if (season.continental && league.continental) parts.push([CONTINENTALS[league.continental].name, CONTINENTAL_STAGES[season.continental]]);
  return parts;
}

export function SeasonReport({ season, previous, journal, expandedDetails = false }: {
  season: SeasonRecord; previous?: SeasonRecord; journal?: SeasonJournal; expandedDetails?: boolean;
}) {
  const heading = useId();
  const keeper = season.pos === "GK";
  const grade = seasonGrade(season);
  const national = [season.caps ? `A매치 ${season.caps}경기 ${season.intlGoals}골` : "", ...season.tournaments].filter(Boolean);
  return (
    <section className={cardClass} aria-labelledby={heading}>
      <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4 sm:px-6 dark:border-white/[0.07]">
        <div className="min-w-0">
          <p className="sport-eyebrow text-emerald-700 dark:text-emerald-400">SEASON REPORT</p>
          <h2 id={heading} className="mt-1 text-lg font-black tracking-tight">{seasonLabel(season.year)} 시즌 · {season.age}세</h2>
          <p className={`mt-1 flex min-w-0 items-center gap-1.5 text-sm ${mutedClass}`}>
            <ClubBadge name={clubName(season.club)} className="size-5 text-[10px]" />
            <span className="truncate">{clubName(season.club)}{season.loan ? " (임대)" : season.military ? " (군 복무)" : ""} · {roleName(season.role, season.age)}</span>
          </p>
        </div>
        <span title="시즌 평가" className={`flex size-12 shrink-0 items-center justify-center rounded-2xl text-2xl font-black ${grade === "S" ? "bg-amber-300 text-amber-950" : grade === "A" ? "bg-[#d4f77d] text-[#102c26]" : "bg-zinc-100 text-zinc-600 dark:bg-white/10 dark:text-zinc-300"}`}>
          <span className="sr-only">시즌 평가 </span>{grade}
        </span>
      </div>
      <SeasonStats season={season} previous={previous} journal={journal} />
      <details open={expandedDetails || undefined} className="border-t border-zinc-100 dark:border-white/[0.07]">
        <summary className="cursor-pointer px-5 py-4 text-sm font-bold sm:px-6">대회·이벤트 상세 기록{journal ? ` · 선택 ${journal.entries.length}회` : ""}</summary>
        <div className="space-y-3 px-5 pb-5 text-sm sm:px-6">
          <p className={mutedClass}>
            {competitionLine(season).map(([name, stage], index) => (
              <span key={name}>{index ? " · " : ""}{name} <strong className="font-bold text-zinc-800 dark:text-zinc-100">{stage}</strong></span>
            ))}
          </p>
          {season.reserve ? <p className={mutedClass}>{reserveText(season.reserve)} · 1군 기회가 적을 때 경기 감각을 쌓았어요</p> : null}
          {season.trophies.length || season.awards.length ? (
            <ul className="flex flex-wrap gap-1.5" aria-label="트로피와 수상">
              {season.trophies.map((honor) => <li key={honor.label} className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900 dark:bg-amber-300/15 dark:text-amber-200"><TrophyIcon className="size-3.5" />{honor.label}</li>)}
              {season.awards.map((honor) => <li key={honor.label} className={`rounded-full px-2.5 py-1 text-xs font-bold ${honor.label.endsWith("발롱도르") ? "bg-amber-300 text-amber-950" : "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"}`}>{honor.label}</li>)}
            </ul>
          ) : null}
          {season.ballon > 10 ? <p className={`text-xs ${mutedClass}`}>발롱도르 최종 후보 {season.ballon}위</p> : null}
          {national.length ? <p>{national.join(" · ")}</p> : null}
          {season.rival ? <p className={`text-xs ${mutedClass}`}><strong className="font-bold text-rose-600 dark:text-rose-400">라이벌</strong> {rivalLine(season.rival, keeper)}</p> : null}
          {season.highlights.length ? (
            <ul className="space-y-1.5">
              {season.highlights.map((text, i) => <li key={`${i}-${text}`} className="flex gap-2"><span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-emerald-500" /><span>{text}</span></li>)}
            </ul>
          ) : null}
          {season.event ? <p className={`rounded-xl bg-zinc-50 px-3 py-2 text-xs leading-relaxed dark:bg-white/[0.04] ${mutedClass}`}>{season.event}</p> : null}
          {journal?.entries.length ? (
            <div className="border-t border-zinc-100 pt-4 dark:border-white/[0.07]">
              <h3 className="font-extrabold">내 선택과 그 결과</h3>
              <ol className="mt-3 space-y-3" aria-label="시즌 선택 기록">
                {journal.entries.map((entry) => (
                  <li key={entry.step} data-choice-step={entry.step} className="border-l-2 border-emerald-600/25 pl-3">
                    <p className={`text-[10px] font-bold ${mutedClass}`}>{entry.kind === "training" ? "프리시즌" : entry.kind === "offseason" ? "시즌 종료 후" : "시즌 중"}</p>
                    <p className="mt-0.5 text-sm font-extrabold">{entry.title}</p>
                    <p className={`mt-1 text-xs leading-relaxed ${mutedClass}`}>{entry.body}</p>
                    <p className="mt-2 text-xs font-bold text-emerald-800 dark:text-emerald-200">선택 · {entry.choice}</p>
                    <p className={`mt-0.5 text-xs ${mutedClass}`}>{entry.detail}</p>
                    {entry.outcome ? <p className="mt-1 text-xs leading-relaxed">결과 · {entry.outcome}</p> : null}
                    {entry.ovrBefore !== entry.ovrAfter ? <p className={`mt-1 text-[11px] ${mutedClass}`}>경기·성장 포함 진행 후 OVR {entry.ovrBefore} → {entry.ovrAfter}</p> : null}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      </details>
    </section>
  );
}

/** 시즌이 흘러가는 짧은 연출. 실제 계산은 이미 끝났고 결과를 보여 주기 전에 잠깐 기다려요. */
export function SimulationCard({ title, from, to, ms }: { title: string; from: number; to: number; ms: number }) {
  return (
    <section className="flex flex-col items-center rounded-3xl bg-[#102c26] px-6 py-10 text-center text-white" aria-busy="true" aria-live="polite">
      <BallIcon className={`size-10 text-[#d4f77d] ${styles.ball}`} />
      <p className="mt-4 text-lg font-black">{title}</p>
      <div className="mt-5 h-2 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full bg-[#d4f77d] ${styles.progress}`} style={{ "--from": `${from}%`, "--to": `${to}%`, "--sim-ms": `${ms}ms` } as CSSProperties} />
      </div>
      <p className="mt-3 text-xs text-white/60">{to < 100 ? "전반기 일정을 치르고 있어요" : "시즌 막바지 순위 경쟁 중이에요"}</p>
    </section>
  );
}

/** 시즌이 끝날 때의 오버롤을 나이 순서로 잇는 선 그래프. 표는 커리어 기록에 그대로 있어요. */
export function OvrChart({ history, dark = false }: { history: Pick<SeasonRecord, "age" | "ovrEnd" | "club">[]; dark?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  useEffect(() => {
    const node = box.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  if (history.length < 2) return null;

  const height = 136;
  const pad = { left: 30, right: 14, top: 22, bottom: 24 };
  const values = history.map((season) => season.ovrEnd);
  const top = Math.max(...values);
  const low = Math.floor((Math.min(...values) - 2) / 10) * 10;
  const high = Math.max(low + 20, Math.ceil((top + 2) / 10) * 10);
  const peak = values.indexOf(top);
  const x = (i: number) => pad.left + (i * Math.max(0, width - pad.left - pad.right)) / (history.length - 1);
  const y = (value: number) => pad.top + ((high - value) * (height - pad.top - pad.bottom)) / (high - low);
  const points = values.map((value, i) => `${x(i).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
  const ticks: number[] = [];
  for (let value = low; value <= high; value += 10) ticks.push(value);
  // 표면은 은퇴 카드의 짙은 초록 또는 일반 카드예요. 선은 2px, 눈금은 표면보다 한 단계 밝은 1px 실선이에요.
  const ink = dark
    ? { line: "stroke-[#d4f77d]", area: "fill-[#d4f77d]/10", dot: "fill-[#d4f77d] stroke-[#102c26]", grid: "stroke-white/10", text: "fill-white/55", strong: "fill-white", tip: "bg-[#071913] text-white ring-white/10" }
    : {
      line: "stroke-emerald-600 dark:stroke-emerald-400", area: "fill-emerald-500/10", dot: "fill-emerald-600 stroke-white dark:fill-emerald-400 dark:stroke-[#191a1e]",
      grid: "stroke-zinc-200 dark:stroke-white/10", text: "fill-zinc-500 dark:fill-zinc-400", strong: "fill-zinc-800 dark:fill-zinc-100",
      tip: "bg-white text-zinc-900 ring-zinc-950/10 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-white/10",
    };
  const last = history.length - 1;
  // 나이는 처음·마지막과, 둘과 충분히 떨어져 있을 때만 최고 시즌에 적어요.
  const ages = [0, last, ...(x(peak) - x(0) > 44 && x(last) - x(peak) > 44 ? [peak] : [])];
  const shown = active;
  const season = shown !== null ? history[shown] : null;
  const nearest = (clientX: number) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect || width <= pad.left + pad.right) return null;
    const ratio = (clientX - rect.left - pad.left) / (width - pad.left - pad.right);
    return Math.min(history.length - 1, Math.max(0, Math.round(ratio * (history.length - 1))));
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const step = event.key === "ArrowLeft" ? -1 : 1;
      setActive((current) => Math.min(history.length - 1, Math.max(0, (current ?? history.length - 1) + step)));
    } else if (event.key === "Escape") setActive(null);
  };
  const summary = `오버롤 변화. ${history[0].age}세 ${values[0]}에서 ${history[peak].age}세 최고 ${top}, 마지막 시즌 ${values.at(-1)}.`;

  return (
    <div ref={box} tabIndex={0} role="group" aria-label={`${summary} 좌우 방향키로 시즌별 오버롤을 볼 수 있어요.`}
      onPointerMove={(event: PointerEvent) => setActive(nearest(event.clientX))} onPointerLeave={() => setActive(null)}
      onFocus={() => setActive((current) => current ?? last)} onBlur={() => setActive(null)} onKeyDown={onKey}
      className="relative touch-pan-y rounded-xl outline-offset-2" style={{ height }}>
      {width > 0 ? (
        <svg width={width} height={height} className="block" aria-hidden="true">
          {ticks.map((value) => (
            <g key={value}>
              <line x1={pad.left} x2={width - pad.right} y1={y(value)} y2={y(value)} strokeWidth="1" className={ink.grid} />
              <text x={pad.left - 8} y={y(value) + 3.5} textAnchor="end" className={`text-[10px] tabular-nums ${ink.text}`}>{value}</text>
            </g>
          ))}
          {ages.map((i) => (
            <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 ? "start" : i === last ? "end" : "middle"} className={`text-[10px] ${ink.text}`}>{history[i].age}세</text>
          ))}
          <polygon points={`${x(0)},${height - pad.bottom} ${points} ${x(last)},${height - pad.bottom}`} className={ink.area} />
          <polyline points={points} fill="none" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" className={ink.line} />
          {shown !== null ? <line x1={x(shown)} x2={x(shown)} y1={pad.top - 6} y2={height - pad.bottom} strokeWidth="1" className={ink.grid} /> : null}
          <circle cx={x(peak)} cy={y(top)} r="4.5" strokeWidth="2" className={ink.dot} />
          <text x={Math.min(Math.max(x(peak), pad.left + 30), width - pad.right - 30)} y={y(top) - 9} textAnchor="middle" className={`text-[10px] font-bold ${ink.strong}`}>최고 {top}</text>
          {shown !== null ? <circle cx={x(shown)} cy={y(values[shown])} r="4.5" strokeWidth="2" className={ink.dot} /> : null}
        </svg>
      ) : null}
      {season && shown !== null && width > 0 ? (
        <div role="status" className={`pointer-events-none absolute z-10 w-max -translate-x-1/2 rounded-lg px-2.5 py-1.5 text-xs shadow-lg ring-1 ${ink.tip}`}
          style={{ left: Math.min(Math.max(x(shown), 64), width - 64), top: y(values[shown]) >= 58 ? y(values[shown]) - 58 : y(values[shown]) + 12 }}>
          <strong className="block text-sm font-extrabold tabular-nums">오버롤 {values[shown]}</strong>
          <span className={dark ? "text-white/65" : mutedClass}>{season.age}세 · {clubName(season.club)}</span>
        </div>
      ) : null}
    </div>
  );
}

export function HistoryTable({ history }: { history: SeasonRecord[] }) {
  if (!history.length) return null;
  return (
    <details className={`${cardClass} group`}>
      <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-bold sm:px-6">
        커리어 기록 · {history.length}시즌
        <span className={`text-xs font-semibold ${mutedClass} group-open:hidden`}>펼치기</span>
        <span className={`hidden text-xs font-semibold ${mutedClass} group-open:inline`}>접기</span>
      </summary>
      {history.length >= 2 ? (
        <div className="border-t border-zinc-100 px-4 pt-4 pb-2 dark:border-white/[0.07]">
          <p className={`mb-2 px-1 text-xs font-semibold ${mutedClass}`}>시즌이 끝날 때의 오버롤</p>
          <OvrChart history={history} />
        </div>
      ) : null}
      <div className="overflow-x-auto border-t border-zinc-100 dark:border-white/[0.07]">
        <table className="w-full min-w-[560px] text-left text-xs tabular-nums">
          <thead className={mutedClass}>
            <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-semibold">
              <th>시즌</th><th>나이</th><th>클럽</th><th>OVR</th><th>경기</th><th>골</th><th>도움</th><th>평점</th><th>수상·트로피</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.06]">
            {history.map((season) => (
              <tr key={season.year} className="[&>td]:px-3 [&>td]:py-2">
                <td className="whitespace-nowrap">{seasonLabel(season.year)}</td>
                <td>{season.age}</td>
                <td className="max-w-36 truncate font-semibold">{clubName(season.club)}{season.loan ? " (임대)" : ""}</td>
                <td className="font-bold">{season.ovrEnd}</td>
                <td>{season.apps}</td>
                <td>{season.goals}</td>
                <td>{season.assists}</td>
                <td>{season.apps ? (season.rating / 10).toFixed(1) : "-"}</td>
                <td className="max-w-56 truncate">{[...season.awards, ...season.trophies].map((honor) => honor.label.replace(/^\d{4} /, "")).join(", ") || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

const BREAKDOWN_LABELS: [keyof LegacyBreakdown, string][] = [
  ["trophies", "트로피"], ["awards", "개인상"], ["ballon", "발롱도르"], ["records", "통산 기록"], ["national", "대표팀"], ["peak", "최고 오버롤"], ["rival", "라이벌"],
];

/** 레전드 점수가 어디서 왔는지 보여 줘요. 다 더하면 레전드 점수예요. */
export function ScoreBreakdown({ parts }: { parts: LegacyBreakdown }) {
  return (
    <dl className="grid grid-cols-4 gap-2 sm:grid-cols-7">
      {BREAKDOWN_LABELS.map(([key, label]) => (
        <div key={key} className="rounded-xl bg-white/[0.05] px-2 py-2.5 text-center">
          <dt className="text-[10px] text-white/55">{label}</dt>
          <dd className={`mt-0.5 text-sm font-extrabold tabular-nums ${parts[key] ? "" : "text-white/35"}`}>{parts[key].toLocaleString("ko-KR")}</dd>
        </div>
      ))}
    </dl>
  );
}
