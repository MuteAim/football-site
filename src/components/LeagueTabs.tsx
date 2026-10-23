"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { LinkPending } from "./LinkPending";

const TABS = [
  { segment: null, path: "", label: "순위" },
  { segment: "fixtures", path: "/fixtures", label: "일정" },
  { segment: "results", path: "/results", label: "결과" },
  { segment: "scorers", path: "/scorers", label: "득점" },
] as const;

/** 순위·일정·결과·득점을 오가는 버튼 묶음. 경기 필터와 같은 선택 색을 써요. */
export function LeagueTabs({ code }: { code: string }) {
  const segment = useSelectedLayoutSegment();

  return (
    <nav
      aria-label="대회 메뉴"
      className="mt-3 grid h-13 grid-cols-4 gap-1 rounded-2xl bg-white p-1.5 ring-1 ring-emerald-950/[0.08] dark:bg-[#131e18] dark:ring-white/[0.08]"
    >
      {TABS.map((tab) => {
        const active = segment === tab.segment;
        return (
          <Link
            key={tab.label}
            href={`/league/${code}${tab.path}`}
            aria-current={active ? "page" : undefined}
            className={`relative flex items-center justify-center rounded-xl text-sm font-medium transition active:scale-95 ${
              active
                ? "bg-[#173d2c] font-bold text-white dark:bg-[#d4f77d] dark:text-emerald-950"
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            }`}
          >
            {tab.label}
            <LinkPending className="rounded-xl bg-emerald-500/20" />
          </Link>
        );
      })}
    </nav>
  );
}
