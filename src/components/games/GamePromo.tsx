import Link from "next/link";
import { TrophyIcon } from "../Icons";

export function GamePromo() {
  return (
    <Link href="/games/career" prefetch={false} className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-900/10 bg-white px-4 py-3 transition hover:border-emerald-600/40 dark:border-white/10 dark:bg-[#191a1e]">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#102c26] text-amber-200"><TrophyIcon className="size-6" /></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold">레전드 로드 <span className="ml-1 text-[9px] font-black text-emerald-700 dark:text-emerald-400">NEW</span></span><span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">17세 유망주로 시작해 발롱도르까지, 나만의 축구 인생!</span></span>
      <span className="shrink-0 text-xs font-bold text-emerald-800 dark:text-emerald-300">도전 →</span>
    </Link>
  );
}
