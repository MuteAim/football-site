"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { savePost } from "@/lib/cafe/actions";
import { WRITABLE_BOARDS } from "@/lib/cafe/boards";
import { LIMITS } from "@/lib/cafe/config";
import type { FormState, SquadSummary } from "@/lib/cafe/types";
import { cardClass, errorTextClass, inputClass, primaryButtonClass, secondaryButtonClass } from "../ui";
import { SquadFaces } from "./SquadList";

const initialState: FormState = { error: null };

type EditorProps = {
  post?: { id: number; board: string; title: string; body: string };
  defaultBoard?: string;
  cancelHref: string;
  /** 드림 스쿼드 화면의 '카페에 자랑하기'로 왔으면 글에 붙일 내 스쿼드예요. */
  squad?: SquadSummary;
};

/**
 * 글쓰기와 글 수정 폼. 수정할 때는 게시판을 바꿀 수 없어요.
 * 저장에 실패하면 서버가 쓰던 내용을 돌려줘서 입력한 글이 사라지지 않아요.
 *
 * Next.js는 지나온 화면을 숨겨 두었다가 다시 보여 줘서, 글을 올린 뒤 다시 글쓰기를 누르면 방금 쓴 글이 남아 있게 돼요.
 * 그래서 링크로 새로 들어올 때마다 빈 폼으로 시작하고, 뒤로 가기로 돌아올 때만 쓰던 내용을 살려 둬요.
 */
export function PostEditor(props: EditorProps) {
  const { bfcacheId } = useRouter();
  return <EditorForm key={bfcacheId} {...props} />;
}

function EditorForm({ post, defaultBoard, cancelHref, squad }: EditorProps) {
  const [state, formAction, pending] = useActionState(savePost, initialState);
  const values = state.values;

  return (
    <form action={formAction} className={`${cardClass} space-y-3 p-4`}>
      {squad ? (
        <div className="flex items-center gap-3 rounded-xl bg-emerald-500/10 p-3">
          <input type="hidden" name="squadId" value={squad.id} />
          <SquadFaces players={squad.players} />
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-emerald-700 dark:text-emerald-400">드림 스쿼드를 붙여 올려요</span>
            <span className="block truncate text-sm font-medium">
              {squad.name} · {squad.formation}
            </span>
          </span>
        </div>
      ) : null}
      {post ? (
        <input type="hidden" name="postId" value={post.id} />
      ) : (
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">게시판</span>
          <select
            name="board"
            defaultValue={values?.board ?? defaultBoard ?? "free"}
            className={inputClass}
          >
            {WRITABLE_BOARDS.map((board) => (
              <option key={board.slug} value={board.slug}>
                {board.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">제목</span>
        <input
          name="title"
          required
          maxLength={LIMITS.title}
          defaultValue={values?.title ?? post?.title ?? squad?.name}
          placeholder="제목을 써 주세요"
          className={inputClass}
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">내용</span>
        <textarea
          name="body"
          required
          maxLength={LIMITS.body}
          rows={14}
          defaultValue={values?.body ?? post?.body}
          placeholder="서로 존중하는 이야기를 나눠 주세요. 욕설이나 광고 글은 매니저가 지울 수 있어요."
          className={`${inputClass} resize-y leading-relaxed`}
        />
      </label>
      {state.error ? (
        <p role="alert" className={errorTextClass}>
          {state.error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2 pt-1">
        <Link href={cancelHref} className={secondaryButtonClass}>
          취소
        </Link>
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? "올리는 중…" : post ? "수정하기" : "올리기"}
        </button>
      </div>
    </form>
  );
}
