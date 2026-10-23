import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { DEFAULT_SETTINGS } from "./banner";
import { isCafeConfigured } from "./config";
import { CafeError } from "./data";
import { isStaff } from "./profile";
import { anonClient, publicClient } from "./supabase-server";
import type { Author, CafeSettings } from "./types";

/** 카페 설정을 저장해 둔 캐시의 이름. 운영자가 설정을 바꾸면 이 이름으로 바로 버려요. */
export const SETTINGS_TAG = "cafe-settings";

const COLUMNS = "cafe_name, tagline, banner_color, notice_on, notice_text, notice_href, write_locked, lock_message";

type RawSettings = {
  cafe_name: string;
  tagline: string;
  banner_color: string;
  notice_on: boolean;
  notice_text: string | null;
  notice_href: string | null;
  write_locked: boolean;
  lock_message: string | null;
};

function toSettings(raw: RawSettings): CafeSettings {
  return {
    cafeName: raw.cafe_name,
    tagline: raw.tagline,
    bannerColor: raw.banner_color,
    notice: { on: raw.notice_on, text: raw.notice_text, href: raw.notice_href },
    lock: { on: raw.write_locked, message: raw.lock_message },
  };
}

/**
 * 카페 설정. 모든 카페 화면의 배너가 써서 저장해 두고, 운영자가 바꾸면 그때 버리고 새로 읽어요(updateTag).
 * SQL Editor에서 직접 바꾼 값은 한 시간 안에 반영돼요. 읽지 못하면 처음 값을 1분만 저장해 두고 다시 읽어요.
 */
export async function getCafeSettings(): Promise<CafeSettings> {
  "use cache";
  cacheTag(SETTINGS_TAG);

  if (!isCafeConfigured()) {
    cacheLife("hours");
    return DEFAULT_SETTINGS;
  }
  const { data, error } = await anonClient().from("cafe_settings").select(COLUMNS).maybeSingle<RawSettings>();
  if (error || !data) {
    if (error) console.error(error);
    cacheLife("minutes");
    return DEFAULT_SETTINGS;
  }
  cacheLife("hours");
  return toSettings(data);
}

/** 이 회원이 글쓰기 잠금에 걸리는지. 걸리면 잠금 설정을, 아니면 null을 돌려줘요. 매니저와 운영자는 걸리지 않아요. */
export async function lockFor(profile: Author | null | undefined): Promise<CafeSettings["lock"] | null> {
  if (isStaff(profile)) return null;
  const { lock } = await getCafeSettings();
  return lock.on ? lock : null;
}

/** 카페 관리 화면용. 저장해 둔 값이 아니라 지금 DB에 있는 값을 읽어요. */
export async function readCafeSettings(): Promise<CafeSettings> {
  const supabase = await publicClient();
  const { data, error } = await supabase.from("cafe_settings").select(COLUMNS).maybeSingle<RawSettings>();
  if (error) throw new CafeError(error.message);
  return data ? toSettings(data) : DEFAULT_SETTINGS;
}
