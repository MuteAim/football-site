"use client";

import { useTransition } from "react";
import { pinPost } from "@/lib/cafe/admin-actions";
import { showToast } from "../feedback";
import { textButtonClass } from "../ui";

/** 글 화면의 공지 올리기·내리기 버튼. 운영자에게만 보여요. 끝나면 서버가 화면을 다시 그려요. */
export function PinButton({ postId, pinned }: { postId: number; pinned: boolean }) {
  const [pending, startPin] = useTransition();

  function toggle() {
    startPin(async () => {
      const { error } = await pinPost(postId, !pinned);
      showToast(error ?? (pinned ? "공지에서 내렸어요" : "공지로 올렸어요"));
    });
  }

  return (
    <button type="button" disabled={pending} onClick={toggle} className={textButtonClass}>
      {pending ? "바꾸는 중…" : pinned ? "공지 내리기" : "공지로 올리기"}
    </button>
  );
}
