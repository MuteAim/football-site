import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BannerForm, LockForm, NoticeForm } from "@/components/cafe/AdminSettingsForms";
import { PostListSkeleton } from "@/components/cafe/CafeSkeletons";
import { AdminOnly } from "@/components/cafe/CafeNotices";
import { PinButton } from "@/components/cafe/PinButton";
import { BoardChip } from "@/components/cafe/PostList";
import { cardClass, cardHeadingClass, cardListClass, mutedClass } from "@/components/ui";
import { postHref } from "@/lib/cafe/boards";
import { listPinned } from "@/lib/cafe/data";
import { readCafeSettings } from "@/lib/cafe/settings";
import type { PostSummary } from "@/lib/cafe/types";
import { getViewer } from "@/lib/cafe/viewer";

export const metadata: Metadata = { title: "카페 관리" };

/** 공지로 올린 글 목록. 여기서 바로 내릴 수 있어요. */
function PinnedPosts({ posts }: { posts: PostSummary[] }) {
  return (
    <section className={`${cardClass} mb-4`}>
      <h2 className={cardHeadingClass}>공지 글</h2>
      <p className={`px-4 pt-3 text-sm ${mutedClass}`}>
        글 화면 아래의 ‘공지로 올리기’를 누르면 그 게시판 첫 쪽 맨 위에 보여요. 전체글에는 최근에 올린 공지 5개가 나와요.
      </p>
      {posts.length === 0 ? (
        <p className={`px-4 py-5 text-sm ${mutedClass}`}>아직 공지로 올린 글이 없어요.</p>
      ) : (
        <ul className={cardListClass}>
          {posts.map((post) => (
            <li key={post.id} className="flex items-center gap-2 py-3 text-xs">
              <BoardChip slug={post.board} />
              <Link
                href={postHref(post)}
                className="min-w-0 flex-1 truncate text-[15px] hover:text-emerald-700 dark:hover:text-emerald-400"
              >
                {post.title}
              </Link>
              <PinButton postId={post.id} pinned />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

async function AdminSettings() {
  const viewer = await getViewer();
  if (!viewer?.profile?.isAdmin) return <AdminOnly viewer={viewer} />;

  // 설정은 저장해 둔 값이 아니라 지금 DB 값으로 폼을 채워요.
  const [settings, pinned] = await Promise.all([readCafeSettings(), listPinned("", 20)]);
  return (
    <>
      <BannerForm settings={settings} />
      <NoticeForm settings={settings} />
      <LockForm settings={settings} />
      <PinnedPosts posts={pinned} />
    </>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<PostListSkeleton rows={6} />}>
      <AdminSettings />
    </Suspense>
  );
}
