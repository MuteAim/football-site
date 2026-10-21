import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActiveNavLinks, NavLinks } from "@/components/SiteNav";
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
    { media: "(prefers-color-scheme: dark)", color: "#18181b" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
          <div className="mx-auto flex max-w-3xl items-center gap-3 overflow-hidden px-4 py-2.5">
            <Link href="/" className="shrink-0 text-base font-bold">
              ⚽ 해외축구
            </Link>
            <Suspense fallback={<NavLinks />}>
              <ActiveNavLinks />
            </Suspense>
          </div>
        </header>

        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">{children}</main>

        <footer className="mx-auto w-full max-w-3xl space-y-1 px-4 pb-8 pt-4 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          <p>모든 시간은 한국 시간 기준이에요. 무료 플랜 데이터라 실제 경기보다 몇 분 늦게 반영될 수 있어요.</p>
          <p>
            경기 데이터 제공{" "}
            <a href="https://www.football-data.org" className="underline underline-offset-2">
              football-data.org
            </a>
          </p>
        </footer>
      </body>
    </html>
  );
}
