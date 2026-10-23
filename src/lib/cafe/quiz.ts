import "server-only";
import { CafeError } from "./data";
import { cardPhotos, facePhoto } from "./squad";
import { adminClient } from "./supabase-admin";
import { createSessionClient } from "./supabase-server";
import type { QuizStatus } from "./types";

// 선수 맞히기 읽기예요. 문제 내기와 채점은 actions.ts의 startQuiz, answerQuiz가 DB 함수를 불러서 해요.

/** 내 선수 맞히기 상태. 본인만 볼 수 있어서 로그인 쿠키를 실어 읽어요. 가입 전이면 null이에요. */
export async function getMyQuiz(): Promise<QuizStatus | null> {
  const supabase = await createSessionClient();
  const { data, error } = await supabase
    .rpc("my_quiz")
    .maybeSingle<{ streak: number; played: number; earned: number; round_id: number | null; choices: string[] | null }>();
  if (error) throw new CafeError(error.message);
  if (!data) return null;
  return {
    streak: data.streak,
    played: data.played,
    earned: data.earned,
    round: data.round_id && data.choices ? { id: data.round_id, choices: data.choices } : null,
  };
}

/**
 * 문제의 정답 선수 사진 주소 후보. 카드의 동작 사진을 먼저 쓰고, 없으면 얼굴 사진이에요.
 * 정답 선수는 서버만 가진 비밀 키로 읽어서 화면이 사진 주소로 정답을 알 수 없어요.
 * 비밀 키가 없거나 내 문제가 아니면 null이에요.
 */
export async function getQuizPhotoSources(roundId: number, userId: string): Promise<string[] | null> {
  const admin = adminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("quiz_rounds")
    .select("answer_pid, answer_spid")
    .eq("id", roundId)
    .eq("user_id", userId)
    .maybeSingle<{ answer_pid: number; answer_spid: number | null }>();
  if (error) throw new CafeError(error.message);
  if (!data) return null;
  return data.answer_spid ? cardPhotos(data.answer_spid) : [facePhoto(data.answer_pid)];
}
