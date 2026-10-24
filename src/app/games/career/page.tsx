import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CareerGame } from "@/components/games/CareerGame";
import { mutedClass } from "@/components/ui";
import { getCareerSnapshot } from "@/lib/cafe/career-actions";
import { readCareerChallenge } from "@/lib/career/board";

export const metadata: Metadata = {
  title: "레전드 로드 · 유망주에서 발롱도르까지 축구 선수 키우기",
  description: "17세 유망주로 시작해 훈련·이적·국가대표를 고르며 나만의 축구 인생을 만들어요. 로그인 없이 무료 플레이, 은퇴하면 레전드 점수로 오늘의 순위와 베스트 11에 도전!",
  openGraph: { title: "레전드 로드 — 내 선수는 발롱도르를 몇 번 받을까?", description: "시즌마다 고른 길이 축구 인생이 되는 커리어 미니게임. 친구의 레전드 점수를 넘어 보세요." },
};

async function Game({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [params, snapshot] = await Promise.all([searchParams, getCareerSnapshot()]);
  const challenge = readCareerChallenge(typeof params.score === "string" ? params.score : null, typeof params.day === "string" ? params.day : null);
  // 로그아웃하거나 다른 계정으로 바뀌면 화면을 새로 만들어서, 이전 계정의 커리어를 들고 있지 않게 해요.
  return <CareerGame key={snapshot.owner ?? "guest"} initial={snapshot} challenge={challenge} />;
}

export default function CareerPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <div className="break-keep">
      <Link href="/games" prefetch={false} className={`text-xs font-semibold ${mutedClass} hover:underline`}>← 미니게임 라운지</Link>
      <div className="mt-4 mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="sport-eyebrow text-emerald-700 dark:text-emerald-400">LEGEND ROAD</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">레전드 로드</h1>
          <p className={`mt-2 text-sm ${mutedClass}`}>유망주에서 발롱도르까지, 시즌마다 고른 길이 축구 인생이 돼요.</p>
        </div>
        <span className="rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">한 커리어 5~10분 · 자동 저장</span>
      </div>
      <Suspense fallback={<div className="h-[460px] animate-pulse rounded-3xl bg-[#102c26]" aria-busy="true" aria-label="커리어 불러오는 중" />}>
        <Game searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
