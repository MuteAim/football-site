import type { Metadata } from "next";
import { Suspense } from "react";
import { SquadBuilderLoader, SquadBuilderSkeleton } from "@/components/cafe/SquadBuilderLoader";
import { mutedClass } from "@/components/ui";
import { getViewer } from "@/lib/cafe/viewer";
import { getSeasons } from "@/lib/fconline";

export const metadata: Metadata = { title: "드림 스쿼드 만들기" };

/** 누구나 만들어 볼 수 있고, 저장은 회원만 해요. 로그인 상태를 읽어서 볼 때마다 그려요. */
async function NewSquad() {
  const [viewer, seasons] = await Promise.all([getViewer(), getSeasons()]);
  return <SquadBuilderLoader seasons={seasons} viewer={!viewer ? "guest" : viewer.profile ? "member" : "join"} />;
}

export default function NewSquadPage() {
  return (
    <div className="break-keep">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">드림 스쿼드 만들기</h1>
        <p className={`mt-0.5 text-sm ${mutedClass}`}>포메이션을 고르고 자리를 눌러 선수 카드를 넣어요.</p>
      </div>
      <Suspense fallback={<SquadBuilderSkeleton />}>
        <NewSquad />
      </Suspense>
    </div>
  );
}
