import type { Metadata } from "next";
import { CafeHeader } from "@/components/cafe/CafeHeader";
import { CafeSetupNotice } from "@/components/cafe/CafeNotices";
import { isCafeConfigured } from "@/lib/cafe/config";

export const metadata: Metadata = {
  title: { template: "%s · 해외축구 카페", default: "해외축구 카페" },
  description: "해외축구 팬들이 리그별 게시판과 경기 응원톡으로 이야기를 나누는 곳이에요.",
};

export default function CafeLayout({ children }: LayoutProps<"/cafe">) {
  return (
    <>
      <CafeHeader />
      {isCafeConfigured() ? children : <CafeSetupNotice />}
    </>
  );
}
