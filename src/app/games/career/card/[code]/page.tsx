import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ShareLinkButton } from "@/components/cafe/ShareLinkButton";
import { ClubTable, HonorList } from "@/components/games/CareerArchive";
import { OvrChart, ScoreBreakdown } from "@/components/games/CareerParts";
import { cardClass, mutedClass, textButtonClass } from "@/components/ui";
import { getCareerCard } from "@/lib/cafe/career-cards";
import { careerDay } from "@/lib/career/board";
import { cardLastClub, cardPlayerLine } from "@/lib/career/card";
import { NATIONS } from "@/lib/career/data";

type Params = Promise<{ code: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const shared = await getCareerCard((await params).code);
  if (!shared) return { title: "카드를 찾을 수 없어요 · 레전드 로드" };
  const { card } = shared;
  const title = `${card.name}「${card.title}」 · 레전드 로드`;
  const description = `레전드 점수 ${card.score.toLocaleString("ko-KR")}점 · ${card.grade}. ${card.totals.seasons}시즌 ${card.totals.apps}경기 ${card.totals.goals}골 · 발롱도르 ${card.totals.ballonDor}회. ${shared.nickname} 님의 선수를 넘어 보세요!`;
  return { title, description, openGraph: { title, description }, robots: { index: false } };
}

/** 공유 카드 화면. 서버가 다시 계산한 은퇴 기록이라 누구나 그대로 믿고 봐요. */
async function CardContent({ params }: { params: Params }) {
  const { code } = await params;
  const shared = await getCareerCard(code);
  if (!shared) notFound();
  const { card, nickname, createdAt } = shared;
  const t = card.totals;
  const keeper = card.pos === "GK";
  const stats: [string, number][] = [
    ["시즌", t.seasons], ["경기", t.apps], keeper ? ["무실점", t.cleanSheets] : ["골", t.goals], ["도움", t.assists],
    ["A매치", t.caps], ["최고 OVR", t.peakOvr], ["발롱도르", t.ballonDor], ["트로피", t.trophies],
  ];
  const challenge = `/games/career?score=${card.score}&day=${careerDay(new Date(createdAt))}`;
  return (
    <>
      <article className="overflow-hidden rounded-3xl bg-[#102c26] text-white">
        <div className="px-5 pt-7 pb-6 text-center sm:px-8">
          <p className="text-xs font-bold tracking-widest text-amber-200/80">LEGEND CARD · {t.firstYear}–{t.lastYear} · {t.retiredAge}세 은퇴</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{card.name}</h1>
          <p className="mt-1 text-xs text-white/65">{cardPlayerLine(card)} · {NATIONS[card.nation as keyof typeof NATIONS]?.name ?? card.nation} · 마지막 소속 {cardLastClub(card)}</p>
          <p className="mt-4 inline-flex rounded-full bg-amber-300/15 px-4 py-1.5 text-sm font-extrabold text-amber-200">「{card.title}」</p>
          <p className="mt-5 text-[11px] font-bold tracking-widest text-lime-200/70">LEGEND SCORE</p>
          <p className="mt-1 text-6xl font-black tracking-tighter text-[#d4f77d] tabular-nums">{card.score.toLocaleString("ko-KR")}<span className="ml-2 text-lg tracking-normal">점</span></p>
          <p className="mt-2 text-sm font-bold">{card.grade}</p>
          <p className="mt-3 text-xs text-white/60">{nickname} 님의 선수 · 서버가 다시 계산해 확인한 기록</p>
        </div>
        <dl className="mx-5 grid grid-cols-4 gap-y-4 rounded-2xl bg-white/[0.05] py-4 text-center sm:mx-8">
          {stats.map(([label, value]) => (
            <div key={label}><dt className="text-[10px] text-white/55">{label}</dt><dd className={`mt-0.5 text-lg font-extrabold tabular-nums ${label === "발롱도르" && value ? "text-amber-300" : ""}`}>{value.toLocaleString("ko-KR")}</dd></div>
          ))}
        </dl>
        <div className="space-y-5 px-5 py-6 text-sm sm:px-8">
          <div>
            <h2 className="text-xs font-bold text-white/60">레전드 점수는 이렇게 모였어요</h2>
            <div className="mt-2"><ScoreBreakdown parts={card.breakdown} /></div>
          </div>
          {card.curve.length >= 2 ? (
            <div>
              <h2 className="text-xs font-bold text-white/60">커리어 곡선 · 시즌이 끝날 때의 오버롤</h2>
              <div className="mt-2"><OvrChart history={card.curve} dark /></div>
            </div>
          ) : null}
          <div>
            <h2 className="text-xs font-bold text-white/60">평생의 라이벌 · {card.rival.name}</h2>
            <p className={`mt-1 font-extrabold ${card.rival.beat ? "text-[#d4f77d]" : "text-white/85"}`}>
              {card.rival.beat ? "라이벌을 넘어선 커리어" : "라이벌이 한 발 앞선 커리어"} · 맞대결 {card.rival.won}승 {card.rival.drawn}무 {card.rival.lost}패
            </p>
          </div>
          <div>
            <h2 className="text-xs font-bold text-white/60">커리어 발자취</h2>
            <p className="mt-1 leading-relaxed">{card.clubs.map((club) => club.name).join(" → ")}</p>
          </div>
        </div>
      </article>

      <div className="mt-4 rounded-3xl bg-[#d4f77d] p-5 text-[#102c26] sm:flex sm:items-center sm:justify-between sm:gap-4">
        <div>
          <p className="text-lg font-black">이 선수를 넘을 수 있을까?</p>
          <p className="mt-1 text-sm opacity-75">17세 유망주로 시작해 나만의 축구 인생을 만들어 보세요. 로그인 없이 무료!</p>
        </div>
        <Link href={challenge} prefetch={false} className="mt-3 flex h-12 shrink-0 items-center justify-center rounded-xl bg-[#102c26] px-6 text-sm font-black text-[#d4f77d] sm:mt-0">레전드 로드 도전하기 →</Link>
      </div>

      <section className={`${cardClass} mt-4 p-5`}>
        <h2 className="font-extrabold">팀별 기록</h2>
        <p className={`mt-1 text-[11px] ${mutedClass}`}>임대·군 복무는 실제 뛴 팀 기준이며, 같은 팀에 복귀한 시즌은 합산해요.</p>
        <ClubTable name={card.name} clubs={card.clubs} />
        <h2 className="mt-6 font-extrabold">수상·우승 내역</h2>
        <p className={`mt-1 text-xs ${mutedClass}`}>발롱도르 {t.ballonDor}회 · 개인 수상 {t.awards}회 · 트로피 {t.trophies}개</p>
        <HonorList honors={card.honors} />
        <div className="mt-5 flex justify-end gap-1 border-t border-zinc-100 pt-2 dark:border-white/[0.07]">
          <ShareLinkButton />
          <a href={`/games/career/card/${code}/opengraph-image`} download={`legend-road-${card.name}.png`} className={textButtonClass}>이미지 저장</a>
        </div>
      </section>
    </>
  );
}

export default function CareerCardPage({ params }: { params: Params }) {
  return (
    <div className="mx-auto max-w-2xl break-keep">
      <Link href="/games/career" prefetch={false} className={`text-xs font-semibold ${mutedClass} hover:underline`}>← 레전드 로드</Link>
      <div className="mt-4">
        <Suspense fallback={<div className="h-[560px] animate-pulse rounded-3xl bg-[#102c26]" aria-busy="true" aria-label="카드 불러오는 중" />}>
          <CardContent params={params} />
        </Suspense>
      </div>
    </div>
  );
}
