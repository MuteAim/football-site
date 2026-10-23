"use server";

import { connection } from "next/server";
import { isCafeConfigured } from "./config";
import { createSessionClient } from "./supabase-server";
import { getViewer } from "./viewer";
import { PENALTY, penaltyDay, type PenaltyBoard, type PenaltyResult, type PenaltySnapshot } from "../penalty";

const emptyBoard: PenaltyBoard = { leaders: [], personal: null, participants: 0 };

export async function getPenaltySnapshot(day?: string): Promise<PenaltySnapshot> {
  await connection();
  const today = penaltyDay();
  const target = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : today;
  const fallback: PenaltySnapshot = { day: target, member: false, available: false, board: emptyBoard };
  if (!isCafeConfigured()) return fallback;
  try {
    const [viewer, supabase] = await Promise.all([getViewer(), createSessionClient()]);
    fallback.member = !!viewer?.profile;
    const { data, error } = await supabase.rpc("penalty_board", { target_day: target });
    if (error || !data) return fallback;
    return { day: target, member: !!viewer?.profile, available: true, board: data as PenaltyBoard };
  } catch {
    return fallback;
  }
}

export async function startPenalty(): Promise<{ runId: string; day: string } | { error: string }> {
  if (!isCafeConfigured()) return { error: "지금은 연습 모드로 플레이할 수 있어요." };
  try {
    const supabase = await createSessionClient();
    // 회원 확인·시작 시각·날짜·재시작 간격은 DB에서 인증 주체를 기준으로 정해요.
    const { data, error } = await supabase.rpc("penalty_start").single<{ run_id: string; day: string }>();
    if (error || !data) {
      return { error: error?.code === "P0001" ? error.message : "순위 도전을 시작하지 못했어요. 로그인 상태를 확인하거나 연습 모드로 즐겨 주세요." };
    }
    return { runId: data.run_id, day: data.day };
  } catch {
    return { error: "서버에 연결하지 못했어요. 다시 시도하거나 연습 모드로 즐겨 주세요." };
  }
}

export async function finishPenalty(runId: string, timings: (number | null)[]): Promise<PenaltyResult | { error: string }> {
  if (!isCafeConfigured() || typeof runId !== "string" || !/^[0-9a-f-]{36}$/i.test(runId)
    || !Array.isArray(timings) || timings.length !== PENALTY.shots
    || timings.some((time) => time !== null && (!Number.isInteger(time) || time < PENALTY.minShotMs || time >= PENALTY.shotMs))) {
    return { error: "기록 형식이 맞지 않아요. 새 게임을 시작해 주세요." };
  }
  try {
    const supabase = await createSessionClient();
    const { data, error } = await supabase.rpc("penalty_finish", { target_run: runId, timings })
      .single<{ score: number; goals: number; perfects: number; best_streak: number }>();
    if (error || !data) return { error: error?.code === "P0001" ? error.message : "기록을 저장하지 못했어요. 아래 버튼으로 다시 시도해 주세요." };
    return { score: data.score, goals: data.goals, perfects: data.perfects, bestStreak: data.best_streak };
  } catch {
    return { error: "연결이 끊겨 기록을 저장하지 못했어요. 다시 시도해 주세요." };
  }
}
