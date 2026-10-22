"use client";

import { useActionState, useEffect, useRef } from "react";
import { addComment } from "@/lib/cafe/actions";
import { LIMITS } from "@/lib/cafe/config";
import type { FormState } from "@/lib/cafe/types";
import { showToast } from "../feedback";
import { errorTextClass, inputClass, primaryButtonClass, textButtonClass } from "../ui";

const initialState: FormState = { error: null };

type ReplyOptions = {
  parentId: number;
  /** 답글에 답글을 달 때 "@닉네임 "을 미리 넣어 둬요. */
  initialText: string;
  onDone: () => void;
  onCancel: () => void;
};

/**
 * 댓글 입력칸. 등록하면 입력칸이 비워지고, 실패하면 쓰던 댓글이 그대로 남아요.
 * reply를 넘기면 그 댓글의 답글 입력칸이 돼요. 열리자마자 글자 끝에 커서를 두고, 등록하면 닫혀요.
 */
export function CommentForm({ postId, reply }: { postId: number; reply?: ReplyOptions }) {
  const [state, formAction, pending] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await addComment(prev, formData);
    if (!result.error) {
      showToast(reply ? "답글을 달았어요" : "댓글을 달았어요");
      reply?.onDone();
    }
    return result;
  }, initialState);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoFocus = reply !== undefined;

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!autoFocus || !textarea) return;
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }, [autoFocus]);

  return (
    <form action={formAction} className={reply ? "space-y-2 pt-1 pb-3" : "space-y-2 px-4 pt-3 pb-4"}>
      <input type="hidden" name="postId" value={postId} />
      {reply ? <input type="hidden" name="parentId" value={reply.parentId} /> : null}
      <textarea
        ref={textareaRef}
        name="body"
        required
        maxLength={LIMITS.comment}
        rows={reply ? 2 : 3}
        defaultValue={state.values?.body ?? reply?.initialText}
        placeholder={reply ? "답글을 남겨 주세요" : "댓글을 남겨 주세요"}
        aria-label={reply ? "답글" : "댓글"}
        className={`${inputClass} resize-none`}
      />
      <div className="flex items-center justify-between gap-3">
        <p role="alert" className={errorTextClass}>
          {state.error}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {reply ? (
            <button type="button" onClick={reply.onCancel} className={textButtonClass}>
              취소
            </button>
          ) : null}
          <button type="submit" disabled={pending} className={primaryButtonClass}>
            {pending ? "등록 중…" : "등록"}
          </button>
        </div>
      </div>
    </form>
  );
}
