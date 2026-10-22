"use client";

import { useActionState } from "react";
import { addComment } from "@/lib/cafe/actions";
import { LIMITS } from "@/lib/cafe/config";
import type { FormState } from "@/lib/cafe/types";
import { errorTextClass, inputClass, primaryButtonClass } from "../ui";

const initialState: FormState = { error: null };

/** 댓글 입력칸. 등록하면 입력칸이 비워지고, 실패하면 쓰던 댓글이 그대로 남아요. */
export function CommentForm({ postId }: { postId: number }) {
  const [state, formAction, pending] = useActionState(addComment, initialState);

  return (
    <form action={formAction} className="space-y-2 px-4 pt-3 pb-4">
      <input type="hidden" name="postId" value={postId} />
      <textarea
        name="body"
        required
        maxLength={LIMITS.comment}
        rows={3}
        defaultValue={state.values?.body}
        placeholder="댓글을 남겨 주세요"
        aria-label="댓글"
        className={`${inputClass} resize-none`}
      />
      <div className="flex items-center justify-between gap-3">
        <p role="alert" className={errorTextClass}>
          {state.error}
        </p>
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? "등록 중…" : "등록"}
        </button>
      </div>
    </form>
  );
}
