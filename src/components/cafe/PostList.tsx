import Link from "next/link";
import { getBoard, postHref } from "@/lib/cafe/boards";
import type { PostSummary } from "@/lib/cafe/types";
import { formatPostTime } from "@/lib/time";
import { HeartIcon } from "../Icons";
import { LinkPending } from "../LinkPending";
import { cardListClass } from "../ui";
import { NameBadge, TeamCrest } from "./Avatar";

/** 게시판 이름 앞에 대회 고유색 점을 찍어서 어느 게시판 글인지 한눈에 보여 줘요. */
export function BoardChip({ slug }: { slug: string }) {
  const board = getBoard(slug);
  if (!board) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 font-medium text-zinc-600 dark:text-zinc-300">
      {/* EPL·챔스처럼 아주 진한 색은 어두운 화면에서 안 보여서 옅은 테두리를 둘러요. */}
      <span className="size-1.5 rounded-full dark:ring-1 dark:ring-white/40" style={{ backgroundColor: board.color }} />
      {board.short}
    </span>
  );
}

function Dot() {
  return <span aria-hidden className="text-zinc-300 dark:text-zinc-600">·</span>;
}

/** 글 한 줄. 제목 옆 초록 숫자는 댓글 수예요. */
function PostRow({ post, showBoard, now }: { post: PostSummary; showBoard: boolean; now: Date }) {
  return (
    <li>
      <Link
        href={postHref(post)}
        className="relative -mx-4 block px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-white/[0.03]"
      >
        <p className="flex items-baseline gap-1.5">
          <span className="min-w-0 truncate text-[15px] font-medium">{post.title}</span>
          {post.commentCount > 0 ? (
            <span className="shrink-0 text-[13px] font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">
              [{post.commentCount}]
            </span>
          ) : null}
        </p>
        <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          {showBoard ? (
            <>
              <BoardChip slug={post.board} />
              <Dot />
            </>
          ) : null}
          <span className="flex min-w-0 items-center gap-1">
            <TeamCrest team={post.author.team} />
            <span className="truncate">{post.author.nickname}</span>
          </span>
          {post.author.isManager ? <NameBadge>매니저</NameBadge> : null}
          <Dot />
          <span className="shrink-0 tabular-nums">{formatPostTime(post.createdAt, now)}</span>
          <Dot />
          <span className="shrink-0 tabular-nums">조회 {post.viewCount}</span>
          {post.likeCount > 0 ? (
            <span className="ml-0.5 inline-flex shrink-0 items-center gap-0.5 font-medium text-rose-500 tabular-nums dark:text-rose-400">
              <HeartIcon filled className="size-3" />
              {post.likeCount}
            </span>
          ) : null}
        </p>
        <LinkPending className="bg-emerald-500/10" />
      </Link>
    </li>
  );
}

export function PostList({
  posts,
  showBoard,
  now,
}: {
  posts: PostSummary[];
  showBoard: boolean;
  now: Date;
}) {
  return (
    <ul className={cardListClass}>
      {posts.map((post) => (
        <PostRow key={post.id} post={post} showBoard={showBoard} now={now} />
      ))}
    </ul>
  );
}
