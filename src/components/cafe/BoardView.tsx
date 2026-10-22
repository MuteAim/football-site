import Link from "next/link";
import { Suspense } from "react";
import { boardHref, postHref, type Board } from "@/lib/cafe/boards";
import { listPosts, listWeeklyBest } from "@/lib/cafe/data";
import type { PostSummary } from "@/lib/cafe/types";
import { EmptyState } from "../EmptyState";
import { ChevronRightIcon, HeartIcon, PencilIcon } from "../Icons";
import { cardClass, cardHeadingClass, cardListClass, mutedClass, primaryButtonClass } from "../ui";
import { PostListSkeleton } from "./CafeSkeletons";
import { Pagination } from "./Pagination";
import { PostList } from "./PostList";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function parsePage(value: string | string[] | undefined): number {
  const page = Number(Array.isArray(value) ? value[0] : value);
  return Number.isSafeInteger(page) && page >= 1 && page <= 10_000 ? page : 1;
}

/** 전체글 첫 쪽 위에 붙는 이번 주 인기글 다섯 개. */
function WeeklyBest({ posts }: { posts: PostSummary[] }) {
  if (posts.length === 0) return null;
  return (
    <section className={`${cardClass} mb-3`}>
      <h2 className={cardHeadingClass}>
        <HeartIcon filled className="size-4 text-rose-500" />
        이번 주 인기글
        <Link
          href="/cafe/best"
          className="ml-auto flex items-center text-xs font-medium text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300"
        >
          더 보기
          <ChevronRightIcon className="size-4" />
        </Link>
      </h2>
      <ol className={cardListClass}>
        {posts.map((post, index) => (
          <li key={post.id}>
            <Link href={postHref(post)} className="flex h-11 items-center gap-3 text-[15px] hover:text-emerald-700 dark:hover:text-emerald-400">
              <span className="w-4 shrink-0 text-center text-sm font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate">{post.title}</span>
              <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-rose-500 tabular-nums dark:text-rose-400">
                <HeartIcon filled className="size-3" />
                {post.likeCount}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

async function BoardPosts({ board, searchParams }: { board: Board; searchParams: SearchParams }) {
  const page = parsePage((await searchParams).page);
  const [{ posts, total }, best] = await Promise.all([
    listPosts(board.slug, page),
    board.slug === "" && page === 1 ? listWeeklyBest() : Promise.resolve([]),
  ]);
  const now = new Date();

  return (
    <>
      <WeeklyBest posts={best} />
      {posts.length === 0 ? (
        <EmptyState>
          {page > 1
            ? "이 쪽에는 글이 없어요."
            : board.slug === "best"
              ? "아직 인기글이 없어요. 마음에 드는 글에 추천을 눌러 주세요!"
              : "아직 글이 없어요. 첫 글을 남겨 보세요!"}
        </EmptyState>
      ) : (
        <section className={cardClass}>
          <PostList posts={posts} showBoard={!board.writable} now={now} />
        </section>
      )}
      <Pagination page={page} total={total} basePath={boardHref(board)} />
    </>
  );
}

/** 게시판 화면. 제목 줄은 바로 보이고, 글 목록은 불러오는 대로 채워져요. */
export function BoardView({ board, searchParams }: { board: Board; searchParams: SearchParams }) {
  const writeBoard = board.writable ? board.slug : "free";
  return (
    <>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight">{board.name}</h1>
          <p className={`mt-0.5 truncate text-sm ${mutedClass}`}>{board.description}</p>
        </div>
        <Link href={`/cafe/write?board=${writeBoard}`} className={primaryButtonClass}>
          <PencilIcon className="size-4" />
          글쓰기
        </Link>
      </div>
      <Suspense fallback={<PostListSkeleton />}>
        <BoardPosts board={board} searchParams={searchParams} />
      </Suspense>
    </>
  );
}
