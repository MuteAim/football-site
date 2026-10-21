"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { COMPETITIONS } from "@/lib/competitions";
import { LinkPending } from "./LinkPending";

export function NavLinks({ activeCode = null }: { activeCode?: string | null }) {
  const navRef = useRef<HTMLElement>(null);

  // 휴대폰에서는 뒤쪽 대회가 화면 밖에 있어서, 지금 보는 대회가 가려져 있으면 가운데로 끌어와요.
  useEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !active) return;
    const start = active.offsetLeft;
    const end = start + active.offsetWidth;
    if (start >= nav.scrollLeft && end <= nav.scrollLeft + nav.clientWidth) return;
    nav.scrollTo({ left: start - (nav.clientWidth - active.offsetWidth) / 2, behavior: "smooth" });
  }, [activeCode]);

  return (
    <nav
      ref={navRef}
      aria-label="대회 목록"
      className="no-scrollbar relative -mr-4 flex min-w-0 flex-1 gap-1 overflow-x-auto py-1 pr-7 [mask-image:linear-gradient(to_right,#000_calc(100%_-_28px),transparent)]"
    >
      {COMPETITIONS.map((competition) => {
        const active = competition.code === activeCode;
        return (
          // 대회 페이지를 화면에 보이는 대로 전부 미리 만들면 API 호출이 한꺼번에 몰려서 미리 불러오기를 꺼 뒀어요.
          // 대신 누르는 순간 LinkPending이 반응을 보여 줘요.
          <Link
            key={competition.code}
            href={`/league/${competition.code}`}
            prefetch={false}
            aria-current={active ? "page" : undefined}
            className={`relative flex h-8 shrink-0 items-center rounded-full px-3.5 text-sm font-medium transition active:scale-95 ${
              active
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-950/5 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white"
            }`}
          >
            {competition.short}
            <LinkPending className="rounded-full bg-emerald-500/25" />
          </Link>
        );
      })}
    </nav>
  );
}

/** 지금 보고 있는 대회를 강조해요. 주소를 읽어야 해서 레이아웃에서는 Suspense로 감싸 둡니다. */
export function ActiveNavLinks() {
  const pathname = usePathname();
  const activeCode = /^\/league\/([^/]+)/.exec(pathname)?.[1] ?? null;
  return <NavLinks activeCode={activeCode} />;
}
