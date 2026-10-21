// 첫 방문 때 데이터가 오기 전까지 보이는 뼈대 화면이에요.
// 실제 화면과 높이를 맞춰 두어서 내용이 들어올 때 화면이 밀리지 않게 했어요.
const bar = "rounded bg-zinc-200 dark:bg-zinc-800";
const card =
  "overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900";

function MatchRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <div className="w-14 shrink-0 space-y-1.5">
        <div className={`h-3 w-10 ${bar}`} />
        <div className={`h-2.5 w-7 ${bar}`} />
      </div>
      <div className="min-w-0 flex-1 space-y-1.5 border-l border-zinc-100 pl-3 dark:border-zinc-800">
        <div className="flex h-5 items-center gap-2">
          <div className={`h-5 w-5 rounded-full ${bar}`} />
          <div className={`h-3 w-24 ${bar}`} />
        </div>
        <div className="flex h-5 items-center gap-2">
          <div className={`h-5 w-5 rounded-full ${bar}`} />
          <div className={`h-3 w-20 ${bar}`} />
        </div>
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className={`${card} animate-pulse`} aria-busy="true" aria-label="불러오는 중">
      <div className="h-9 border-b border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60" />
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
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
      <div className={`mb-5 h-12 animate-pulse ${bar}`} />
      <div className={`mb-4 h-7 w-40 animate-pulse ${bar}`} />
      <ListSkeleton rows={rows} />
    </div>
  );
}

export function TableSkeleton({ rows = 12 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="불러오는 중">
      <div className={`h-5 w-24 animate-pulse ${bar}`} />
      <div className={`${card} animate-pulse`}>
        <div className="h-8 bg-zinc-50 dark:bg-zinc-900/60" />
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2">
              <div className={`h-3 w-4 ${bar}`} />
              <div className={`h-5 w-5 rounded-full ${bar}`} />
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
    <div className="mb-4 animate-pulse" aria-hidden>
      <div className="flex items-center gap-3">
        <div className={`h-12 w-12 rounded-xl ${bar}`} />
        <div className="space-y-2">
          <div className={`h-5 w-36 ${bar}`} />
          <div className={`h-3 w-16 ${bar}`} />
        </div>
      </div>
      <div className="mt-4 h-[41px] border-b border-zinc-200 dark:border-zinc-800" />
    </div>
  );
}
