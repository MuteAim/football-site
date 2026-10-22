"use client";

import { useTransition } from "react";
import { signOut } from "@/lib/cafe/actions";
import { showToast } from "../feedback";

/** 로그아웃 버튼. 끝나면 화면 아래에 알려 줘요. */
export function SignOutButton({ className }: { className: string }) {
  const [pending, startSignOut] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startSignOut(async () => {
          await signOut();
          showToast("로그아웃했어요");
        })
      }
      className={className}
    >
      {pending ? "로그아웃 중…" : "로그아웃"}
    </button>
  );
}
