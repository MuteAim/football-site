import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EditorSkeleton } from "@/components/cafe/CafeSkeletons";
import { MemberRequired } from "@/components/cafe/CafeNotices";
import { PostEditor } from "@/components/cafe/PostEditor";
import { EmptyState } from "@/components/EmptyState";
import { parsePostId, postHref } from "@/lib/cafe/boards";
import { getPost } from "@/lib/cafe/data";
import { getViewer } from "@/lib/cafe/viewer";

export const metadata: Metadata = { title: "글 고치기" };

async function EditContent({ params }: { params: PageProps<"/cafe/[board]/[id]/edit">["params"] }) {
  const { board, id: rawId } = await params;
  const id = parsePostId(rawId);
  if (!id) notFound();

  const [post, viewer] = await Promise.all([getPost(id), getViewer()]);
  if (!post || post.board !== board) notFound();
  if (!viewer?.profile) return <MemberRequired viewer={viewer} next={`${postHref(post)}/edit`} />;
  if (viewer.id !== post.author.id) return <EmptyState>내가 쓴 글만 고칠 수 있어요.</EmptyState>;

  return (
    <PostEditor
      post={{ id: post.id, board: post.board, title: post.title, body: post.body }}
      cancelHref={postHref(post)}
    />
  );
}

export default function EditPage({ params }: PageProps<"/cafe/[board]/[id]/edit">) {
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold tracking-tight">글 고치기</h1>
      <Suspense fallback={<EditorSkeleton />}>
        <EditContent params={params} />
      </Suspense>
    </>
  );
}
