"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { ALL_BOARD, BOARDS, boardHref, getBoard } from "@/lib/cafe/boards";
import { ShirtIcon, TrophyIcon } from "../Icons";
import { LinkPending } from "../LinkPending";
import { useCenterActive } from "../useCenterActive";

const TABS = [ALL_BOARD, ...BOARDS];

/** 게시판은 아니지만 카페에서 자주 쓰는 곳. 게시판 탭 끝에 붙여요. slug는 /cafe/ 뒤 주소예요. */
const EXTRA_TABS = [
  { slug: "predict", label: "예측왕", Icon: TrophyIcon },
  { slug: "squad", label: "스쿼드", Icon: ShirtIcon },
];

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
      {/* 승부 예측 순위와 드림 스쿼드는 게시판이 아니지만 자주 가는 곳이라 맨 끝에 붙여 둬요. */}
      {EXTRA_TABS.map(({ slug, label, Icon }) => (
        <Link
          key={slug}
          href={`/cafe/${slug}`}
          aria-current={active === slug ? "page" : undefined}
          className={`relative flex h-9 shrink-0 items-center gap-1 rounded-full px-3.5 text-sm font-medium transition active:scale-95 ${
            active === slug
              ? "bg-zinc-900 font-semibold text-white dark:bg-white dark:text-zinc-900"
              : "bg-white text-zinc-600 ring-1 ring-zinc-950/5 hover:text-zinc-900 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-white/10 dark:hover:text-white"
          }`}
        >
          <Icon className="size-3.5" />
          {label}
          <LinkPending className="rounded-full bg-emerald-500/20" />
        </Link>
      ))}
    </nav>
  );
}

/** 주소를 읽어서 지금 게시판을 찾아요. 주소를 읽어야 해서 레이아웃에서는 Suspense로 감싸 둡니다. */
export function ActiveBoardTabs() {
  const pathname = usePathname();
  const segment = pathname.split("/")[2] ?? "";
  const extra = EXTRA_TABS.find((tab) => tab.slug === segment)?.slug;
  const active = pathname === "/cafe" ? "" : (extra ?? getBoard(segment)?.slug ?? null);
  return <BoardTabs active={active} />;
}
