import { cacheLife } from "next/cache";
import { Suspense, ViewTransition, type ReactNode } from "react";
import { getViewer } from "@/lib/cafe/viewer";
import { getMatchesSnapshot } from "@/lib/football-data";
import { isWithinRange, MAX_DISTANCE_DAYS, queryRange } from "@/lib/match-dates";
import { isLive } from "@/lib/match-display";
import { toKstDateKey, todayKst } from "@/lib/time";
import { DateStrip } from "./DateStrip";
import { EmptyState } from "./EmptyState";
import { FilteredMatches, MyTeamFilter } from "./FilteredMatches";
import { ScoreRefresh } from "./ScoreRefresh";
import { CompetitionNav } from "./SiteNav";
import { MatchdayHero } from "./MatchdayHero";

const SLIDE = { "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" };

async function ViewerTeamFilter() {
  const viewer = await getViewer();
  return <MyTeamFilter team={viewer?.profile?.team ?? null} />;
}

/** 회원별 버튼은 슬롯으로 전달해서 공용 경기 캐시에 회원 정보를 넣지 않아요. */
export function DayMatches({ date }: { date?: string }) {
  return (
    <CachedDayMatches
      date={date}
      teamControl={
        <Suspense fallback={<span className="h-10 w-28 animate-pulse rounded-xl bg-zinc-200 dark:bg-white/5" aria-label="응원팀 불러오는 중" />}>
          <ViewerTeamFilter />
        </Suspense>
      }
    />
  );
}

async function CachedDayMatches({ date, teamControl }: { date?: string; teamControl: ReactNode }) {
  "use cache";
  cacheLife("matches");

  const today = todayKst();
  const selected = date ?? today;
  const inRange = isWithinRange(selected, today);
  const { from, to } = queryRange(selected, today);
  const snapshot = inRange ? await getMatchesSnapshot(from, to) : null;
  const matches = snapshot?.matches
    .filter((match) => toKstDateKey(match.utcDate) === selected)
    .sort((a, b) => a.utcDate.localeCompare(b.utcDate)) ?? [];

  return (
    <>
      <MatchdayHero matches={matches} selected={selected} today={today} />
      <CompetitionNav />
      <DateStrip selected={selected} today={today} />
      <ViewTransition enter={SLIDE} exit={SLIDE} default="none">
        <div>
          {snapshot ? (
            <>
              <ScoreRefresh checkedAt={snapshot.checkedAt} automatic={selected === today || matches.some(isLive)} />
              <FilteredMatches matches={matches} today={today} teamControl={teamControl} />
            </>
          ) : <EmptyState>오늘 기준 앞뒤 {MAX_DISTANCE_DAYS}일 안의 경기만 볼 수 있어요. 오늘 버튼으로 돌아가 주세요.</EmptyState>}
        </div>
      </ViewTransition>
    </>
  );
}
