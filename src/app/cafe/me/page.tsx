import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { Suspense } from "react";
import { Avatar, LevelBadge, RoleBadge } from "@/components/cafe/Avatar";
import { MemberRequired } from "@/components/cafe/CafeNotices";
import { TeamPickerSkeleton } from "@/components/cafe/CafeSkeletons";
import { ProfileForm } from "@/components/cafe/ProfileForm";
import { SignOutButton } from "@/components/cafe/SignOutButton";
import { TeamPicker } from "@/components/cafe/TeamPicker";
import { cardClass, mutedClass, secondaryButtonClass, skeletonClass, textButtonClass } from "@/components/ui";
import { QUIZ, quizPrize, safeNext } from "@/lib/cafe/config";
import { getMyGoals, settlePredictions } from "@/lib/cafe/goals";
import { levelOf, nextLevel } from "@/lib/cafe/levels";
import { getPredictionRanking, rankOf } from "@/lib/cafe/predictions";
import { getMyQuiz } from "@/lib/cafe/quiz";
import { nameColorClass } from "@/lib/cafe/shop";
import { getTeamChoices } from "@/lib/cafe/teams";
import type { FanTeam, GoalEvent } from "@/lib/cafe/types";
import { getViewer } from "@/lib/cafe/viewer";
import { addDays, todayKst } from "@/lib/time";

export const metadata: Metadata = { title: "내 정보" };

const sectionClass = "mt-6 border-t border-zinc-100 pt-5 dark:border-white/[0.07]";

async function TeamSection({ current }: { current: FanTeam | null }) {
  const leagues = await getTeamChoices();
  return <TeamPicker leagues={leagues} current={current} />;
}

/** 내 승부 예측 성적. 예측 순위와 같은 계산 결과를 써요. */
async function PredictionRecord({ userId }: { userId: string }) {
  const entries = await getPredictionRanking();
  const index = entries.findIndex((entry) => entry.author.id === userId);
  const entry = entries[index];

  return (
    <div className="mt-1.5 flex items-center justify-between gap-3">
      <p className={`text-sm ${entry ? "" : mutedClass}`}>
        {entry ? (
          <>
            <span className="font-semibold">{rankOf(entries)[index]}위</span> · {entry.settled}경기 중 {entry.hits}경기 적중
          </>
        ) : (
          "아직 결과가 나온 예측이 없어요. 경기 화면에서 승부를 예측해 보세요."
        )}
      </p>
      <Link href="/cafe/predict" className={`shrink-0 ${textButtonClass}`}>
        순위 보기
      </Link>
    </div>
  );
}

const GOAL_LABEL: Record<GoalEvent["kind"], string> = {
  attendance: "출석",
  streak: "7일 연속 출석 보너스",
  prediction: "승부 예측 적중",
  minority: "소수 의견 적중 보너스",
  quiz: "선수 맞히기 정답",
};

/** 내 선수 맞히기 상태. 연승과 오늘 푼 문제 수예요. */
async function QuizRecord() {
  const quiz = await getMyQuiz();
  const remaining = quiz ? QUIZ.daily - quiz.played : 0;
  return (
    <div className="mt-1.5 flex items-center justify-between gap-3">
      <p className={`text-sm ${quiz && (quiz.streak > 0 || quiz.played > 0) ? "" : mutedClass}`}>
        {!quiz || (quiz.streak === 0 && quiz.played === 0)
          ? "카드 사진 속 선수를 맞히면 골을 받아요."
          : `${quiz.streak}연승 · 다음 정답 +${quizPrize(quiz.streak)}골 · 오늘 ${quiz.played}/${QUIZ.daily}문제`}
      </p>
      <Link href="/cafe/game" className={`shrink-0 ${textButtonClass}`}>
        {remaining > 0 ? "풀러 가기" : "보러 가기"}
      </Link>
    </div>
  );
}

/** 내 골과 등급, 출석 상태, 최근 골 내역 */
async function GoalSection({ userId, goals }: { userId: string; goals: number }) {
  const { streak, lastAttended, balance, events } = await getMyGoals(userId);
  const level = levelOf(goals);
  const next = nextLevel(goals);
  const progress = next ? Math.round(((goals - level.min) / (next.min - level.min)) * 100) : 100;
  const today = todayKst();
  // 어제나 오늘 출석했어야 연속 출석이 이어지고 있는 거예요.
  const attendedToday = lastAttended === today;
  const running = attendedToday || lastAttended === addDays(today, -1) ? streak : 0;

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <p className="text-2xl font-bold tracking-tight tabular-nums">
          {goals.toLocaleString("ko-KR")}
          <span className="ml-0.5 text-base">골</span>
        </p>
        <LevelBadge goals={goals} />
        <p className={`ml-auto text-xs ${mutedClass}`}>
          {next ? `${next.name}까지 ${(next.min - goals).toLocaleString("ko-KR")}골` : "가장 높은 등급이에요"}
        </p>
      </div>
      <div
        role="progressbar"
        aria-label="다음 등급까지"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-white/10"
      >
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
      </div>
      {/* 등급은 모은 골로 정해지고, 상점에서는 남은 골만 줄어요. */}
      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-emerald-500/[0.07] px-3 py-2">
        <p className="text-sm">
          쓸 수 있는 골 <span className="font-bold tabular-nums">{balance.toLocaleString("ko-KR")}골</span>
        </p>
        <Link href="/cafe/shop" className="shrink-0 text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
          골 상점 →
        </Link>
      </div>
      <p className={`mt-2 text-sm ${mutedClass}`}>
        {attendedToday
          ? `오늘 출석 완료 · ${running}일 연속`
          : running > 0
            ? `${running}일 연속 출석 중이에요.`
            : "하루 첫 방문 때 자동으로 출석해요."}
      </p>

      {events.length > 0 ? (
        <ul className="mt-3 divide-y divide-zinc-100 rounded-xl bg-zinc-50 px-3 text-sm dark:divide-white/[0.06] dark:bg-white/[0.03]">
          {events.map((event) => (
            <li key={event.id} className="flex items-center gap-2 py-2">
              <span className="min-w-0 flex-1 truncate">{GOAL_LABEL[event.kind]}</span>
              <span className={`shrink-0 text-xs tabular-nums ${mutedClass}`}>{event.day.slice(5).replace("-", ".")}</span>
              <span className="w-12 shrink-0 text-right font-semibold text-emerald-700 tabular-nums dark:text-emerald-400">
                +{event.amount}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className={`mt-2 text-xs leading-relaxed ${mutedClass}`}>
        출석 10골, 7일 연속 출석마다 30골, 승부 예측 적중 10골을 받아요. 남들이 많이 틀린 경기를 맞히면 10골을 더 주고,
        예측으로 받는 골은 하루 50골까지예요. 선수 맞히기는 정답 1골에 연승마다 1골씩 더해서 5연승부터 5골이에요.
      </p>
    </div>
  );
}

// 처음 로그인한 사람은 여기서 닉네임을 정해 가입하고, 회원은 닉네임을 바꾸거나 로그아웃해요.
async function MeContent({ searchParams }: { searchParams: PageProps<"/cafe/me">["searchParams"] }) {
  const [params, viewer] = await Promise.all([searchParams, getViewer()]);
  const next = safeNext(params.next);
  // 끝난 경기 예측을 정산해 둬서, 다음에 볼 때 골이 들어와 있게 해요.
  if (viewer?.profile) after(settlePredictions);

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
          <Avatar id={viewer.id} nickname={profile.nickname} team={profile.team} frame={profile.frame} size="lg" />
          <div className="min-w-0">
            <h1 className="flex items-center gap-1.5 text-xl font-bold tracking-tight">
              <span className={`truncate ${nameColorClass(profile.nameColor)}`}>{profile.nickname}</span>
              <LevelBadge goals={profile.goals} />
              <RoleBadge author={profile} />
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
        <>
          <section className={sectionClass}>
            <h2 className="text-sm font-semibold">골</h2>
            <Suspense fallback={<div className={`mt-2 h-24 animate-pulse ${skeletonClass}`} />}>
              <GoalSection userId={viewer.id} goals={profile.goals} />
            </Suspense>
          </section>

          <section className={sectionClass}>
            <h2 className="text-sm font-semibold">승부 예측</h2>
            <Suspense fallback={<div className={`mt-2 h-5 w-48 animate-pulse ${skeletonClass}`} />}>
              <PredictionRecord userId={viewer.id} />
            </Suspense>
          </section>

          <section className={sectionClass}>
            <h2 className="text-sm font-semibold">선수 맞히기</h2>
            <Suspense fallback={<div className={`mt-2 h-5 w-48 animate-pulse ${skeletonClass}`} />}>
              <QuizRecord />
            </Suspense>
          </section>

          <section className={sectionClass}>
            <h2 className="text-sm font-semibold">응원하는 팀</h2>
            <p className={`mt-0.5 mb-3 text-xs ${mutedClass}`}>고른 팀 엠블럼이 글과 댓글에서 내 프로필 그림으로 보여요.</p>
            {/* 팀 목록은 경기 API에서 와서 늦을 수 있으니, 닉네임 폼을 먼저 보여 주고 따로 불러와요. */}
            <Suspense fallback={<TeamPickerSkeleton />}>
              <TeamSection current={profile.team} />
            </Suspense>
          </section>
        </>
      ) : null}

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-zinc-100 pt-4 dark:border-white/[0.07]">
        <p className={`text-sm ${mutedClass}`}>
          {profile ? "이 기기에서 로그아웃해요." : "다른 계정으로 로그인하려면 먼저 로그아웃하세요."}
        </p>
        <SignOutButton className={secondaryButtonClass} />
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
