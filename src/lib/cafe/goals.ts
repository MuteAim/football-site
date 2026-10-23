import "server-only";
import { getCompetition } from "../competitions";
import { getCompetitionMatches, type Match } from "../football-data";
import { matchResult } from "../match-display";
import { teamName } from "../teams-ko";
import { CafeError } from "./data";
import { SHOP_LOOKS } from "./shop";
import { adminClient } from "./supabase-admin";
import { createSessionClient, publicClient } from "./supabase-server";
import type { GoalEvent, ShopItem } from "./types";

// 골 읽기, 승부 예측 정산, 골 상점 읽기예요.
// 골 규칙은 supabase/schema.sql의 check_in, settle_match에, 상점 규칙은 buy_item, equip_item에 있어요.

/** 한 서버가 정산을 다시 돌리기까지 기다리는 시간. 경기 결과 캐시(5분)와 맞췄어요. */
const SETTLE_INTERVAL = 5 * 60_000;
let lastSettled = 0;

/**
 * 끝난 경기의 승부 예측을 정산해서 맞힌 회원에게 골을 줘요.
 * 결과는 경기 API에서 확인하고, 서버만 가진 비밀 키로 DB의 settle_match를 불러요.
 * 비밀 키가 없으면 아무것도 하지 않아요. 같은 경기는 DB가 한 번만 정산해서 여러 번 불려도 괜찮아요.
 * 화면을 다 보낸 뒤 after()로 불러서 방문자가 기다리지 않게 해요.
 */
export async function settlePredictions(): Promise<void> {
  const admin = adminClient();
  if (!admin || Date.now() - lastSettled < SETTLE_INTERVAL) return;
  lastSettled = Date.now();

  const { data, error } = await admin.from("unsettled_matches").select("match_id, competition");
  if (error) {
    console.error(error);
    return;
  }

  const byCompetition = new Map<string, number[]>();
  for (const { match_id, competition } of data as { match_id: number; competition: string }[]) {
    if (!getCompetition(competition)) continue;
    byCompetition.set(competition, [...(byCompetition.get(competition) ?? []), match_id]);
  }

  for (const [code, ids] of byCompetition) {
    let matches: Match[];
    try {
      // 리그 일정 화면과 같은 캐시라 API 호출이 거의 늘지 않아요.
      matches = (await getCompetitionMatches(code)).matches;
    } catch (error) {
      console.error(error);
      continue;
    }
    for (const id of ids) {
      const match = matches.find((m) => m.id === id);
      const result = match ? matchResult(match) : null;
      if (!match || !result) continue;
      const { error: settleError } = await admin.rpc("settle_match", {
        target: id,
        outcome: result,
        kickoff: match.utcDate,
        // 맞힌 회원의 내 소식에 보일 경기 이름이에요.
        match_label: `${teamName(match.homeTeam)} vs ${teamName(match.awayTeam)}`,
      });
      if (settleError) console.error(settleError);
    }
  }
}

/** 내 출석 상태, 쓸 수 있는 골, 최근 골 내역. 모두 본인만 볼 수 있어서 로그인 쿠키를 실어 읽어요. */
export async function getMyGoals(userId: string): Promise<{
  streak: number;
  lastAttended: string | null;
  balance: number;
  events: GoalEvent[];
}> {
  const supabase = await createSessionClient();
  const [attendance, balance, events] = await Promise.all([
    // 출석 칸과 쓴 골은 다른 회원에게 숨겨 둬서 본인 전용 함수로 읽어요.
    supabase.rpc("my_attendance").maybeSingle<{ streak: number; last_attended: string | null }>(),
    supabase.rpc("my_balance"),
    supabase
      .from("goal_events")
      .select("id, kind, amount, day")
      .eq("user_id", userId)
      .order("id", { ascending: false })
      .limit(10),
  ]);
  if (attendance.error) throw new CafeError(attendance.error.message);
  if (balance.error) throw new CafeError(balance.error.message);
  if (events.error) throw new CafeError(events.error.message);
  return {
    streak: attendance.data?.streak ?? 0,
    lastAttended: attendance.data?.last_attended ?? null,
    balance: (balance.data as number | null) ?? 0,
    events: events.data as GoalEvent[],
  };
}

// ---------- 골 상점 ----------

/** 상점에 파는 아이템. 화면 모양(shop.ts)이 있는 것만, 정해 둔 순서대로 돌려줘요. */
export async function listShopItems(): Promise<ShopItem[]> {
  const supabase = await publicClient();
  const { data, error } = await supabase.from("shop_items").select("id, kind, price").order("sort");
  if (error) throw new CafeError(error.message);
  return (data as ShopItem[]).filter((item) => SHOP_LOOKS[item.id]?.kind === item.kind);
}

/** 내 쓸 수 있는 골과 산 아이템. 둘 다 본인만 볼 수 있어요. */
export async function getMyShop(userId: string): Promise<{ balance: number; owned: string[] }> {
  const supabase = await createSessionClient();
  const [balance, owned] = await Promise.all([
    supabase.rpc("my_balance"),
    supabase.from("owned_items").select("item_id").eq("user_id", userId),
  ]);
  if (balance.error) throw new CafeError(balance.error.message);
  if (owned.error) throw new CafeError(owned.error.message);
  return {
    balance: (balance.data as number | null) ?? 0,
    owned: (owned.data as { item_id: string }[]).map((row) => row.item_id),
  };
}

/** 이 경기 예측으로 받은 골. 아직 정산 전이면 null이에요. */
export async function getMatchGoals(matchId: number, userId: string): Promise<number | null> {
  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .from("goal_events")
    .select("amount")
    .eq("user_id", userId)
    .eq("ref", String(matchId))
    .in("kind", ["prediction", "minority"]);
  if (error) throw new CafeError(error.message);
  if (data.length === 0) return null;
  return data.reduce((sum, row) => sum + (row as { amount: number }).amount, 0);
}
