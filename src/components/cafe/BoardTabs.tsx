"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { ALL_BOARD, BOARDS, boardHref, getBoard } from "@/lib/cafe/boards";
import { LinkPending } from "../LinkPending";
import { useCenterActive } from "../useCenterActive";

const TABS = [ALL_BOARD, ...BOARDS];

/** 게시판 탭. 가로로 넘길 수 있고 고른 게시판만 진하게 보여 줘요. active가 ""이면 전체글이에요. */
export function BoardTabs({ active }: { active: string | null }) {
  const navRef = useRef<HTMLElement>(null);
  useCenterActive(navRef, active);

  return (
    <nav
      ref={navRef}
      aria-label="게시판 목록"
      className="no-scrollbar -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 py-0.5"
    >
      {TABS.map((board) => {
        const isActive = board.slug === active;
        return (
          <Link
            key={board.slug || "all"}
            href={boardHref(board)}
            aria-current={isActive ? "page" : undefined}
            className={`relative flex h-9 shrink-0 items-center rounded-full px-3.5 text-sm font-medium transition active:scale-95 ${
              isActive
                ? "bg-zinc-900 font-semibold text-white dark:bg-white dark:text-zinc-900"
                : "bg-white text-zinc-600 ring-1 ring-zinc-950/5 hover:text-zinc-900 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-white/10 dark:hover:text-white"
            }`}
          >
            {board.short}
            <LinkPending className="rounded-full bg-emerald-500/20" />
          </Link>
        );
      })}
    </nav>
  );
}

/** 주소를 읽어서 지금 게시판을 찾아요. 주소를 읽어야 해서 레이아웃에서는 Suspense로 감싸 둡니다. */
export function ActiveBoardTabs() {
  const pathname = usePathname();
  const segment = pathname.split("/")[2] ?? "";
  if (segment === "predict" || segment === "squad") return null;
  const active = pathname === "/cafe" ? "" : (getBoard(segment)?.slug ?? null);
  return <BoardTabs active={active} />;
}
