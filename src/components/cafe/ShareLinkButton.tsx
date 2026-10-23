"use client";

import { showToast } from "../feedback";
import { textButtonClass } from "../ui";

/** 지금 화면 주소를 복사하는 버튼. 복사하지 못하면 주소창에서 복사하라고 알려 줘요. */
export function ShareLinkButton() {
  async function copy() {
    try {
      await navigator.clipboard.writeText(location.href);
      showToast("링크를 복사했어요");
    } catch {
      showToast("주소창의 링크를 복사해 주세요");
    }
  }

  return (
    <button type="button" onClick={() => void copy()} className={textButtonClass}>
      링크 복사
    </button>
  );
}
