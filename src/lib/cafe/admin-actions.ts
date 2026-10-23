"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { refresh, updateTag } from "next/cache";
import { isBannerColor, isNoticeHref, SETTING_LIMITS } from "./banner";
import { isCafeConfigured } from "./config";
import { SETTINGS_TAG } from "./settings";
import { createSessionClient } from "./supabase-server";
import type { FormState } from "./types";

// 카페 관리 화면의 저장 동작이에요. 운영자만 쓸 수 있어요.
// 서버 동작은 화면을 거치지 않고도 불릴 수 있어서 여기서 운영자인지 확인하고, DB 규칙도 한 번 더 막아요.

const NOT_ADMIN = "운영자만 바꿀 수 있어요.";

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
