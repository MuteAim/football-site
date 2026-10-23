import type { Metadata } from "next";
import { Suspense } from "react";
import { EditorSkeleton } from "@/components/cafe/CafeSkeletons";
import { MemberRequired, WriteLocked } from "@/components/cafe/CafeNotices";
import { PostEditor } from "@/components/cafe/PostEditor";
import { isWritableBoard } from "@/lib/cafe/boards";
import { lockFor } from "@/lib/cafe/settings";
import { getViewer } from "@/lib/cafe/viewer";

export const metadata: Metadata = { title: "글쓰기" };

async function WriteContent({ searchParams }: { searchParams: PageProps<"/cafe/write">["searchParams"] }) {
  const [{ board }, viewer] = await Promise.all([searchParams, getViewer()]);
  const slug = typeof board === "string" && isWritableBoard(board) ? board : "free";

  if (!viewer?.profile) {
    return (
      <MemberRequired viewer={viewer} next={`/cafe/write?board=${slug}`}>
        글쓰기는 카페 회원만 할 수 있어요.
      </MemberRequired>
    );
  }
  const lock = await lockFor(viewer.profile);
  if (lock) return <WriteLocked message={lock.message} />;
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
