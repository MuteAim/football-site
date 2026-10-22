"use client";

import { useActionState, useState } from "react";
import { saveTeam } from "@/lib/cafe/actions";
import type { FanTeam, FormState, LeagueTeams } from "@/lib/cafe/types";
import { Crest } from "../Crest";
import { errorTextClass, mutedClass, primaryButtonClass, textButtonClass } from "../ui";

const initialState: FormState = { error: null };

/** 응원팀 고르기. 리그를 고른 뒤 엠블럼을 누르고 저장해요. */
export function TeamPicker({ leagues, current }: { leagues: LeagueTeams[]; current: FanTeam | null }) {
  const [state, formAction, pending] = useActionState(saveTeam, initialState);
  const [selected, setSelected] = useState(current);
  // 처음에는 지금 응원하는 팀이 있는 리그를 펼쳐요.
  const [league, setLeague] = useState(
    () => leagues.find((l) => l.teams.some((team) => team.id === current?.id))?.code ?? leagues[0]?.code,
  );

  if (leagues.length === 0) {
    return <p className={`text-sm ${mutedClass}`}>팀 목록을 불러오지 못했어요. 잠시 후 다시 열어 주세요.</p>;
  }

  const teams = leagues.find((l) => l.code === league)?.teams ?? [];
  const changed = (selected?.id ?? null) !== (current?.id ?? null);

  return (
    <form action={formAction}>
      <input type="hidden" name="teamId" value={selected?.id ?? ""} />

      <div role="group" aria-label="리그" className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5">
        {leagues.map((l) => {
          const active = l.code === league;
          return (
            <button
              key={l.code}
              type="button"
              aria-pressed={active}
              onClick={() => setLeague(l.code)}
              className={`h-8 shrink-0 rounded-full px-3 text-[13px] font-medium transition active:scale-95 ${
                active
                  ? "bg-zinc-900 font-semibold text-white dark:bg-white dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-600 hover:text-zinc-900 dark:bg-white/[0.06] dark:text-zinc-300 dark:hover:text-white"
              }`}
            >
              {l.name}
            </button>
          );
        })}
      </div>

      <ul className="mt-3 grid grid-cols-4 gap-1 sm:grid-cols-5">
        {teams.map((team) => {
          const active = team.id === selected?.id;
          return (
            <li key={team.id}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => setSelected(team)}
                className={`flex w-full flex-col items-center gap-1.5 rounded-xl px-1 pt-2.5 pb-2 text-[11px] font-medium ring-1 transition active:scale-95 ${
                  active
                    ? "bg-emerald-500/10 text-emerald-800 ring-emerald-500 dark:text-emerald-300"
                    : "text-zinc-600 ring-transparent hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/[0.06]"
                }`}
              >
                {/* 프로필 그림과 같은 흰 동그라미 위에 올려서, 어두운 화면에서도 짙은 엠블럼이 보여요. */}
                <span className="flex size-11 items-center justify-center rounded-full bg-white ring-1 ring-zinc-950/5 dark:ring-white/10">
                  <Crest src={team.crest} size={28} />
                </span>
                <span className="w-full truncate text-center">{team.name}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5 text-sm">
          {selected ? (
            <>
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full dark:bg-white">
                <Crest src={selected.crest} size={18} />
              </span>
              <span className="truncate font-semibold">{selected.name}</span>
              <button type="button" onClick={() => setSelected(null)} className={`shrink-0 ${textButtonClass}`}>
                선택 해제
              </button>
            </>
          ) : (
            <span className={mutedClass}>고른 팀이 없어요.</span>
          )}
        </div>
        <button type="submit" disabled={!changed || pending} className={primaryButtonClass}>
          {pending ? "저장 중…" : "저장"}
        </button>
      </div>

      {state.error ? (
        <p role="alert" className={`mt-2 ${errorTextClass}`}>
          {state.error}
        </p>
      ) : state.message && !changed ? (
        <p role="status" className="mt-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
