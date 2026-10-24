"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { refresh, updateTag } from "next/cache";
import { isBannerColor, isNoticeHref, SETTING_LIMITS } from "./banner";
import { GRANT_LIMITS, isCafeConfigured } from "./config";
import { SETTINGS_TAG } from "./settings";
import { createSessionClient } from "./supabase-server";
import type { FormState } from "./types";

// 카페 관리 화면의 저장 동작이에요. 운영자만 쓸 수 있어요.
// 서버 동작은 화면을 거치지 않고도 불릴 수 있어서 여기서 운영자인지 확인하고, DB 규칙도 한 번 더 막아요.

const NOT_ADMIN = "운영자만 바꿀 수 있어요.";

/** 버전은 중복 등록할 수 없어서 재전송해도 같은 업데이트 알림이 두 번 생기지 않아요. */
export async function publishUpdate(_prev: FormState, formData: FormData): Promise<FormState> {
  const version = text(formData, "version").toLowerCase();
  const title = text(formData, "title");
  const body = text(formData, "body");
  const values = { version, title, body };
  if (!/^[a-z0-9][a-z0-9._-]{0,59}$/.test(version)) {
    return { error: "버전은 영문 소문자·숫자로 시작하고 점·밑줄·하이픈을 포함해 60자까지 쓸 수 있어요.", values };
  }
  if (!title || title.length > 100 || !body || body.length > 3000) {
    return { error: "제목은 1~100자, 내용은 1~3,000자로 써 주세요.", values };
  }
  const supabase = await requireAdmin();
  if (typeof supabase === "string") return { error: supabase, values };
  const { error } = await supabase.from("site_updates").insert(values);
  if (error) {
    if (error.code === "23505") return { error: "이미 등록된 버전이에요. 기존 업데이트 소식을 확인해 주세요.", values };
    console.error(error);
    return { error: "업데이트를 등록하지 못했어요. 잠시 후 다시 시도해 주세요.", values };
  }
  refresh();
  return { error: null, message: "업데이트를 등록하고 회원들에게 알렸어요." };
}

/**
 * 회원에게 골을 줘요. 받은 골은 회원의 골 내역에 '운영 지급'과 이유로 남고, 운영 기록에도 남아요.
 * requestId는 화면이 지급마다 새로 만든 번호라서, 응답 전에 다시 보내도 DB가 한 번만 지급해요.
 */
export async function grantGoals(_prev: FormState, formData: FormData): Promise<FormState> {
  const nickname = text(formData, "nickname");
  const amountText = text(formData, "amount");
  const reason = text(formData, "reason");
  const requestId = text(formData, "requestId");
  const values = { nickname, amount: amountText, reason };
  const amount = /^\d{1,5}$/.test(amountText) ? Number(amountText) : 0;
  if (!nickname) return { error: "골을 받을 회원의 닉네임을 써 주세요.", values };
  if (amount < 1 || amount > GRANT_LIMITS.amount) {
    return { error: `골은 한 번에 1~${GRANT_LIMITS.amount.toLocaleString("ko-KR")}골까지 지급할 수 있어요.`, values };
  }
  if (!reason || reason.length > GRANT_LIMITS.reason) return { error: `지급 이유를 1~${GRANT_LIMITS.reason}자로 써 주세요.`, values };
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) return { error: "지급 요청이 올바르지 않아요. 화면을 새로 고쳐 주세요.", values };

  const supabase = await requireAdmin();
  if (typeof supabase === "string") return { error: supabase, values };
  const { data, error } = await supabase
    .rpc("admin_grant_goals", { target_nickname: nickname, grant_amount: amount, grant_reason: reason, request_id: requestId })
    .single<{ nickname: string; goals: number }>();
  if (error || !data) {
    if (error?.code === "PGRST202") return { error: "DB에 골 지급 기능이 아직 없어요. supabase/schema.sql을 다시 실행해 주세요.", values };
    if (error && ["P0001", "P0002", "42501"].includes(error.code)) return { error: error.message, values };
    console.error(error);
    return { error: "골을 지급하지 못했어요. 잠시 후 다시 시도해 주세요.", values };
  }
  return { error: null, message: `${data.nickname}님에게 ${amount.toLocaleString("ko-KR")}골을 지급했어요. 모은 골은 이제 ${data.goals.toLocaleString("ko-KR")}골이에요.` };
}

async function requireAdmin(): Promise<SupabaseClient | string> {
  if (!isCafeConfigured()) return "카페 설정이 아직 안 됐어요.";
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) return "로그인이 필요해요. 다시 로그인해 주세요.";

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle<{ is_admin: boolean }>();
  return profile?.is_admin ? supabase : NOT_ADMIN;
}

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * 카페 설정의 몇 칸을 바꾸고, 저장해 둔 설정을 버려서 다음에 여는 모든 화면이 새 값으로 그려지게 해요.
 * 이 화면도 같은 응답 안에서 새 값으로 다시 그려져요. 실패하면 화면에 보여 줄 문구를 돌려줘요.
 */
async function updateSettings(supabase: SupabaseClient, values: Record<string, unknown>): Promise<string | null> {
  const { data, error } = await supabase.from("cafe_settings").update(values).eq("id", true).select("id");
  if (error) {
    if (error.code === "23514") return "글자 수나 형식이 맞지 않아요.";
    console.error(error);
    return "저장하지 못했어요. 잠시 후 다시 시도해 주세요.";
  }
  // 운영자가 아니면 DB가 오류 없이 아무것도 바꾸지 않아요.
  if (!data?.length) return NOT_ADMIN;
  updateTag(SETTINGS_TAG);
  return null;
}

/** 배너의 카페 이름, 소개, 색 */
export async function saveBanner(_prev: FormState, formData: FormData): Promise<FormState> {
  const cafeName = text(formData, "cafeName");
  const tagline = text(formData, "tagline");
  const bannerColor = text(formData, "bannerColor");
  const values = { cafeName, tagline, bannerColor };

  if (!cafeName || cafeName.length > SETTING_LIMITS.cafeName) {
    return { error: `카페 이름은 1~${SETTING_LIMITS.cafeName}자로 써 주세요.`, values };
  }
  if (!tagline || tagline.length > SETTING_LIMITS.tagline) {
    return { error: `소개는 1~${SETTING_LIMITS.tagline}자로 써 주세요.`, values };
  }
  if (!isBannerColor(bannerColor)) return { error: "배너 색을 골라 주세요.", values };

  const supabase = await requireAdmin();
  if (typeof supabase === "string") return { error: supabase, values };
  const error = await updateSettings(supabase, { cafe_name: cafeName, tagline, banner_color: bannerColor });
  if (error) return { error, values };
  return { error: null, message: "배너를 바꿨어요." };
}

/** 카페 맨 위 한 줄 공지. 끄면 쓴 내용은 남겨 둬서 다시 켤 때 그대로 써요. */
export async function saveNotice(_prev: FormState, formData: FormData): Promise<FormState> {
  const on = formData.get("noticeOn") === "on";
  const noticeText = text(formData, "noticeText");
  const noticeHref = text(formData, "noticeHref");
  const values = { noticeOn: on ? "on" : "", noticeText, noticeHref };

  if (on && !noticeText) return { error: "공지 내용을 써 주세요.", values };
  if (noticeText.length > SETTING_LIMITS.notice) {
    return { error: `공지는 ${SETTING_LIMITS.notice}자까지 쓸 수 있어요.`, values };
  }
  if (noticeHref && !isNoticeHref(noticeHref)) {
    return { error: "링크는 /로 시작하는 이 사이트 주소나 https:// 주소만 쓸 수 있어요.", values };
  }

  const supabase = await requireAdmin();
  if (typeof supabase === "string") return { error: supabase, values };
  const error = await updateSettings(supabase, {
    notice_on: on,
    notice_text: noticeText || null,
    notice_href: noticeHref || null,
  });
  if (error) return { error, values };
  return { error: null, message: on ? "공지를 띄웠어요." : "공지를 내렸어요." };
}

/** 글쓰기 잠금(점검 모드) 켜고 끄기. 누른 버튼의 locked 값(on/off)으로 정해요. */
export async function saveLock(_prev: FormState, formData: FormData): Promise<FormState> {
  const locked = formData.get("locked") === "on";
  const lockMessage = text(formData, "lockMessage");
  const values = { lockMessage };
  if (lockMessage.length > SETTING_LIMITS.lockMessage) {
    return { error: `안내 문구는 ${SETTING_LIMITS.lockMessage}자까지 쓸 수 있어요.`, values };
  }

  const supabase = await requireAdmin();
  if (typeof supabase === "string") return { error: supabase, values };
  const error = await updateSettings(supabase, { write_locked: locked, lock_message: lockMessage || null });
  if (error) return { error, values };
  return { error: null, message: locked ? "글쓰기를 잠갔어요." : "글쓰기 잠금을 풀었어요." };
}

/** 글을 공지로 올리거나 내려요. 글 목록과 글 화면은 저장해 두지 않아서 지금 화면만 다시 그려요. */
export async function pinPost(postId: number, pinned: boolean): Promise<{ error: string | null }> {
  if (!Number.isSafeInteger(postId) || postId <= 0 || typeof pinned !== "boolean") {
    return { error: "글을 찾을 수 없어요." };
  }
  const supabase = await requireAdmin();
  if (typeof supabase === "string") return { error: supabase };

  const { error } = await supabase.rpc("pin_post", { target: postId, pinned });
  if (error) {
    if (error.code === "P0002") return { error: "글을 찾을 수 없어요." };
    if (error.code === "42501") return { error: NOT_ADMIN };
    console.error(error);
    return { error: "바꾸지 못했어요. 잠시 후 다시 시도해 주세요." };
  }
  refresh();
  return { error: null };
}
