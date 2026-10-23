import type { Metadata } from "next";
import { Suspense } from "react";
import { EditorSkeleton } from "@/components/cafe/CafeSkeletons";
import { MemberRequired, WriteLocked } from "@/components/cafe/CafeNotices";
import { PostEditor } from "@/components/cafe/PostEditor";
import { isWritableBoard, parsePostId } from "@/lib/cafe/boards";
import { lockFor } from "@/lib/cafe/settings";
import { getSquad } from "@/lib/cafe/squads";
import { getViewer } from "@/lib/cafe/viewer";

export const metadata: Metadata = { title: "글쓰기" };

async function WriteContent({ searchParams }: { searchParams: PageProps<"/cafe/write">["searchParams"] }) {
  const [{ board, squad: squadParam }, viewer] = await Promise.all([searchParams, getViewer()]);
  const slug = typeof board === "string" && isWritableBoard(board) ? board : "free";
  const squadId = typeof squadParam === "string" ? parsePostId(squadParam) : null;

  if (!viewer?.profile) {
    return (
      <MemberRequired viewer={viewer} next={`/cafe/write?board=${slug}${squadId ? `&squad=${squadId}` : ""}`}>
        글쓰기는 카페 회원만 할 수 있어요.
      </MemberRequired>
    );
  }
  const lock = await lockFor(viewer.profile);
  if (lock) return <WriteLocked message={lock.message} />;

  // 드림 스쿼드 화면의 '카페에 자랑하기'로 왔으면 그 스쿼드를 붙여요. 내 스쿼드만 붙일 수 있어요.
  const squad = squadId ? await getSquad(squadId) : null;
  if (squad && squad.author.id === viewer.id) {
    return (
      <PostEditor
        defaultBoard={slug}
        cancelHref={`/cafe/squad/${squad.id}`}
        squad={{ id: squad.id, name: squad.name, formation: squad.formation, players: squad.players }}
      />
    );
  }
  return <PostEditor defaultBoard={slug} cancelHref={`/cafe/${slug}`} />;
}

export default function WritePage({ searchParams }: PageProps<"/cafe/write">) {
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold tracking-tight">글쓰기</h1>
      <Suspense fallback={<EditorSkeleton />}>
        <WriteContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
