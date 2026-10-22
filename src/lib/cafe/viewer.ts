import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { isCafeConfigured } from "./config";
import { PROFILE_COLUMNS, type RawProfile, toAuthor } from "./profile";
import { createSessionClient } from "./supabase-server";
import type { Viewer } from "./types";

/**
 * 지금 보고 있는 사람을 알아내요. 로그인하지 않았으면 null이에요.
 * 쿠키를 읽기 때문에 이 값을 쓰는 화면 조각은 꼭 Suspense 안에 둬야 해요.
 * 한 번 요청하는 동안 여러 곳에서 불러도 실제 확인은 한 번만 해요.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  if (!isCafeConfigured()) return null;

  // 로그인 확인은 토큰 만료 시각을 지금 시각과 비교해서, 미리 만들어 둘 수 없는 요청 시점 작업이라고 알려 둬요.
  await connection();
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims.sub;
  if (!id) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", id)
    .maybeSingle<RawProfile>();

  return { id, profile: profile ? toAuthor(profile) : null };
});
