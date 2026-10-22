import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AttendanceCheck } from "@/components/cafe/AttendanceCheck";
import { LogoMark } from "@/components/Icons";
import { ActiveCafeNavLink, ActiveNavLinks, CafeNavLink, NavLinks } from "@/components/SiteNav";
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
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        {/* 화면 전환 때 머리글은 제자리에 두고 내용만 움직이도록 이름을 붙여 둬요. */}
        <header
          style={{ viewTransitionName: "site-header" }}
          className="sticky top-0 z-30 border-b border-zinc-950/5 bg-white/75 backdrop-blur-xl backdrop-saturate-150 dark:border-white/[0.07] dark:bg-zinc-950/75"
        >
          <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 overflow-hidden px-4">
            <Link href="/" className="flex shrink-0 items-center gap-2 text-[17px] font-bold tracking-tight">
              <LogoMark />
              해외축구
            </Link>
            <Suspense fallback={<CafeNavLink />}>
              <ActiveCafeNavLink />
            </Suspense>
            <Suspense fallback={<NavLinks />}>
              <ActiveNavLinks />
            </Suspense>
          </div>
        </header>

        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-4 pb-8">{children}</main>

        <footer className="border-t border-zinc-950/5 dark:border-white/[0.07]">
          <div className="mx-auto max-w-3xl space-y-1 px-4 pt-5 pb-10 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
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
      </body>
    </html>
  );
}
