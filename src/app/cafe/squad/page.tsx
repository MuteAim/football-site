import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PostListSkeleton } from "@/components/cafe/CafeSkeletons";
import { SquadList } from "@/components/cafe/SquadList";
import { NexonCredit } from "@/components/cafe/SquadPitch";
import { PlusIcon } from "@/components/Icons";
import { cardClass, cardHeadingClass, mutedClass, primaryButtonClass } from "@/components/ui";
import { SQUAD_LIMITS } from "@/lib/cafe/squad";
import { listSquads } from "@/lib/cafe/squads";
import { getViewer } from "@/lib/cafe/viewer";

export const metadata: Metadata = { title: "드림 스쿼드" };

/** 내가 만든 스쿼드와 회원들이 최근에 만든 스쿼드. 볼 때마다 새로 읽어요. */
async function Squads() {
  const viewer = await getViewer();
  const me = viewer?.profile ? viewer : null;
  const [mine, recent] = await Promise.all([
    me ? listSquads({ userId: me.id, limit: SQUAD_LIMITS.perMember }) : Promise.resolve([]),
    listSquads({ limit: 20 }),
  ]);

  return (
    <>
      {me ? (
        <section className={`${cardClass} mb-4`}>
          <h2 className={cardHeadingClass}>
            내 스쿼드
            <span className={`ml-auto text-xs font-normal tabular-nums ${mutedClass}`}>
              {mine.length}/{SQUAD_LIMITS.perMember}
            </span>
          </h2>
          {mine.length > 0 ? (
            <SquadList squads={mine} showAuthor={false} />
          ) : (
            <p className={`px-4 py-6 text-center text-sm ${mutedClass}`}>아직 만든 스쿼드가 없어요.</p>
          )}
        </section>
      ) : null}
      <section className={cardClass}>
        <h2 className={cardHeadingClass}>새로 만든 스쿼드</h2>
        {recent.length > 0 ? (
          <SquadList squads={recent} showAuthor />
        ) : (
          <p className={`px-4 py-6 text-center text-sm ${mutedClass}`}>첫 드림 스쿼드를 만들어 보세요!</p>
        )}
      </section>
    </>
  );
}

export default function SquadHomePage() {
  return (
    <div className="break-keep">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">드림 스쿼드</h1>
          <p className={`mt-0.5 text-sm ${mutedClass}`}>FC온라인 선수 카드로 나만의 베스트 11을 짜고 카페에 자랑해요.</p>
        </div>
        <Link href="/cafe/squad/new" className={primaryButtonClass}>
          <PlusIcon className="size-4" />
          만들기
        </Link>
      </div>
      <Suspense fallback={<PostListSkeleton rows={6} />}>
        <Squads />
      </Suspense>
      <NexonCredit className="mt-3 text-center" />
    </div>
  );
}
