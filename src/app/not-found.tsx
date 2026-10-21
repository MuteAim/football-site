import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <p className="text-lg font-semibold">페이지를 찾을 수 없어요.</p>
      <Link
        href="/"
        className="mt-4 inline-block text-sm text-emerald-700 underline underline-offset-2 dark:text-emerald-400"
      >
        오늘 경기 보러 가기
      </Link>
    </div>
  );
}
