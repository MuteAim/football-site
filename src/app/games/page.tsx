import type { Metadata } from "next";
import Link from "next/link";
import { BallIcon, QuizCardIcon, TrophyIcon } from "@/components/Icons";
import { cardClass, mutedClass } from "@/components/ui";

export const metadata: Metadata = { title: "축구 미니게임", description: "유망주를 발롱도르 레전드로 키우는 레전드 로드, 승부차기 러시, 선수 맞히기까지. 경기 기다리는 시간도 즐겁게!" };

export default function GamesPage() {
  return (
    <div className="break-keep">
      <div className="mb-7"><p className="sport-eyebrow text-emerald-700 dark:text-emerald-400">MATCHDAY ARCADE</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">경기 전, 한 판 어때?</h1><p className={`mt-3 text-sm ${mutedClass}`}>선수 인생부터 손끝의 감각, 축구 지식까지. 당신만의 기록을 남겨보세요.</p></div>
      <div className="grid gap-5 md:grid-cols-[1.4fr_1fr]">
        <Link href="/games/career" prefetch={false} className="group relative flex min-h-80 flex-col overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#0d1f19,#1d3a2c)] p-6 text-white transition hover:-translate-y-1 sm:p-8 md:col-span-2">
          <div className="absolute -right-10 -bottom-12 flex size-72 items-center justify-center rounded-full border border-amber-200/10" aria-hidden="true"><div className="absolute size-52 rounded-full border border-amber-200/10" /><TrophyIcon className="size-32 text-amber-200/20 transition group-hover:-rotate-6 group-hover:scale-105" /></div>
          <span className="relative self-start rounded-full bg-amber-300 px-3 py-1 text-[10px] font-black tracking-wider text-amber-950">NEW · 로그인 없이 플레이</span>
          <div className="relative mt-8"><p className="text-xs font-bold tracking-widest text-amber-200/70">LEGEND ROAD</p><h2 className="mt-2 text-3xl font-black sm:text-4xl">레전드 로드</h2><p className="mt-3 max-w-md text-sm leading-relaxed text-white/75">열일곱 살 유망주로 시작해 발롱도르까지.<br />훈련·이적·국가대표, 시즌마다 고른 길이 전설이 돼요.</p></div>
          <span className="relative mt-7 flex items-center gap-3 text-sm font-extrabold text-amber-200">커리어 시작 <span className="transition group-hover:translate-x-1">→</span></span>
        </Link>
        <Link href="/games/penalty" prefetch={false} className="group relative flex min-h-72 flex-col overflow-hidden rounded-3xl bg-[#102c26] p-6 text-white transition hover:-translate-y-1 sm:p-8">
          <div className="absolute -right-8 -bottom-8 flex size-56 items-center justify-center rounded-full border border-white/10" aria-hidden="true"><div className="absolute size-40 rounded-full border border-white/10" /><BallIcon className="size-24 -rotate-12 text-[#d4f77d]/20 transition group-hover:rotate-12" /></div>
          <span className="relative self-start rounded-full bg-[#d4f77d] px-3 py-1 text-[10px] font-black tracking-wider text-[#102c26]">로그인 없이 플레이</span>
          <div className="relative mt-8"><p className="text-xs font-bold tracking-widest text-lime-200/70">PENALTY RUSH</p><h2 className="mt-2 text-3xl font-black">승부차기 러시</h2><p className="mt-3 max-w-60 text-sm leading-relaxed text-white/70">10번의 슛에 모든 걸 걸어봐.<br />연속 골, PERFECT, 오늘의 순위.</p></div>
          <span className="relative mt-7 flex items-center gap-3 text-sm font-extrabold text-[#d4f77d]">바로 킥오프 <span className="transition group-hover:translate-x-1">→</span></span>
        </Link>
        <Link href="/cafe/game" prefetch={false} className={`group flex min-h-72 flex-col p-6 transition hover:-translate-y-1 sm:p-8 ${cardClass}`}>
          <QuizCardIcon className="size-10 text-emerald-600 dark:text-emerald-400" />
          <span className={`mt-6 text-[10px] font-bold tracking-wider ${mutedClass}`}>PLAYER QUIZ · 하루 5문제</span>
          <h2 className="mt-2 text-2xl font-black">선수 맞히기</h2><p className={`mt-3 text-sm leading-relaxed ${mutedClass}`}>사진 한 장이면 충분한 찐팬인가요?<br />선수를 맞히고 연승 골을 모아보세요.</p>
          <span className="mt-7 text-sm font-bold text-emerald-700 dark:text-emerald-300">퀴즈 풀기 →</span>
        </Link>
      </div>
      <p className={`mt-5 text-xs ${mutedClass}`}>레전드 로드와 승부차기 러시 점수는 게임 순위용이며, 선수 맞히기의 골 포인트와는 별개예요.</p>
    </div>
  );
}
