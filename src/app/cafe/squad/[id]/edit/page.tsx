import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MemberRequired } from "@/components/cafe/CafeNotices";
import { SquadBuilderLoader, SquadBuilderSkeleton } from "@/components/cafe/SquadBuilderLoader";
import { EmptyState } from "@/components/EmptyState";
import { parsePostId } from "@/lib/cafe/boards";
import { getSquad } from "@/lib/cafe/squads";
import { getViewer } from "@/lib/cafe/viewer";
import { getSeasons } from "@/lib/fconline";

export const metadata: Metadata = { title: "드림 스쿼드 고치기" };

async function EditSquad({ params }: { params: Promise<{ id: string }> }) {
  const id = parsePostId((await params).id);
  if (!id) notFound();

  const [squad, viewer, seasons] = await Promise.all([getSquad(id), getViewer(), getSeasons()]);
  if (!squad) notFound();
  if (!viewer?.profile) return <MemberRequired viewer={viewer} next={`/cafe/squad/${id}/edit`} />;
  if (viewer.id !== squad.author.id) return <EmptyState>내가 만든 스쿼드만 고칠 수 있어요.</EmptyState>;

  return <SquadBuilderLoader squad={squad} seasons={seasons} viewer="member" />;
}

export default function EditSquadPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="break-keep">
      <h1 className="mb-4 text-2xl font-bold tracking-tight">드림 스쿼드 고치기</h1>
      <Suspense fallback={<SquadBuilderSkeleton />}>
        <EditSquad params={params} />
      </Suspense>
    </div>
  );
}
