import Link from "next/link";
import { Suspense } from "react";
import { bannerLook } from "@/lib/cafe/banner";
import { isCafeConfigured } from "@/lib/cafe/config";
import { getUnreadCount } from "@/lib/cafe/notifications";
import { getCafeSettings } from "@/lib/cafe/settings";
import { getViewer } from "@/lib/cafe/viewer";
import { UserIcon } from "../Icons";
import { LinkPending } from "../LinkPending";
import { AccountMenu } from "./AccountMenu";
import { ActiveBoardTabs, BoardTabs } from "./BoardTabs";
import { CafeBanner, LockBar, NoticeBar } from "./CafeBanner";
import { LoginLink } from "./LoginLink";

const chipClass =
  "flex h-9 max-w-36 shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3 text-sm font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/25 active:scale-95";

/**
 * 배너 오른쪽. 로그인하지 않았으면 로그인 버튼, 닉네임을 정하기 전이면 닉네임 정하기,
 * 회원이면 누르면 내 소식·내 정보·상점·예측 순위로 가는 계정 메뉴예요.
 */
async function ViewerChip({ badgeRing }: { badgeRing: string }) {
  if (!isCafeConfigured()) return null;
  const viewer = await getViewer();

  if (!viewer) {
    return (
      <LoginLink className={chipClass}>
        <UserIcon className="size-4" />
        로그인
      </LoginLink>
    );
  }
  if (!viewer.profile) {
    return (
      <Link href="/cafe/me" className={`relative ${chipClass}`}>
        닉네임 정하기
        <LinkPending className="rounded-full bg-white/20" />
      </Link>
    );
  }
  return (
    <AccountMenu me={viewer.profile} unread={await getUnreadCount()} chipClass={chipClass} badgeRing={badgeRing} />
  );
}

/**
 * 카페 머리. 배너와 공지·글쓰기 잠금 띠, 게시판 탭이에요. 모든 카페 화면 위에 붙어요.
 * 배너와 띠는 운영자가 카페 관리 화면에서 정해요. 설정은 저장해 둬서 화면 뼈대와 같이 바로 떠요.
 */
export async function CafeHeader() {
  const settings = await getCafeSettings();
  const badgeRing = bannerLook(settings.bannerColor).ring;
  return (
    <div className="mb-5">
      <CafeBanner name={settings.cafeName} tagline={settings.tagline} color={settings.bannerColor}>
        <Suspense fallback={<span className="h-9 w-20 shrink-0 rounded-full bg-white/15" />}>
          <ViewerChip badgeRing={badgeRing} />
        </Suspense>
      </CafeBanner>
      <LockBar lock={settings.lock} />
      <NoticeBar notice={settings.notice} />
      <Suspense fallback={<BoardTabs active={null} />}>
        <ActiveBoardTabs />
      </Suspense>
    </div>
  );
}
