"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useRef } from "react";
import { FLASH_COOKIE } from "@/lib/cafe/config";
import { answerConfirm, showToast, useFeedback } from "./feedback";
import { mutedClass, secondaryButtonClass } from "./ui";

const confirmToneClass = {
  danger: "bg-rose-600 shadow-rose-600/20 hover:bg-rose-700",
  primary: "bg-emerald-600 shadow-emerald-600/20 hover:bg-emerald-700",
};

/** 화면 아래 알림과 확인 창을 그려요. 루트 레이아웃에 하나만 둬요. */
export function FeedbackHost() {
  const { toasts, confirm } = useFeedback();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  // 브라우저 기본 확인 창처럼 뒤를 막고, Esc와 포커스 가두기는 <dialog>가 맡아요.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (confirm && !dialog.open) dialog.showModal();
    if (!confirm && dialog.open) dialog.close();
  }, [confirm]);

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((toast) => (
          <p
            key={toast.id}
            className="max-w-full rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-lg motion-safe:animate-[toast-in_0.3s_ease-out] dark:bg-white dark:text-zinc-900"
          >
            {toast.message}
          </p>
        ))}
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onCancel={(event) => {
          event.preventDefault();
          answerConfirm(false);
        }}
        onClick={(event) => {
          // 창 바깥 어두운 곳을 누르면 취소예요.
          if (event.target === event.currentTarget) answerConfirm(false);
        }}
        className="m-auto w-[min(22rem,calc(100vw-2rem))] rounded-2xl bg-white p-0 text-zinc-900 shadow-2xl backdrop:bg-black/50 dark:bg-zinc-900 dark:text-zinc-100"
      >
        {confirm ? (
          <div className="p-5 break-keep">
            <h2 id={titleId} className="text-base font-bold">
              {confirm.title}
            </h2>
            {confirm.description ? (
              <p className={`mt-1.5 text-sm leading-relaxed ${mutedClass}`}>{confirm.description}</p>
            ) : null}
            <div className="mt-5 flex gap-2">
              {/* 처음 포커스는 취소에 둬서, 엔터를 잘못 눌러도 지워지지 않게 해요. */}
              <button type="button" onClick={() => answerConfirm(false)} className={`flex-1 ${secondaryButtonClass}`}>
                취소
              </button>
              <button
                type="button"
                onClick={() => answerConfirm(true)}
                className={`inline-flex h-10 flex-1 items-center justify-center rounded-full px-4 text-sm font-semibold text-white shadow-sm transition active:scale-95 ${
                  confirmToneClass[confirm.tone ?? "primary"]
                }`}
              >
                {confirm.confirmLabel}
              </button>
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}

/**
 * 다른 화면으로 넘어가는 서버 동작(글 올리기, 로그인 등)이 남긴 알림을 꺼내 보여 줘요.
 * 서버가 짧게 사는 쿠키에 문구를 적어 두면, 화면이 바뀐 뒤 여기서 읽고 바로 지워요.
 * 주소를 읽어서 레이아웃에서는 Suspense로 감싸 둬요.
 */
export function FlashToast() {
  const pathname = usePathname();

  useEffect(() => {
    const match = document.cookie.match(new RegExp(`(?:^|; )${FLASH_COOKIE}=([^;]*)`));
    if (!match) return;
    document.cookie = `${FLASH_COOKIE}=; Max-Age=0; Path=/`;
    try {
      showToast(decodeURIComponent(match[1]));
    } catch {
      // 문구가 깨졌으면 그냥 넘어가요.
    }
  }, [pathname]);

  return null;
}
