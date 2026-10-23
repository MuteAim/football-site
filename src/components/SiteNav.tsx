"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { COMPETITIONS } from "@/lib/competitions";
import { BallIcon, ChatIcon, ShirtIcon, TrophyIcon } from "./Icons";
import { Crest } from "./Crest";
import { LinkPending } from "./LinkPending";

const MAIN_LINKS = [
  { href: "/", label: "경기", Icon: BallIcon },
  { href: "/cafe", label: "카페", Icon: ChatIcon },
  { href: "/cafe/predict", label: "예측", Icon: TrophyIcon },
  { href: "/cafe/squad", label: "스쿼드", Icon: ShirtIcon },
];

export function MainNav({ activeHref }: { activeHref?: string }) {
  return (
    <nav aria-label="주요 메뉴" className="ml-auto grid min-w-0 max-w-lg flex-1 grid-cols-4 gap-1 sm:gap-2">
      {MAIN_LINKS.map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          prefetch={false}
          aria-current={activeHref === href ? "page" : undefined}
          className={`relative flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl text-[13px] font-bold transition sm:text-sm ${
            activeHref === href
              ? "bg-[#d4f77d] text-[#132b1e] shadow-sm dark:bg-white/10 dark:text-white dark:after:absolute dark:after:bottom-1.5 dark:after:left-1/2 dark:after:h-0.5 dark:after:w-4 dark:after:-translate-x-1/2 dark:after:rounded-full dark:after:bg-emerald-400"
              : "text-white/65 hover:bg-white/10 hover:text-white"
          }`}
        >
          <Icon className="hidden size-4 sm:block" />
          {label}
          <LinkPending className="rounded-xl bg-white/20" />
        </Link>
      ))}
    </nav>
  );
}

export function ActiveMainNav() {
  const pathname = usePathname();
  const activeHref = pathname === "/cafe/predict" ? "/cafe/predict"
    : pathname === "/cafe/squad" || pathname.startsWith("/cafe/squad/") ? "/cafe/squad"
    : pathname === "/cafe" || pathname.startsWith("/cafe/") ? "/cafe"
    : pathname === "/" || pathname.startsWith("/matches/") || pathname.startsWith("/league/") ? "/"
    : undefined;
  return <MainNav activeHref={activeHref} />;
}

/** 리그 이동은 경기 화면 안에서 골라요. 선택한 리그만 요청해서 API 호출을 아껴요. */
export function CompetitionNav({ activeCode = "" }: { activeCode?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="hidden min-w-0 items-center gap-1 lg:flex" aria-label="주요 리그 바로가기">
        {COMPETITIONS.filter((item) => ["PL", "PD", "BL1", "SA", "FL1", "CL"].includes(item.code)).map((item) => (
          <Link key={item.code} href={`/league/${item.code}`} prefetch={false} title={item.name}
            aria-label={`${item.name} 순위와 일정`} aria-current={activeCode === item.code ? "page" : undefined}
            className={`flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-bold transition ${activeCode === item.code ? "bg-emerald-700 text-white" : "text-zinc-600 hover:bg-white dark:text-zinc-300 dark:hover:bg-white/5"}`}>
            <span className="flex size-6 items-center justify-center rounded-md bg-white"><Crest src={item.emblem} size={18} /></span>
            {item.short}
          </Link>
        ))}
      </div>
      <label className="flex w-full items-center justify-between gap-3 text-sm lg:w-auto">
      <span className="shrink-0 text-xs font-semibold text-zinc-500 lg:sr-only dark:text-zinc-400">리그 순위·일정</span>
      <select
        aria-label="리그 순위와 일정 보기"
        aria-busy={pending}
        value={activeCode}
        disabled={pending}
        onChange={(event) => {
          const code = event.target.value;
          if (COMPETITIONS.some((competition) => competition.code === code)) {
            startTransition(() => router.push(`/league/${code}`));
          }
        }}
        className="h-10 min-w-0 max-w-52 rounded-xl bg-white px-3 text-sm font-medium ring-1 ring-zinc-950/10 focus-visible:outline-emerald-500 disabled:opacity-50 dark:bg-zinc-900 dark:ring-white/10"
      >
        <option value="" disabled>리그 선택</option>
        {COMPETITIONS.map((competition) => <option key={competition.code} value={competition.code}>{competition.name}</option>)}
      </select>
      </label>
    </div>
  );
}
