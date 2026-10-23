import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { MemberRequired } from "@/components/cafe/CafeNotices";
import { PlayerQuiz } from "@/components/cafe/PlayerQuiz";
import { NexonCredit } from "@/components/cafe/SquadPitch";
import { cardClass, cardHeadingClass, mutedClass, skeletonClass } from "@/components/ui";
import { QUIZ } from "@/lib/cafe/config";
import { getMyQuiz } from "@/lib/cafe/quiz";
import { isSettlementConfigured } from "@/lib/cafe/supabase-admin";
import { getViewer } from "@/lib/cafe/viewer";

export const metadata: Metadata = { title: "선수 맞히기" };

/** 회원마다 문제와 연승이 달라서 요청 때마다 그려요. */
async function Quiz() {
  await connection();
  const viewer = await getViewer();
  if (!viewer?.profile) {
    return (
      <MemberRequired viewer={viewer} next="/cafe/game">
        회원이 되면 선수 맞히기로 골을 모을 수 있어요.
      </MemberRequired>
    );
  }
  // 사진은 서버의 비밀 키로 정답 선수를 읽어 와야 보여 줄 수 있어요.
  if (!isSettlementConfigured()) {
    return (
      <div className={`${cardClass} px-5 py-10 text-center`}>
        <p className="font-semibold">아직 문제를 낼 수 없어요.</p>
        <p className={`mt-1 text-sm ${mutedClass}`}>운영자가 서버에 Supabase 비밀 키를 넣어야 선수 사진을 보여 줄 수 있어요.</p>
      </div>
    );
  }
  const status = await getMyQuiz();
  if (!status) {
    return (
      <MemberRequired viewer={viewer} next="/cafe/game">
        회원이 되면 선수 맞히기로 골을 모을 수 있어요.
      </MemberRequired>
    );
  }
  return <PlayerQuiz initial={status} />;
}

function QuizSkeleton() {
  return (
    <div className={`${cardClass} animate-pulse`} aria-busy="true" aria-label="불러오는 중">
      <div className="grid h-[68px] grid-cols-4 gap-2 p-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={`h-full ${skeletonClass}`} />
        ))}
      </div>
      <div className="p-4">
        <div className={`mx-auto aspect-square w-full max-w-[260px] rounded-2xl ${skeletonClass}`} />
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className={`h-12 rounded-xl ${skeletonClass}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function GamePage() {
  return (
    <div className="mx-auto max-w-xl break-keep">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">선수 맞히기</h1>
        <p className={`mt-1 text-sm ${mutedClass}`}>
          FC온라인 카드 사진을 보고 누구인지 맞히면 골을 받아요. 하루 {QUIZ.daily}문제, 연승할수록 골이 커져요.
        </p>
      </div>
      <Suspense fallback={<QuizSkeleton />}>
        <Quiz />
      </Suspense>
      <section className={`${cardClass} mt-4`}>
        <h2 className={cardHeadingClass}>규칙</h2>
        <ul className={`space-y-1.5 px-4 py-3 text-sm ${mutedClass}`}>
          <li>사진 속 선수를 보기 {QUIZ.choices}개 중에서 골라요. 한국 시간으로 하루 {QUIZ.daily}문제까지 풀 수 있어요.</li>
          <li>
            정답은 1골이고 연승마다 1골씩 더 받아요. 2연승 2골, 3연승 3골, {QUIZ.maxStreak}연승부터는 정답마다{" "}
            {QUIZ.maxStreak}골이에요.
          </li>
          <li>틀리면 연승이 끊기고 다음 정답은 다시 1골부터예요. 연승은 날이 바뀌어도 이어져요.</li>
          <li>받은 골은 등급과 골 상점에 그대로 쓰여요.</li>
        </ul>
      </section>
      <NexonCredit className="mt-3 text-center" />
    </div>
  );
}
