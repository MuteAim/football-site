// 골 상점 아이템이 화면에서 어떻게 보이는지예요. 가격과 종류는 supabase/schema.sql의 shop_items에 있어요.
// 아이템을 늘리면 두 곳을 같이 고쳐요. 여기에 없는 아이템은 상점에 나오지 않아요.
// Tailwind가 클래스를 찾을 수 있게 문자열 그대로 적어 둬요.

export type ShopKind = "color" | "frame";

type Look = { name: string; kind: ShopKind; className: string };

export const SHOP_LOOKS: Record<string, Look> = {
  "color-emerald": { name: "초록 닉네임", kind: "color", className: "text-emerald-600 dark:text-emerald-400" },
  "color-sky": { name: "하늘 닉네임", kind: "color", className: "text-sky-600 dark:text-sky-400" },
  "color-violet": { name: "보라 닉네임", kind: "color", className: "text-violet-600 dark:text-violet-400" },
  "color-rose": { name: "장미 닉네임", kind: "color", className: "text-rose-600 dark:text-rose-400" },
  "color-gold": { name: "황금 닉네임", kind: "color", className: "text-amber-600 dark:text-amber-400" },
  "color-legend": {
    name: "레전드 닉네임",
    kind: "color",
    className: "bg-linear-to-r from-amber-500 via-rose-500 to-violet-500 bg-clip-text text-transparent",
  },
  "frame-emerald": { name: "초록 테두리", kind: "frame", className: "bg-emerald-500" },
  "frame-sky": { name: "하늘 테두리", kind: "frame", className: "bg-sky-500" },
  "frame-gold": { name: "황금 테두리", kind: "frame", className: "bg-linear-to-br from-amber-300 via-amber-500 to-amber-700" },
  "frame-rainbow": {
    name: "무지개 테두리",
    kind: "frame",
    className: "bg-[conic-gradient(#f43f5e,#f59e0b,#10b981,#0ea5e9,#8b5cf6,#f43f5e)]",
  },
};

/** 닉네임에 붙일 색 클래스. 아이템이 없으면 빈 글자예요. */
export function nameColorClass(itemId: string | null | undefined): string {
  const look = itemId ? SHOP_LOOKS[itemId] : undefined;
  return look?.kind === "color" ? look.className : "";
}

/** 프로필 그림 테두리 배경 클래스. 아이템이 없으면 빈 글자예요. */
export function frameClass(itemId: string | null | undefined): string {
  const look = itemId ? SHOP_LOOKS[itemId] : undefined;
  return look?.kind === "frame" ? look.className : "";
}
