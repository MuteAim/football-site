// 카페 기능 설정이에요. 글과 회원 정보는 Supabase에 저장해요.
// 브라우저에서도 쓰는 값이라 서버 전용 비밀 값은 여기에 넣으면 안 돼요.

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
// 예전 프로젝트의 anon 키도 똑같이 쓸 수 있어요.
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Supabase 주소와 키가 없으면 카페 화면 대신 설정 안내를 보여 줘요. */
export function isCafeConfigured(): boolean {
  return SUPABASE_URL !== "" && SUPABASE_KEY !== "";
}

/**
 * 로그인 버튼 목록. Supabase 대시보드의 Authentication > Sign In / Providers에서 켠 것만 남겨 두세요.
 * 켜지 않은 방식을 누르면 Supabase 오류 화면이 떠요.
 */
export const LOGIN_PROVIDERS = [
  { id: "kakao", label: "카카오로 시작하기" },
  { id: "google", label: "Google로 시작하기" },
] as const;

export type LoginProvider = (typeof LOGIN_PROVIDERS)[number]["id"];

// 글자 수 제한. supabase/schema.sql의 check 조건과 같아야 해요.
export const LIMITS = {
  title: 100,
  body: 10000,
  comment: 1000,
  talk: 200,
} as const;

export const NICKNAME_PATTERN = /^[가-힣A-Za-z0-9_]{2,12}$/;
export const NICKNAME_HINT = "2~12자, 한글·영문·숫자·밑줄(_)만 쓸 수 있어요.";

export const PAGE_SIZE = 20;

/** 추천을 이만큼 받으면 인기글 게시판에 올라가요. */
export const BEST_LIKES = 3;

/** 다른 화면으로 넘어가는 동작이 끝났을 때 보여 줄 알림 문구를 잠깐 담아 두는 쿠키 이름 */
export const FLASH_COOKIE = "cafe-flash";

/** 승부 예측에서 고를 수 있는 것. supabase/schema.sql의 pick 조건과 같아야 해요. */
export const PREDICTION_PICKS = ["home", "draw", "away"] as const;

/** 선수 맞히기 규칙. supabase/schema.sql의 quiz_start, quiz_answer와 같아야 해요. */
export const QUIZ = {
  /** 한국 날짜로 하루에 풀 수 있는 문제 수 */
  daily: 5,
  /** 보기 수 */
  choices: 4,
  /** 연승 보너스가 더 늘지 않는 연승 수. 정답은 연승 수만큼 골을 받아요. */
  maxStreak: 5,
} as const;

/** 지금 연승이 streak일 때 다음 정답으로 받는 골. 첫 정답 1골, 2연승 2골, … 5연승부터는 5골이에요. */
export function quizPrize(streak: number): number {
  return Math.min(Math.max(streak, 0) + 1, QUIZ.maxStreak);
}

/** 로그인 뒤 돌아갈 주소. 다른 사이트로 빠져나가는 주소는 막고 카페 첫 화면으로 보내요. */
export function safeNext(value: unknown, fallback = "/cafe"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
