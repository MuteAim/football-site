import Link from "next/link";
import { Suspense } from "react";
import { isCafeConfigured } from "@/lib/cafe/config";
import { getViewer } from "@/lib/cafe/viewer";
import { ChatIcon, PitchLines, UserIcon } from "../Icons";
import { LinkPending } from "../LinkPending";
import { AccountMenu } from "./AccountMenu";
import { ActiveBoardTabs, BoardTabs } from "./BoardTabs";
import { LoginLink } from "./LoginLink";

const chipClass =
  "flex h-9 max-w-36 shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3 text-sm font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/25 active:scale-95";

/**
 * 배너 오른쪽. 로그인하지 않았으면 로그인 버튼, 닉네임을 정하기 전이면 닉네임 정하기,
 * 회원이면 누르면 내 정보·상점·예측 순위로 가는 계정 메뉴예요.
 */
async function ViewerChip() {
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
  return <AccountMenu me={viewer.profile} chipClass={chipClass} />;
}

/** 카페 머리. 초록 배너와 게시판 탭이에요. 모든 카페 화면 위에 붙어요. */
export function CafeHeader() {
  return (
    <div className="mb-5">
      <div className="relative h-[104px] rounded-3xl bg-linear-to-br from-emerald-700 to-emerald-900 px-5 text-white shadow-sm">
        {/* 장식만 둥근 모서리 안에 잘라 두고, 계정 메뉴는 배너 밖으로 펼쳐질 수 있게 해요. */}
        <div aria-hidden className="absolute inset-0 overflow-hidden rounded-3xl">
          <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_100%_0%,rgb(255_255_255/0.2),transparent_60%)]" />
          <PitchLines className="absolute top-1/2 -right-16 size-56 -translate-y-1/2 text-white/10" />
        </div>
        <div className="relative flex h-full items-center gap-4">
          {/* 휴대폰에서는 카페 이름이 잘리지 않게 아이콘을 숨겨요. */}
          <div className="hidden size-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 sm:flex">
            <ChatIcon className="size-7" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white/85">해축남</p>
            <Link href="/cafe" className="block truncate text-2xl font-bold tracking-tight">
              해외축구에 진심인 사람들 대화하는곳
            </Link>
          </div>
          <Suspense fallback={<span className="h-9 w-20 shrink-0 rounded-full bg-white/15" />}>
            <ViewerChip />
          </Suspense>
        </div>
      </div>
      <Suspense fallback={<BoardTabs active={null} />}>
        <ActiveBoardTabs />
      </Suspense>
    </div>
  );
}
