import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BoardView } from "@/components/cafe/BoardView";
import { BoardSkeleton } from "@/components/cafe/CafeSkeletons";
import { BOARDS, getBoard } from "@/lib/cafe/boards";

// 게시판 목록은 정해져 있어서 제목 줄까지는 빌드할 때 모두 만들어 둬요. 글 목록은 볼 때마다 새로 읽어요.
export function generateStaticParams() {
  return BOARDS.map((board) => ({ board: board.slug }));
}

export async function generateMetadata({ params }: PageProps<"/cafe/[board]">): Promise<Metadata> {
  const { board } = await params;
  return { title: getBoard(board)?.name ?? "게시판을 찾을 수 없어요" };
}

async function BoardForParams({
  params,
  searchParams,
}: {
  params: PageProps<"/cafe/[board]">["params"];
  searchParams: PageProps<"/cafe/[board]">["searchParams"];
}) {
  const board = getBoard((await params).board);
  if (!board) notFound();
  return <BoardView board={board} searchParams={searchParams} />;
}

export default function BoardPage({ params, searchParams }: PageProps<"/cafe/[board]">) {
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <BoardForParams params={params} searchParams={searchParams} />
    </Suspense>
  );
}
