import { cardClass, cardHeadingClass, cardListClass, skeletonClass as bar } from "../ui";

// 카페 글을 불러오는 동안 보이는 뼈대 화면이에요. 실제 화면과 높이를 맞춰 두었어요.

export function PostListSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className={`${cardClass} animate-pulse`} aria-busy="true" aria-label="불러오는 중">
      <div className={cardListClass}>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="py-3">
            <div className="flex h-[22px] items-center">
              <div className={`h-3.5 ${i % 3 === 0 ? "w-2/3" : i % 3 === 1 ? "w-1/2" : "w-3/5"} ${bar}`} />
            </div>
            <div className="mt-1 flex h-4 items-center">
              <div className={`h-2.5 w-40 ${bar}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 게시판 제목 자리까지 같이 잡아 두는 뼈대. */
export function BoardSkeleton() {
  return (
    <div aria-busy="true" aria-label="불러오는 중">
      <div className="mb-4 flex h-[58px] animate-pulse items-end justify-between">
        <div className="space-y-2">
          <div className={`h-6 w-28 ${bar}`} />
          <div className={`h-3 w-44 ${bar}`} />
        </div>
        <div className={`h-10 w-24 rounded-full ${bar}`} />
      </div>
      <PostListSkeleton />
    </div>
  );
}

export function PostSkeleton() {
  return (
    <div aria-busy="true" aria-label="불러오는 중" className="animate-pulse">
      <div className={`mb-3 h-5 w-24 ${bar}`} />
      <div className={`${cardClass} p-5`}>
        <div className={`h-6 w-3/4 ${bar}`} />
        <div className="mt-4 flex items-center gap-2.5">
          <div className={`size-10 rounded-full ${bar}`} />
          <div className="space-y-1.5">
            <div className={`h-3.5 w-20 ${bar}`} />
            <div className={`h-3 w-36 ${bar}`} />
          </div>
        </div>
        <div className="mt-6 space-y-2.5">
          <div className={`h-3.5 w-full ${bar}`} />
          <div className={`h-3.5 w-11/12 ${bar}`} />
          <div className={`h-3.5 w-4/5 ${bar}`} />
          <div className={`h-3.5 w-2/3 ${bar}`} />
        </div>
      </div>
    </div>
  );
}

export function EditorSkeleton() {
  return (
    <div className={`${cardClass} animate-pulse space-y-4 p-4`} aria-busy="true" aria-label="불러오는 중">
      <div className={`h-11 ${bar}`} />
      <div className={`h-11 ${bar}`} />
      <div className={`h-80 ${bar}`} />
    </div>
  );
}

export function TalkSkeleton() {
  return (
    <div className={`${cardClass} mt-3 animate-pulse`} aria-busy="true" aria-label="불러오는 중">
      <div className={cardHeadingClass}>
        <div className={`h-3.5 w-16 ${bar}`} />
      </div>
      <div className="h-[min(55vh,480px)] space-y-4 px-4 py-4">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex gap-2.5">
            <div className={`size-8 rounded-full ${bar}`} />
            <div className="flex-1 space-y-1.5">
              <div className={`h-3 w-20 ${bar}`} />
              <div className={`h-3.5 ${i % 2 ? "w-1/2" : "w-3/4"} ${bar}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 승부 예측 카드 뼈대. 세 칸과 아래 안내 줄 자리를 잡아 둬요. */
export function PredictionSkeleton() {
  return (
    <div className={`${cardClass} mt-3 animate-pulse`} aria-busy="true" aria-label="불러오는 중">
      <div className={cardHeadingClass}>
        <div className={`h-3.5 w-16 ${bar}`} />
      </div>
      <div className="grid grid-cols-3 gap-2 px-4 pt-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className={`h-[106px] rounded-xl ${bar}`} />
        ))}
      </div>
      <div className="space-y-3 px-4 pt-3 pb-4">
        <div className={`h-3.5 w-2/3 ${bar}`} />
        <div className={`h-10 w-28 ${bar}`} />
      </div>
    </div>
  );
}

export function MatchSummarySkeleton() {
  return (
    <div aria-busy="true" aria-label="불러오는 중" className="animate-pulse">
      <div className={`mb-3 h-5 w-28 ${bar}`} />
      <div className={`${cardClass} h-[188px]`} />
      <PredictionSkeleton />
      <TalkSkeleton />
    </div>
  );
}

/** 응원팀 고르기 뼈대. 한 리그 20팀 자리를 같은 칸 크기로 잡아 둬요. */
export function TeamPickerSkeleton() {
  return (
    <div aria-busy="true" aria-label="불러오는 중" className="animate-pulse">
      <div className="flex gap-1.5 py-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className={`h-8 w-14 rounded-full ${bar}`} />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1 sm:grid-cols-5">
        {Array.from({ length: 20 }, (_, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 px-1 pt-2.5 pb-2">
            <div className={`size-11 rounded-full ${bar}`} />
            <div className="flex h-[16.5px] items-center">
              <div className={`h-2.5 w-10 ${bar}`} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className={`h-3.5 w-24 ${bar}`} />
        <div className={`h-10 w-16 rounded-full ${bar}`} />
      </div>
    </div>
  );
}
