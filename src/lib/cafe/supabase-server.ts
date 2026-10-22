import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { SUPABASE_KEY, SUPABASE_URL } from "./config";

/**
 * 로그인 쿠키를 실어 보내는 클라이언트. 본인 확인이 필요한 읽기와 모든 쓰기에 써요.
 * 요청마다 새로 만들어야 해서 공유하지 않아요.
 */
export async function createSessionClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        // 화면을 그리는 중에는 쿠키를 바꿀 수 없어서 조용히 넘어가요.
        // 로그인 유지(토큰 갱신)는 src/proxy.ts가 화면을 그리기 전에 미리 해 둬요.
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {}
      },
    },
  });
}

let anonClient: SupabaseClient | null = null;

/**
 * 로그인과 상관없는 공개 글 읽기용. 쿠키를 읽지 않아서 로그인 상태가 이상해도 글은 보여요.
 * 글은 늘 최신으로 보여야 해서 저장해 두지 않고 요청 때마다 읽어요.
 */
export async function publicClient(): Promise<SupabaseClient> {
  await connection();
  anonClient ??= createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return anonClient;
}
