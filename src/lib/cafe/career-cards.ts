import { cacheLife } from "next/cache";
import { CARD_CODE, type SharedCard } from "../career/card";
import { isCafeConfigured } from "./config";
import { anonClient } from "./supabase-server";

/** 레전드 로드 공유 카드. 만든 뒤에는 바뀌지 않아서 오래 저장해 두고, 없는 주소는 잠깐만 기억해요. */
export async function getCareerCard(code: string): Promise<SharedCard | null> {
  "use cache";
  if (!CARD_CODE.test(code) || !isCafeConfigured()) {
    cacheLife("hours");
    return null;
  }
  const { data, error } = await anonClient().rpc("career_card", { target_code: code });
  if (error || !data) {
    if (error) console.error(error);
    cacheLife("minutes");
    return null;
  }
  cacheLife("days");
  return data as SharedCard;
}
