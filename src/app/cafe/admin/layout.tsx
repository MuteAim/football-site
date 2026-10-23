import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { AdminTabList, AdminTabs } from "@/components/cafe/AdminTabs";
import { mutedClass } from "@/components/ui";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** 카페 관리 화면들의 제목과 탭. 운영자인지는 각 화면이 확인해요. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="break-keep">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">카페 관리</h1>
        <p className={`mt-1 text-sm ${mutedClass}`}>
          저장하면 카페의 모든 화면에 바로 반영돼요. 바꾼 내용은 운영 기록에 남아요.
        </p>
      </div>
      <Suspense fallback={<AdminTabList />}>
        <AdminTabs />
      </Suspense>
      {children}
    </div>
  );
}
