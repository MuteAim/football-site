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

/** 순위·일정·결과·득점을 오가는 버튼 묶음. 고른 칸만 하얗게 떠 보여요. */
export function LeagueTabs({ code }: { code: string }) {
  const segment = useSelectedLayoutSegment();

  return (
    <nav
      aria-label="대회 메뉴"
      className="mt-3 grid h-11 grid-cols-4 gap-1 rounded-2xl bg-zinc-200/70 p-1 dark:bg-zinc-900"
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
                ? "bg-white font-semibold text-zinc-900 shadow-xs ring-1 ring-zinc-950/5 dark:bg-zinc-700 dark:text-white dark:ring-white/10"
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
