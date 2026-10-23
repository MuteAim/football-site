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
      className="no-scrollbar -mx-4 mt-4 flex gap-1.5 overflow-x-auto px-4 py-1"
    >
      {TABS.map((board) => {
        const isActive = board.slug === active;
        return (
          <Link
            key={board.slug || "all"}
            href={boardHref(board)}
            aria-current={isActive ? "page" : undefined}
            className={`relative flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold transition active:scale-[0.98] ${
              isActive
                ? "bg-emerald-700 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-950"
                : "bg-white text-zinc-600 ring-1 ring-zinc-950/5 hover:text-zinc-900 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-white/10 dark:hover:text-white"
            }`}
          >
            {board.slug && board.slug !== "best" ? <span aria-hidden className={`size-1.5 rounded-full ${isActive ? "bg-current" : ""}`} style={isActive ? undefined : { backgroundColor: board.color }} /> : null}
            {board.short}
            <LinkPending className="rounded-xl bg-emerald-500/20" />
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
  if (segment === "predict" || segment === "squad" || segment === "game") return null;
  const active = pathname === "/cafe" ? "" : (getBoard(segment)?.slug ?? null);
  return <BoardTabs active={active} />;
}
