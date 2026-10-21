const bar = "rounded bg-zinc-200 dark:bg-zinc-800";
const card =
  "animate-pulse overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900";

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className={card} aria-busy="true" aria-label="불러오는 중">
      <div className="h-9 border-b border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60" />
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-b border-zinc-100 px-3 py-3.5 last:border-0 dark:border-zinc-800"
        >
          <div className={`h-3 w-10 ${bar}`} />
          <div className={`h-3 flex-1 ${bar}`} />
          <div className={`h-5 w-12 ${bar}`} />
          <div className={`h-3 flex-1 ${bar}`} />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 12 }: { rows?: number }) {
  return (
    <div className={card} aria-busy="true" aria-label="불러오는 중">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-b border-zinc-100 px-3 py-2.5 last:border-0 dark:border-zinc-800"
        >
          <div className={`h-3 w-5 ${bar}`} />
          <div className={`h-5 w-5 rounded-full ${bar}`} />
          <div className={`h-3 flex-1 ${bar}`} />
          <div className={`h-3 w-24 ${bar}`} />
        </div>
      ))}
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
