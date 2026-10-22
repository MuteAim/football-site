"use client";

import { useState, useTransition } from "react";
import { toggleLike } from "@/lib/cafe/actions";
import { HeartIcon } from "../Icons";
import { errorTextClass } from "../ui";

const baseClass =
  "inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold ring-1 transition active:scale-95 disabled:pointer-events-none";

/** 추천 버튼. 누르면 바로 바뀐 모양을 보여 주고, 서버 결과가 오면 진짜 개수로 맞춰요. */
export function LikeButton({
  postId,
  initialLiked,
  initialCount,
  disabledReason,
}: {
  postId: number;
  initialLiked: boolean;
  initialCount: number;
  /** 누를 수 없을 때 이유. 로그인 안 함, 내 글 등 */
  disabledReason?: string;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onClick() {
    const nextLiked = !liked;
    setLiked(nextLiked);
    setCount((c) => c + (nextLiked ? 1 : -1));
    setError(null);
    startTransition(async () => {
      const result = await toggleLike(postId);
      if ("error" in result) {
        setLiked(!nextLiked);
        setCount((c) => c + (nextLiked ? -1 : 1));
        setError(result.error);
        return;
      }
      setLiked(result.liked);
      setCount(result.count);
    });
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={pending || Boolean(disabledReason)}
        aria-pressed={liked}
        title={disabledReason}
        className={`${baseClass} ${
          liked
            ? "bg-rose-500 text-white ring-rose-500"
            : "bg-white text-zinc-700 ring-zinc-950/10 hover:text-rose-600 hover:ring-rose-300 dark:bg-zinc-900 dark:text-zinc-200 dark:ring-white/10"
        } ${disabledReason ? "opacity-60" : ""}`}
      >
        <HeartIcon filled={liked} className="size-5" />
        추천 <span className="tabular-nums">{count}</span>
      </button>
      {error || disabledReason ? (
        <p className={error ? errorTextClass : "text-xs text-zinc-500 dark:text-zinc-400"}>{error ?? disabledReason}</p>
      ) : null}
    </div>
  );
}
