"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useRef, useState, useTransition, type FormEvent } from "react";
import { deleteTalk, sendTalk } from "@/lib/cafe/actions";
import { LIMITS } from "@/lib/cafe/config";
import { PROFILE_COLUMNS, type RawProfile, toAuthor } from "@/lib/cafe/profile";
import { nameColorClass } from "@/lib/cafe/shop";
import { getBrowserClient } from "@/lib/cafe/supabase-browser";
import type { Author, Talk, TalkSide } from "@/lib/cafe/types";
import { formatKickoff } from "@/lib/time";
import { Crest } from "../Crest";
import { SendIcon } from "../Icons";
import { confirmDialog } from "../feedback";
import {
  cardClass,
  cardHeadingClass,
  errorTextClass,
  inputClass,
  primaryButtonClass,
  textButtonClass,
} from "../ui";
import { Avatar, LevelBadge, RoleBadge } from "./Avatar";
import { LoginLink } from "./LoginLink";

// 화면에 들고 있는 응원톡 최대 개수. 오래된 것부터 지워서 오래 켜 둬도 느려지지 않아요.
const MAX_TALKS = 300;

type TeamInfo = { name: string; crest: string | null };

type TalkRow = {
  id: number;
  match_id: number;
  user_id: string;
  side: TalkSide | null;
  body: string;
  created_at: string;
};

const SIDE_STYLE: Record<TalkSide, { bar: string; text: string; ring: string }> = {
  home: { bar: "bg-sky-500", text: "text-sky-700 dark:text-sky-300", ring: "ring-sky-500 bg-sky-500/10" },
  away: { bar: "bg-rose-500", text: "text-rose-700 dark:text-rose-300", ring: "ring-rose-500 bg-rose-500/10" },
};

/** 응원 게이지. 홈팀과 원정팀을 응원한 메시지 수를 막대로 보여 줘요. */
function CheerGauge({ home, away, counts }: { home: TeamInfo; away: TeamInfo; counts: Record<TalkSide, number> }) {
  const total = counts.home + counts.away;
  const homePercent = total === 0 ? 50 : Math.round((counts.home / total) * 100);

  return (
    <div className="px-4 pt-3 pb-1">
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className={`truncate ${SIDE_STYLE.home.text}`}>
          {home.name} {total > 0 ? `${homePercent}%` : ""}
        </span>
        <span className={`truncate ${SIDE_STYLE.away.text}`}>
          {total > 0 ? `${100 - homePercent}%` : ""} {away.name}
        </span>
      </div>
      <div
        className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-white/10"
        role="img"
        aria-label={total > 0 ? `${home.name} ${homePercent}%, ${away.name} ${100 - homePercent}%` : "아직 응원이 없어요"}
      >
        {total > 0 ? (
          <>
            <div className={`${SIDE_STYLE.home.bar} transition-[width] duration-500`} style={{ width: `${homePercent}%` }} />
            <div className={`${SIDE_STYLE.away.bar} flex-1`} />
          </>
        ) : null}
      </div>
    </div>
  );
}

/**
 * 경기별 응원톡. 처음 메시지는 서버가 넣어 주고, 그 뒤 새 메시지는 Supabase 실시간 전송으로 받아요.
 * 메시지를 보낼 때 응원할 팀을 고르면 게이지에 반영돼요.
 */
export function TalkRoom({
  matchId,
  home,
  away,
  initialTalks,
  initialAuthors,
  initialCounts,
  viewer,
  joinHref,
}: {
  matchId: number;
  home: TeamInfo;
  away: TeamInfo;
  initialTalks: Talk[];
  initialAuthors: Author[];
  initialCounts: Record<TalkSide, number>;
  /** staff는 매니저나 운영자, locked는 글쓰기 잠금에 걸렸을 때 입력칸 대신 보여 줄 안내예요. */
  viewer: { id: string; joined: boolean; staff: boolean; locked: string | null } | null;
  /** 닉네임을 아직 안 정한 사람을 보낼 주소 */
  joinHref: string;
}) {
  const [talks, setTalks] = useState(initialTalks);
  const [authors, setAuthors] = useState<Record<string, Author>>(() =>
    Object.fromEntries(initialAuthors.map((author) => [author.id, author])),
  );
  const [counts, setCounts] = useState(initialCounts);
  const [live, setLive] = useState(false);
  const [side, setSide] = useState<TalkSide | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, startSending] = useTransition();

  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const seen = useRef(new Set(initialTalks.map((talk) => talk.id)));
  const lastId = useRef(initialTalks.at(-1)?.id ?? 0);
  const requestedAuthors = useRef(new Set(initialAuthors.map((author) => author.id)));

  /** 처음 보는 회원이 말하면 닉네임을 한 번만 물어봐요. */
  function loadAuthor(userId: string) {
    if (requestedAuthors.current.has(userId)) return;
    requestedAuthors.current.add(userId);
    void getBrowserClient()
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .eq("id", userId)
      .maybeSingle<RawProfile>()
      .then(({ data }) => {
        if (!data) return;
        setAuthors((prev) => ({ ...prev, [data.id]: toAuthor(data) }));
      });
  }

  function addTalk(talk: Talk) {
    if (seen.current.has(talk.id)) return;
    seen.current.add(talk.id);
    lastId.current = Math.max(lastId.current, talk.id);
    setTalks((prev) => [...prev, talk].slice(-MAX_TALKS));
    const talkSide = talk.side;
    if (talkSide) setCounts((prev) => ({ ...prev, [talkSide]: prev[talkSide] + 1 }));
    loadAuthor(talk.userId);
  }

  const onInsert = useEffectEvent((row: TalkRow) => {
    addTalk({ id: row.id, userId: row.user_id, side: row.side, body: row.body, createdAt: row.created_at });
  });
  const onDelete = useEffectEvent((id: number) => {
    setTalks((prev) => prev.filter((talk) => talk.id !== id));
  });

  // 실시간 연결이 될 때마다, 연결이 없던 동안 올라온 응원톡을 한 번에 받아 와요.
  // 화면을 처음 연 직후나, 다른 화면에 갔다가 돌아와 다시 연결될 때 빠진 메시지를 채워요.
  const catchUp = useEffectEvent(async () => {
    const { data } = await getBrowserClient()
      .from("match_talks")
      .select("id, match_id, user_id, side, body, created_at")
      .eq("match_id", matchId)
      .gt("id", lastId.current)
      .order("id", { ascending: true })
      .limit(MAX_TALKS);
    for (const row of (data ?? []) as TalkRow[]) onInsert(row);
  });

  // 이 경기의 새 응원톡과 지워진 응원톡을 실시간으로 받아요.
  // 지운 소식에는 경기 번호가 안 실려 와서 전체를 받고, 화면에 있는 것만 지워요.
  // 다른 화면으로 가면 Next.js가 이 화면을 숨기면서 연결도 끊어요.
  useEffect(() => {
    const supabase = getBrowserClient();
    const channel = supabase
      .channel(`match-talks:${matchId}`)
      .on<TalkRow>(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "match_talks", filter: `match_id=eq.${matchId}` },
        (payload) => onInsert(payload.new),
      )
      .on<TalkRow>("postgres_changes", { event: "DELETE", schema: "public", table: "match_talks" }, (payload) => {
        if (typeof payload.old.id === "number") onDelete(payload.old.id);
      })
      .subscribe((status) => {
        setLive(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED") void catchUp();
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [matchId]);

  // 맨 아래를 보고 있을 때만 새 메시지를 따라 내려가요. 위로 올려 읽는 중이면 그대로 둬요.
  useEffect(() => {
    const list = listRef.current;
    if (list && stickToBottom.current) list.scrollTop = list.scrollHeight;
  }, [talks]);

  function onScroll() {
    const list = listRef.current;
    if (!list) return;
    stickToBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 48;
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setError(null);
    startSending(async () => {
      const result = await sendTalk({ matchId, side, body });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      stickToBottom.current = true;
      addTalk(result.talk);
      setDraft("");
    });
  }

  async function remove(id: number) {
    if (!(await confirmDialog({ title: "이 응원톡을 지울까요?", confirmLabel: "지우기", tone: "danger" }))) return;
    startSending(async () => {
      if (await deleteTalk(id)) setTalks((prev) => prev.filter((talk) => talk.id !== id));
    });
  }

  const teams: Record<TalkSide, TeamInfo> = { home, away };

  return (
    <section className={`${cardClass} mt-3`}>
      <h2 className={cardHeadingClass}>
        응원톡
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            live
              ? "bg-red-500/10 text-red-600 dark:text-red-400"
              : "bg-zinc-500/10 text-zinc-500 dark:text-zinc-400"
          }`}
        >
          <span className={`size-1.5 rounded-full ${live ? "bg-red-500" : "bg-zinc-400"}`} />
          {live ? "실시간" : "연결 중"}
        </span>
        <span className="ml-auto text-xs font-normal text-zinc-400 dark:text-zinc-500">
          {talks.length > 0 ? `최근 ${talks.length}개` : null}
        </span>
      </h2>

      <CheerGauge home={home} away={away} counts={counts} />

      <div
        ref={listRef}
        onScroll={onScroll}
        aria-live="polite"
        className="h-[min(55vh,480px)] space-y-3 overflow-y-auto px-4 py-3"
      >
        {talks.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
            첫 응원을 남겨 보세요!
          </p>
        ) : (
          talks.map((talk) => {
            const author = authors[talk.userId];
            const nickname = author?.nickname ?? "회원";
            const mine = viewer?.id === talk.userId;
            return (
              <div key={talk.id} className="group flex gap-2.5">
                <Avatar id={talk.userId} nickname={nickname} team={author?.team} frame={author?.frame} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
                    {/* 산 닉네임 색이 있으면 그 색을, 없으면 내 메시지만 초록으로 보여 줘요. */}
                    <span
                      className={`truncate font-semibold ${
                        nameColorClass(author?.nameColor) || (mine ? "text-emerald-700 dark:text-emerald-400" : "")
                      }`}
                    >
                      {nickname}
                    </span>
                    {author ? <LevelBadge goals={author.goals} /> : null}
                    <RoleBadge author={author} />
                    {talk.side ? (
                      <span className={`inline-flex shrink-0 items-center gap-1 font-medium ${SIDE_STYLE[talk.side].text}`}>
                        <Crest src={teams[talk.side].crest} size={14} />
                        응원
                      </span>
                    ) : null}
                    <span className="shrink-0 text-zinc-400 tabular-nums dark:text-zinc-500">
                      {formatKickoff(talk.createdAt)}
                    </span>
                    {mine || viewer?.staff ? (
                      <button
                        type="button"
                        onClick={() => void remove(talk.id)}
                        className={`ml-auto opacity-0 group-hover:opacity-100 focus:opacity-100 max-sm:opacity-100 ${textButtonClass}`}
                      >
                        삭제
                      </button>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-[15px] break-words whitespace-pre-wrap">{talk.body}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-zinc-100 px-4 pt-3 pb-4 dark:border-white/[0.07]">
        {viewer?.joined && viewer.locked ? (
          <p className="text-sm break-keep text-zinc-500 dark:text-zinc-400">{viewer.locked}</p>
        ) : viewer?.joined ? (
          <form onSubmit={onSubmit} className="space-y-2">
            <div className="flex gap-1.5" role="group" aria-label="응원할 팀">
              {(["home", "away"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={side === key}
                  onClick={() => setSide((current) => (current === key ? null : key))}
                  className={`flex h-8 min-w-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ring-1 transition active:scale-95 ${
                    side === key
                      ? `${SIDE_STYLE[key].ring} ${SIDE_STYLE[key].text}`
                      : "text-zinc-600 ring-zinc-950/10 hover:bg-zinc-950/5 dark:text-zinc-300 dark:ring-white/10 dark:hover:bg-white/10"
                  }`}
                >
                  <Crest src={teams[key].crest} size={16} />
                  <span className="truncate">{teams[key].name} 응원</span>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={LIMITS.talk}
                placeholder={side ? `${teams[side].name} 응원 한마디!` : "응원 한마디!"}
                aria-label="응원톡"
                className={inputClass}
              />
              <button
                type="submit"
                disabled={sending || draft.trim() === ""}
                aria-label="보내기"
                className="flex size-[42px] shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700 active:scale-95 disabled:opacity-40"
              >
                <SendIcon className="size-5" />
              </button>
            </div>
            {error ? (
              <p role="alert" className={errorTextClass}>
                {error}
              </p>
            ) : null}
          </form>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {viewer ? "닉네임을 정하면 응원톡에 참여할 수 있어요." : "로그인하면 응원톡에 참여할 수 있어요."}
            </p>
            {viewer ? (
              <Link href={joinHref} className={primaryButtonClass}>
                닉네임 정하기
              </Link>
            ) : (
              <LoginLink className={primaryButtonClass}>로그인</LoginLink>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
