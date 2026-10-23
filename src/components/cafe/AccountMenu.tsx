"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { nameColorClass } from "@/lib/cafe/shop";
import { getBrowserClient } from "@/lib/cafe/supabase-browser";
import type { Author } from "@/lib/cafe/types";
import { BagIcon, BellIcon, ChevronDownIcon, QuizCardIcon, SlidersIcon, TrophyIcon, UserIcon } from "../Icons";
import { cardClass, mutedClass } from "../ui";
import { Avatar, LevelBadge } from "./Avatar";
import { SignOutButton } from "./SignOutButton";

const NOTIFICATIONS_PATH = "/cafe/notifications";

/** 새 소식 수. 두 자리부터는 9+로 줄여요. */
function countLabel(count: number): string {
  return count > 9 ? "9+" : String(count);
}

/** 안 읽은 내 소식 수를 서버에 다시 물어봐요. 실패하면 null이에요. */
async function fetchUnread(): Promise<number | null> {
  try {
    const response = await fetch(`${NOTIFICATIONS_PATH}/unread`, { cache: "no-store" });
    if (!response.ok) return null;
    return ((await response.json()) as { count: number }).count;
  } catch {
    return null;
  }
}

/**
 * 안 읽은 내 소식 수. 처음 값은 서버가 그려 주고, 카페 머리는 화면을 옮겨도 다시 그려지지 않아서
 * 실시간 수신·읽음 처리·화면 이동 때 갱신하고, 연결이 끊겨도 보이는 동안 30초마다 확인해요.
 */
function useUnreadCount(initial: number, userId: string): number {
  const pathname = usePathname();
  const [count, setCount] = useState(initial);
  useEffect(() => {
    let active = true;
    let requestId = 0;
    let scheduled: number | undefined;
    const sync = () => {
      if (document.visibilityState !== "visible") return;
      window.clearTimeout(scheduled);
      const id = ++requestId;
      // 여러 알림을 한꺼번에 읽으면 실시간 이벤트가 여러 번 와서 한 요청으로 모아요.
      scheduled = window.setTimeout(() => {
        void fetchUnread().then((next) => {
          if (active && id === requestId && next !== null) setCount(next);
        });
      }, 150);
    };
    sync();
    const supabase = getBrowserClient();
    const channel = supabase.channel(`notifications:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, sync)
      .subscribe((status) => { if (status === "SUBSCRIBED") sync(); });
    const timer = window.setInterval(sync, 30_000);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("cafe-notifications-read", sync);
    return () => {
      active = false;
      window.clearTimeout(scheduled);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("cafe-notifications-read", sync);
      void supabase.removeChannel(channel);
    };
  }, [pathname, userId]);

  return count;
}

function MenuLink({
  href,
  icon,
  label,
  hint,
  badge = 0,
  onPick,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  hint: string;
  /** 0보다 크면 오른쪽에 빨간 숫자로 보여 줘요. */
  badge?: number;
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
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        <span className={`block truncate text-xs ${mutedClass}`}>{hint}</span>
      </span>
      {badge > 0 ? (
        <span className="shrink-0 rounded-full bg-rose-500 px-1.5 text-xs leading-5 font-bold text-white tabular-nums">
          {countLabel(badge)}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * 카페 배너 오른쪽의 내 계정 메뉴. 내 닉네임을 누르면 등급과 골, 내 소식·내 정보·상점·예측 순위로 가는 길이 펼쳐져요.
 * 운영자에게는 카페 관리도 보여요. 안 읽은 내 소식이 있으면 닉네임 옆 프로필 그림에 빨간 숫자가 붙어요.
 * 바깥을 누르거나 Esc를 누르면 닫혀요. badgeRing은 숫자 배지를 배너 색과 떼어 보이게 두르는 테두리 색이에요.
 */
export function AccountMenu({
  me,
  unread,
  chipClass,
  badgeRing,
}: {
  me: Author;
  unread: number;
  chipClass: string;
  badgeRing: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const count = useUnreadCount(unread, me.id);
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
        <span className="relative shrink-0">
          <Avatar id={me.id} nickname={me.nickname} team={me.team} frame={me.frame} size="sm" />
          {count > 0 ? (
            <span
              className={`absolute -top-1.5 -right-1.5 min-w-[18px] rounded-full bg-rose-500 px-1 text-center text-[11px] leading-[18px] font-bold text-white tabular-nums ring-2 ${badgeRing}`}
            >
              {countLabel(count)}
              <span className="sr-only">개의 새 소식</span>
            </span>
          ) : null}
        </span>
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
              href={NOTIFICATIONS_PATH}
              icon={<BellIcon className="size-4" />}
              label="내 소식"
              hint={count > 0 ? `새 소식 ${count}개` : "댓글·태그·업데이트와 예측 결과"}
              badge={count}
              onPick={close}
            />
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
              href="/cafe/game"
              icon={<QuizCardIcon className="size-4" />}
              label="선수 맞히기"
              hint="카드 사진 보고 선수 맞히고 골 받기"
              onPick={close}
            />
            <MenuLink
              href="/cafe/predict"
              icon={<TrophyIcon className="size-4" />}
              label="승부 예측 순위"
              hint="내 순위와 적중률"
              onPick={close}
            />
            {me.isAdmin ? (
              <MenuLink
                href="/cafe/admin"
                icon={<SlidersIcon className="size-4" />}
                label="카페 관리"
                hint="배너·공지·글쓰기 잠금과 운영 기록"
                onPick={close}
              />
            ) : null}
          </nav>
          <div className="border-t border-zinc-100 p-1.5 dark:border-white/[0.07]">
            <SignOutButton
              className={`w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-zinc-100 dark:hover:bg-white/[0.06] ${mutedClass}`}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
