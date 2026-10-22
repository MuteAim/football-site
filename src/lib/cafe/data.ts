import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { BEST_LIKES, PAGE_SIZE } from "./config";
import { createSessionClient, publicClient } from "./supabase-server";
import type { Author, Comment, Post, PostSummary, Talk, TalkSide } from "./types";

// 카페 글 읽기예요. 글은 올라오자마자 보여야 해서 저장해 두지 않고 요청 때마다 Supabase에서 읽어요.
// 그래서 이 함수들을 부르는 화면 조각은 꼭 Suspense 안에 둬야 해요.

type RawAuthor = { id: string; nickname: string; is_manager: boolean };
// 글쓴이는 한 명이라 실제로는 객체로 오지만, DB 구조를 모르는 타입 추론은 배열로 봐서 둘 다 받아요.
type RawAuthorField = RawAuthor | RawAuthor[] | null;

type RawPostSummary = {
  id: number;
  board: string;
  title: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  created_at: string;
  author: RawAuthorField;
};

type RawPost = RawPostSummary & { body: string; updated_at: string | null };

type RawComment = { id: number; body: string; created_at: string; author: RawAuthorField };

type RawTalk = {
  id: number;
  user_id: string;
  side: TalkSide | null;
  body: string;
  created_at: string;
  author: RawAuthorField;
};

// 글과 회원은 작성자(user_id) 말고 추천(post_likes)으로도 이어져 있어서, 어느 쪽으로 이을지 꼭 적어 줘야 해요.
const AUTHOR = "author:profiles!user_id(id, nickname, is_manager)";
const POST_SUMMARY = `id, board, title, view_count, like_count, comment_count, created_at, ${AUTHOR}`;

function toAuthor(field: RawAuthorField): Author {
  const raw = Array.isArray(field) ? field[0] : field;
  if (!raw) return { id: "", nickname: "알 수 없음", isManager: false };
  return { id: raw.id, nickname: raw.nickname, isManager: raw.is_manager };
}

function toPostSummary(raw: RawPostSummary): PostSummary {
  return {
    id: raw.id,
    board: raw.board,
    title: raw.title,
    viewCount: raw.view_count,
    likeCount: raw.like_count,
    commentCount: raw.comment_count,
    createdAt: raw.created_at,
    author: toAuthor(raw.author),
  };
}

export class CafeError extends Error {
  constructor(message: string) {
    super(`카페 데이터를 불러오지 못했어요: ${message}`);
    this.name = "CafeError";
  }
}

/** 게시판 글 목록. slug가 비어 있으면 전체글, best면 인기글이에요. */
export async function listPosts(
  slug: string,
  page: number,
): Promise<{ posts: PostSummary[]; total: number }> {
  const supabase = await publicClient();
  const from = (page - 1) * PAGE_SIZE;

  let query = supabase.from("posts").select(POST_SUMMARY, { count: "exact" });
  if (slug === "best") query = query.gte("like_count", BEST_LIKES);
  else if (slug) query = query.eq("board", slug);

  const { data, count, error } = await query
    .order("id", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  // 글 수보다 뒤 페이지를 열면 Supabase가 범위 오류를 줘서 빈 목록으로 바꿔요.
  if (error?.code === "PGRST103") return { posts: [], total: await countPosts(slug) };
  if (error) throw new CafeError(error.message);
  return { posts: (data as RawPostSummary[]).map(toPostSummary), total: count ?? 0 };
}

async function countPosts(slug: string): Promise<number> {
  const supabase = await publicClient();
  let query = supabase.from("posts").select("id", { count: "exact", head: true });
  if (slug === "best") query = query.gte("like_count", BEST_LIKES);
  else if (slug) query = query.eq("board", slug);
  const { count, error } = await query;
  if (error) throw new CafeError(error.message);
  return count ?? 0;
}

/** 최근 7일 동안 추천을 가장 많이 받은 글. */
export async function listWeeklyBest(limit = 5): Promise<PostSummary[]> {
  const supabase = await publicClient();
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SUMMARY)
    .gte("created_at", since)
    .gt("like_count", 0)
    .order("like_count", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw new CafeError(error.message);
  return (data as RawPostSummary[]).map(toPostSummary);
}

/** 글 하나. 화면 제목과 본문이 같이 불러도 한 번만 읽어요. */
export const getPost = cache(async (id: number): Promise<Post | null> => {
  const supabase = await publicClient();
  const { data, error } = await supabase
    .from("posts")
    .select(`${POST_SUMMARY}, body, updated_at`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new CafeError(error.message);
  if (!data) return null;
  const raw = data as RawPost;
  return { ...toPostSummary(raw), body: raw.body, updatedAt: raw.updated_at };
});

export async function listComments(postId: number): Promise<Comment[]> {
  const supabase = await publicClient();
  const { data, error } = await supabase
    .from("comments")
    .select(`id, body, created_at, ${AUTHOR}`)
    .eq("post_id", postId)
    .order("id", { ascending: true })
    .limit(500);
  if (error) throw new CafeError(error.message);
  return (data as RawComment[]).map((raw) => ({
    id: raw.id,
    body: raw.body,
    createdAt: raw.created_at,
    author: toAuthor(raw.author),
  }));
}

/** 내가 이 글을 추천했는지. 추천 기록은 본인 것만 보여서 로그인 쿠키를 실어 읽어요. */
export async function hasLiked(postId: number, viewerId: string): Promise<boolean> {
  await connection();
  const supabase = await createSessionClient();
  const { data } = await supabase
    .from("post_likes")
    .select("post_id")
    .eq("post_id", postId)
    .eq("user_id", viewerId)
    .maybeSingle();
  return data != null;
}

/** 경기 응원톡 최근 메시지. 오래된 것부터 순서대로 돌려줘요. */
export async function listTalks(
  matchId: number,
  limit = 100,
): Promise<{ talks: Talk[]; authors: Author[] }> {
  const supabase = await publicClient();
  const { data, error } = await supabase
    .from("match_talks")
    .select(`id, user_id, side, body, created_at, ${AUTHOR}`)
    .eq("match_id", matchId)
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw new CafeError(error.message);

  const rows = (data as RawTalk[]).reverse();
  const authors = new Map<string, Author>();
  for (const row of rows) {
    const author = toAuthor(row.author);
    if (author.id) authors.set(author.id, author);
  }
  return {
    talks: rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      side: row.side,
      body: row.body,
      createdAt: row.created_at,
    })),
    authors: [...authors.values()],
  };
}

/** 홈팀과 원정팀을 응원한 메시지 수. 응원 게이지에 써요. */
export async function countTalkSides(matchId: number): Promise<{ home: number; away: number }> {
  const supabase = await publicClient();
  const count = async (side: TalkSide) => {
    const { count, error } = await supabase
      .from("match_talks")
      .select("id", { count: "exact", head: true })
      .eq("match_id", matchId)
      .eq("side", side);
    if (error) throw new CafeError(error.message);
    return count ?? 0;
  };
  const [home, away] = await Promise.all([count("home"), count("away")]);
  return { home, away };
}
