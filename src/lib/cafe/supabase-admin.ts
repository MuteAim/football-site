import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./config";

// 서버 전용 비밀 키로 쓰는 클라이언트예요. 권한 규칙을 건너뛰니 승부 예측 정산에만 써요.
// 키 이름에 NEXT_PUBLIC_을 붙이면 브라우저로 새어 나가니 절대 붙이지 마세요.
// 예전 프로젝트의 service_role 키도 똑같이 쓸 수 있어요.
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

let admin: SupabaseClient | null = null;

/** 비밀 키가 없으면 null이에요. 그러면 예측 골 정산만 멈추고 나머지는 그대로 돌아가요. */
export function adminClient(): SupabaseClient | null {
  if (!SECRET_KEY || !SUPABASE_URL) return null;
  admin ??= createClient(SUPABASE_URL, SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return admin;
}

export function isSettlementConfigured(): boolean {
  return SECRET_KEY !== "" && SUPABASE_URL !== "";
}
