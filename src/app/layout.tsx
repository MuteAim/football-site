import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AttendanceCheck } from "@/components/cafe/AttendanceCheck";
import { FeedbackHost, FlashToast } from "@/components/FeedbackHost";
import { LogoMark } from "@/components/Icons";
import { ActiveMainNav, MainNav } from "@/components/SiteNav";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "해외축구 일정·순위",
    template: "%s · 해외축구 일정·순위",
  },
  description:
    "프리미어리그, 라리가, 분데스리가, 세리에 A, 리그 1, 챔피언스리그의 경기 일정과 결과, 순위를 한국 시간으로 확인하세요.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#10251c" },
    { media: "(prefers-color-scheme: dark)", color: "#111214" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="football-shell flex min-h-full flex-col text-zinc-900 dark:text-zinc-100">
        <a href="#main-content" className="sr-only z-50 rounded-lg bg-white p-3 text-emerald-900 focus:not-sr-only focus:fixed focus:top-2 focus:left-2">본문 바로가기</a>
        {/* 화면 전환 때 머리글은 제자리에 두고 내용만 움직이도록 이름을 붙여 둬요. */}
        <header
          style={{ viewTransitionName: "site-header" }}
          className="sticky top-0 z-30 border-b border-white/10 bg-[#10251c]/95 text-white backdrop-blur-xl dark:bg-[#111214]/95"
        >
          <div className="mx-auto flex h-18 max-w-5xl items-center gap-3 px-4 sm:gap-10 sm:px-6">
            <Link href="/" aria-label="해외축구 홈" className="flex shrink-0 items-center gap-2.5">
              <LogoMark />
              <span className="hidden min-[400px]:block">
                <span className="block text-base leading-5 font-extrabold tracking-tight sm:text-lg">해외축구</span>
                <span className="sport-eyebrow mt-0.5 block text-[#d4f77d] dark:text-zinc-400">MATCHDAY</span>
              </span>
            </Link>
            <Suspense fallback={<MainNav />}>
              <ActiveMainNav />
            </Suspense>
          </div>
        </header>

        <main id="main-content" className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-10 sm:px-6 sm:pt-7">{children}</main>

        <footer className="border-t border-emerald-950/10 dark:border-white/[0.07]">
          <div className="mx-auto max-w-5xl space-y-1 px-4 pt-6 pb-10 text-xs leading-relaxed text-zinc-500 sm:px-6 dark:text-zinc-400">
            <p className="mb-3 text-sm font-bold text-emerald-900 dark:text-zinc-300">경기장 밖에서도, 축구는 계속.</p>
            <p>모든 시간은 한국 시간 기준이에요. 무료 플랜 데이터라 실제 경기보다 몇 분 늦게 반영될 수 있어요.</p>
            <p>
              경기 데이터 제공{" "}
              <a
                href="https://www.football-data.org"
                className="font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-2 hover:decoration-current dark:text-zinc-300 dark:decoration-zinc-600"
              >
                football-data.org
              </a>
            </p>
            <p>
              <Link
                href="/privacy"
                className="font-semibold text-zinc-700 underline decoration-zinc-300 underline-offset-2 hover:decoration-current dark:text-zinc-300 dark:decoration-zinc-600"
              >
                개인정보 처리방침
              </Link>
            </p>
          </div>
        </footer>
        {/* 어느 화면이든 하루 첫 방문이면 출석 골을 줘요. */}
        <AttendanceCheck />
        {/* 브라우저 기본 alert·confirm 대신 쓰는 화면 아래 알림과 확인 창이에요. */}
        <FeedbackHost />
        <Suspense fallback={null}>
          <FlashToast />
        </Suspense>
      </body>
    </html>
  );
}
