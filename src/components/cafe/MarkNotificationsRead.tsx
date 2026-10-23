"use client";

import { useEffect } from "react";
import { readNotifications } from "@/lib/cafe/actions";

/**
 * 내 소식 화면을 열면 소식을 모두 읽음으로 바꿔요.
 * 미리 불러오기(prefetch)로는 읽음이 되지 않게, 화면에 실제로 보였을 때 브라우저가 불러요.
 */
export function MarkNotificationsRead() {
  useEffect(() => {
    void readNotifications();
  }, []);
  return null;
}
