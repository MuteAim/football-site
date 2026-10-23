"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { skeletonClass } from "../ui";

/** 스쿼드 만들기 화면을 불러오는 동안 보여 주는 피치 모양 뼈대 */
export function SquadBuilderSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-1.5">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className={`h-9 w-16 rounded-full ${skeletonClass}`} />
        ))}
      </div>
      <div className={`mx-auto aspect-[68/90] w-full max-w-[26rem] rounded-2xl ${skeletonClass}`} />
    </div>
  );
}

// 저장 안 한 스쿼드를 브라우저 저장소에서 처음부터 읽어야 해서, 서버에서 그리지 않고 브라우저에서만 그려요.
// 그래야 서버 화면과 어긋나지 않아요.
const SquadBuilder = dynamic(() => import("./SquadBuilder").then((module) => module.SquadBuilder), {
  ssr: false,
  loading: SquadBuilderSkeleton,
});

/**
 * 스쿼드 만들기. Next.js는 지나온 화면을 숨겨 두었다가 다시 보여 줘서, 저장한 뒤 다시 '만들기'를 누르면
 * 방금 저장한 스쿼드가 남아 있게 돼요. 그래서 링크로 새로 들어올 때마다 새로 시작하고,
 * 뒤로 가기로 돌아올 때만 만들던 화면을 살려 둬요(글쓰기 폼과 같아요).
 */
export function SquadBuilderLoader(props: ComponentProps<typeof SquadBuilder>) {
  const { bfcacheId } = useRouter();
  return <SquadBuilder key={bfcacheId} {...props} />;
}
