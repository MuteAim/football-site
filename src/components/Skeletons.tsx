import { cardClass, cardHeadingClass, cardListClass, skeletonClass as bar } from "./ui";

// 첫 방문 때 데이터가 오기 전까지 보이는 뼈대 화면이에요.
// 실제 화면과 높이를 맞춰 두어서 내용이 들어올 때 화면이 밀리지 않게 했어요.

function MatchRowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="w-14 shrink-0 space-y-2">
        <div className={`h-3.5 w-10 ${bar}`} />
        <div className={`h-2.5 w-7 ${bar}`} />
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex h-6 items-center gap-2.5">
          <div className={`size-[22px] rounded-full ${bar}`} />
          <div className={`h-3.5 w-24 ${bar}`} />
        </div>
        <div className="flex h-6 items-center gap-2.5">
          <div className={`size-[22px] rounded-full ${bar}`} />
          <div className={`h-3.5 w-20 ${bar}`} />
        </div>
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className={`${cardClass} animate-pulse`} aria-busy="true" aria-label="불러오는 중">
      <div className={cardHeadingClass}>
        <div className={`size-7 rounded-lg ${bar}`} />
        <div className={`h-3.5 w-28 ${bar}`} />
      </div>
      <div className={cardListClass}>
        {Array.from({ length: rows }, (_, i) => (
          <MatchRowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

/** 날짜별 경기 화면용. 날짜 버튼과 제목 자리까지 같이 잡아 둬요. */
export function DaySkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="불러오는 중">
      <div className={`mb-5 h-[68px] animate-pulse ${cardClass}`} />
      <div className="mb-4 animate-pulse">
        <div className="flex h-5 items-center">
          <div className={`h-3.5 w-20 ${bar}`} />
        </div>
        <div className="mt-0.5 flex h-8 items-center">
          <div className={`h-6 w-32 ${bar}`} />
        </div>
      </div>
      <ListSkeleton rows={rows} />
    </div>
  );
}

/** 순위표와 득점 순위용. 득점 순위는 한 줄에 선수와 팀이 같이 있어서 줄 높이를 따로 넘겨요. */
export function TableSkeleton({ rows = 12, rowClass = "h-11" }: { rows?: number; rowClass?: string }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="불러오는 중">
      <div className="flex h-5 items-center">
        <div className={`h-3.5 w-24 animate-pulse ${bar}`} />
      </div>
      <div className={`${cardClass} animate-pulse`}>
        <div className="h-[37px] border-b border-zinc-100 dark:border-white/[0.07]" />
        <div className="divide-y divide-zinc-100 dark:divide-white/[0.06]">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className={`flex items-center gap-3 px-4 ${rowClass}`}>
              <div className={`h-3 w-4 ${bar}`} />
              <div className={`size-5 rounded-full ${bar}`} />
              <div className={`h-3 flex-1 ${bar}`} />
              <div className={`h-3 w-28 ${bar}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function HeaderSkeleton() {
  return (
    <div className="mb-5 animate-pulse" aria-hidden>
      <div className={`h-[104px] rounded-3xl ${bar}`} />
      <div className={`mt-3 h-11 rounded-2xl ${bar}`} />
    </div>
  );
}
