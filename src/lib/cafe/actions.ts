"use server";

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { refresh } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cardNames } from "../fconline";
import { getMatchOnDay } from "../match-day";
import { isPredictionOpen } from "../match-display";
import { isDateKey } from "../time";
import { lockNotice } from "./banner";
import { getBoard, isWritableBoard, postHref } from "./boards";
import {
  FLASH_COOKIE,
  LIMITS,
  LOGIN_PROVIDERS,
  NICKNAME_HINT,
  NICKNAME_PATTERN,
  PREDICTION_PICKS,
  isCafeConfigured,
  safeNext,
} from "./config";
import { countPredictions } from "./predictions";
import { getCafeSettings } from "./settings";
import type { ShopKind } from "./shop";
import { isFormation, playerIdOf, SQUAD_LIMITS, SQUAD_SIZE, type SquadPlayer } from "./squad";
import { createSessionClient } from "./supabase-server";
import { findTeamChoice } from "./teams";
import type { FormState, PredictionCounts, PredictionPick, Talk, TalkSide } from "./types";

// 카페의 모든 쓰기 동작이에요.
// 서버 동작은 화면을 거치지 않고도 불릴 수 있어서, 매번 로그인과 입력값을 서버에서 다시 확인해요.
// DB에도 같은 규칙(본인 글만 수정, 글자 수, 도배 방지)이 있어서 여기를 건너뛰어도 막혀요.

/** staff는 매니저나 운영자예요. 글쓰기 잠금 중에도 쓸 수 있어요. */
type Member = { supabase: SupabaseClient; userId: string; staff: boolean };

/** 가입(닉네임 설정)까지 마친 회원만 통과시켜요. 아니면 화면에 보여 줄 오류 문구를 돌려줘요. */
async function requireMember(): Promise<Member | string> {
  if (!isCafeConfigured()) return "카페 설정이 아직 안 됐어요.";
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) return "로그인이 필요해요. 다시 로그인해 주세요.";

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_manager, is_admin")
    .eq("id", userId)
    .maybeSingle<{ is_manager: boolean; is_admin: boolean }>();
  if (!profile) return "닉네임을 정한 뒤에 쓸 수 있어요.";
  return { supabase, userId, staff: profile.is_manager || profile.is_admin };
}

/** DB가 거절한 이유를 사람이 읽을 문구로 바꿔요. 42501은 권한 규칙, 여기서는 대부분 도배 방지예요. */
function describe(error: PostgrestError, tooFast: string): string {
  if (error.code === "42501") return tooFast;
  if (error.code === "23514") return "글자 수나 형식이 맞지 않아요.";
  if (error.code === "23503") return "이미 지워진 글이에요.";
  console.error(error);
  return "저장하지 못했어요. 잠시 후 다시 시도해 주세요.";
}

/**
 * 글·댓글·응원톡을 DB가 거절한 이유. 권한 규칙(42501)에 걸렸는데 글쓰기 잠금 중이면 잠금 안내를,
 * 아니면 tooFast(도배 방지) 문구를 돌려줘요. 매니저와 운영자는 잠금에 걸리지 않아요.
 */
async function refusal(member: Member, error: PostgrestError, tooFast: string): Promise<string> {
  if (error.code === "42501" && !member.staff) {
    const { lock } = await getCafeSettings();
    if (lock.on) return lockNotice(lock.message);
  }
  return describe(error, tooFast);
}

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function positiveInt(value: unknown): number | null {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

/** 로그인 뒤 돌아올 이 사이트 주소. 배포된 곳마다 달라서 요청에서 알아내요. */
async function siteOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

// ---------- 로그인 ----------

/** 소셜 로그인 버튼. 카카오·구글 로그인 화면으로 보냈다가 /auth/callback으로 돌아와요. */
export async function signIn(formData: FormData): Promise<void> {
  const provider = LOGIN_PROVIDERS.find((p) => p.id === formData.get("provider"))?.id;
  const next = safeNext(formData.get("next"));
  if (!provider || !isCafeConfigured()) redirect("/cafe/login?error=1");

  const supabase = await createSessionClient();
  const callback = new URL("/auth/callback", await siteOrigin());
  callback.searchParams.set("next", next);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: callback.toString() },
  });
  if (error || !data.url) {
    console.error(error);
    redirect("/cafe/login?error=1");
  }
  redirect(data.url);
}

export async function signOut(): Promise<void> {
  if (!isCafeConfigured()) return;
  const supabase = await createSessionClient();
  await supabase.auth.signOut();
  refreshViewer();
}

/**
 * 다른 화면으로 넘어가는 동작이 끝났을 때 넘어간 화면 아래에 띄울 알림을 남겨요.
 * 브라우저가 화면을 옮긴 뒤 FlashToast가 읽고 바로 지워요.
 */
async function flash(message: string) {
  (await cookies()).set(FLASH_COOKIE, message, { path: "/", maxAge: 60, sameSite: "lax" });
}

/**
 * 로그인 상태나 프로필이 바뀌면 카페 머리의 닉네임처럼 여러 화면이 같이 쓰는 부분도 다시 그려요.
 * revalidatePath는 내 정보 화면의 응원팀 목록(순위표 캐시)까지 버려서 API를 다시 부르게 하니,
 * 저장해 둔 데이터는 그대로 두고 화면만 다시 그리는 refresh를 써요.
 */
function refreshViewer() {
  refresh();
}

/** 처음 가입할 때 닉네임을 정하고, 나중에 바꿀 때도 같은 폼을 써요. */
export async function saveProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const nickname = text(formData, "nickname");
  const values = { nickname };
  if (!NICKNAME_PATTERN.test(nickname)) return { error: NICKNAME_HINT, values };
  if (!isCafeConfigured()) return { error: "카페 설정이 아직 안 됐어요.", values };

  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) return { error: "로그인이 필요해요. 다시 로그인해 주세요.", values };

  const { data: existing } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  const { error } = existing
    ? await supabase.from("profiles").update({ nickname }).eq("id", userId)
    : await supabase.from("profiles").insert({ nickname });

  if (error?.code === "23505") return { error: "이미 누가 쓰고 있는 닉네임이에요.", values };
  if (error) return { error: describe(error, "닉네임을 저장할 수 없어요."), values };

  refreshViewer();
  if (!existing) {
    await flash(`${nickname}님, 가입을 환영해요!`);
    redirect(safeNext(formData.get("next")));
  }
  return { error: null, message: "닉네임을 바꿨어요." };
}

/** 응원팀 고르기. teamId가 비어 있으면 응원팀을 지워요. */
export async function saveTeam(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = text(formData, "teamId");
  const teamId = raw ? positiveInt(raw) : null;
  if (raw && !teamId) return { error: "팀을 다시 골라 주세요." };

  const member = await requireMember();
  if (typeof member === "string") return { error: member };

  // 팀 이름과 엠블럼은 화면이 보낸 값을 믿지 않고 순위표에서 다시 찾아 저장해요.
  const team = teamId ? await findTeamChoice(teamId) : null;
  if (teamId && !team) return { error: "팀을 확인하지 못했어요. 잠시 후 다시 골라 주세요." };

  const { error } = await member.supabase
    .from("profiles")
    .update({ team_id: team?.id ?? null, team_name: team?.name ?? null, team_crest: team?.crest ?? null })
    .eq("id", member.userId);
  if (error) return { error: describe(error, "응원팀을 저장할 수 없어요.") };

  refreshViewer();
  return { error: null, message: team ? "응원팀을 저장했어요." : "응원팀을 지웠어요." };
}

// ---------- 골 ----------

/**
 * 출석 체크. 하루 첫 방문 때 브라우저가 한 번 불러요. 로그인하지 않았거나 닉네임을 정하기 전이면 null이에요.
 * 날짜와 골은 DB가 정해서 화면에서 조작할 수 없어요.
 */
export async function checkIn(): Promise<{ awarded: number; streak: number; goals: number } | null> {
  if (!isCafeConfigured()) return null;
  const supabase = await createSessionClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims.sub) return null;

  const { data, error } = await supabase
    .rpc("check_in")
    .maybeSingle<{ awarded: number; streak: number; goals: number }>();
  if (error) {
    console.error(error);
    return null;
  }
  if (!data) return null;
  // 골이 늘었으면 닉네임 옆 등급처럼 화면에 보이는 골도 다시 그려요.
  if (data.awarded > 0) refresh();
  return data;
}

/**
 * 내 소식 화면에서 실제로 본 소식만 읽음으로 바꿔요.
 * 화면은 다시 그리지 않아서, 방금 본 새 소식 표시는 화면을 떠날 때까지 남아요.
 */
export async function readNotifications(ids: number[]): Promise<boolean> {
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 50 || !ids.every((id) => positiveInt(id) === id)) return false;
  const member = await requireMember();
  if (typeof member === "string") return false;
  const { error } = await member.supabase.rpc("read_notification_items", { targets: ids });
  if (error) console.error(error);
  return !error;
}

// ---------- 골 상점 ----------

// DB 함수(buy_item, equip_item)가 거절한 이유를 사람이 읽을 문구로 바꿔요.
const SHOP_ERRORS: Record<string, string> = {
  P0002: "없는 아이템이에요.",
  "23505": "이미 가진 아이템이에요.",
  GL001: "골이 모자라요.",
  "42501": "가입한 회원만 살 수 있어요.",
};
const ITEM_ID = /^[a-z0-9-]{1,40}$/;

/** 아이템 사기. 가격과 남은 골은 DB가 확인해요. */
export async function buyItem(itemId: string): Promise<{ error: string | null }> {
  if (typeof itemId !== "string" || !ITEM_ID.test(itemId)) return { error: "아이템을 다시 골라 주세요." };
  const member = await requireMember();
  if (typeof member === "string") return { error: member };

  const { error } = await member.supabase.rpc("buy_item", { item: itemId });
  if (error) {
    if (!SHOP_ERRORS[error.code]) console.error(error);
    return { error: SHOP_ERRORS[error.code] ?? "사지 못했어요. 잠시 후 다시 시도해 주세요." };
  }
  refresh();
  return { error: null };
}

/** 산 아이템 쓰기와 벗기. itemId가 null이면 그 종류를 벗어요. */
export async function equipItem(slot: ShopKind, itemId: string | null): Promise<{ error: string | null }> {
  const validItem = itemId === null || (typeof itemId === "string" && ITEM_ID.test(itemId));
  if ((slot !== "color" && slot !== "frame") || !validItem) return { error: "아이템을 다시 골라 주세요." };
  const member = await requireMember();
  if (typeof member === "string") return { error: member };

  const { error } = await member.supabase.rpc("equip_item", { slot, item: itemId });
  if (error) {
    if (error.code !== "42501") console.error(error);
    return { error: error.code === "42501" ? "가진 아이템만 쓸 수 있어요." : "바꾸지 못했어요. 잠시 후 다시 시도해 주세요." };
  }
  refresh();
  return { error: null };
}

// ---------- 게시글 ----------

/** 새 글과 글 수정을 같이 처리해요. postId가 있으면 수정이에요. */
export async function savePost(_prev: FormState, formData: FormData): Promise<FormState> {
  const postId = positiveInt(formData.get("postId"));
  const board = text(formData, "board");
  const title = text(formData, "title");
  const body = text(formData, "body");
  const values = { board, title, body };

  if (!postId && !isWritableBoard(board)) return { error: "게시판을 골라 주세요.", values };
  if (!title) return { error: "제목을 써 주세요.", values };
  if (title.length > LIMITS.title) return { error: `제목은 ${LIMITS.title}자까지 쓸 수 있어요.`, values };
  if (!body) return { error: "내용을 써 주세요.", values };
  if (body.length > LIMITS.body) return { error: `내용은 ${LIMITS.body}자까지 쓸 수 있어요.`, values };

  const member = await requireMember();
  if (typeof member === "string") return { error: member, values };
  const { supabase, userId } = member;

  if (postId) {
    const { data, error } = await supabase
      .from("posts")
      .update({ title, body, updated_at: new Date().toISOString() })
      .eq("id", postId)
      .eq("user_id", userId)
      .select("id, board")
      .maybeSingle<{ id: number; board: string }>();
    if (error) return { error: await refusal(member, error, "이 글을 고칠 수 없어요."), values };
    if (!data) return { error: "내가 쓴 글만 고칠 수 있어요.", values };
    await flash("글을 고쳤어요");
    redirect(postHref(data));
  }

  // 드림 스쿼드 화면에서 '카페에 올리기'로 왔으면 그 스쿼드를 글에 붙여요. DB도 내 스쿼드만 받아요.
  const squadId = formData.get("squadId") ? positiveInt(formData.get("squadId")) : null;
  if (squadId) {
    const { data: squad } = await supabase
      .from("squads")
      .select("id")
      .eq("id", squadId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!squad) return { error: "내 스쿼드만 글에 붙일 수 있어요.", values };
  }

  const { data, error } = await supabase
    .from("posts")
    .insert(squadId ? { board, title, body, squad_id: squadId } : { board, title, body })
    .select("id, board")
    .single<{ id: number; board: string }>();
  if (error) {
    return { error: await refusal(member, error, "글은 30초에 한 번만 쓸 수 있어요. 잠시 후 다시 올려 주세요."), values };
  }
  await flash("글을 올렸어요");
  redirect(postHref(data));
}

export async function deletePost(formData: FormData): Promise<void> {
  const postId = positiveInt(formData.get("postId"));
  const member = await requireMember();
  if (!postId || typeof member === "string") return;

  // 지울 권한이 없으면 DB가 조용히 아무것도 지우지 않아요.
  const { data } = await member.supabase
    .from("posts")
    .delete()
    .eq("id", postId)
    .select("board")
    .maybeSingle<{ board: string }>();
  if (!data) return;
  await flash("글을 지웠어요");
  redirect(getBoard(data.board) ? `/cafe/${data.board}` : "/cafe");
}

/** 추천 누르기와 취소. 바뀐 추천 상태와 개수를 돌려줘요. */
export async function toggleLike(
  postId: number,
): Promise<{ liked: boolean; count: number } | { error: string }> {
  const id = positiveInt(postId);
  if (!id) return { error: "글을 찾을 수 없어요." };
  const member = await requireMember();
  if (typeof member === "string") return { error: member };
  const { supabase, userId } = member;

  const { data: existing } = await supabase
    .from("post_likes")
    .select("post_id")
    .eq("post_id", id)
    .eq("user_id", userId)
    .maybeSingle();

  const { error } = existing
    ? await supabase.from("post_likes").delete().eq("post_id", id).eq("user_id", userId)
    : await supabase.from("post_likes").insert({ post_id: id });
  if (error && error.code !== "23505") return { error: describe(error, "내 글은 추천할 수 없어요.") };

  const { data: post } = await supabase
    .from("posts")
    .select("like_count")
    .eq("id", id)
    .maybeSingle<{ like_count: number }>();
  return { liked: !existing, count: post?.like_count ?? 0 };
}

/** 조회수 올리기. 화면이 열릴 때 브라우저가 한 번 불러요. */
export async function countView(postId: number): Promise<void> {
  const id = positiveInt(postId);
  if (!id || !isCafeConfigured()) return;
  const supabase = await createSessionClient();
  await supabase.rpc("count_post_view", { target: id });
}

// ---------- 댓글 ----------

/** 댓글과 답글. parentId가 있으면 그 댓글의 답글이에요. */
export async function addComment(_prev: FormState, formData: FormData): Promise<FormState> {
  const postId = positiveInt(formData.get("postId"));
  const parentId = formData.get("parentId") ? positiveInt(formData.get("parentId")) : null;
  const body = text(formData, "body");
  const values = { body };
  if (!postId) return { error: "글을 찾을 수 없어요.", values };
  if (formData.get("parentId") && !parentId) return { error: "답글을 달 댓글을 찾을 수 없어요.", values };
  if (!body) return { error: "댓글 내용을 써 주세요.", values };
  if (body.length > LIMITS.comment) return { error: `댓글은 ${LIMITS.comment}자까지 쓸 수 있어요.`, values };

  const member = await requireMember();
  if (typeof member === "string") return { error: member, values };

  const { error } = await member.supabase
    .from("comments")
    .insert(parentId ? { post_id: postId, parent_id: parentId, body } : { post_id: postId, body });
  if (error) {
    // 답글은 댓글이 그사이 지워져도 DB가 거절해요.
    const tooFast = parentId
      ? "답글을 달 수 없어요. 댓글이 지워졌거나, 5초 안에 또 쓰고 있어요."
      : "댓글은 5초에 한 번만 달 수 있어요.";
    return { error: await refusal(member, error, tooFast), values };
  }
  refresh();
  return { error: null };
}

export async function deleteComment(formData: FormData): Promise<void> {
  const commentId = positiveInt(formData.get("commentId"));
  const member = await requireMember();
  if (!commentId || typeof member === "string") return;
  await member.supabase.from("comments").delete().eq("id", commentId);
  refresh();
}

// ---------- 드림 스쿼드 ----------

/**
 * 스쿼드 저장. id가 있으면 고치기예요. players는 포메이션 자리 순서대로 카드 번호이고 빈 자리는 null이에요.
 * 화면이 보낸 카드 번호가 진짜 있는지 넥슨 선수 목록에서 확인하고, 선수 이름도 거기서 가져와 적어요.
 * 저장하면 스쿼드 화면으로 넘어가요.
 */
export async function saveSquad(input: {
  id: number | null;
  name: string;
  formation: string;
  players: (number | null)[];
}): Promise<{ error: string }> {
  const id = input.id === null ? null : positiveInt(input.id);
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const formation = typeof input.formation === "string" ? input.formation : "";
  if (input.id !== null && !id) return { error: "스쿼드를 찾을 수 없어요." };
  if (!name || name.length > SQUAD_LIMITS.name) return { error: `스쿼드 이름은 1~${SQUAD_LIMITS.name}자로 써 주세요.` };
  if (!isFormation(formation)) return { error: "포메이션을 골라 주세요." };
  const spids = Array.isArray(input.players) ? input.players : [];
  if (spids.length !== SQUAD_SIZE || !spids.every((spid) => spid === null || positiveInt(spid) !== null)) {
    return { error: "선수를 다시 골라 주세요." };
  }
  const picked = spids.filter((spid): spid is number => spid !== null);
  if (picked.length === 0) return { error: "선수를 한 명 이상 넣어 주세요." };
  if (new Set(picked.map(playerIdOf)).size !== picked.length) return { error: "같은 선수는 한 번만 넣을 수 있어요." };

  const member = await requireMember();
  if (typeof member === "string") return { error: member };
  const { supabase, userId } = member;

  let names: Map<number, string>;
  try {
    names = await cardNames(picked);
  } catch (error) {
    console.error(error);
    return { error: "FC온라인 선수 목록을 확인하지 못했어요. 잠시 후 다시 저장해 주세요." };
  }
  const players: (SquadPlayer | null)[] = [];
  for (const spid of spids) {
    const playerName = spid === null ? undefined : names.get(spid);
    if (spid !== null && !playerName) return { error: "지금은 없는 카드가 있어요. 선수를 다시 골라 주세요." };
    players.push(spid === null || !playerName ? null : { spid, name: playerName });
  }

  if (id) {
    const { data, error } = await supabase
      .from("squads")
      .update({ name, formation, players, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId)
      .select("id")
      .maybeSingle();
    if (error) return { error: await refusal(member, error, "스쿼드를 고칠 수 없어요.") };
    if (!data) return { error: "내가 만든 스쿼드만 고칠 수 있어요." };
    await flash("스쿼드를 고쳤어요");
    redirect(`/cafe/squad/${id}`);
  }

  // 개수 제한은 DB도 막지만, 도배 방지에 걸린 것과 구분해서 알려 주려고 먼저 세요.
  const { count } = await supabase.from("squads").select("id", { count: "exact", head: true }).eq("user_id", userId);
  if ((count ?? 0) >= SQUAD_LIMITS.perMember) {
    return { error: `스쿼드는 ${SQUAD_LIMITS.perMember}개까지 만들 수 있어요. 안 쓰는 스쿼드를 지워 주세요.` };
  }
  const { data, error } = await supabase
    .from("squads")
    .insert({ name, formation, players })
    .select("id")
    .single<{ id: number }>();
  if (error) return { error: await refusal(member, error, "스쿼드는 10초에 하나만 만들 수 있어요. 잠시 후 다시 저장해 주세요.") };
  await flash("스쿼드를 저장했어요");
  redirect(`/cafe/squad/${data.id}`);
}

export async function deleteSquad(formData: FormData): Promise<void> {
  const squadId = positiveInt(formData.get("squadId"));
  const member = await requireMember();
  if (!squadId || typeof member === "string") return;

  // 지울 권한이 없으면 DB가 조용히 아무것도 지우지 않아요.
  const { data } = await member.supabase.from("squads").delete().eq("id", squadId).select("id");
  if (!data?.length) return;
  await flash("스쿼드를 지웠어요");
  redirect("/cafe/squad");
}

// ---------- 승부 예측 ----------

/** 승부 예측 고르기와 바꾸기. 킥오프 전까지만 받고, 바뀐 예측 수를 돌려줘요. */
export async function savePrediction(input: {
  matchId: number;
  date: string;
  pick: PredictionPick;
}): Promise<{ pick: PredictionPick; counts: PredictionCounts } | { error: string }> {
  const matchId = positiveInt(input.matchId);
  const pick = PREDICTION_PICKS.find((p) => p === input.pick);
  if (!matchId || !pick || typeof input.date !== "string" || !isDateKey(input.date)) {
    return { error: "예측을 다시 골라 주세요." };
  }

  const member = await requireMember();
  if (typeof member === "string") return { error: member };
  const { supabase, userId } = member;

  // 킥오프 시각은 화면이 보낸 값을 믿지 않고 경기 API에서 다시 확인해요.
  const match = await getMatchOnDay(input.date, matchId);
  if (!match) return { error: "경기를 찾을 수 없어요." };
  if (!isPredictionOpen(match, Date.now())) return { error: "킥오프가 지나서 예측이 마감됐어요." };

  const { data: existing } = await supabase
    .from("match_predictions")
    .select("pick")
    .eq("match_id", matchId)
    .eq("user_id", userId)
    .maybeSingle();
  const { error } = existing
    ? await supabase.from("match_predictions").update({ pick }).eq("match_id", matchId).eq("user_id", userId)
    : await supabase.from("match_predictions").insert({ match_id: matchId, competition: match.competition.code, pick });
  if (error) return { error: describe(error, "예측을 저장할 수 없어요.") };

  return { pick, counts: await countPredictions(matchId, match.utcDate) };
}

// ---------- 응원톡 ----------

export async function sendTalk(input: {
  matchId: number;
  side: TalkSide | null;
  body: string;
}): Promise<{ talk: Talk } | { error: string }> {
  const matchId = positiveInt(input.matchId);
  const side = input.side === "home" || input.side === "away" ? input.side : null;
  const body = typeof input.body === "string" ? input.body.trim() : "";
  if (!matchId) return { error: "경기를 찾을 수 없어요." };
  if (!body) return { error: "응원 메시지를 써 주세요." };
  if (body.length > LIMITS.talk) return { error: `응원톡은 ${LIMITS.talk}자까지 쓸 수 있어요.` };

  const member = await requireMember();
  if (typeof member === "string") return { error: member };

  const { data, error } = await member.supabase
    .from("match_talks")
    .insert({ match_id: matchId, side, body })
    .select("id, user_id, side, body, created_at")
    .single<{ id: number; user_id: string; side: TalkSide | null; body: string; created_at: string }>();
  if (error) return { error: await refusal(member, error, "조금만 천천히 보내 주세요.") };
  return {
    talk: { id: data.id, userId: data.user_id, side: data.side, body: data.body, createdAt: data.created_at },
  };
}

export async function deleteTalk(talkId: number): Promise<boolean> {
  const id = positiveInt(talkId);
  const member = await requireMember();
  if (!id || typeof member === "string") return false;
  const { data } = await member.supabase.from("match_talks").delete().eq("id", id).select("id");
  return (data?.length ?? 0) > 0;
}
