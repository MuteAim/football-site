import Link from "next/link";
import { PAGE_SIZE } from "@/lib/cafe/config";
import { ChevronLeftIcon, ChevronRightIcon } from "../Icons";

const itemClass =
  "flex size-9 items-center justify-center rounded-full text-sm font-medium tabular-nums transition active:scale-95";

/** 쪽 번호. 지금 쪽 앞뒤로 다섯 칸까지만 보여 줘요. */
export function Pagination({
  page,
  total,
  basePath,
}: {
  page: number;
  total: number;
  basePath: string;
}) {
  const last = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (last === 1 && page === 1) return null;

  const start = Math.max(1, Math.min(page - 2, last - 4));
  const pages = Array.from({ length: Math.min(5, last - start + 1) }, (_, i) => start + i);
  const href = (n: number) => (n === 1 ? basePath : `${basePath}?page=${n}`);

  return (
    <nav aria-label="쪽 이동" className="mt-4 flex items-center justify-center gap-1">
      {page > 1 ? (
        <Link href={href(page - 1)} aria-label="이전 쪽" className={`${itemClass} text-zinc-500 hover:bg-zinc-950/5 dark:hover:bg-white/10`}>
          <ChevronLeftIcon className="size-4" />
        </Link>
      ) : null}
      {pages.map((n) => (
        <Link
          key={n}
          href={href(n)}
          aria-current={n === page ? "page" : undefined}
          className={`${itemClass} ${
            n === page
              ? "bg-zinc-900 font-semibold text-white dark:bg-white dark:text-zinc-900"
              : "text-zinc-600 hover:bg-zinc-950/5 dark:text-zinc-300 dark:hover:bg-white/10"
          }`}
        >
          {n}
        </Link>
      ))}
      {page < last ? (
        <Link href={href(page + 1)} aria-label="다음 쪽" className={`${itemClass} text-zinc-500 hover:bg-zinc-950/5 dark:hover:bg-white/10`}>
          <ChevronRightIcon className="size-4" />
        </Link>
      ) : null}
    </nav>
  );
}
