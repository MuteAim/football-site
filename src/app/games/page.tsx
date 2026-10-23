import type { Metadata } from "next";
import Link from "next/link";
import { BallIcon, QuizCardIcon } from "@/components/Icons";
import { cardClass, mutedClass } from "@/components/ui";

export const metadata: Metadata = { title: "축구 미니게임", description: "승부차기 실력으로 기록을 겨루고, 선수 맞히기로 축구 지식을 뽐내세요. 경기 기다리는 시간도 즐겁게!" };

export default function GamesPage() {
  return (
    <div className="break-keep">
      <div className="mb-7"><p className="sport-eyebrow text-emerald-700 dark:text-emerald-400">MATCHDAY ARCADE</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">경기 전, 한 판 어때?</h1><p className={`mt-3 text-sm ${mutedClass}`}>손끝의 감각부터 축구 지식까지. 당신만의 기록을 남겨보세요.</p></div>
      <div className="grid gap-5 md:grid-cols-[1.4fr_1fr]">
        <Link href="/games/penalty" prefetch={false} className="group relative flex min-h-80 flex-col overflow-hidden rounded-3xl bg-[#102c26] p-6 text-white transition hover:-translate-y-1 sm:p-8">
          <div className="absolute -right-8 -bottom-8 flex size-64 items-center justify-center rounded-full border border-white/10" aria-hidden="true"><div className="absolute size-44 rounded-full border border-white/10" /><BallIcon className="size-28 -rotate-12 text-[#d4f77d]/20 transition group-hover:rotate-12" /></div>
          <span className="relative self-start rounded-full bg-[#d4f77d] px-3 py-1 text-[10px] font-black tracking-wider text-[#102c26]">NEW · 로그인 없이 플레이</span>
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
      <p className={`mt-5 text-xs ${mutedClass}`}>승부차기 점수는 게임 순위용이며, 선수 맞히기의 골 포인트와는 별개예요.</p>
    </div>
  );
}
