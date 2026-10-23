import Link from "next/link";
import type { ReactNode } from "react";
import { bannerLook, isExternalHref, lockNotice } from "@/lib/cafe/banner";
import type { CafeSettings } from "@/lib/cafe/types";
import { BallIcon, ChevronRightIcon, LockIcon, MegaphoneIcon, PitchLines } from "../Icons";

// 카페 머리의 배너와 그 아래 띠들이에요. 카페 머리와 카페 관리 화면의 미리 보기가 같이 써요.

/**
 * 카페 배너. 운영자가 정한 카페 이름, 소개, 색으로 그려요. children은 오른쪽의 로그인·계정 메뉴 자리예요.
 * preview면 미리 보기라서 소개를 링크로 만들지 않아요.
 */
export function CafeBanner({
  name,
  tagline,
  color,
  preview = false,
  children,
}: {
  name: string;
  tagline: string;
  color: string;
  preview?: boolean;
  children?: ReactNode;
}) {
  const title = "block truncate text-xl font-extrabold tracking-tight sm:text-3xl";
  return (
    <div className={`relative min-h-36 rounded-3xl bg-linear-to-br px-5 py-5 text-white shadow-sm sm:px-7 sm:py-6 ${bannerLook(color).banner} dark:from-[#24262b] dark:to-[#18191d] dark:ring-1 dark:ring-white/[0.08]`}>
      {/* 장식만 둥근 모서리 안에 잘라 두고, 계정 메뉴는 배너 밖으로 펼쳐질 수 있게 해요. */}
      <div aria-hidden className="absolute inset-0 overflow-hidden rounded-3xl">
        <span className={`absolute top-0 left-7 hidden h-0.5 w-10 rounded-b-full dark:block ${bannerLook(color).swatch}`} />
        <div className="absolute inset-0 bg-linear-to-r from-black/35 to-transparent" />
        <PitchLines className="absolute top-1/2 -right-12 h-60 w-96 -translate-y-1/2 -rotate-12 text-white/10 dark:text-white/[0.06]" />
      </div>
      <div className="relative">
        <p className="sport-eyebrow mb-3 text-white/70">THE SUPPORTERS CLUB</p>
        <div className="flex items-center gap-3 sm:gap-4">
        {/* 휴대폰에서는 카페 이름이 잘리지 않게 아이콘을 숨겨요. */}
        <div className="hidden size-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 sm:flex">
          <BallIcon className="size-8" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="mb-1 truncate text-xs font-semibold text-white/70">{name} · 축구 팬들의 카페</p>
          {preview ? (
            <p className={title}>{tagline}</p>
          ) : (
            <Link href="/cafe" className={title}>
              {tagline}
            </Link>
          )}
        </div>
        {children}
        </div>
      </div>
    </div>
  );
}

const barClass = "mt-3 flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium ring-1 break-keep";
const noticeClass = `${barClass} bg-amber-50 text-amber-900 ring-amber-900/10 dark:bg-amber-400/10 dark:text-amber-100 dark:ring-amber-300/15`;

/** 카페 맨 위 한 줄 공지. 링크가 있으면 띠 전체가 링크예요. 바깥 주소는 새 탭에서 열어요. */
export function NoticeBar({ notice, preview = false }: { notice: CafeSettings["notice"]; preview?: boolean }) {
  if (!notice.on || !notice.text) return null;
  const inner = (
    <>
      <MegaphoneIcon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">{notice.text}</span>
      {notice.href ? <ChevronRightIcon className="size-4 shrink-0 opacity-60" /> : null}
    </>
  );
  if (!notice.href || preview) return <p className={noticeClass}>{inner}</p>;
  const linkClass = `${noticeClass} transition-colors hover:bg-amber-100 dark:hover:bg-amber-400/15`;
  if (isExternalHref(notice.href)) {
    return (
      <a href={notice.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={notice.href} className={linkClass}>
      {inner}
    </Link>
  );
}

/** 글쓰기 잠금(점검 모드) 중이라고 알리는 띠 */
export function LockBar({ lock }: { lock: CafeSettings["lock"] }) {
  if (!lock.on) return null;
  return (
    <p
      className={`${barClass} bg-rose-50 text-rose-900 ring-rose-900/10 dark:bg-rose-400/10 dark:text-rose-100 dark:ring-rose-300/15`}
    >
      <LockIcon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">{lockNotice(lock.message)}</span>
    </p>
  );
}
