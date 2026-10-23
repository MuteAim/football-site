"use server";

import { connection } from "next/server";
import { isCafeConfigured } from "./config";
import { adminClient, isSettlementConfigured } from "./supabase-admin";
import { createSessionClient } from "./supabase-server";
import { getViewer } from "./viewer";
import { careerDay, EMPTY_CAREER_BOARD, type CareerBoard, type CareerSnapshot } from "../career/board";
import { CAREER_RULES, CAREER_VERSION, CareerError, replayCareer, summarizeCareer, type CareerSetup } from "../career/engine";

// 레전드 로드 순위예요. 커리어는 브라우저가 진행하고, 은퇴하면 서버가 시드와 선택 기록으로
// 처음부터 다시 계산해서 나온 기록만 저장해요. 저장은 비밀 키로만 부를 수 있는 career_record가 해요.

function rankingReady(): boolean {
  return isCafeConfigured() && isSettlementConfigured();
}

export async function getCareerSnapshot(day?: string): Promise<CareerSnapshot> {
  await connection();
  const target = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : careerDay();
  const fallback: CareerSnapshot = { day: target, member: false, available: false, board: EMPTY_CAREER_BOARD };
  if (!isCafeConfigured()) return fallback;
  try {
    const [viewer, supabase] = await Promise.all([getViewer(), createSessionClient()]);
    fallback.member = !!viewer?.profile;
    if (!rankingReady()) return fallback;
    const { data, error } = await supabase.rpc("career_board", { target_day: target });
    if (error || !data) return fallback;
    return { day: target, member: !!viewer?.profile, available: true, board: data as CareerBoard };
  } catch {
    return fallback;
  }
}

export async function startCareerRun(): Promise<{ runId: string; seed: number; startYear: number } | { error: string }> {
  if (!rankingReady()) return { error: "지금은 순위 도전을 열 수 없어요. 연습 커리어로 즐겨 주세요." };
  try {
    const supabase = await createSessionClient();
    // 시드와 시작 시즌은 DB가 정해요. 새 커리어를 시작하면 이전 순위 도전 커리어는 저장할 수 없어요.
    const { data, error } = await supabase.rpc("career_start").single<{ run_id: string; seed: number; start_year: number }>();
    if (error || !data) {
      return { error: error?.code === "P0001" ? error.message : "순위 도전을 시작하지 못했어요. 로그인 상태를 확인하거나 연습 커리어로 즐겨 주세요." };
    }
    return { runId: data.run_id, seed: Number(data.seed), startYear: data.start_year };
  } catch {
    return { error: "서버에 연결하지 못했어요. 다시 시도하거나 연습 커리어로 즐겨 주세요." };
  }
}

export async function finishCareerRun(runId: string, setup: CareerSetup, choices: number[], version: number): Promise<{ score: number; day: string } | { error: string }> {
  if (!rankingReady()) return { error: "지금은 순위에 기록할 수 없어요." };
  if (version !== CAREER_VERSION) return { error: "게임 규칙이 바뀌어서 이 커리어는 순위에 올릴 수 없어요." };
  if (typeof runId !== "string" || !/^[0-9a-f-]{36}$/i.test(runId) || typeof setup !== "object" || setup === null
    || !Array.isArray(choices) || choices.length > CAREER_RULES.maxChoices || choices.some((choice) => !Number.isInteger(choice) || choice < 0 || choice > 9)) {
    return { error: "기록 형식이 맞지 않아요." };
  }
  // 순위 도전은 스카우트 후보를 정해진 횟수까지만 다시 뽑을 수 있어요.
  const reroll = setup.reroll ?? 0;
  if (!Number.isInteger(reroll) || reroll < 0 || reroll > CAREER_RULES.rankedRerolls) {
    return { error: `순위 도전은 후보를 ${CAREER_RULES.rankedRerolls}번까지만 다시 뽑을 수 있어요.` };
  }
  const admin = adminClient();
  if (!admin) return { error: "지금은 순위에 기록할 수 없어요." };
  try {
    const viewer = await getViewer();
    if (!viewer?.profile) return { error: "로그인하고 닉네임을 정하면 순위에 기록할 수 있어요." };
    const { data: run, error } = await admin.from("career_runs").select("id, seed, start_year")
      .eq("user_id", viewer.id).maybeSingle<{ id: string; seed: number; start_year: number }>();
    if (error) return { error: "기록을 확인하지 못했어요. 다시 시도해 주세요." };
    if (!run || run.id !== runId) return { error: "다른 곳에서 새 커리어를 시작해서 이 커리어는 순위에 올릴 수 없어요." };

    // 화면이 보낸 결과는 믿지 않고 서버가 같은 규칙으로 다시 계산해요.
    const state = replayCareer({
      v: CAREER_VERSION, seed: Number(run.seed), startYear: run.start_year, choices,
      setup: { name: setup.name, nation: setup.nation, league: setup.league, pos: setup.pos, pick: setup.pick, ...(reroll ? { reroll } : {}) },
    });
    if (state.phase !== "retired") return { error: "은퇴한 커리어만 순위에 올릴 수 있어요." };
    const summary = summarizeCareer(state);
    const record = {
      position: summary.pos, name: summary.name, nation: summary.nation, club: summary.lastClub,
      score: summary.score, ballonDor: summary.ballonDor, peakOvr: summary.peakOvr,
      goals: summary.goals, assists: summary.assists, apps: summary.apps, trophies: summary.trophies, seasons: summary.seasons,
    };
    const { data, error: saveError } = await admin.rpc("career_record", { target_user: viewer.id, target_run: runId, record })
      .single<{ record_day: string; is_new: boolean }>();
    if (saveError || !data) return { error: saveError?.code === "P0001" ? saveError.message : "기록을 저장하지 못했어요. 아래 버튼으로 다시 시도해 주세요." };
    return { score: summary.score, day: data.record_day };
  } catch (reason) {
    if (reason instanceof CareerError) return { error: reason.message };
    return { error: "연결이 끊겨 기록을 저장하지 못했어요. 다시 시도해 주세요." };
  }
}
