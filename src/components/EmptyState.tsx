import type { ReactNode } from "react";
import { BallIcon } from "./Icons";

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-300 px-4 py-12 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
      <span className="flex size-11 items-center justify-center rounded-full bg-white text-zinc-400 ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:text-zinc-500 dark:ring-white/10">
        <BallIcon className="size-5" />
      </span>
      <p>{children}</p>
    </div>
  );
}
