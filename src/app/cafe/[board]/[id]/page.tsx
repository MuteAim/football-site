import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar, LevelBadge, NameBadge } from "@/components/cafe/Avatar";
import { PostSkeleton } from "@/components/cafe/CafeSkeletons";
import { CommentForm } from "@/components/cafe/CommentForm";
import { CommentThread, ReplyButton } from "@/components/cafe/CommentThread";
import { ConfirmButton } from "@/components/cafe/ConfirmButton";
import { LikeButton } from "@/components/cafe/LikeButton";
import { LoginLink } from "@/components/cafe/LoginLink";
import { RichText } from "@/components/cafe/RichText";
import { ViewCounter } from "@/components/cafe/ViewCounter";
import { ChevronLeftIcon, EyeIcon, ReplyIcon } from "@/components/Icons";
import {
  cardClass,
  cardHeadingClass,
  cardListClass,
  mutedClass,
  primaryButtonClass,
  secondaryButtonClass,
  textButtonClass,
} from "@/components/ui";
import { deleteComment, deletePost } from "@/lib/cafe/actions";
import { boardHref, getBoard, parsePostId, postHref } from "@/lib/cafe/boards";
import { isCafeConfigured } from "@/lib/cafe/config";
import { getPost, hasLiked, listComments } from "@/lib/cafe/data";
import type { Comment, Post, Viewer } from "@/lib/cafe/types";
import { getViewer } from "@/lib/cafe/viewer";
import { formatDateTime, formatRelativeTime } from "@/lib/time";

type Params = PageProps<"/cafe/[board]/[id]">["params"];

export async function generateMetadata({ params }: PageProps<"/cafe/[board]/[id]">): Promise<Metadata> {
  const id = parsePostId((await params).id);
  const post = id && isCafeConfigured() ? await getPost(id) : null;
  return { title: post?.title ?? "글을 찾을 수 없어요" };
}

/** 댓글 한 줄. 답글은 작은 프로필 그림과 꺾인 화살표로 보여 줘요. */
function CommentItem({
  comment,
  post,
  viewer,
  now,
  isReply,
  canReply,
}: {
  comment: Comment;
  post: Post;
  viewer: Viewer | null;
  now: Date;
  isReply: boolean;
  canReply: boolean;
}) {
  const arrow = isReply ? <ReplyIcon className="mt-1 size-3.5 shrink-0 text-zinc-300 dark:text-zinc-600" /> : null;

  // 답글이 남아 있어서 자리만 남은 댓글이에요.
  if (comment.deleted) {
    return (
      <div className="flex items-center gap-2 py-3">
        {arrow}
        <p className={`text-sm ${mutedClass}`}>삭제된 댓글이에요.</p>
      </div>
    );
  }

  const canDelete = viewer?.id === comment.author.id || viewer?.profile?.isManager === true;
  return (
    <div className={`flex ${isReply ? "gap-2 py-2.5" : "gap-2.5 py-3"}`}>
      {arrow}
      <Avatar
        id={comment.author.id}
        nickname={comment.author.nickname}
        team={comment.author.team}
        size={isReply ? "sm" : "md"}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="truncate text-sm font-semibold">{comment.author.nickname}</span>
          <LevelBadge goals={comment.author.goals} />
          {comment.author.id === post.author.id ? <NameBadge tone="zinc">글쓴이</NameBadge> : null}
          {comment.author.isManager ? <NameBadge>매니저</NameBadge> : null}
          <span className="shrink-0 text-zinc-400 dark:text-zinc-500">
            {formatRelativeTime(comment.createdAt, now)}
          </span>
          <div className="ml-auto flex shrink-0 items-center">
            {/* 답글에서 누르면 그 사람 닉네임을 붙여서 같은 댓글 아래에 답글을 달아요. */}
            {canReply ? <ReplyButton mention={isReply ? comment.author.nickname : undefined} /> : null}
            {canDelete ? (
              <form action={deleteComment}>
                <input type="hidden" name="commentId" value={comment.id} />
                <ConfirmButton message="이 댓글을 지울까요?">삭제</ConfirmButton>
              </form>
            ) : null}
          </div>
        </div>
        <RichText text={comment.body} className="mt-1 text-[15px] leading-relaxed" />
      </div>
    </div>
  );
}

function CommentSection({
  post,
  comments,
  viewer,
  now,
}: {
  post: Post;
  comments: Comment[];
  viewer: Viewer | null;
  now: Date;
}) {
  const next = postHref(post);
  const tops = comments.filter((comment) => comment.parentId === null);
  const replies = new Map<number, Comment[]>();
  for (const comment of comments) {
    if (comment.parentId === null) continue;
    const list = replies.get(comment.parentId);
    if (list) list.push(comment);
    else replies.set(comment.parentId, [comment]);
  }
  // "삭제된 댓글" 자리는 댓글 수에 넣지 않아요. 글 목록의 댓글 수와 같아요.
  const count = comments.filter((comment) => !comment.deleted).length;

  return (
    <section className={`${cardClass} mt-3`}>
      <h2 className={cardHeadingClass}>
        댓글 <span className="text-emerald-600 tabular-nums dark:text-emerald-400">{count}</span>
      </h2>
      {tops.length > 0 ? (
        <ul className={cardListClass}>
          {tops.map((top) => {
            const thread = replies.get(top.id) ?? [];
            // 지워진 댓글에는 DB가 답글을 받지 않아서 버튼도 숨겨요.
            const canReply = viewer?.profile != null && !top.deleted;
            const item = (
              <>
                <CommentItem comment={top} post={post} viewer={viewer} now={now} isReply={false} canReply={canReply} />
                {thread.length > 0 ? (
                  <ul className="mb-3 divide-y divide-zinc-200/70 rounded-xl bg-zinc-50 px-3 dark:divide-white/[0.06] dark:bg-white/[0.03]">
                    {thread.map((reply) => (
                      <li key={reply.id}>
                        <CommentItem comment={reply} post={post} viewer={viewer} now={now} isReply canReply={canReply} />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            );
            return (
              <li key={top.id}>
                {canReply ? (
                  <CommentThread postId={post.id} parentId={top.id}>
                    {item}
                  </CommentThread>
                ) : (
                  item
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={`px-4 py-6 text-center text-sm ${mutedClass}`}>첫 댓글을 남겨 보세요.</p>
      )}
      <div className="border-t border-zinc-100 dark:border-white/[0.07]">
        {viewer?.profile ? (
          <CommentForm postId={post.id} />
        ) : (
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <p className={`text-sm ${mutedClass}`}>
              {viewer ? "닉네임을 정하면 댓글을 달 수 있어요." : "로그인하면 댓글을 달 수 있어요."}
            </p>
            {viewer ? (
              <Link href={`/cafe/me?next=${encodeURIComponent(next)}`} className={primaryButtonClass}>
                닉네임 정하기
              </Link>
            ) : (
              <LoginLink next={next} className={primaryButtonClass}>
                로그인
              </LoginLink>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

async function PostContent({ params }: { params: Params }) {
  const { board: slug, id: rawId } = await params;
  const id = parsePostId(rawId);
  if (!id) notFound();

  const [post, comments, viewer] = await Promise.all([getPost(id), listComments(id), getViewer()]);
  const board = getBoard(slug);
  if (!post || !board || post.board !== slug) notFound();

  const liked = viewer?.profile ? await hasLiked(id, viewer.id) : false;
  const isOwner = viewer?.id === post.author.id;
  const canDelete = isOwner || viewer?.profile?.isManager === true;
  const now = new Date();

  return (
    <>
      <ViewCounter postId={post.id} />
      <Link
        href={boardHref(board)}
        className="mb-3 inline-flex items-center gap-0.5 text-sm font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
      >
        <ChevronLeftIcon className="size-4" />
        {board.name}
      </Link>

      <article className={cardClass}>
        <header className="border-b border-zinc-100 px-5 pt-5 pb-4 dark:border-white/[0.07]">
          <h1 className="text-xl leading-snug font-bold tracking-tight break-words">{post.title}</h1>
          <div className="mt-3 flex items-center gap-2.5">
            <Avatar id={post.author.id} nickname={post.author.nickname} team={post.author.team} size="lg" />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <span className="truncate">{post.author.nickname}</span>
                <LevelBadge goals={post.author.goals} />
                {post.author.isManager ? <NameBadge>매니저</NameBadge> : null}
              </p>
              <p className={`mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs tabular-nums ${mutedClass}`}>
                <span>{formatDateTime(post.createdAt)}</span>
                {post.updatedAt ? <span>(수정됨)</span> : null}
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-0.5">
                  <EyeIcon className="size-3.5" />
                  <span className="sr-only">조회</span>
                  {post.viewCount}
                </span>
              </p>
            </div>
          </div>
        </header>

        <RichText text={post.body} className="px-5 py-6 text-[15px] leading-relaxed" />

        <div className="flex justify-center px-5 pb-6">
          {/* 서버에서 새 추천 수가 오면 버튼도 그 값으로 다시 시작해요. */}
          <LikeButton
            key={`${post.id}:${liked}:${post.likeCount}`}
            postId={post.id}
            initialLiked={liked}
            initialCount={post.likeCount}
            disabledReason={
              !viewer?.profile
                ? "카페 회원이 되면 추천할 수 있어요."
                : isOwner
                  ? "내 글은 추천할 수 없어요."
                  : undefined
            }
          />
        </div>

        {canDelete ? (
          <div className="flex justify-end gap-1 border-t border-zinc-100 px-4 py-2 dark:border-white/[0.07]">
            {isOwner ? (
              <Link href={`${postHref(post)}/edit`} className={textButtonClass}>
                수정
              </Link>
            ) : null}
            <form action={deletePost}>
              <input type="hidden" name="postId" value={post.id} />
              <ConfirmButton message="이 글을 지울까요? 댓글도 함께 지워져요.">삭제</ConfirmButton>
            </form>
          </div>
        ) : null}
      </article>

      <CommentSection post={post} comments={comments} viewer={viewer} now={now} />

      <div className="mt-4 flex justify-center">
        <Link href={boardHref(board)} className={secondaryButtonClass}>
          목록으로
        </Link>
      </div>
    </>
  );
}

export default function PostPage({ params }: PageProps<"/cafe/[board]/[id]">) {
  return (
    <Suspense fallback={<PostSkeleton />}>
      <PostContent params={params} />
    </Suspense>
  );
}
