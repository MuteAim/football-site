import Link from "next/link";
import { getBoard, postHref } from "@/lib/cafe/boards";
import { nameColorClass } from "@/lib/cafe/shop";
import type { PostSummary } from "@/lib/cafe/types";
import { formatPostTime } from "@/lib/time";
import { ChatIcon, HeartIcon } from "../Icons";
import { LinkPending } from "../LinkPending";
import { cardListClass } from "../ui";
import { LevelBadge, RoleBadge, TeamCrest } from "./Avatar";

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

/** 휴대폰에서는 제목 두 줄과 작성자·시각·댓글 수를 먼저 보여 줘요. */
function PostRow({ post, showBoard, now }: { post: PostSummary; showBoard: boolean; now: Date }) {
  return (
    <li>
      <Link
        href={postHref(post)}
        className="group relative -mx-4 block px-4 py-4 transition-colors hover:bg-emerald-50/50 dark:hover:bg-white/[0.03]"
      >
        {showBoard ? <p className="mb-1.5 text-[11px] sm:hidden"><BoardChip slug={post.board} /></p> : null}
        <p className="flex items-start gap-2">
          {post.pinned ? (
            <span className="shrink-0 rounded bg-rose-500/10 px-1 py-px text-[11px] font-bold text-rose-600 dark:text-rose-300">
              공지
            </span>
          ) : null}
          <span className="line-clamp-2 min-w-0 flex-1 text-[15px] leading-6 font-semibold break-words transition group-hover:text-emerald-700 sm:line-clamp-1 dark:group-hover:text-emerald-400">{post.title}</span>
          {post.commentCount > 0 ? (
            <span aria-label={`댓글 ${post.commentCount}개`} className="inline-flex h-7 min-w-10 shrink-0 items-center justify-center gap-1 rounded-lg bg-emerald-500/[0.08] px-1.5 text-xs font-bold text-emerald-700 tabular-nums dark:text-emerald-400">
              <ChatIcon className="size-3.5" />
              {post.commentCount}
            </span>
          ) : null}
        </p>
        <p className="mt-2 flex min-w-0 items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 sm:mt-1">
          {showBoard ? (
            <span className="hidden shrink-0 items-center gap-1.5 sm:inline-flex">
              <BoardChip slug={post.board} />
              <Dot />
            </span>
          ) : null}
          <span className="flex min-w-0 flex-1 items-center gap-1 sm:flex-initial">
            <TeamCrest team={post.author.team} />
            <span className={`truncate ${nameColorClass(post.author.nameColor)}`}>{post.author.nickname}</span>
          </span>
          <span className="hidden shrink-0 items-center gap-1.5 sm:inline-flex">
            <LevelBadge goals={post.author.goals} />
            <RoleBadge author={post.author} />
            <Dot />
          </span>
          <time dateTime={post.createdAt} className="shrink-0 tabular-nums">{formatPostTime(post.createdAt, now)}</time>
          <span className="hidden shrink-0 items-center gap-1.5 sm:inline-flex">
            <Dot />
            <span className="tabular-nums">조회 {post.viewCount}</span>
            {post.likeCount > 0 ? (
              <span className="inline-flex items-center gap-0.5 font-medium text-rose-500 tabular-nums dark:text-rose-400">
                <HeartIcon filled className="size-3" />
                {post.likeCount}
              </span>
            ) : null}
          </span>
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
