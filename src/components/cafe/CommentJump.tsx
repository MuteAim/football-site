"use client";

import { useEffect, useRef } from "react";

/** 칠해 둔 댓글이 원래 색으로 돌아가기까지의 시간 */
const HIGHLIGHT_MS = 2500;

/**
 * 주소가 #comment-번호로 끝나면 그 댓글로 내려가서 잠깐 옅게 칠해 보여 줘요. 내 소식에서 댓글·답글 소식을 누르면 이렇게 와요.
 * 댓글 칸은 글보다 늦게 그려질 수 있어서 Next가 대신 내려 주지 못해요. 그래서 댓글 칸 안에 두고, 칸이 그려진 뒤에 내려가요.
 */
export function CommentJump() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const match = /^#(comment-\d+)$/.exec(location.hash);
    // 지나온 화면이 숨겨진 채 남아 있을 수 있어서, 문서 전체가 아니라 이 댓글 칸 안에서 찾아요.
    const target = match ? ref.current?.closest("section")?.querySelector<HTMLElement>(`[id="${match[1]}"]`) : null;
    if (!target) return;
    target.scrollIntoView({ block: "center" });
    target.dataset.highlight = "";
    const timer = setTimeout(() => delete target.dataset.highlight, HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, []);

  return <span ref={ref} hidden />;
}
