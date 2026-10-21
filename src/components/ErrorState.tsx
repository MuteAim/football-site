"use client";

import { useEffect } from "react";

export function ErrorState({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      role="alert"
      className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm dark:border-amber-900/60 dark:bg-amber-950/40"
    >
      <p className="font-semibold text-amber-900 dark:text-amber-200">데이터를 불러오지 못했어요.</p>
      <p className="mt-1 text-amber-900/80 dark:text-amber-200/70">
        무료 API 호출 한도에 잠시 걸렸을 수 있어요. 1분쯤 뒤에 다시 시도해 주세요.
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-3 rounded-lg bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        다시 시도
      </button>
    </div>
  );
}
