"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { CACHE_PROFILES } from "@/lib/cache-profiles";
import { formatDateTime } from "@/lib/time";

const INTERVAL = CACHE_PROFILES.matches.revalidate * 1000;

/** 현재 화면만 갱신하고 서버의 공용 캐시는 유지해요. 숨긴 탭에서는 요청하지 않아요. */
export function ScoreRefresh({ checkedAt, automatic }: { checkedAt: string; automatic: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [offline, setOffline] = useState(false);
  const lastRequest = useRef(0);

  const refresh = useCallback(() => {
    if (pending) return;
    if (!navigator.onLine) {
      setOffline(true);
      return;
    }
    setOffline(false);
    lastRequest.current = Date.now();
    startTransition(() => router.refresh());
  }, [pending, router]);

  useEffect(() => {
    if (!automatic) return;
    if (lastRequest.current === 0) lastRequest.current = Date.now();
    const check = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRequest.current >= INTERVAL) refresh();
    };
    const timer = window.setInterval(check, 15_000);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("online", check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("online", check);
    };
  }, [automatic, refresh]);

  return (
    <div className="my-3 rounded-xl bg-zinc-200/40 px-3 py-2 text-xs text-zinc-500 dark:bg-white/[0.04] dark:text-zinc-400">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <p aria-live="polite">데이터 기준 <time dateTime={checkedAt}>{formatDateTime(checkedAt)}</time></p>
        <button type="button" onClick={refresh} disabled={pending} className="min-h-9 rounded-lg px-2 font-semibold text-emerald-700 hover:bg-emerald-500/10 disabled:opacity-50 dark:text-emerald-300">
          {pending ? "확인 중…" : "새로고침"}
        </button>
      </div>
      <p className="leading-relaxed">{automatic ? "화면을 보는 동안 5분마다 확인해요. " : ""}경기 정보는 실제보다 몇 분 늦을 수 있어요. 한국 시간 기준이에요.</p>
      {offline ? <p role="alert" className="mt-1 text-rose-600 dark:text-rose-400">인터넷 연결을 확인한 뒤 다시 시도해 주세요.</p> : null}
    </div>
  );
}
