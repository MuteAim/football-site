import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PenaltyGame } from "@/components/games/PenaltyGame";
import { getPenaltySnapshot } from "@/lib/cafe/penalty-actions";
import { readChallenge } from "@/lib/penalty";
import { mutedClass } from "@/components/ui";

export const metadata: Metadata = {
  title: "승부차기 러시 · 10번의 슛으로 겨루는 축구 미니게임",
  description: "타이밍을 맞춰 슛! 연속 골과 PERFECT로 최고 기록에 도전하세요. 로그인 없이 무료 플레이, 오늘의 순위와 친구 도전장까지.",
  openGraph: { title: "승부차기 러시 — 내 기록을 넘을 수 있을까?", description: "10번의 슛, 최대 약 43초. 오늘의 승부사가 되어 보세요." },
};

async function Game({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [params, snapshot] = await Promise.all([searchParams, getPenaltySnapshot()]);
  const challenge = readChallenge(typeof params.score === "string" ? params.score : null, typeof params.day === "string" ? params.day : null);
  return <PenaltyGame initial={snapshot} challenge={challenge} />;
}

export default function PenaltyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <div className="break-keep">
      <Link href="/games" prefetch={false} className={`text-xs font-semibold ${mutedClass} hover:underline`}>← 미니게임 라운지</Link>
      <div className="mt-4 mb-6 flex flex-wrap items-end justify-between gap-3">
        <div><p className="sport-eyebrow text-emerald-700 dark:text-emerald-400">ONE MORE SHOT</p><h1 className="mt-1 text-3xl font-black tracking-tight">승부차기 러시</h1><p className={`mt-2 text-sm ${mutedClass}`}>연속 골을 쌓고, 친구의 기록을 넘어서세요.</p></div>
        <span className="rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">터치 · 스페이스로 플레이</span>
      </div>
      <Suspense fallback={<div className="h-[540px] animate-pulse rounded-3xl bg-[#102c26]" aria-busy="true" aria-label="경기장 준비 중" />}><Game searchParams={searchParams} /></Suspense>
    </div>
  );
}
