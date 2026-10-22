import type { Metadata } from "next";
import { Suspense } from "react";
import { Avatar, NameBadge } from "@/components/cafe/Avatar";
import { MemberRequired } from "@/components/cafe/CafeNotices";
import { TeamPickerSkeleton } from "@/components/cafe/CafeSkeletons";
import { ProfileForm } from "@/components/cafe/ProfileForm";
import { TeamPicker } from "@/components/cafe/TeamPicker";
import { cardClass, mutedClass, secondaryButtonClass, skeletonClass } from "@/components/ui";
import { signOut } from "@/lib/cafe/actions";
import { safeNext } from "@/lib/cafe/config";
import { getTeamChoices } from "@/lib/cafe/teams";
import type { FanTeam } from "@/lib/cafe/types";
import { getViewer } from "@/lib/cafe/viewer";

export const metadata: Metadata = { title: "내 정보" };

async function TeamSection({ current }: { current: FanTeam | null }) {
  const leagues = await getTeamChoices();
  return <TeamPicker leagues={leagues} current={current} />;
}

// 처음 로그인한 사람은 여기서 닉네임을 정해 가입하고, 회원은 닉네임을 바꾸거나 로그아웃해요.
async function MeContent({ searchParams }: { searchParams: PageProps<"/cafe/me">["searchParams"] }) {
  const [params, viewer] = await Promise.all([searchParams, getViewer()]);
  const next = safeNext(params.next);

  if (!viewer) {
    return (
      <MemberRequired viewer={null} next="/cafe/me">
        로그인이 필요해요.
      </MemberRequired>
    );
  }

  const profile = viewer.profile;
  return (
    <div className={`${cardClass} p-5`}>
      {profile ? (
        <div className="flex items-center gap-3">
          <Avatar id={viewer.id} nickname={profile.nickname} team={profile.team} size="lg" />
          <div className="min-w-0">
            <h1 className="flex items-center gap-1.5 text-xl font-bold tracking-tight">
              <span className="truncate">{profile.nickname}</span>
              {profile.isManager ? <NameBadge>매니저</NameBadge> : null}
            </h1>
            <p className={`truncate text-sm ${mutedClass}`}>
              {profile.team ? `카페 회원 · ${profile.team.name} 팬` : "카페 회원"}
            </p>
          </div>
        </div>
      ) : (
        <>
          <h1 className="text-xl font-bold tracking-tight">카페 가입</h1>
          <p className={`mt-1 text-sm ${mutedClass}`}>카페에서 쓸 닉네임을 정해 주세요. 나중에 바꿀 수 있어요.</p>
        </>
      )}

      <div className="mt-5">
        {/* 가입하면 같은 자리에 닉네임 바꾸기 폼이 와서, 이전 폼 상태가 남지 않게 새로 그려요. */}
        <ProfileForm key={profile ? "member" : "join"} nickname={profile?.nickname} next={next} />
      </div>

      {profile ? (
        <section className="mt-6 border-t border-zinc-100 pt-5 dark:border-white/[0.07]">
          <h2 className="text-sm font-semibold">응원하는 팀</h2>
          <p className={`mt-0.5 mb-3 text-xs ${mutedClass}`}>고른 팀 엠블럼이 글과 댓글에서 내 프로필 그림으로 보여요.</p>
          {/* 팀 목록은 경기 API에서 와서 늦을 수 있으니, 닉네임 폼을 먼저 보여 주고 따로 불러와요. */}
          <Suspense fallback={<TeamPickerSkeleton />}>
            <TeamSection current={profile.team} />
          </Suspense>
        </section>
      ) : null}

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-zinc-100 pt-4 dark:border-white/[0.07]">
        <p className={`text-sm ${mutedClass}`}>
          {profile ? "이 기기에서 로그아웃해요." : "다른 계정으로 로그인하려면 먼저 로그아웃하세요."}
        </p>
        <form action={signOut}>
          <button type="submit" className={secondaryButtonClass}>
            로그아웃
          </button>
        </form>
      </div>
    </div>
  );
}

export default function MePage({ searchParams }: PageProps<"/cafe/me">) {
  return (
    <div className="mx-auto max-w-md break-keep">
      <Suspense fallback={<div className={`h-[260px] animate-pulse rounded-2xl ${skeletonClass}`} />}>
        <MeContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
