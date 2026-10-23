// 경기·카페·스쿼드가 공유하는 표면과 버튼이에요.
export const cardClass =
  "overflow-hidden rounded-2xl bg-white shadow-[0_2px_8px_-4px_rgb(16_37_28/0.12)] ring-1 ring-emerald-950/[0.08] dark:bg-[#131e18] dark:shadow-none dark:ring-white/[0.08]";

/** 카드 맨 위 제목 줄. 높이를 고정해 두어서 뼈대 화면과 높이가 맞아요. */
export const cardHeadingClass =
  "mx-4 flex h-14 items-center gap-2.5 border-b border-zinc-100 text-[15px] font-bold tracking-tight dark:border-white/[0.07]";

/** 카드 안 목록. 구분선이 카드 양 끝에 닿지 않게 안쪽으로 들여 놓아요. */
export const cardListClass = "divide-y divide-zinc-100 px-4 dark:divide-white/[0.06]";

/** 보조 설명 글씨 */
export const mutedClass = "text-zinc-500 dark:text-zinc-400";

/** 뼈대 화면의 회색 막대 */
export const skeletonClass = "rounded-md bg-zinc-200/80 dark:bg-white/[0.07]";

// ---------- 카페 버튼과 입력칸 ----------

/** 글쓰기, 등록처럼 화면에서 가장 중요한 버튼 */
export const primaryButtonClass =
  "inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white shadow-sm shadow-emerald-900/10 transition hover:bg-emerald-800 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400";

/** 취소, 수정처럼 덜 중요한 버튼 */
export const secondaryButtonClass =
  "inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-white px-4 text-sm font-semibold text-zinc-700 ring-1 ring-zinc-950/10 transition hover:bg-zinc-50 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 dark:bg-[#19271f] dark:text-zinc-200 dark:ring-white/10 dark:hover:bg-zinc-800";

/** 글 옆의 작은 글자 버튼 (삭제 등) */
export const textButtonClass =
  "rounded-md px-1.5 py-0.5 text-xs font-medium text-zinc-400 transition hover:bg-zinc-950/5 hover:text-zinc-700 disabled:opacity-50 dark:text-zinc-500 dark:hover:bg-white/10 dark:hover:text-zinc-200";

export const inputClass =
  "w-full rounded-xl bg-zinc-100 px-3.5 py-2.5 text-[15px] outline-none ring-1 ring-transparent transition placeholder:text-zinc-400 focus:bg-white focus:ring-emerald-500 dark:bg-white/[0.06] dark:placeholder:text-zinc-500 dark:focus:bg-zinc-900";

/** 폼 아래 빨간 오류 문구 */
export const errorTextClass = "text-sm font-medium text-rose-600 dark:text-rose-400";
