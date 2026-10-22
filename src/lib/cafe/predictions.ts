import "server-only";
import { cacheLife } from "next/cache";
import { getCompetition } from "../competitions";
import { getCompetitionMatches, type Match } from "../football-data";
import { matchResult } from "../match-display";
import { PREDICTION_PICKS } from "./config";
import { CafeError } from "./data";
import { PROFILE_COLUMNS, type RawProfile, toAuthor } from "./profile";
import { anonClient, publicClient } from "./supabase-server";
import type { Author, PredictionCounts, PredictionPick, RankingEntry } from "./types";

// 승부 예측 읽기예요. 킥오프 시각과 결과는 경기 API에만 있어서,
// 킥오프 뒤에 고친 예측(updated_at이 킥오프보다 늦은 것)은 세지 않아요.

/** 킥오프 전에 고른 예측 수 */
export async function countPredictions(matchId: number, kickoff: string): Promise<PredictionCounts> {
  const supabase = await publicClient();
  const entries = await Promise.all(
    PREDICTION_PICKS.map(async (pick) => {
      const { count, error } = await supabase
        .from("match_predictions")
        .select("match_id", { count: "exact", head: true })
        .eq("match_id", matchId)
        .eq("pick", pick)
        .lt("updated_at", kickoff);
      if (error) throw new CafeError(error.message);
      return [pick, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(entries) as PredictionCounts;
}

export async function getMyPrediction(matchId: number, userId: string): Promise<PredictionPick | null> {
  const supabase = await publicClient();
  const { data, error } = await supabase
    .from("match_predictions")
    .select("pick")
    .eq("match_id", matchId)
    .eq("user_id", userId)
    .maybeSingle<{ pick: PredictionPick }>();
  if (error) throw new CafeError(error.message);
  return data?.pick ?? null;
}

type RawPrediction = {
  match_id: number;
  user_id: string;
  competition: string;
  pick: PredictionPick;
  updated_at: string;
};

const PAGE = 1000;
const PROFILE_CHUNK = 100;

/**
 * 이번 시즌 예측 순위. 결과가 나온 경기만 세고, 적중 수가 많은 순서예요.
 * 결과는 대회별 이번 시즌 경기 목록(리그 일정 화면과 같은 캐시)에서 찾아서 API 호출이 거의 늘지 않아요.
 * 모든 예측을 읽어서 계산하니, 5분 동안은 계산해 둔 순위를 그대로 보여 줘요.
 */
export async function getPredictionRanking(): Promise<RankingEntry[]> {
  "use cache";
  cacheLife("matches");

  const supabase = anonClient();
  const rows: RawPrediction[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("match_predictions")
      .select("match_id, user_id, competition, pick, updated_at")
      .order("match_id")
      .order("user_id")
      .range(from, from + PAGE - 1);
    if (error) throw new CafeError(error.message);
    rows.push(...(data as RawPrediction[]));
    if (data.length < PAGE) break;
  }

  // 대회 하나가 API 한도에 걸려도 나머지 대회 결과로 순위를 보여 줘요.
  const codes = [...new Set(rows.map((row) => row.competition))].filter((code) => getCompetition(code));
  const matches = new Map<number, Match>();
  await Promise.all(
    codes.map(async (code) => {
      try {
        for (const match of (await getCompetitionMatches(code)).matches) matches.set(match.id, match);
      } catch (error) {
        console.error(error);
      }
    }),
  );

  const stats = new Map<string, { settled: number; hits: number }>();
  for (const row of rows) {
    const match = matches.get(row.match_id);
    if (!match || match.competition.code !== row.competition) continue;
    const result = matchResult(match);
    if (!result || Date.parse(row.updated_at) >= Date.parse(match.utcDate)) continue;
    const entry = stats.get(row.user_id) ?? { settled: 0, hits: 0 };
    entry.settled += 1;
    if (row.pick === result) entry.hits += 1;
    stats.set(row.user_id, entry);
  }

  const ids = [...stats.keys()];
  const authors = new Map<string, Author>();
  for (let i = 0; i < ids.length; i += PROFILE_CHUNK) {
    const { data, error } = await supabase
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .in("id", ids.slice(i, i + PROFILE_CHUNK));
    if (error) throw new CafeError(error.message);
    for (const raw of data as RawProfile[]) authors.set(raw.id, toAuthor(raw));
  }

  return ids
    .flatMap((id) => {
      const author = authors.get(id);
      const entry = stats.get(id);
      return author && entry ? [{ author, ...entry }] : [];
    })
    .sort((a, b) => b.hits - a.hits || b.hits / b.settled - a.hits / a.settled || a.author.nickname.localeCompare(b.author.nickname, "ko"));
}

/** 적중 수와 적중률이 같으면 같은 등수예요. 순위표 순서대로 등수를 매겨 돌려줘요. */
export function rankOf(entries: RankingEntry[]): number[] {
  const ranks: number[] = [];
  entries.forEach((entry, i) => {
    const prev = entries[i - 1];
    const tied = prev && prev.hits === entry.hits && prev.settled === entry.settled;
    ranks.push(tied ? ranks[i - 1] : i + 1);
  });
  return ranks;
}
