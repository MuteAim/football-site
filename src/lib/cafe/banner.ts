import type { CafeSettings } from "./types";

// 카페 배너와 공지 설정의 모양과 한도예요. 서버와 카페 관리 화면(브라우저)이 같이 써요.
// 색 이름과 글자 수는 supabase/schema.sql의 cafe_settings_values_check와 같아야 해요.
// Tailwind가 클래스를 찾을 수 있게 문자열 그대로 적어 둬요.

type BannerLook = {
  label: string;
  /** 배너 배경 그라데이션 */
  banner: string;
  /** 배너 위 빨간 숫자 배지를 배경과 떼어 보이게 두르는 테두리 */
  ring: string;
  /** 색 고르기 동그라미 */
  swatch: string;
};

export const BANNER_COLORS = {
  emerald: { label: "초록", banner: "from-emerald-700 to-emerald-900", ring: "ring-emerald-800", swatch: "bg-emerald-700" },
  teal: { label: "청록", banner: "from-teal-700 to-teal-900", ring: "ring-teal-800", swatch: "bg-teal-700" },
  sky: { label: "하늘", banner: "from-sky-700 to-sky-900", ring: "ring-sky-800", swatch: "bg-sky-700" },
  indigo: { label: "남색", banner: "from-indigo-700 to-indigo-900", ring: "ring-indigo-800", swatch: "bg-indigo-700" },
  violet: { label: "보라", banner: "from-violet-700 to-violet-900", ring: "ring-violet-800", swatch: "bg-violet-700" },
  rose: { label: "장미", banner: "from-rose-700 to-rose-900", ring: "ring-rose-800", swatch: "bg-rose-700" },
  amber: { label: "호박", banner: "from-amber-700 to-amber-900", ring: "ring-amber-800", swatch: "bg-amber-700" },
  slate: { label: "먹색", banner: "from-slate-700 to-slate-900", ring: "ring-slate-800", swatch: "bg-slate-700" },
} satisfies Record<string, BannerLook>;

export type BannerColor = keyof typeof BANNER_COLORS;

export function isBannerColor(value: string): value is BannerColor {
  return Object.hasOwn(BANNER_COLORS, value);
}

/** 배너 색 모양. 모르는 이름이면 초록이에요. */
export function bannerLook(name: string): BannerLook {
  return isBannerColor(name) ? BANNER_COLORS[name] : BANNER_COLORS.emerald;
}

export const SETTING_LIMITS = {
  cafeName: 20,
  tagline: 40,
  notice: 100,
  noticeHref: 300,
  lockMessage: 100,
} as const;

/** DB에서 설정을 읽지 못했을 때와, 카페 설정을 아직 안 했을 때 쓰는 처음 값이에요. */
export const DEFAULT_SETTINGS: CafeSettings = {
  cafeName: "해축남",
  tagline: "해외축구에 진심인 사람들 대화하는곳",
  bannerColor: "emerald",
  notice: { on: false, text: null, href: null },
  lock: { on: false, message: null },
};

/** 글쓰기 잠금 중에 운영자가 적은 이유가 없으면 보여 줄 문구 */
export const DEFAULT_LOCK_MESSAGE = "잠시 점검 중이에요. 조금 뒤에 다시 써 주세요.";

/** 글쓰기 잠금 중에 글·댓글·응원톡 자리에 보여 줄 안내 */
export function lockNotice(message: string | null): string {
  return `지금은 글쓰기를 잠시 멈췄어요. ${message ?? DEFAULT_LOCK_MESSAGE}`;
}

/** 공지 링크로 받을 수 있는 주소. 이 사이트 주소(/로 시작, //는 안 돼요)나 https 주소예요. */
export function isNoticeHref(value: string): boolean {
  return value.length <= SETTING_LIMITS.noticeHref && /^(\/([^/\s]\S*)?|https:\/\/\S+)$/.test(value);
}

export function isExternalHref(href: string): boolean {
  return href.startsWith("https://");
}
