import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Avatar } from "@/components/cafe/Avatar";
import { PostListSkeleton } from "@/components/cafe/CafeSkeletons";
import { MemberRequired } from "@/components/cafe/CafeNotices";
import { MarkNotificationsRead } from "@/components/cafe/MarkNotificationsRead";
import { BallIcon, BellIcon, ChatIcon, HeartIcon, ReplyIcon } from "@/components/Icons";
import { cardClass, mutedClass } from "@/components/ui";
import { postHref } from "@/lib/cafe/boards";
import { listNotifications } from "@/lib/cafe/notifications";
import { nameColorClass } from "@/lib/cafe/shop";
import type { CafeNotification } from "@/lib/cafe/types";
import { getViewer } from "@/lib/cafe/viewer";
import { matchHref } from "@/lib/match-day";
import { formatRelativeTime, todayKst } from "@/lib/time";

export const metadata: Metadata = { title: "내 소식" };

/** 소식을 누르면 갈 곳. 댓글과 답글은 그 댓글 자리로 바로 내려가요. */
function hrefFor(item: CafeNotification): string {
  if (item.match) return matchHref(item.match.day, item.match.id, todayKst()) ?? "/cafe/predict";
  if (!item.post) return "/cafe";
  if (item.comment && !item.comment.deleted) return `${postHref(item.post)}#comment-${item.comment.id}`;
  return postHref(item.post);
}

/** 프로필 그림 오른쪽 아래에 붙는 작은 종류 표시 */
const KIND_MARKS: Record<Exclude<CafeNotification["kind"], "prediction">, { icon: ReactNode; className: string }> = {
  comment: { icon: <ChatIcon className="size-3" />, className: "bg-emerald-500" },
  reply: { icon: <ReplyIcon className="size-3" />, className: "bg-sky-500" },
  like: { icon: <HeartIcon className="size-3" filled />, className: "bg-rose-500" },
};

function Picture({ item }: { item: CafeNotification }) {
  if (item.kind === "prediction" || !item.actor) {
    return (
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        <BallIcon className="size-5" />
      </span>
    );
  }
  const mark = KIND_MARKS[item.kind];
  return (
    <span className="relative shrink-0">
      <Avatar id={item.actor.id} nickname={item.actor.nickname} team={item.actor.team} frame={item.actor.frame} size="lg" />
      <span
        aria-hidden
        className={`absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full text-white ring-2 ring-white dark:ring-zinc-900 ${mark.className}`}
      >
        {mark.icon}
      </span>
    </span>
  );
}

/** 소식 첫 줄. 누가 무엇을 했는지 한 문장으로 말해요. */
function Headline({ item }: { item: CafeNotification }) {
  if (item.kind === "prediction") {
    const goals = item.match?.goals ?? 0;
    return (
      <>
        승부 예측이 맞았어요!{" "}
        {goals > 0 ? (
          <span className="text-emerald-600 tabular-nums dark:text-emerald-400">+{goals}골</span>
        ) : null}
      </>
    );
  }
  const name = (
    <span className={nameColorClass(item.actor?.nameColor ?? null)}>{item.actor?.nickname ?? "알 수 없음"}</span>
  );
  if (item.kind === "comment") return <>{name}님이 내 글에 댓글을 달았어요.</>;
  if (item.kind === "reply") return <>{name}님이 내 댓글에 답글을 달았어요.</>;
  return <>{name}님이 내 글을 추천했어요.</>;
}

/** 소식 둘째 줄. 달린 댓글 내용이나, 하루 예측 골을 다 채운 날의 안내예요. */
function Detail({ item }: { item: CafeNotification }) {
  if (item.kind === "prediction") {
    if ((item.match?.goals ?? 0) > 0) return null;
    return <p className={`mt-0.5 text-sm ${mutedClass}`}>이날 받을 수 있는 예측 골(50골)을 다 받아서 골은 없어요.</p>;
  }
  if (!item.comment) return null;
  if (item.comment.deleted) return <p className={`mt-0.5 text-sm ${mutedClass}`}>삭제된 댓글이에요.</p>;
  return <p className="mt-0.5 line-clamp-2 text-sm text-zinc-700 dark:text-zinc-300">{item.comment.body}</p>;
}

function NotificationItem({ item, now }: { item: CafeNotification; now: Date }) {
  const where = item.kind === "prediction" ? (item.match?.label ?? "경기 결과 보기") : item.post?.title;
  return (
    <li>
      <Link
        href={hrefFor(item)}
        className={`flex gap-3 px-4 py-3.5 transition-colors hover:bg-zinc-50 dark:hover:bg-white/[0.03] ${
          item.read ? "" : "bg-emerald-500/[0.06] dark:bg-emerald-400/[0.06]"
        }`}
      >
        <Picture item={item} />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-snug font-semibold">
            <Headline item={item} />
          </p>
          <Detail item={item} />
          <p className={`mt-1 flex items-center gap-1.5 text-xs ${mutedClass}`}>
            {where ? <span className="truncate">{where}</span> : null}
            {where ? <span aria-hidden>·</span> : null}
            <span className="shrink-0">{formatRelativeTime(item.createdAt, now)}</span>
          </p>
        </div>
        {item.read ? null : (
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-emerald-500">
            <span className="sr-only">새 소식</span>
          </span>
        )}
      </Link>
    </li>
  );
}

async function Notifications() {
  const viewer = await getViewer();
  if (!viewer?.profile) {
    return (
      <MemberRequired viewer={viewer} next="/cafe/notifications">
        회원이 되면 내 글에 달린 댓글과 추천, 승부 예측 결과를 여기서 모아 봐요.
      </MemberRequired>
    );
  }

  const items = await listNotifications();
  if (items.length === 0) {
    return (
      <div className={`${cardClass} flex flex-col items-center gap-3 px-5 py-12 text-center`}>
        <span className="flex size-11 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <BellIcon className="size-5" />
        </span>
        <p className="font-semibold">아직 소식이 없어요.</p>
        <p className={`text-sm ${mutedClass}`}>글을 쓰거나 승부 예측에 참여하면 반응이 여기에 모여요.</p>
      </div>
    );
  }

  const now = new Date();
  return (
    <>
      {items.some((item) => !item.read) ? <MarkNotificationsRead /> : null}
      <ul className={`${cardClass} divide-y divide-zinc-100 dark:divide-white/[0.06]`}>
        {items.map((item) => (
          <NotificationItem key={item.id} item={item} now={now} />
        ))}
      </ul>
    </>
  );
}

export default function NotificationsPage() {
  return (
    <div className="break-keep">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">내 소식</h1>
        <p className={`mt-1 text-sm ${mutedClass}`}>
          내 글과 댓글에 달린 반응, 승부 예측 결과를 모아 보여 줘요. 60일이 지난 소식은 사라져요.
        </p>
      </div>
      <Suspense fallback={<PostListSkeleton rows={6} />}>
        <Notifications />
      </Suspense>
    </div>
  );
}
