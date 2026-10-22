import { getCompetition } from "../competitions";
import { BEST_LIKES } from "./config";

// 카페 게시판 목록이에요. 배열 순서가 게시판 탭 순서가 됩니다.
// 글을 쓸 수 있는 게시판(writable)을 늘리거나 줄이면 supabase/schema.sql의 posts_board_check도 같이 고쳐 주세요.
export type Board = {
  slug: string;
  name: string;
  short: string;
  description: string;
  writable: boolean;
  /** 목록에서 게시판 이름 앞에 찍는 점 색. 리그 게시판은 대회 고유색을 써요. */
  color: string;
};

function leagueBoard(code: string, description: string): Board {
  const competition = getCompetition(code);
  return {
    slug: code,
    name: competition?.name ?? code,
    short: competition?.short ?? code,
    description,
    writable: true,
    color: competition?.color ?? "#52525b",
  };
}

export const BOARDS: Board[] = [
  {
    slug: "best",
    name: "인기글",
    short: "인기글",
    description: `추천을 ${BEST_LIKES}개 이상 받은 글을 모았어요.`,
    writable: false,
    color: "#e11d48",
  },
  {
    slug: "free",
    name: "자유게시판",
    short: "자유",
    description: "축구 이야기라면 뭐든 좋아요.",
    writable: true,
    color: "#059669",
  },
  leagueBoard("PL", "프리미어리그 팬들의 수다방이에요."),
  leagueBoard("PD", "라리가 이야기를 나눠요."),
  leagueBoard("BL1", "분데스리가 이야기를 나눠요."),
  leagueBoard("SA", "세리에 A 이야기를 나눠요."),
  leagueBoard("FL1", "리그 1 이야기를 나눠요."),
  leagueBoard("CL", "유럽 대항전 이야기를 나눠요."),
  {
    slug: "etc",
    name: "기타 리그",
    short: "기타",
    description: "챔피언십, 에레디비시, 남미 축구, 국가대표 이야기를 나눠요.",
    writable: true,
    color: "#52525b",
  },
];

/** 모든 게시판의 글을 한데 모은 첫 화면. 실제 게시판은 아니라서 주소에 이름이 없어요. */
export const ALL_BOARD: Board = {
  slug: "",
  name: "전체글",
  short: "전체",
  description: "카페에 올라온 모든 글이에요.",
  writable: false,
  color: "#52525b",
};

const BY_SLUG = new Map(BOARDS.map((board) => [board.slug, board]));

export function getBoard(slug: string): Board | undefined {
  return BY_SLUG.get(slug);
}

export const WRITABLE_BOARDS = BOARDS.filter((board) => board.writable);

export function isWritableBoard(slug: string): boolean {
  return BY_SLUG.get(slug)?.writable === true;
}

export function boardHref(board: Board): string {
  return board.slug ? `/cafe/${board.slug}` : "/cafe";
}

export function postHref(post: { board: string; id: number }): string {
  return `/cafe/${post.board}/${post.id}`;
}

/** 주소의 글 번호. 숫자가 아니면 null이에요. */
export function parsePostId(value: string): number | null {
  const id = Number(value);
  return /^\d+$/.test(value) && Number.isSafeInteger(id) && id > 0 ? id : null;
}
