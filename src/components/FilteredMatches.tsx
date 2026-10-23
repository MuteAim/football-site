"use client";

import Link from "next/link";
import { createContext, useContext, useState, type ReactNode } from "react";
import type { FanTeam } from "@/lib/cafe/types";
import { COMPETITIONS, competitionOrder, getCompetition } from "@/lib/competitions";
import type { Match } from "@/lib/football-data";
import { filterMatches, type MatchFilter } from "@/lib/match-filters";
import { roundLabel } from "@/lib/match-display";
import { Crest } from "./Crest";
import { EmptyState } from "./EmptyState";
import { ChevronRightIcon } from "./Icons";
import { LinkPending } from "./LinkPending";
import { MatchRow } from "./MatchRow";
import { cardClass, cardHeadingClass, cardListClass } from "./ui";

const FILTERS: { value: MatchFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "live", label: "진행 중" },
  { value: "scheduled", label: "예정" },
  { value: "finished", label: "종료" },
];

const TeamFilterContext = createContext<{ teamId: number | null; select: (id: number | null) => void } | null>(null);

/** 회원 정보만 서버에서 따로 읽어 이 버튼으로 넘겨요. 경기 목록 캐시는 모두 함께 씁니다. */
export function MyTeamFilter({ team }: { team: FanTeam | null }) {
  const filter = useContext(TeamFilterContext);
  if (!filter) return null;
  if (!team) {
    return <Link href="/cafe/me" className="flex h-10 items-center rounded-xl px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300">응원팀 설정</Link>;
  }
  const active = filter.teamId === team.id;
  return (
    <button
      type="button"
      aria-pressed={active}
      title={team.name}
      onClick={() => filter.select(active ? null : team.id)}
      className={`flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold ring-1 transition ${active ? "bg-emerald-500/10 text-emerald-800 ring-emerald-500 dark:text-emerald-300" : "bg-white text-zinc-600 ring-zinc-950/10 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-white/10"}`}
    >
      <Crest src={team.crest} size={16} />
      내 팀만 보기
    </button>
  );
}

function CompetitionHeading({ code, list }: { code: string; list: Match[] }) {
  const info = getCompetition(code);
  const content = (
    <>
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-zinc-950/5">
        <Crest src={info?.emblem ?? list[0].competition.emblem} size={18} />
      </span>
      <span className="truncate">{info?.name ?? list[0].competition.name}</span>
      <span className="ml-auto shrink-0 text-xs font-normal text-zinc-500 dark:text-zinc-400">{list.length}경기</span>
    </>
  );
  return (
    <h2 className={cardHeadingClass}>
      {info ? (
        <Link href={`/league/${code}`} prefetch={false} className="group relative flex min-w-0 flex-1 items-center gap-2.5 self-stretch">
          {content}
          <ChevronRightIcon className="-mr-1 size-4 shrink-0 text-zinc-400" />
          <LinkPending className="-mx-2 rounded-lg bg-emerald-500/15" />
        </Link>
      ) : <span className="flex min-w-0 flex-1 items-center gap-2.5">{content}</span>}
    </h2>
  );
}

export function FilteredMatches({ matches, today, teamControl }: { matches: Match[]; today: string; teamControl: ReactNode }) {
  const [status, setStatus] = useState<MatchFilter>("all");
  const [competition, setCompetition] = useState("");
  const [teamId, setTeamId] = useState<number | null>(null);
  const scoped = filterMatches(matches, "all", competition, teamId);
  const visible = filterMatches(scoped, status, "", null);
  const filtered = status !== "all" || competition !== "" || teamId !== null;
  const groups = new Map<string, Match[]>();
  for (const match of visible) {
    const list = groups.get(match.competition.code) ?? [];
    list.push(match);
    groups.set(match.competition.code, list);
  }
  const ordered = [...groups].sort(([a], [b]) => competitionOrder(a) - competitionOrder(b));

  function reset() {
    setStatus("all");
    setCompetition("");
    setTeamId(null);
  }

  return (
    <TeamFilterContext.Provider value={{ teamId, select: setTeamId }}>
      <div className="mb-4 space-y-3">
        <div role="group" aria-label="경기 상태" className="grid grid-cols-4 gap-1 rounded-2xl bg-zinc-200/60 p-1 dark:bg-white/5">
          {FILTERS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={status === value}
              onClick={() => setStatus(value)}
              className={`flex min-h-11 min-w-0 flex-wrap items-center justify-center gap-x-1 rounded-xl px-1 text-[13px] font-semibold transition ${status === value ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-800 dark:text-white" : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"}`}
            >
              {label}<span className={`text-xs tabular-nums ${value === "live" ? "text-red-600 dark:text-red-400" : "text-zinc-500 dark:text-zinc-400"}`}>{filterMatches(scoped, value, "", null).length}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <select
            aria-label="경기 목록 리그 필터"
            value={competition}
            onChange={(event) => setCompetition(event.target.value)}
            className="h-10 min-w-0 max-w-44 rounded-xl bg-white px-3 text-sm ring-1 ring-zinc-950/10 focus-visible:outline-emerald-500 dark:bg-zinc-900 dark:ring-white/10"
          >
            <option value="">전체 리그</option>
            {COMPETITIONS.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
          </select>
          {teamControl}
        </div>
        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <p role="status" aria-live="polite">{visible.length}경기 표시 · 전체 {matches.length}경기</p>
          {filtered ? <button type="button" onClick={reset} className="min-h-8 rounded-lg px-2 font-semibold text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300">필터 초기화</button> : null}
        </div>
      </div>
      {visible.length === 0 ? (
        <EmptyState>{filtered ? "선택한 조건에 맞는 경기가 없어요. 필터를 바꿔 보세요." : "이날은 경기가 없어요. 다른 날짜를 골라 보세요."}</EmptyState>
      ) : (
        <div className="space-y-3">
          {ordered.map(([code, list]) => (
            <section key={code} className={cardClass}>
              <CompetitionHeading code={code} list={list} />
              <ul className={cardListClass}>
                {list.map((match) => <MatchRow key={match.id} match={match} caption={roundLabel(match)} today={today} />)}
              </ul>
            </section>
          ))}
        </div>
      )}
    </TeamFilterContext.Provider>
  );
}
