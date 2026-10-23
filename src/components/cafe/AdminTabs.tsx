"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LinkPending } from "../LinkPending";

const TABS = [
  { href: "/cafe/admin", label: "설정" },
  { href: "/cafe/admin/logs", label: "운영 기록" },
];

/** 카페 관리 화면의 탭. 주소를 읽어서 지금 탭을 진하게 보여 줘요. 레이아웃에서는 Suspense로 감싸 둬요. */
export function AdminTabs() {
  const pathname = usePathname();
  return <AdminTabList active={pathname} />;
}

/** 주소를 읽기 전에 먼저 보여 주는 탭. 아무 탭도 고르지 않은 모양이에요. */
export function AdminTabList({ active = null }: { active?: string | null }) {
  return (
    <nav aria-label="카페 관리 메뉴" className="mb-4 flex gap-1.5">
      {TABS.map((tab) => {
        const isActive = tab.href === active;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={`relative flex h-9 items-center rounded-full px-3.5 text-sm font-medium transition active:scale-95 ${
              isActive
                ? "bg-zinc-900 font-semibold text-white dark:bg-white dark:text-zinc-900"
                : "bg-white text-zinc-600 ring-1 ring-zinc-950/5 hover:text-zinc-900 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-white/10 dark:hover:text-white"
            }`}
          >
            {tab.label}
            <LinkPending className="rounded-full bg-emerald-500/20" />
          </Link>
        );
      })}
    </nav>
  );
}
