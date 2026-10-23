import { BoardView } from "@/components/cafe/BoardView";
import { ALL_BOARD } from "@/lib/cafe/boards";
import { GamePromo } from "@/components/games/GamePromo";

// 카페 첫 화면은 모든 게시판의 글을 최신순으로 보여 주고, 첫 쪽 위에는 이번 주 인기글을 붙여요.
export default function CafeHomePage({ searchParams }: PageProps<"/cafe">) {
  return <><GamePromo /><BoardView board={ALL_BOARD} searchParams={searchParams} /></>;
}
