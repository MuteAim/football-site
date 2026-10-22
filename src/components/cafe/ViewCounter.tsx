"use client";

import { startTransition, useEffect } from "react";
import { countView } from "@/lib/cafe/actions";

/** 글을 열면 조회수를 하나 올려요. 같은 창에서 다시 열거나 새로 고침하면 다시 세지 않아요. */
export function ViewCounter({ postId }: { postId: number }) {
  useEffect(() => {
    const key = `cafe:viewed:${postId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // 사생활 보호 모드처럼 저장소를 못 쓰면 그냥 매번 세요.
    }
    startTransition(async () => {
      await countView(postId);
    });
  }, [postId]);

  return null;
}
