"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { signOut } from "@/lib/cafe/actions";
import { nameColorClass } from "@/lib/cafe/shop";
import type { Author } from "@/lib/cafe/types";
import { BagIcon, ChevronDownIcon, TrophyIcon, UserIcon } from "../Icons";
import { cardClass, mutedClass } from "../ui";
import { Avatar, LevelBadge } from "./Avatar";

function MenuLink({
  href,
  icon,
  label,
  hint,
  onPick,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  hint: string;
  onPick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onPick}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-zinc-100 dark:hover:bg-white/[0.06]"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        <span className={`block truncate text-xs ${mutedClass}`}>{hint}</span>
      </span>
    </Link>
  );
}

/**
 * 카페 배너 오른쪽의 내 계정 메뉴. 내 닉네임을 누르면 등급과 골, 내 정보·상점·예측 순위로 가는 길이 펼쳐져요.
 * 바깥을 누르거나 Esc를 누르면 닫혀요.
 */
export function AccountMenu({ me, chipClass }: { me: Author; chipClass: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className={`${chipClass} pl-1.5 ${open ? "bg-white/25" : ""}`}
      >
        <Avatar id={me.id} nickname={me.nickname} team={me.team} frame={me.frame} size="sm" />
        <span className="truncate">{me.nickname}</span>
        <ChevronDownIcon className={`-mr-1 size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div
          id={menuId}
          className={`${cardClass} absolute top-full right-0 z-40 mt-2 w-72 max-w-[calc(100vw-2rem)] text-zinc-900 shadow-lg dark:text-zinc-100`}
        >
          <div className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3 dark:border-white/[0.07]">
            <Avatar id={me.id} nickname={me.nickname} team={me.team} frame={me.frame} size="lg" />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 font-semibold">
                <span className={`truncate ${nameColorClass(me.nameColor)}`}>{me.nickname}</span>
                <LevelBadge goals={me.goals} />
              </p>
              <p className={`text-xs tabular-nums ${mutedClass}`}>모은 골 {me.goals.toLocaleString("ko-KR")}골</p>
            </div>
          </div>
          <nav aria-label="내 메뉴" className="p-1.5">
            <MenuLink
              href="/cafe/me"
              icon={<UserIcon className="size-4" />}
              label="내 정보"
              hint="닉네임·응원팀 바꾸기, 골과 출석"
              onPick={close}
            />
            <MenuLink
              href="/cafe/shop"
              icon={<BagIcon className="size-4" />}
              label="골 상점"
              hint="골로 닉네임 색과 테두리 사기"
              onPick={close}
            />
            <MenuLink
              href="/cafe/predict"
              icon={<TrophyIcon className="size-4" />}
              label="승부 예측 순위"
              hint="내 순위와 적중률"
              onPick={close}
            />
          </nav>
          <form action={signOut} className="border-t border-zinc-100 p-1.5 dark:border-white/[0.07]">
            <button
              type="submit"
              className={`w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-zinc-100 dark:hover:bg-white/[0.06] ${mutedClass}`}
            >
              로그아웃
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
