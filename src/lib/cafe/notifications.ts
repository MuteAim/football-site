import "server-only";
import { CafeError } from "./data";
import { PROFILE_COLUMNS, type RawProfile, toAuthor } from "./profile";
import { createSessionClient } from "./supabase-server";
import type { CafeNotification } from "./types";

// 내 소식 읽기예요. 소식은 DB 트리거와 settle_match가 만들고(supabase/schema.sql), 본인만 읽을 수 있어요.

/** 내 소식 화면에 보여 주는 개수. 60일 지난 소식은 DB가 지워요. */
export const NOTIFICATION_PAGE_SIZE = 50;

function recentSince() {
  return new Date(Date.now() - 60 * 86_400_000).toISOString();
}

// 소식과 회원은 받는 사람(user_id)과 소식을 만든 사람(actor_id) 두 갈래로 이어져 있어서 어느 쪽인지 적어 줘요.
const COLUMNS = `id, kind, read_at, created_at, match_id, match_day, label, amount,
  actor:profiles!actor_id(${PROFILE_COLUMNS}), post:posts(id, board, title), comment:comments(id, body, deleted_at),
  update:site_updates(id, title, body)`;

type RawNotification = {
  update: CafeNotification["update"];
  id: number;
  kind: CafeNotification["kind"];
  read_at: string | null;
  created_at: string;
  match_id: number | null;
  match_day: string | null;
  label: string | null;
  amount: number | null;
  actor: RawProfile | null;
  post: { id: number; board: string; title: string } | null;
  comment: { id: number; body: string; deleted_at: string | null } | null;
};

function toNotification(raw: RawNotification): CafeNotification {
  return {
    id: raw.id,
    update: raw.update,
    kind: raw.kind,
    read: raw.read_at !== null,
    createdAt: raw.created_at,
    actor: raw.actor ? toAuthor(raw.actor) : null,
    post: raw.post,
    comment: raw.comment ? { id: raw.comment.id, body: raw.comment.body, deleted: raw.comment.deleted_at !== null } : null,
    match:
      raw.match_id !== null && raw.match_day !== null
        ? { id: raw.match_id, day: raw.match_day, label: raw.label, goals: raw.amount ?? 0 }
        : null,
  };
}

/** 아직 안 읽은 내 소식 수. 로그인한 회원만 읽을 수 있어서, 부르기 전에 getViewer로 회원인지 확인해 주세요. */
export async function getUnreadCount(): Promise<number> {
  const supabase = await createSessionClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .gte("created_at", recentSince())
    .is("read_at", null);
  if (error) throw new CafeError(error.message);
  return count ?? 0;
}

/** 최근 내 소식. 새것부터예요. */
export async function listNotifications(page = 1): Promise<{ items: CafeNotification[]; total: number }> {
  const supabase = await createSessionClient();
  const since = recentSince();
  const from = (page - 1) * NOTIFICATION_PAGE_SIZE;
  const { data, error, count } = await supabase
    .from("notifications")
    .select(COLUMNS, { count: "exact" })
    .gte("created_at", since)
    .order("id", { ascending: false })
    .range(from, from + NOTIFICATION_PAGE_SIZE - 1);
  if (error?.code === "PGRST103") {
    const result = await supabase.from("notifications").select("id", { count: "exact", head: true }).gte("created_at", since);
    if (result.error) throw new CafeError(result.error.message);
    return { items: [], total: result.count ?? 0 };
  }
  if (error) throw new CafeError(error.message);
  return { items: (data as unknown as RawNotification[]).map(toNotification), total: count ?? 0 };
}
