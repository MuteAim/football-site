import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar, LevelBadge, RoleBadge } from "@/components/cafe/Avatar";
import { PostSkeleton } from "@/components/cafe/CafeSkeletons";
import { ConfirmButton } from "@/components/cafe/ConfirmButton";
import { ShareLinkButton } from "@/components/cafe/ShareLinkButton";
import { NexonCredit, SquadPitch, SquadPlayerList } from "@/components/cafe/SquadPitch";
import { ChevronLeftIcon } from "@/components/Icons";
import { cardClass, mutedClass, primaryButtonClass, textButtonClass } from "@/components/ui";
import { deleteSquad } from "@/lib/cafe/actions";
import { parsePostId } from "@/lib/cafe/boards";
import { isCafeConfigured } from "@/lib/cafe/config";
import { isStaff } from "@/lib/cafe/profile";
import { nameColorClass } from "@/lib/cafe/shop";
import { getSquad } from "@/lib/cafe/squads";
import { getViewer } from "@/lib/cafe/viewer";
import { getSeasons } from "@/lib/fconline";
import { formatDateTime } from "@/lib/time";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const id = parsePostId((await params).id);
  const squad = id && isCafeConfigured() ? await getSquad(id) : null;
  return { title: squad ? `${squad.name} · 드림 스쿼드` : "스쿼드를 찾을 수 없어요" };
}

/** 스쿼드 화면. 누구나 보고 링크로 공유해요. 만든 사람은 고치고 카페에 올리고, 매니저도 지울 수 있어요. */
async function SquadContent({ params }: { params: Params }) {
  const id = parsePostId((await params).id);
  if (!id) notFound();

  const [squad, viewer, seasons] = await Promise.all([getSquad(id), getViewer(), getSeasons()]);
  if (!squad) notFound();
  const isOwner = viewer?.id === squad.author.id;
  const canDelete = isOwner || isStaff(viewer?.profile);

  return (
    <>
      <Link
        href="/cafe/squad"
        className="mb-3 inline-flex items-center gap-0.5 text-sm font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
      >
        <ChevronLeftIcon className="size-4" />
        드림 스쿼드
      </Link>

      <article className={cardClass}>
        <header className="border-b border-zinc-100 px-5 pt-5 pb-4 dark:border-white/[0.07]">
          <h1 className="text-xl leading-snug font-bold tracking-tight break-words">{squad.name}</h1>
          <div className="mt-3 flex items-center gap-2.5">
            <Avatar
              id={squad.author.id}
              nickname={squad.author.nickname}
              team={squad.author.team}
              frame={squad.author.frame}
              size="md"
            />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <span className={`truncate ${nameColorClass(squad.author.nameColor)}`}>{squad.author.nickname}</span>
                <LevelBadge goals={squad.author.goals} />
                <RoleBadge author={squad.author} />
              </p>
              <p className={`text-xs tabular-nums ${mutedClass}`}>
                {squad.formation} · {formatDateTime(squad.updatedAt ?? squad.createdAt)}
                {squad.updatedAt ? " (고침)" : ""}
              </p>
            </div>
          </div>
        </header>

        <div className="p-4">
          <SquadPitch formation={squad.formation} players={squad.players} seasons={seasons} />
        </div>
        <div className="px-4 pb-2">
          <SquadPlayerList formation={squad.formation} players={squad.players} seasons={seasons} />
        </div>

        <div className="flex justify-end gap-1 border-t border-zinc-100 px-4 py-2 dark:border-white/[0.07]">
          <ShareLinkButton />
          {isOwner ? (
            <Link href={`/cafe/squad/${squad.id}/edit`} className={textButtonClass}>
              고치기
            </Link>
          ) : null}
          {canDelete ? (
            <form action={deleteSquad}>
              <input type="hidden" name="squadId" value={squad.id} />
              <ConfirmButton title="이 스쿼드를 지울까요?" description="이 스쿼드를 붙인 글에서도 빠지고, 되돌릴 수 없어요.">
                지우기
              </ConfirmButton>
            </form>
          ) : null}
        </div>
      </article>

      {isOwner ? (
        <div className="mt-4 flex justify-center">
          <Link href={`/cafe/write?squad=${squad.id}`} className={primaryButtonClass}>
            카페에 자랑하기
          </Link>
        </div>
      ) : null}
      <NexonCredit className="mt-3 text-center" />
    </>
  );
}

export default function SquadPage({ params }: { params: Params }) {
  return (
    <div className="break-keep">
      <Suspense fallback={<PostSkeleton />}>
        <SquadContent params={params} />
      </Suspense>
    </div>
  );
}
