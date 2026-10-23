"use client";

import { useEffect } from "react";
import { readNotifications } from "@/lib/cafe/actions";

/**
 * 내 소식 화면에 표시된 소식만 읽음으로 바꿔요.
 * 미리 불러오기(prefetch)로는 읽음이 되지 않게, 화면에 실제로 보였을 때 브라우저가 불러요.
 */
export function MarkNotificationsRead({ ids }: { ids: number[] }) {
  const key = ids.join(",");
  useEffect(() => {
    const mark = () => {
      if (document.visibilityState !== "visible") return;
      void readNotifications(key.split(",").map(Number)).then((ok) => {
        if (ok) window.dispatchEvent(new Event("cafe-notifications-read"));
      });
    };
    mark();
    document.addEventListener("visibilitychange", mark);
    return () => document.removeEventListener("visibilitychange", mark);
  }, [key]);
  return null;
}
