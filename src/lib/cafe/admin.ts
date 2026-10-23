import "server-only";
import { CafeError } from "./data";
import { PROFILE_COLUMNS, type RawProfile, toAuthor } from "./profile";
import { createSessionClient } from "./supabase-server";
import type { AdminLog } from "./types";

// 카페 관리 화면에서 읽는 것들이에요. 운영 기록은 운영자만 볼 수 있어서 로그인 쿠키를 실어 읽어요.

type RawLog = {
  id: number;
  area: string;
  target: string | null;
  changes: Record<string, unknown>;
  created_at: string;
  actor: RawProfile | RawProfile[] | null;
};

/** 최근 운영 기록. 운영자가 아니면 DB가 빈 목록을 줘요. */
export async function listAdminLogs(limit = 100): Promise<AdminLog[]> {
  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .from("admin_logs")
    .select(`id, area, target, changes, created_at, actor:profiles!actor_id(${PROFILE_COLUMNS})`)
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw new CafeError(error.message);
  return (data as RawLog[]).map((raw) => {
    const actor = Array.isArray(raw.actor) ? raw.actor[0] : raw.actor;
    return {
      id: raw.id,
      area: raw.area,
      target: raw.target,
      changes: raw.changes,
      createdAt: raw.created_at,
      actor: actor ? toAuthor(actor) : null,
    };
  });
}
