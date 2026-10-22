"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { confirmDialog, showToast } from "../feedback";
import { textButtonClass } from "../ui";

/**
 * 지우기처럼 되돌릴 수 없는 버튼. 확인 창으로 한 번 더 물어보고 폼을 보내요.
 * doneMessage를 주면 끝났을 때 화면 아래에 알려 줘요. 다른 화면으로 넘어가는 동작은 서버가 알림을 남겨요.
 */
export function ConfirmButton({
  title,
  description,
  confirmLabel = "지우기",
  doneMessage,
  children,
}: {
  title: string;
  description?: string;
  confirmLabel?: string;
  doneMessage?: string;
  children: string;
}) {
  const { pending } = useFormStatus();
  const sent = useRef(false);

  // 보냈는데 버튼이 그대로 남아 있으면 지우지 못한 거라, 나중에 화면을 떠날 때 잘못 알리지 않게 잊어요.
  useEffect(() => {
    sent.current = pending;
  }, [pending]);

  // 지운 줄은 화면에서 사라지면서 이 버튼도 같이 사라져요. 보낸 뒤 사라졌으면 지워진 거라 그때 알려 줘요.
  useEffect(
    () => () => {
      if (sent.current && doneMessage) showToast(doneMessage);
    },
    [doneMessage],
  );

  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(event) => {
        event.preventDefault();
        const button = event.currentTarget;
        void confirmDialog({ title, description, confirmLabel, tone: "danger" }).then((ok) => {
          if (ok) button.form?.requestSubmit(button);
        });
      }}
      className={textButtonClass}
    >
      {pending ? "지우는 중…" : children}
    </button>
  );
}
