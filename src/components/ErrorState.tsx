"use client";

import { useEffect } from "react";

export function ErrorState({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      role="alert"
      className="rounded-2xl bg-amber-50 p-5 text-sm ring-1 ring-amber-200 dark:bg-amber-950/30 dark:ring-amber-900/50"
    >
      <p className="text-base font-semibold text-amber-950 dark:text-amber-100">데이터를 불러오지 못했어요.</p>
      <p className="mt-1 text-amber-900/80 dark:text-amber-200/70">
        무료 API 호출 한도에 잠시 걸렸을 수 있어요. 1분쯤 뒤에 다시 시도해 주세요.
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-4 inline-flex h-9 items-center rounded-full bg-zinc-900 px-4 font-semibold text-white transition hover:bg-zinc-700 active:scale-95 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        다시 시도
      </button>
    </div>
  );
}
