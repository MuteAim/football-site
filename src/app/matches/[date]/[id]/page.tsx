import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after, connection } from "next/server";
import { Suspense } from "react";
import { MatchSummarySkeleton, PredictionSkeleton, TalkSkeleton } from "@/components/cafe/CafeSkeletons";
import { CafeSetupNotice } from "@/components/cafe/CafeNotices";
import { PredictionCard } from "@/components/cafe/PredictionCard";
import { TalkRoom } from "@/components/cafe/TalkRoom";
import { ChevronLeftIcon } from "@/components/Icons";
import { MatchSummary } from "@/components/MatchSummary";
import { ScoreRefresh } from "@/components/ScoreRefresh";
import { lockNotice } from "@/lib/cafe/banner";
import { isCafeConfigured } from "@/lib/cafe/config";
import { countTalkSides, listTalks } from "@/lib/cafe/data";
import { getMatchGoals, settlePredictions } from "@/lib/cafe/goals";
import { countPredictions, getMyPrediction } from "@/lib/cafe/predictions";
import { isStaff } from "@/lib/cafe/profile";
import { lockFor } from "@/lib/cafe/settings";
import { getViewer } from "@/lib/cafe/viewer";
import type { Match } from "@/lib/football-data";
import { getMatchOnDay, getMatchOnDaySnapshot } from "@/lib/match-day";
import { isFinished, isLive, isPredictionOpen, matchResult, statusLabel } from "@/lib/match-display";
import { teamName } from "@/lib/teams-ko";
import { formatDayHeading, isDateKey } from "@/lib/time";

type Params = PageProps<"/matches/[date]/[id]">["params"];

async function findMatch(params: Params): Promise<Match | null> {
  const { date, id } = await params;
  const matchId = Number(id);
  if (!isDateKey(date) || !/^\d+$/.test(id) || !Number.isSafeInteger(matchId)) return null;
  return getMatchOnDay(date, matchId);
}

export async function generateMetadata({ params }: PageProps<"/matches/[date]/[id]">): Promise<Metadata> {
  // API 한도에 걸려도 제목 때문에 화면 전체가 오류가 나지 않게 해요.
  const match = await findMatch(params).catch(() => null);
  return {
    title: match ? `${teamName(match.homeTeam)} vs ${teamName(match.awayTeam)} 응원톡` : "경기 응원톡",
  };
}

/** 응원톡. 메시지와 로그인 상태는 볼 때마다 새로 읽어요. */
async function MatchTalk({ match, path }: { match: Match; path: string }) {
  const [viewer, { talks, authors }, counts] = await Promise.all([
    getViewer(),
    listTalks(match.id),
    countTalkSides(match.id),
  ]);
  const lock = viewer?.profile ? await lockFor(viewer.profile) : null;

  return (
    <TalkRoom
      matchId={match.id}
      home={{ name: teamName(match.homeTeam), crest: match.homeTeam.crest }}
      away={{ name: teamName(match.awayTeam), crest: match.awayTeam.crest }}
      initialTalks={talks}
      initialAuthors={authors}
      initialCounts={counts}
      viewer={
        viewer
          ? {
              id: viewer.id,
              joined: viewer.profile !== null,
              staff: isStaff(viewer.profile),
              locked: lock ? lockNotice(lock.message) : null,
            }
          : null
      }
      joinHref={`/cafe/me?next=${encodeURIComponent(path)}`}
    />
  );
}

/** 승부 예측. 내 예측과 예측 수는 볼 때마다 새로 읽어요. */
async function MatchPrediction({ match, date, path }: { match: Match; date: string; path: string }) {
  const viewer = await getViewer();
  // 마감 여부를 지금 시각으로 정해서, 미리 만들어 둘 수 없는 요청 시점 작업이라고 알려 둬요.
  await connection();
  const [counts, mine] = await Promise.all([
    countPredictions(match.id, match.utcDate),
    viewer?.profile ? getMyPrediction(match.id, viewer.id) : null,
  ]);
  const now = new Date();
  const open = isPredictionOpen(match, now.getTime());
  const result = matchResult(match);
  const label = statusLabel(match);
  // 끝난 경기면 정산해 두고, 맞혔으면 받은 골을 보여 줘요.
  if (result) after(settlePredictions);
  const earnedGoals = result && mine === result && viewer ? await getMatchGoals(match.id, viewer.id) : null;

  return (
    <PredictionCard
      // 서버에서 새 값이 오면 카드도 그 값으로 다시 시작해요.
      key={`${match.id}:${mine}:${open}:${result}:${counts.home}-${counts.draw}-${counts.away}`}
      matchId={match.id}
      date={date}
      kickoff={match.utcDate}
      home={{ name: teamName(match.homeTeam), crest: match.homeTeam.crest }}
      away={{ name: teamName(match.awayTeam), crest: match.awayTeam.crest }}
      open={open}
      closedNote={label && !isFinished(match) ? `${label}된 경기라 예측을 받지 않아요.` : null}
      result={result}
      earnedGoals={earnedGoals}
      initialPick={mine}
      initialCounts={counts}
      viewer={!viewer ? "guest" : viewer.profile ? "member" : "join"}
      path={path}
    />
  );
}

async function MatchContent({ params }: { params: Params }) {
  const { date, id } = await params;
  if (!isDateKey(date) || !/^\d+$/.test(id) || !Number.isSafeInteger(Number(id))) notFound();
  const snapshot = await getMatchOnDaySnapshot(date, Number(id));
  if (!snapshot) notFound();
  const { match, checkedAt } = snapshot;
  const path = `/matches/${date}/${match.id}`;

  return (
    <>
      <Link
        href={`/matches/${date}`}
        className="mb-3 inline-flex items-center gap-0.5 text-sm font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
      >
        <ChevronLeftIcon className="size-4" />
        {formatDayHeading(date)} 경기
      </Link>
      <MatchSummary match={match} />
      <ScoreRefresh checkedAt={checkedAt} automatic={isLive(match) || match.status === "TIMED" || match.status === "SCHEDULED"} />
      {isCafeConfigured() ? (
        <>
          <Suspense fallback={<PredictionSkeleton />}>
            <MatchPrediction match={match} date={date} path={path} />
          </Suspense>
          <Suspense fallback={<TalkSkeleton />}>
            <MatchTalk match={match} path={path} />
          </Suspense>
        </>
      ) : (
        <div className="mt-3">
          <CafeSetupNotice />
        </div>
      )}
    </>
  );
}

// 경기 화면. 경기 정보는 날짜별 경기 화면과 같은 저장된 API 응답을 쓰고, 그 아래 실시간 응원톡을 붙여요.
export default function MatchPage({ params }: PageProps<"/matches/[date]/[id]">) {
  return (
    <Suspense fallback={<MatchSummarySkeleton />}>
      <MatchContent params={params} />
    </Suspense>
  );
}
