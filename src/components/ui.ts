// 여러 화면이 같이 쓰는 카드 모양이에요. 테두리 대신 옅은 그림자와 윤곽선으로 띄워 보여요.
export const cardClass =
  "overflow-hidden rounded-2xl bg-white shadow-xs ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:shadow-none dark:ring-white/[0.07]";

/** 카드 맨 위 제목 줄. 높이를 고정해 두어서 뼈대 화면과 높이가 맞아요. */
export const cardHeadingClass =
  "mx-4 flex h-12 items-center gap-2.5 border-b border-zinc-100 text-[15px] font-semibold dark:border-white/[0.07]";

/** 카드 안 목록. 구분선이 카드 양 끝에 닿지 않게 안쪽으로 들여 놓아요. */
export const cardListClass = "divide-y divide-zinc-100 px-4 dark:divide-white/[0.06]";

/** 보조 설명 글씨 */
export const mutedClass = "text-zinc-500 dark:text-zinc-400";

/** 뼈대 화면의 회색 막대 */
export const skeletonClass = "rounded-md bg-zinc-200/80 dark:bg-white/[0.07]";
