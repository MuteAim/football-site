"use client";

import { useEffect, useState } from "react";
import { checkIn } from "@/lib/cafe/actions";

const STORAGE_KEY = "cafe:attended";
const kstDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" });

/**
 * 하루 첫 방문 때 자동으로 출석 체크를 하고, 골을 받았으면 화면 아래에 잠깐 알려 줘요.
 * 로그인 쿠키가 없으면 서버에 묻지 않고, 오늘 이미 확인한 브라우저도 다시 묻지 않아요.
 * 다른 기기에서 또 불러도 DB가 하루 한 번만 골을 줘요.
 */
export function AttendanceCheck() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!document.cookie.includes("sb-")) return;
    const today = kstDate.format(new Date());
    try {
      if (localStorage.getItem(STORAGE_KEY) === today) return;
    } catch {
      // 저장소를 못 쓰면 매번 물어봐요. 골은 DB가 하루 한 번만 줘요.
    }

    let active = true;
    const run = () => {
      void checkIn().then((result) => {
        // 닉네임을 정하기 전이면 가입한 뒤에 다시 물어보도록 적어 두지 않아요.
        if (!result) return;
        try {
          localStorage.setItem(STORAGE_KEY, today);
        } catch {}
        if (!active || result.awarded === 0) return;
        setMessage(
          result.awarded > 10
            ? `${result.streak}일 연속 출석! +${result.awarded}골`
            : `출석 체크 +${result.awarded}골 · ${result.streak}일 연속`,
        );
      });
    };
    // 골을 받으면 화면을 다시 그려서, 서버가 화면을 다 보내기 전에 끼어들지 않게 다 받은 뒤에 물어봐요.
    if (document.readyState === "complete") run();
    else window.addEventListener("load", run, { once: true });
    return () => {
      active = false;
      window.removeEventListener("load", run);
    };
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [message]);

  if (!message) return null;
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4 motion-safe:animate-[toast-in_0.3s_ease-out]"
    >
      <p className="rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-lg dark:bg-white dark:text-zinc-900">
        ⚽ {message}
      </p>
    </div>
  );
}
