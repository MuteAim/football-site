"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { COMPETITIONS } from "@/lib/competitions";

export function NavLinks({ activeCode = null }: { activeCode?: string | null }) {
  return (
    <nav
      aria-label="대회 목록"
      className="no-scrollbar -mr-4 flex min-w-0 flex-1 gap-1 overflow-x-auto pr-7 [mask-image:linear-gradient(to_right,#000_calc(100%_-_28px),transparent)]"
    >
      {COMPETITIONS.map((competition) => {
        const active = competition.code === activeCode;
        return (
          <Link
            key={competition.code}
            href={`/league/${competition.code}`}
            prefetch={false}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm transition-colors ${
              active
                ? "bg-emerald-600 font-semibold text-white"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            {competition.short}
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
