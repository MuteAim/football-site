import type { Metadata } from "next";
import { Suspense } from "react";
import { Avatar } from "@/components/cafe/Avatar";
import { PostListSkeleton } from "@/components/cafe/CafeSkeletons";
import { AdminOnly } from "@/components/cafe/CafeNotices";
import { EmptyState } from "@/components/EmptyState";
import { cardClass, cardListClass, mutedClass } from "@/components/ui";
import { listAdminLogs } from "@/lib/cafe/admin";
import { BANNER_COLORS, isBannerColor } from "@/lib/cafe/banner";
import type { AdminLog } from "@/lib/cafe/types";
import { getViewer } from "@/lib/cafe/viewer";
import { formatDateTime, formatRelativeTime } from "@/lib/time";

export const metadata: Metadata = { title: "운영 기록" };

/** 카페 설정 칸 이름. supabase/schema.sql의 cafe_settings 칸과 같아요. */
const FIELD_LABELS: Record<string, string> = {
  cafe_name: "카페 이름",
  tagline: "소개",
  banner_color: "배너 색",
  notice_on: "공지 띠",
  notice_text: "공지 내용",
  notice_href: "공지 링크",
  write_locked: "글쓰기 잠금",
  lock_message: "잠금 안내",
};

function formatValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "(비어 있음)";
  if (typeof value === "boolean") return value ? "켬" : "끔";
  if (field === "banner_color" && typeof value === "string" && isBannerColor(value)) return BANNER_COLORS[value].label;
  return String(value);
}

/** 기록 한 줄의 내용. 설정이면 바뀐 칸마다 이전 값 → 새 값을, 공지 고정이면 어떤 글인지 보여 줘요. */
function LogBody({ log }: { log: AdminLog }) {
  if (log.area === "pin") {
    const title = typeof log.changes.title === "string" ? log.changes.title : `${log.target}번 글`;
    return (
      <>
        <p className="font-semibold">{log.changes.pinned === true ? "글을 공지로 올렸어요" : "글을 공지에서 내렸어요"}</p>
        <p className={`mt-0.5 truncate text-sm ${mutedClass}`}>{title}</p>
      </>
    );
  }

  const changes = Object.entries(log.changes).filter(
    (entry): entry is [string, [unknown, unknown]] => Array.isArray(entry[1]) && entry[1].length === 2,
  );
  return (
    <>
      <p className="font-semibold">{log.area === "cafe_settings" ? "카페 설정을 바꿨어요" : log.area}</p>
      <ul className="mt-1 space-y-0.5 text-sm">
        {changes.map(([field, [before, after]]) => (
          <li key={field} className="break-words">
            <span className={mutedClass}>{FIELD_LABELS[field] ?? field}: </span>
            <span className={`${mutedClass} line-through decoration-zinc-400/70`}>{formatValue(field, before)}</span>
            <span aria-label="에서" className={mutedClass}>
              {" → "}
            </span>
            <span className="font-medium">{formatValue(field, after)}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

async function Logs() {
  const viewer = await getViewer();
  if (!viewer?.profile?.isAdmin) return <AdminOnly viewer={viewer} />;

  const logs = await listAdminLogs();
  if (logs.length === 0) return <EmptyState>아직 운영 기록이 없어요.</EmptyState>;
  const now = new Date();
  return (
    <>
      <ul className={`${cardClass} ${cardListClass}`}>
        {logs.map((log) => (
          <li key={log.id} className="flex gap-3 py-3.5">
            {log.actor ? (
              <Avatar id={log.actor.id} nickname={log.actor.nickname} team={log.actor.team} frame={log.actor.frame} size="md" />
            ) : (
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-500/10 text-[11px] font-bold text-zinc-500">
                SQL
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className={`flex items-center gap-1.5 text-xs ${mutedClass}`}>
                <span className="truncate font-semibold text-zinc-700 dark:text-zinc-200">
                  {log.actor?.nickname ?? "SQL Editor"}
                </span>
                <span aria-hidden>·</span>
                <time dateTime={log.createdAt} title={formatDateTime(log.createdAt)} className="shrink-0">
                  {formatRelativeTime(log.createdAt, now)}
                </time>
              </p>
              <div className="mt-1">
                <LogBody log={log} />
              </div>
            </div>
          </li>
        ))}
      </ul>
      <p className={`mt-3 text-center text-xs ${mutedClass}`}>최근 100개까지 보여 줘요. 1년이 지난 기록은 지워져요.</p>
    </>
  );
}

export default function AdminLogsPage() {
  return (
    <Suspense fallback={<PostListSkeleton rows={6} />}>
      <Logs />
    </Suspense>
  );
}
