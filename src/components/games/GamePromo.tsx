import Link from "next/link";
import { BallIcon } from "../Icons";

export function GamePromo() {
  return (
    <Link href="/games/penalty" prefetch={false} className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-900/10 bg-white px-4 py-3 transition hover:border-emerald-600/40 dark:border-white/10 dark:bg-[#191a1e]">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#102c26] text-[#d4f77d]"><BallIcon className="size-6" /></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold">승부차기 러시 <span className="ml-1 text-[9px] font-black text-emerald-700 dark:text-emerald-400">NEW</span></span><span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">경기 기다리는 동안, 10번의 슛으로 기록 대결!</span></span>
      <span className="shrink-0 text-xs font-bold text-emerald-800 dark:text-emerald-300">도전 →</span>
    </Link>
  );
}
