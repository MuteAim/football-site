"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { saveSquad } from "@/lib/cafe/actions";
import {
  FORMATION_NAMES,
  isFormation,
  playerIdOf,
  seasonIdOf,
  slotsOf,
  SQUAD_LIMITS,
  SQUAD_SIZE,
  type FcSeasons,
  type Formation,
  type SquadPlayer,
} from "@/lib/cafe/squad";
import { withParticle } from "@/lib/korean";
import { confirmDialog } from "../feedback";
import { ChevronLeftIcon } from "../Icons";
import { cardClass, errorTextClass, inputClass, mutedClass, primaryButtonClass, secondaryButtonClass } from "../ui";
import { CardPhoto } from "./CardPhoto";
import { LoginLink } from "./LoginLink";
import { NexonCredit, SeasonIcon, SquadPitch } from "./SquadPitch";

type Draft = { name: string; formation: Formation; players: (SquadPlayer | null)[] };
type PlayerResult = { pid: number; name: string; spids: number[] };

const DRAFT_KEY = "cafe:squad-draft";
const EMPTY_DRAFT: Draft = { name: "나의 드림 스쿼드", formation: "4-3-3", players: Array(SQUAD_SIZE).fill(null) };

function isSquadPlayer(value: unknown): value is SquadPlayer {
  const player = value as SquadPlayer | null;
  return typeof player?.spid === "number" && typeof player.name === "string";
}

/** 저장하지 않은 새 스쿼드. 로그인하러 다녀와도 이어서 만들 수 있게 이 브라우저에 적어 둬요. 없거나 깨졌으면 null이에요. */
function readDraft(): Draft | null {
  try {
    const raw = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null") as Partial<Draft> | null;
    if (
      typeof raw?.name === "string" &&
      typeof raw.formation === "string" &&
      isFormation(raw.formation) &&
      Array.isArray(raw.players) &&
      raw.players.length === SQUAD_SIZE &&
      raw.players.every((player) => player === null || isSquadPlayer(player))
    ) {
      return { name: raw.name, formation: raw.formation, players: raw.players };
    }
  } catch {
    // 브라우저 저장소를 못 쓰면 빈 스쿼드로 시작해요.
  }
  return null;
}

function writeDraft(draft: Draft | null) {
  try {
    if (draft && draft.players.some(Boolean)) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    // 적어 두지 못해도 만드는 데는 지장이 없어요.
  }
}

/**
 * 드림 스쿼드 만들기와 고치기. 포메이션을 고르고 자리를 눌러 선수 카드를 넣어요.
 * 채운 자리를 누르면 다른 선수로 바꾸거나, 다른 자리와 맞바꾸거나, 비울 수 있어요.
 * 새 스쿼드는 저장하기 전까지 이 브라우저에 적어 둬서, 로그인하고 돌아와도 그대로예요.
 * 브라우저 저장소를 처음부터 읽어야 해서 서버에서는 그리지 않아요(SquadBuilderLoader).
 */
export function SquadBuilder({
  squad,
  seasons,
  viewer,
}: {
  /** 고치는 스쿼드. 없으면 새 스쿼드예요. */
  squad?: { id: number; name: string; formation: string; players: (SquadPlayer | null)[] };
  seasons: FcSeasons;
  /** member는 저장할 수 있는 회원, join은 닉네임을 정하기 전, guest는 로그인 전이에요. */
  viewer: "member" | "join" | "guest";
}) {
  const isNew = !squad;
  const [restored, setRestored] = useState(() => isNew && readDraft() !== null);
  const [draft, setDraft] = useState<Draft>(() =>
    squad
      ? { name: squad.name, formation: isFormation(squad.formation) ? squad.formation : "4-3-3", players: squad.players }
      : (readDraft() ?? EMPTY_DRAFT),
  );
  const [picking, setPicking] = useState<number | null>(null);
  const [moving, setMoving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (isNew) writeDraft(draft);
  }, [isNew, draft]);

  // 선수 고르기 창은 <dialog>가 뒤를 막고 Esc와 포커스 가두기를 맡아요.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (picking !== null && !dialog.open) dialog.showModal();
    if (picking === null && dialog.open) dialog.close();
  }, [picking]);

  const slots = slotsOf(draft.formation);
  const count = draft.players.filter(Boolean).length;
  const path = squad ? `/cafe/squad/${squad.id}/edit` : "/cafe/squad/new";

  function setSlot(index: number, player: SquadPlayer | null) {
    setDraft((current) => ({ ...current, players: current.players.map((p, i) => (i === index ? player : p)) }));
  }

  function onSlot(index: number) {
    if (moving === null) {
      setPicking(index);
      return;
    }
    // 자리 옮기기 중이면 고른 두 자리의 선수를 맞바꿔요.
    if (index !== moving) {
      setDraft((current) => {
        const players = [...current.players];
        [players[moving], players[index]] = [players[index], players[moving]];
        return { ...current, players };
      });
    }
    setMoving(null);
  }

  async function clearAll() {
    const ok = await confirmDialog({ title: "선수를 모두 뺄까요?", confirmLabel: "모두 빼기", tone: "danger" });
    if (ok) setDraft((current) => ({ ...current, players: EMPTY_DRAFT.players }));
  }

  function startOver() {
    writeDraft(null);
    setDraft(EMPTY_DRAFT);
    setRestored(false);
  }

  function save() {
    setError(null);
    startSaving(async () => {
      // 저장되면 서버가 스쿼드 화면으로 넘겨서, 그 전에 적어 둔 것을 지워요. 실패하면 다시 적어요.
      if (isNew) writeDraft(null);
      const result = await saveSquad({
        id: squad?.id ?? null,
        name: draft.name,
        formation: draft.formation,
        players: draft.players.map((player) => player?.spid ?? null),
      });
      if (result?.error) {
        if (isNew) writeDraft(draft);
        setError(result.error);
      }
    });
  }

  const current = picking === null ? null : draft.players[picking];
  const movingName = moving === null ? "" : (draft.players[moving]?.name ?? "");
  const takenPids = new Set(
    draft.players.flatMap((player, index) => (player && index !== picking ? [playerIdOf(player.spid)] : [])),
  );

  return (
    <div className="space-y-4">
      {restored ? (
        <p className={`flex items-center justify-between gap-3 rounded-xl bg-emerald-500/10 px-3.5 py-2.5 text-sm ${mutedClass}`}>
          만들던 스쿼드를 이어서 보여 줘요.
          <button type="button" onClick={startOver} className="shrink-0 font-semibold text-emerald-700 dark:text-emerald-400">
            새로 만들기
          </button>
        </p>
      ) : null}

      <div role="group" aria-label="포메이션" className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 py-0.5">
        {FORMATION_NAMES.map((name) => (
          <button
            key={name}
            type="button"
            aria-pressed={draft.formation === name}
            onClick={() => setDraft((current) => ({ ...current, formation: name }))}
            className={`flex h-9 shrink-0 items-center rounded-full px-3.5 text-sm font-semibold tabular-nums transition active:scale-95 ${
              draft.formation === name
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "bg-white text-zinc-600 ring-1 ring-zinc-950/5 hover:text-zinc-900 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-white/10"
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {moving !== null ? (
          <p
            role="status"
            className="mx-auto flex max-w-[26rem] items-center justify-between gap-3 rounded-xl bg-amber-400/15 px-3.5 py-2.5 text-sm font-medium text-amber-900 dark:text-amber-200"
          >
            {movingName}
            {withParticle(movingName)} 자리를 바꿀 곳을 누르세요.
            <button type="button" onClick={() => setMoving(null)} className="shrink-0 font-semibold">
              취소
            </button>
          </p>
        ) : null}
        <SquadPitch
          formation={draft.formation}
          players={draft.players}
          seasons={seasons}
          onSlot={onSlot}
          selected={moving}
        />
        <div className="mx-auto flex max-w-[26rem] items-center justify-between text-sm">
          <span className={`tabular-nums ${mutedClass}`}>
            선수 {count}/{SQUAD_SIZE}
          </span>
          {count > 0 ? (
            <button type="button" onClick={() => void clearAll()} className={`font-medium ${mutedClass} hover:text-zinc-900 dark:hover:text-white`}>
              모두 빼기
            </button>
          ) : null}
        </div>
      </div>

      <div className={`${cardClass} space-y-3 p-4`}>
        <label className="block">
          <span className="mb-1.5 flex items-baseline justify-between text-sm font-semibold">
            스쿼드 이름
            <span className={`text-xs font-normal tabular-nums ${mutedClass}`}>
              {draft.name.length}/{SQUAD_LIMITS.name}
            </span>
          </span>
          <input
            value={draft.name}
            maxLength={SQUAD_LIMITS.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            className={inputClass}
          />
        </label>
        {error ? (
          <p role="alert" className={errorTextClass}>
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          {squad ? (
            <Link href={`/cafe/squad/${squad.id}`} className={secondaryButtonClass}>
              취소
            </Link>
          ) : null}
          {viewer === "member" ? (
            <button type="button" disabled={saving || count === 0} onClick={save} className={primaryButtonClass}>
              {saving ? "저장하는 중…" : squad ? "고친 스쿼드 저장" : "스쿼드 저장"}
            </button>
          ) : viewer === "join" ? (
            <Link href={`/cafe/me?next=${encodeURIComponent(path)}`} className={primaryButtonClass}>
              닉네임 정하고 저장하기
            </Link>
          ) : (
            <LoginLink next={path} className={primaryButtonClass}>
              로그인하고 저장하기
            </LoginLink>
          )}
        </div>
        {viewer !== "member" ? (
          <p className={`text-right text-xs ${mutedClass}`}>만든 스쿼드는 이 브라우저에 남아 있어서, 다녀와서 바로 저장할 수 있어요.</p>
        ) : null}
      </div>
      <NexonCredit className="text-center" />

      <dialog
        ref={dialogRef}
        aria-label={picking === null ? "선수 고르기" : `${slots[picking]?.label} 자리 선수 고르기`}
        onCancel={(event) => {
          event.preventDefault();
          setPicking(null);
        }}
        onClick={(event) => {
          // 창 바깥 어두운 곳을 누르면 닫아요.
          if (event.target === event.currentTarget) setPicking(null);
        }}
        className="m-auto max-h-[min(40rem,calc(100dvh-2rem))] w-[min(26rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl bg-white p-0 text-zinc-900 shadow-2xl backdrop:bg-black/50 open:flex dark:bg-zinc-900 dark:text-zinc-100"
      >
        {picking !== null ? (
          <PlayerPicker
            key={picking}
            label={slots[picking]?.label ?? ""}
            current={current}
            takenPids={takenPids}
            seasons={seasons}
            onPick={(player) => {
              setSlot(picking, player);
              setPicking(null);
            }}
            onMove={() => {
              setMoving(picking);
              setPicking(null);
            }}
            onClear={() => {
              setSlot(picking, null);
              setPicking(null);
            }}
            onClose={() => setPicking(null)}
          />
        ) : null}
      </dialog>
    </div>
  );
}

/**
 * 한 자리의 선수 고르기. 이름으로 선수를 찾고, 그 선수의 시즌 카드 중 하나를 골라요.
 * 이미 채운 자리면 먼저 지금 카드와 바꾸기·옮기기·비우기를 보여 줘요. 다른 자리에 있는 선수는 고를 수 없어요.
 */
function PlayerPicker({
  label,
  current,
  takenPids,
  seasons,
  onPick,
  onMove,
  onClear,
  onClose,
}: {
  label: string;
  current: SquadPlayer | null;
  takenPids: Set<number>;
  seasons: FcSeasons;
  onPick: (player: SquadPlayer) => void;
  onMove: () => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [searching, setSearching] = useState(current === null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlayerResult[] | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [chosen, setChosen] = useState<PlayerResult | null>(null);

  // 글자를 칠 때마다 묻지 않고 잠깐 멈췄을 때 찾아요. 앞선 검색이 늦게 와도 덮어쓰지 않게 끊어요.
  useEffect(() => {
    const term = query.trim();
    if (!term) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/cafe/squad/players?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        const data = (await response.json()) as { players?: PlayerResult[] };
        if (!response.ok || !data.players) throw new Error("search failed");
        setResults(data.players);
        setStatus("idle");
      } catch {
        if (!controller.signal.aborted) setStatus("error");
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function onQuery(value: string) {
    setQuery(value);
    setChosen(null);
    if (value.trim()) {
      setStatus("loading");
    } else {
      setResults(null);
      setStatus("idle");
    }
  }

  return (
    <>
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-zinc-100 px-4 dark:border-white/[0.07]">
        {chosen ? (
          <button type="button" onClick={() => setChosen(null)} aria-label="다른 선수 찾기" className="-ml-1.5 rounded-full p-1">
            <ChevronLeftIcon className="size-5" />
          </button>
        ) : null}
        <h2 className="min-w-0 flex-1 truncate font-bold">
          {chosen ? `${chosen.name} 카드 고르기` : `${label} 자리`}
        </h2>
        <button type="button" onClick={onClose} className={`text-sm font-medium ${mutedClass}`}>
          닫기
        </button>
      </div>

      {!searching && current ? (
        <div className="space-y-4 p-4">
          <div className="flex items-center gap-3">
            <span className="relative size-16 shrink-0 overflow-hidden rounded-2xl bg-emerald-800">
              <CardPhoto key={current.spid} spid={current.spid} name={current.name} />
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold">{current.name}</p>
              <p className={`flex items-center gap-1 text-xs ${mutedClass}`}>
                <SeasonIcon seasons={seasons} spid={current.spid} />
                <span className="truncate">{seasons[seasonIdOf(current.spid)]?.name}</span>
              </p>
            </div>
          </div>
          <div className="grid gap-2">
            <button type="button" onClick={() => setSearching(true)} className={primaryButtonClass}>
              다른 선수로 바꾸기
            </button>
            <button type="button" onClick={onMove} className={secondaryButtonClass}>
              다른 자리와 맞바꾸기
            </button>
            <button type="button" onClick={onClear} className={secondaryButtonClass}>
              이 자리 비우기
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="shrink-0 p-4 pb-2">
            <input
              type="search"
              value={query}
              autoFocus
              onChange={(event) => onQuery(event.target.value)}
              placeholder="선수 이름 (예: 손흥민)"
              aria-label="선수 이름"
              className={inputClass}
            />
          </div>
          <div className="min-h-40 flex-1 overflow-y-auto px-4 pb-4">
            {chosen ? (
              <ul className="grid grid-cols-3 gap-2">
                {chosen.spids.map((spid) => {
                  const taken = takenPids.has(chosen.pid);
                  return (
                    <li key={spid}>
                      <button
                        type="button"
                        disabled={taken}
                        onClick={() => onPick({ spid, name: chosen.name })}
                        className="flex w-full flex-col items-center gap-1 rounded-xl p-1.5 text-center ring-1 ring-zinc-950/10 transition hover:bg-zinc-50 active:scale-95 disabled:opacity-40 dark:ring-white/10 dark:hover:bg-white/[0.04]"
                      >
                        <span className="relative size-16 overflow-hidden rounded-xl bg-emerald-800">
                          <CardPhoto spid={spid} name={chosen.name} />
                        </span>
                        <span className="flex w-full items-center justify-center gap-1 text-[11px] leading-tight">
                          <SeasonIcon seasons={seasons} spid={spid} />
                          <span className="line-clamp-2 break-all">{seasons[seasonIdOf(spid)]?.name ?? `시즌 ${seasonIdOf(spid)}`}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : status === "loading" ? (
              <p className={`py-6 text-center text-sm ${mutedClass}`}>찾는 중…</p>
            ) : status === "error" ? (
              <p className="py-6 text-center text-sm text-rose-600 dark:text-rose-400">선수 목록을 불러오지 못했어요. 잠시 후 다시 찾아 주세요.</p>
            ) : results === null ? (
              <p className={`py-6 text-center text-sm ${mutedClass}`}>이름의 일부만 써도 찾아요.</p>
            ) : results.length === 0 ? (
              <p className={`py-6 text-center text-sm ${mutedClass}`}>찾는 선수가 없어요.</p>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-white/[0.06]">
                {results.map((player) => {
                  const taken = takenPids.has(player.pid);
                  return (
                    <li key={player.pid}>
                      <button
                        type="button"
                        disabled={taken}
                        onClick={() => setChosen(player)}
                        className="flex w-full items-center gap-3 py-2.5 text-left disabled:opacity-40"
                      >
                        <span className="relative size-10 shrink-0 overflow-hidden rounded-full bg-emerald-800">
                          <CardPhoto pid={player.pid} name={player.name} />
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium">{player.name}</span>
                        <span className={`shrink-0 text-xs ${mutedClass}`}>
                          {taken ? "이미 스쿼드에 있어요" : `카드 ${player.spids.length}장`}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </>
  );
}
