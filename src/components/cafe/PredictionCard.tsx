"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { savePrediction } from "@/lib/cafe/actions";
import { PREDICTION_PICKS } from "@/lib/cafe/config";
import type { PredictionCounts, PredictionPick } from "@/lib/cafe/types";
import { Crest } from "../Crest";
import { CheckIcon, TrophyIcon } from "../Icons";
import { cardClass, cardHeadingClass, errorTextClass, mutedClass, primaryButtonClass } from "../ui";
import { LoginLink } from "./LoginLink";

type TeamInfo = { name: string; crest: string | null };

// 응원톡의 홈(하늘색)·원정(빨간색)과 같은 색을 써요.
const PICK_STYLE: Record<PredictionPick, { bar: string; ring: string; text: string }> = {
  home: { bar: "bg-sky-500", ring: "ring-sky-500 bg-sky-500/10", text: "text-sky-700 dark:text-sky-300" },
  draw: { bar: "bg-zinc-400 dark:bg-zinc-500", ring: "ring-zinc-400 bg-zinc-500/10", text: "text-zinc-600 dark:text-zinc-300" },
  away: { bar: "bg-rose-500", ring: "ring-rose-500 bg-rose-500/10", text: "text-rose-700 dark:text-rose-300" },
};

/** 누른 순간 킥오프가 지났는지. 화면을 그릴 때가 아니라 버튼을 누를 때만 불러요. */
function hasKickedOff(kickoff: string): boolean {
  return Date.now() >= Date.parse(kickoff);
}

function percents(counts: PredictionCounts): Record<PredictionPick, number> {
  const total = counts.home + counts.draw + counts.away;
  if (total === 0) return { home: 0, draw: 0, away: 0 };
  // 셋을 따로 반올림하면 합이 100이 안 될 수 있어서 무승부를 나머지로 맞춰요.
  const home = Math.round((counts.home / total) * 100);
  const away = Math.round((counts.away / total) * 100);
  return { home, away, draw: Math.max(0, 100 - home - away) };
}

/**
 * 경기 화면의 승부 예측. 킥오프 전까지 홈 승·무승부·원정 승 중 하나를 고르고 바꿀 수 있어요.
 * 고르기 전에는 다른 사람의 예측 비율을 숨겨서 따라 고르지 않게 해요.
 */
export function PredictionCard({
  matchId,
  date,
  kickoff,
  home,
  away,
  open,
  closedNote,
  result,
  initialPick,
  initialCounts,
  viewer,
  path,
}: {
  matchId: number;
  date: string;
  kickoff: string;
  home: TeamInfo;
  away: TeamInfo;
  open: boolean;
  /** 마감된 이유. 연기·취소된 경기 등 */
  closedNote: string | null;
  result: PredictionPick | null;
  initialPick: PredictionPick | null;
  initialCounts: PredictionCounts;
  viewer: "guest" | "join" | "member";
  /** 로그인이나 가입 뒤 돌아올 이 화면 주소 */
  path: string;
}) {
  const [pick, setPick] = useState(initialPick);
  const [counts, setCounts] = useState(initialCounts);
  const [closed, setClosed] = useState(!open);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const total = counts.home + counts.draw + counts.away;
  const showShares = pick !== null || closed;
  const share = percents(counts);
  const labels: Record<PredictionPick, string> = { home: `${home.name} 승`, draw: "무승부", away: `${away.name} 승` };

  function choose(next: PredictionPick) {
    if (viewer !== "member" || closed || saving) return;
    // 화면을 켜 둔 사이 킥오프가 지났으면 서버에 묻지 않고 바로 마감해요.
    if (hasKickedOff(kickoff)) {
      setClosed(true);
      setError("킥오프가 지나서 예측이 마감됐어요.");
      return;
    }
    setError(null);
    startSaving(async () => {
      const saved = await savePrediction({ matchId, date, pick: next });
      if ("error" in saved) {
        setError(saved.error);
        if (saved.error.includes("마감")) setClosed(true);
        return;
      }
      setPick(saved.pick);
      setCounts(saved.counts);
    });
  }

  let note: string;
  if (result) {
    note = pick === null ? "예측하지 않은 경기예요." : pick === result ? "예측 적중! 순위에 반영돼요." : "아쉽게 빗나갔어요.";
  } else if (closed) {
    note = closedNote ?? "예측이 마감됐어요. 경기가 끝나면 결과가 나와요.";
  } else if (pick === null) {
    note = "고르면 다른 회원들의 예측 비율이 보여요. 킥오프 전까지 바꿀 수 있어요.";
  } else {
    note = "킥오프 전까지 바꿀 수 있어요. 연장까지의 결과로 채점하고, 승부차기는 무승부로 쳐요.";
  }

  return (
    <section className={`${cardClass} mt-3`}>
      <h2 className={cardHeadingClass}>
        승부 예측
        <span className={`ml-auto text-xs font-normal ${mutedClass}`}>{total}명 참여</span>
      </h2>

      <div role="group" aria-label="승부 예측" className="grid grid-cols-3 gap-2 px-4 pt-3">
        {PREDICTION_PICKS.map((option) => {
          const mine = pick === option;
          const won = result === option;
          const team = option === "home" ? home : option === "away" ? away : null;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={mine}
              disabled={viewer !== "member" || closed || saving}
              onClick={() => choose(option)}
              className={`relative flex min-w-0 flex-col items-center gap-1.5 rounded-xl px-1.5 pt-3 pb-2.5 text-center ring-1 transition enabled:active:scale-95 disabled:cursor-default ${
                mine ? PICK_STYLE[option].ring : "ring-zinc-950/10 enabled:hover:bg-zinc-50 dark:ring-white/10 dark:enabled:hover:bg-white/[0.04]"
              }`}
            >
              {won ? (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 px-1.5 py-px text-[10px] font-bold text-white">
                  결과
                </span>
              ) : null}
              <span className="flex size-9 items-center justify-center rounded-full bg-white ring-1 ring-zinc-950/5 dark:ring-white/10">
                {team ? (
                  <Crest src={team.crest} size={24} />
                ) : (
                  <span className="text-base font-bold text-zinc-400" aria-hidden>
                    =
                  </span>
                )}
              </span>
              <span className={`w-full truncate text-[13px] font-semibold ${mine ? PICK_STYLE[option].text : ""}`}>
                {labels[option]}
              </span>
              <span className={`flex h-4 items-center gap-0.5 text-xs tabular-nums ${mutedClass}`}>
                {mine ? <CheckIcon className="size-3.5" /> : null}
                {showShares ? `${share[option]}%` : mine ? "내 예측" : ""}
              </span>
            </button>
          );
        })}
      </div>

      <div className="px-4 pt-3 pb-4">
        {showShares && total > 0 ? (
          <div
            role="img"
            aria-label={PREDICTION_PICKS.map((option) => `${labels[option]} ${share[option]}%`).join(", ")}
            className="mb-3 flex h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-white/10"
          >
            {PREDICTION_PICKS.map((option) => (
              <div
                key={option}
                className={`${PICK_STYLE[option].bar} transition-[width] duration-500`}
                style={{ width: `${share[option]}%` }}
              />
            ))}
          </div>
        ) : null}

        {error ? (
          <p role="alert" className={errorTextClass}>
            {error}
          </p>
        ) : (
          <p className={`text-sm ${result && pick === result ? "font-semibold text-emerald-700 dark:text-emerald-400" : mutedClass}`}>
            {note}
          </p>
        )}

        <div className="mt-3 flex items-center justify-between gap-3">
          <Link
            href="/cafe/predict"
            className="inline-flex items-center gap-1 text-sm font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
          >
            <TrophyIcon className="size-4" />
            예측 순위 보기
          </Link>
          {viewer === "guest" && !closed ? (
            <LoginLink next={path} className={primaryButtonClass}>
              로그인하고 예측하기
            </LoginLink>
          ) : viewer === "join" && !closed ? (
            <Link href={`/cafe/me?next=${encodeURIComponent(path)}`} className={primaryButtonClass}>
              닉네임 정하기
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
