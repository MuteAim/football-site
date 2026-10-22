"use client";

import { useFormStatus } from "react-dom";
import { LOGIN_PROVIDERS, type LoginProvider } from "@/lib/cafe/config";

// 카카오와 구글이 정한 버튼 색을 따라요.
const STYLE: Record<LoginProvider, string> = {
  kakao: "bg-[#FEE500] text-black/85 hover:brightness-95",
  google:
    "bg-white text-zinc-800 ring-1 ring-zinc-950/15 hover:bg-zinc-50 dark:bg-white dark:hover:bg-zinc-100",
};

function KakaoSymbol() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-5">
      <path
        fill="currentColor"
        d="M12 3.5c-5.25 0-9.5 3.3-9.5 7.38 0 2.62 1.75 4.92 4.4 6.23l-.9 3.3c-.08.3.26.54.52.37l3.92-2.6c.51.06 1.03.1 1.56.1 5.25 0 9.5-3.3 9.5-7.4S17.25 3.5 12 3.5z"
      />
    </svg>
  );
}

function GoogleSymbol() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-5">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}

/** 소셜 로그인 버튼들. 누른 버튼에만 "이동 중"을 보여 줘요. */
export function LoginButtons() {
  const { pending, data } = useFormStatus();
  const chosen = data?.get("provider");

  return (
    <div className="space-y-2.5">
      {LOGIN_PROVIDERS.map((provider) => (
        <button
          key={provider.id}
          type="submit"
          name="provider"
          value={provider.id}
          disabled={pending}
          className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold transition active:scale-[0.98] disabled:opacity-60 ${STYLE[provider.id]}`}
        >
          {provider.id === "kakao" ? <KakaoSymbol /> : <GoogleSymbol />}
          {pending && chosen === provider.id ? "이동 중…" : provider.label}
        </button>
      ))}
    </div>
  );
}
