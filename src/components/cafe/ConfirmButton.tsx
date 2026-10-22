"use client";

import { useFormStatus } from "react-dom";
import { textButtonClass } from "../ui";

/** 지우기처럼 되돌릴 수 없는 버튼. 한 번 더 물어보고 폼을 보내요. */
export function ConfirmButton({ message, children }: { message: string; children: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
      className={textButtonClass}
    >
      {pending ? "지우는 중…" : children}
    </button>
  );
}
