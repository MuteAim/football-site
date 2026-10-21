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

export function LeagueTabs({ code }: { code: string }) {
  const segment = useSelectedLayoutSegment();

  return (
    <nav aria-label="대회 메뉴" className="mt-4 flex border-b border-zinc-200 dark:border-zinc-800">
      {TABS.map((tab) => {
        const active = segment === tab.segment;
        return (
          <Link
            key={tab.label}
            href={`/league/${code}${tab.path}`}
            aria-current={active ? "page" : undefined}
            className={`relative -mb-px flex-1 border-b-2 px-3 py-2.5 text-center text-sm font-medium sm:flex-none sm:px-5 ${
              active
                ? "border-emerald-600 text-emerald-700 dark:border-emerald-400 dark:text-emerald-300"
                : "border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            {tab.label}
            <LinkPending className="rounded-t-md bg-emerald-500/15" />
          </Link>
        );
      })}
    </nav>
  );
}
