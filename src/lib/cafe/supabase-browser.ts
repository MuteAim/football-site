import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "./config";

let browserClient: SupabaseClient | null = null;

/**
 * 브라우저에서 응원톡 실시간 소식을 받는 데만 쓰는 클라이언트예요.
 * 로그인 정보는 싣지 않아요. 글 보내기는 서버를 거치고, 로그인 유지는 서버(proxy.ts)가 맡아서
 * 브라우저와 서버가 동시에 로그인 토큰을 갱신하다 꼬이는 일이 없어요.
 */
export function getBrowserClient(): SupabaseClient {
  browserClient ??= createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return browserClient;
}
