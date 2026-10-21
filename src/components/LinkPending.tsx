"use client";

import { useLinkStatus } from "next/link";

/**
 * 미리 불러오지 않는 링크를 눌렀을 때 다음 화면이 오기 전까지 링크 위에 옅은 반짝임을 보여 줘요.
 * 늘 같은 자리에 깔려 있고 투명도만 바뀌어서 레이아웃이 흔들리지 않아요.
 * 부모 링크에는 relative 클래스가 있어야 해요.
 */
export function LinkPending({ className = "" }: { className?: string }) {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute inset-0 transition-opacity duration-150 ${
        pending ? "animate-pulse opacity-100" : "opacity-0"
      } ${className}`}
    />
  );
}
