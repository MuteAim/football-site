import { useSyncExternalStore } from "react";

// 화면 아래 알림과 확인 창을 띄우는 곳이에요. 브라우저 기본 alert·confirm 대신 써요.
// 어느 컴포넌트에서든 showToast, confirmDialog를 부르면 레이아웃의 FeedbackHost가 그려요.

export type Toast = { id: number; message: string };

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel: string;
  /** 지우기처럼 되돌릴 수 없는 일은 빨간 버튼으로 보여 줘요. */
  tone?: "danger" | "primary";
};

type ConfirmRequest = ConfirmOptions & { id: number; resolve: (ok: boolean) => void };

type FeedbackState = { toasts: Toast[]; confirm: ConfirmRequest | null };

const TOAST_MS = 3500;
const MAX_TOASTS = 3;

let state: FeedbackState = { toasts: [], confirm: null };
let nextId = 1;
const listeners = new Set<() => void>();

function update(next: Partial<FeedbackState>) {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

/** 화면 아래에 잠깐 알림을 띄워요. */
export function showToast(message: string) {
  const id = nextId++;
  update({ toasts: [...state.toasts, { id, message }].slice(-MAX_TOASTS) });
  setTimeout(() => dismissToast(id), TOAST_MS);
}

function dismissToast(id: number) {
  update({ toasts: state.toasts.filter((toast) => toast.id !== id) });
}

/** 확인 창을 띄우고, 확인을 누르면 true, 취소하거나 닫으면 false를 돌려줘요. */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  // 이미 열린 창이 있으면 취소로 닫고 새 창을 띄워요.
  state.confirm?.resolve(false);
  return new Promise((resolve) => {
    update({ confirm: { ...options, id: nextId++, resolve } });
  });
}

export function answerConfirm(ok: boolean) {
  const request = state.confirm;
  if (!request) return;
  update({ confirm: null });
  request.resolve(ok);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const serverState: FeedbackState = { toasts: [], confirm: null };

export function useFeedback(): FeedbackState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => serverState,
  );
}
