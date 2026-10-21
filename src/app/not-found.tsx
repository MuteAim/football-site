import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center py-20 text-center">
      <p className="text-6xl font-bold tracking-tight text-zinc-300 dark:text-zinc-700">404</p>
      <p className="mt-3 text-lg font-semibold">페이지를 찾을 수 없어요.</p>
      <Link
        href="/"
        className="mt-6 inline-flex h-10 items-center rounded-full bg-zinc-900 px-5 text-sm font-semibold text-white transition hover:bg-zinc-700 active:scale-95 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        오늘 경기 보러 가기
      </Link>
    </div>
  );
}
