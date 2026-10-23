import type { Metadata } from "next";
import { Suspense } from "react";
import { PostListSkeleton } from "@/components/cafe/CafeSkeletons";
import { RichText } from "@/components/cafe/RichText";
import { cardClass, mutedClass } from "@/components/ui";
import { listSiteUpdates } from "@/lib/cafe/updates";
import { formatRelativeTime } from "@/lib/time";

export const metadata: Metadata = { title: "업데이트 소식" };

async function Updates() {
  const items = await listSiteUpdates();
  const now = new Date();
  if (!items.length) return <p className={`${cardClass} p-6 text-sm ${mutedClass}`}>아직 등록된 업데이트가 없어요.</p>;
  return <div className="space-y-3">{items.map((item) => (
    <article key={item.id} id={`update-${item.id}`} className={`${cardClass} scroll-mt-24 p-5 target:ring-2 target:ring-emerald-500`}>
      <p className={`mb-2 text-xs ${mutedClass}`}>{item.version} · {formatRelativeTime(item.created_at, now)}</p>
      <h2 className="text-lg font-bold">{item.title}</h2>
      <RichText text={item.body} className="mt-3 text-sm leading-relaxed" />
    </article>
  ))}</div>;
}

export default function UpdatesPage() {
  return <div className="break-keep">
    <h1 className="text-2xl font-bold tracking-tight">업데이트 소식</h1>
    <p className={`mt-1 mb-4 text-sm ${mutedClass}`}>새 기능과 달라진 점을 알려 드려요.</p>
    <Suspense fallback={<PostListSkeleton rows={3} />}><Updates /></Suspense>
  </div>;
}
