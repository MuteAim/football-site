"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { answerQuiz, startQuiz } from "@/lib/cafe/actions";
import { QUIZ, quizPrize } from "@/lib/cafe/config";
import type { QuizResult, QuizRound, QuizStatus } from "@/lib/cafe/types";
import { CheckIcon } from "../Icons";
import { cardClass, errorTextClass, mutedClass, primaryButtonClass, secondaryButtonClass } from "../ui";

/** 문제 사진. 문제 번호로 서버에 받아 와서, 다 받기 전까지는 회색 칸이에요. */
function RoundPhoto({ round }: { round: QuizRound }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[260px] overflow-hidden rounded-2xl bg-linear-to-b from-emerald-900 to-emerald-950 ring-1 ring-emerald-950/10 dark:from-zinc-800 dark:to-zinc-900 dark:ring-white/10">
      {loaded ? null : <div className="absolute inset-0 animate-pulse bg-white/10" aria-label="사진 불러오는 중" />}
      <Image
        key={round.id}
        src={`/cafe/game/photo?round=${round.id}`}
        alt="누구일까요? 이 선수의 사진이에요."
        fill
        sizes="260px"
        unoptimized
        onLoad={() => setLoaded(true)}
        className={`object-contain object-bottom transition-opacity ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}

/** 오늘 푼 문제 수, 연승, 다음 정답으로 받을 골. 문제 카드 맨 위에 보여요. */
function StatusBar({ status }: { status: QuizStatus }) {
  const stats = [
    { label: "오늘", value: `${status.played}/${QUIZ.daily}` },
    { label: "연승", value: `${status.streak}` },
    { label: "오늘 받은 골", value: `${status.earned}` },
    { label: "다음 정답", value: `+${quizPrize(status.streak)}골` },
  ];
  return (
    <dl className="grid grid-cols-4 divide-x divide-zinc-100 text-center dark:divide-white/[0.06]">
      {stats.map((stat) => (
        <div key={stat.label} className="px-1 py-3">
          <dt className={`text-[11px] ${mutedClass}`}>{stat.label}</dt>
          <dd className="text-base font-bold tracking-tight tabular-nums">{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * 선수 맞히기 게임판. 사진을 보고 보기 4개 중 하나를 고르면 서버가 채점해서 결과와 받은 골을 알려 줘요.
 * 처음 상태(initial)는 서버가 읽어 주고, 그 뒤로는 서버 동작의 결과로 화면을 바꿔요.
 */
export function PlayerQuiz({ initial }: { initial: QuizStatus }) {
  const [status, setStatus] = useState(initial);
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startAction] = useTransition();

  const round = status.round;
  const remaining = QUIZ.daily - status.played;
  const answered = result !== null;

  function next() {
    setError(null);
    startAction(async () => {
      const got = await startQuiz();
      if ("error" in got) {
        setError(got.error);
        return;
      }
      setStatus(got);
      setPicked(null);
      setResult(null);
    });
  }

  function answer(choice: number) {
    if (!round || answered || pending) return;
    setError(null);
    setPicked(choice);
    startAction(async () => {
      const got = await answerQuiz(round.id, choice);
      if ("error" in got) {
        setError(got.error);
        setPicked(null);
        return;
      }
      setResult(got);
      setStatus((prev) => ({ ...prev, streak: got.streak, played: got.played, earned: got.earned }));
    });
  }

  return (
    <section className={cardClass} aria-busy={pending}>
      <StatusBar status={status} />
      <div className="border-t border-zinc-100 p-4 dark:border-white/[0.07]">
        {round ? (
          <>
            <RoundPhoto round={round} />
            <p className="mt-4 text-center text-sm font-semibold">이 선수는 누구일까요?</p>
            <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {round.choices.map((name, index) => {
                const number = index + 1;
                const isAnswer = answered && name === result.answer;
                const isWrongPick = answered && picked === number && !result.correct;
                return (
                  <li key={number}>
                    <button
                      type="button"
                      disabled={answered || pending}
                      aria-pressed={picked === number}
                      onClick={() => answer(number)}
                      className={`flex h-12 w-full items-center gap-2 rounded-xl px-3.5 text-left text-[15px] font-semibold ring-1 transition active:scale-[0.98] disabled:pointer-events-none ${
                        isAnswer
                          ? "bg-emerald-600 text-white ring-emerald-600 dark:bg-emerald-500 dark:text-zinc-950 dark:ring-emerald-500"
                          : isWrongPick
                            ? "bg-rose-500/10 text-rose-700 ring-rose-500/40 dark:text-rose-300"
                            : answered
                              ? "text-zinc-400 ring-zinc-950/5 dark:text-zinc-500 dark:ring-white/5"
                              : picked === number
                                ? "bg-emerald-500/10 ring-emerald-500"
                                : "bg-white ring-zinc-950/10 hover:bg-emerald-500/5 hover:ring-emerald-500/50 dark:bg-white/[0.04] dark:ring-white/10 dark:hover:bg-white/[0.08]"
                      }`}
                    >
                      <span
                        className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${
                          isAnswer ? "bg-white/20" : "bg-zinc-100 text-zinc-500 dark:bg-white/10 dark:text-zinc-300"
                        }`}
                      >
                        {isAnswer ? <CheckIcon className="size-3.5" /> : number}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {answered ? (
              <div
                role="status"
                className={`mt-4 rounded-xl px-4 py-3 text-center ${
                  result.correct ? "bg-emerald-500/10" : "bg-rose-500/10"
                }`}
              >
                <p className="font-bold">
                  {result.correct
                    ? `정답이에요! +${result.prize}골${result.streak > 1 ? ` · ${result.streak}연승` : ""}`
                    : "아쉬워요. 연승이 끊겼어요."}
                </p>
                <p className={`mt-0.5 text-sm ${mutedClass}`}>
                  {result.correct
                    ? result.streak >= QUIZ.maxStreak
                      ? `최대 연승 보너스예요. 정답마다 ${QUIZ.maxStreak}골을 받아요.`
                      : `다음 정답은 +${quizPrize(result.streak)}골이에요.`
                    : `정답은 ${result.answer}예요. 다음 정답은 +1골부터 다시 시작해요.`}
                </p>
                <div className="mt-3">
                  {remaining > 0 ? (
                    <button type="button" disabled={pending} onClick={next} className={`w-full ${primaryButtonClass}`}>
                      {pending ? "문제 내는 중…" : `다음 문제 (${remaining}문제 남음)`}
                    </button>
                  ) : (
                    <p className="text-sm font-semibold">오늘 문제를 다 풀었어요. 내일 또 만나요!</p>
                  )}
                </div>
              </div>
            ) : null}
          </>
        ) : remaining > 0 ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="font-semibold">
              {status.played === 0 ? "오늘의 선수 맞히기를 시작해 볼까요?" : `오늘 ${remaining}문제 더 풀 수 있어요.`}
            </p>
            <p className={`text-sm ${mutedClass}`}>
              {status.streak > 0
                ? `${status.streak}연승 중이에요. 다음 정답은 +${quizPrize(status.streak)}골!`
                : "정답마다 1골, 연승할수록 1골씩 더 받아요."}
            </p>
            <button type="button" disabled={pending} onClick={next} className={`mt-1 ${primaryButtonClass}`}>
              {pending ? "문제 내는 중…" : status.played === 0 ? "첫 문제 받기" : "다음 문제 받기"}
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <p className="font-semibold">오늘 문제를 다 풀었어요.</p>
            <p className={`text-sm ${mutedClass}`}>
              오늘 {status.earned}골을 받았어요.{" "}
              {status.streak > 0 ? `${status.streak}연승은 내일도 이어져요.` : "내일 다시 도전해 보세요."}
            </p>
          </div>
        )}
        {error ? (
          <div className="mt-3 flex flex-col items-center gap-2 text-center">
            <p role="alert" className={errorTextClass}>
              {error}
            </p>
            {!round ? null : (
              <button type="button" disabled={pending} onClick={next} className={secondaryButtonClass}>
                문제 다시 받기
              </button>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
