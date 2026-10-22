"use client";

import { createContext, use, useState, type ReactNode } from "react";
import { textButtonClass } from "../ui";
import { CommentForm } from "./CommentForm";

// 맨 위 댓글 하나와 그 답글들을 묶어요. 어느 줄의 "답글"을 눌러도 이 묶음 맨 아래에 답글 입력칸이 열려요.
// 댓글 줄은 서버가 그려서 넘겨주고, 입력칸 여닫기만 여기서 해요.

const ReplyContext = createContext<((mention: string) => void) | null>(null);

export function CommentThread({
  postId,
  parentId,
  children,
}: {
  postId: number;
  parentId: number;
  children: ReactNode;
}) {
  // 열려 있으면 미리 넣을 글자예요. 다른 답글의 "답글"을 누르면 입력칸을 새로 그려서 그 닉네임으로 바꿔요.
  const [mention, setMention] = useState<string | null>(null);
  const close = () => setMention(null);

  return (
    <ReplyContext value={setMention}>
      {children}
      {mention !== null ? (
        <div className="ml-[42px]">
          <CommentForm
            key={mention}
            postId={postId}
            reply={{ parentId, initialText: mention, onDone: close, onCancel: close }}
          />
        </div>
      ) : null}
    </ReplyContext>
  );
}

/** 댓글 줄의 "답글" 버튼. 답글에서 누르면 그 사람 닉네임을 앞에 넣어 줘요. */
export function ReplyButton({ mention }: { mention?: string }) {
  const open = use(ReplyContext);
  if (!open) return null;
  return (
    <button type="button" onClick={() => open(mention ? `@${mention} ` : "")} className={textButtonClass}>
      답글
    </button>
  );
}
