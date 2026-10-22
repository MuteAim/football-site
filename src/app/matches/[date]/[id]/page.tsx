import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MatchSummarySkeleton, TalkSkeleton } from "@/components/cafe/CafeSkeletons";
import { CafeSetupNotice } from "@/components/cafe/CafeNotices";
import { TalkRoom } from "@/components/cafe/TalkRoom";
import { ChevronLeftIcon } from "@/components/Icons";
import { MatchSummary } from "@/components/MatchSummary";
import { isCafeConfigured } from "@/lib/cafe/config";
import { countTalkSides, listTalks } from "@/lib/cafe/data";
import { getViewer } from "@/lib/cafe/viewer";
import type { Match } from "@/lib/football-data";
import { getMatchOnDay } from "@/lib/match-day";
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
          ? { id: viewer.id, joined: viewer.profile !== null, isManager: viewer.profile?.isManager ?? false }
          : null
      }
      joinHref={`/cafe/me?next=${encodeURIComponent(path)}`}
    />
  );
}

async function MatchContent({ params }: { params: Params }) {
  const { date } = await params;
  const match = await findMatch(params);
  if (!match) notFound();

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
      {isCafeConfigured() ? (
        <Suspense fallback={<TalkSkeleton />}>
          <MatchTalk match={match} path={`/matches/${date}/${match.id}`} />
        </Suspense>
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
