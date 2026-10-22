import Link from "next/link";
import { isCafeConfigured } from "@/lib/cafe/config";
import { getTeamDigest, type TeamDigest, type TeamOutcome } from "@/lib/cafe/teams";
import { getViewer } from "@/lib/cafe/viewer";
import type { Match } from "@/lib/football-data";
import { matchHref } from "@/lib/match-day";
import { isLive, matchScore, roundLabel } from "@/lib/match-display";
import { teamName } from "@/lib/teams-ko";
import { formatDayHeading, formatKickoff, relativeDayLabel, toKstDateKey, todayKst } from "@/lib/time";
import { Crest } from "../Crest";
import { ChevronRightIcon } from "../Icons";
import { LinkPending } from "../LinkPending";
import { cardClass, mutedClass } from "../ui";

const OUTCOME: Record<TeamOutcome, { label: string; className: string }> = {
  win: { label: "승", className: "bg-emerald-500 text-white" },
  draw: { label: "무", className: "bg-zinc-300 text-zinc-700 dark:bg-zinc-600 dark:text-zinc-100" },
  loss: { label: "패", className: "bg-rose-500 text-white" },
};

const sectionLabelClass = `text-xs font-semibold ${mutedClass}`;

function opponentOf(match: Match, teamId: number) {
  const home = match.homeTeam.id === teamId;
  return { team: home ? match.awayTeam : match.homeTeam, home };
}

function NextMatch({ digest, today }: { digest: TeamDigest; today: string }) {
  const { next, team } = digest;
  if (!next) {
    return (
      <div className="px-4 py-3">
        <p className={sectionLabelClass}>다음 경기</p>
        <p className="mt-1.5 text-sm">예정된 경기가 없어요.</p>
      </div>
    );
  }

  const live = isLive(next);
  const { team: opponent, home } = opponentOf(next, team.id);
  const date = toKstDateKey(next.utcDate);
  const href = matchHref(date, next.id, today);
  const score = live ? matchScore(next) : null;
  const content = (
    <>
      <p className={`${sectionLabelClass} ${live ? "text-red-600 dark:text-red-400" : ""}`}>
        {live ? "진행 중" : "다음 경기"}
      </p>
      <div className="mt-1.5 flex items-center gap-2.5">
        <Crest src={opponent.crest} size={22} />
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
          vs {teamName(opponent)} <span className={`text-xs font-normal ${mutedClass}`}>{home ? "홈" : "원정"}</span>
        </span>
        <span className="shrink-0 text-sm font-semibold tabular-nums">
          {score
            ? `${home ? score.home : score.away} : ${home ? score.away : score.home}`
            : `${relativeDayLabel(date, today) ?? formatDayHeading(date)} ${formatKickoff(next.utcDate)}`}
        </span>
      </div>
      <p className={`mt-1 text-xs ${mutedClass}`}>
        {next.competition.code === digest.league.code ? digest.league.name : "챔스"} · {roundLabel(next)}
      </p>
    </>
  );

  if (!href) return <div className="px-4 py-3">{content}</div>;
  return (
    // 경기 화면을 미리 만들면 API를 더 부르게 돼서, 다른 경기 줄처럼 미리 불러오기를 꺼 둬요.
    <Link href={href} prefetch={false} className="relative block px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-white/[0.03]">
      {content}
      <LinkPending className="bg-emerald-500/10" />
    </Link>
  );
}

function RecentForm({ digest }: { digest: TeamDigest }) {
  const { recent, team } = digest;
  return (
    <div className="px-4 py-3">
      <p className={sectionLabelClass}>최근 {recent.length}경기</p>
      {recent.length === 0 ? (
        <p className="mt-1.5 text-sm">아직 끝난 경기가 없어요.</p>
      ) : (
        <ol className="mt-1.5 flex gap-1.5">
          {recent.map(({ match, outcome }) => {
            const { team: opponent, home } = opponentOf(match, team.id);
            const score = matchScore(match);
            const line = `${OUTCOME[outcome].label}, ${teamName(opponent)}전 ${home ? score.home : score.away}:${home ? score.away : score.home}`;
            return (
              <li
                key={match.id}
                title={line}
                className={`flex size-7 items-center justify-center rounded-md text-xs font-bold ${OUTCOME[outcome].className}`}
              >
                <span aria-hidden>{OUTCOME[outcome].label}</span>
                <span className="sr-only">{line}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/** 홈 맨 위 "내 팀" 카드. 순위, 다음 경기, 최근 결과를 한 번에 보여 줘요. */
function MyTeamCard({ digest, today }: { digest: TeamDigest; today: string }) {
  const { team, league, standing } = digest;
  return (
    <section className={`${cardClass} mb-4`}>
      <Link
        href={`/league/${league.code}`}
        prefetch={false}
        className="group relative flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-zinc-50 dark:hover:bg-white/[0.03]"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-zinc-950/5 dark:ring-white/10">
          <Crest src={team.crest} size={30} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">내 팀</p>
          <p className="truncate text-lg font-bold tracking-tight">{team.name}</p>
        </div>
        {standing ? (
          <div className="shrink-0 text-right">
            <p className="text-lg font-bold tabular-nums">{standing.position}위</p>
            <p className={`text-xs tabular-nums ${mutedClass}`}>
              {league.name} · 승점 {standing.points}
            </p>
          </div>
        ) : null}
        <ChevronRightIcon className="-mr-1 size-4 shrink-0 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-zinc-500 dark:text-zinc-600" />
        <LinkPending className="bg-emerald-500/10" />
      </Link>
      <div className="grid divide-y divide-zinc-100 border-t border-zinc-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0 dark:divide-white/[0.07] dark:border-white/[0.07]">
        <NextMatch digest={digest} today={today} />
        <RecentForm digest={digest} />
      </div>
    </section>
  );
}

/** 응원팀이 없는 회원에게 고르러 가는 길을 알려 줘요. */
function PickTeamPrompt() {
  return (
    <Link
      href="/cafe/me"
      className={`${cardClass} group relative mb-4 flex items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold">응원하는 팀을 골라 보세요</p>
        <p className={`text-sm ${mutedClass}`}>여기에 내 팀의 다음 경기와 순위가 떠요.</p>
      </div>
      <ChevronRightIcon className="size-4 shrink-0 text-zinc-300 transition group-hover:translate-x-0.5 dark:text-zinc-600" />
      <LinkPending className="bg-emerald-500/10" />
    </Link>
  );
}

/**
 * 홈의 내 팀 자리. 로그인한 회원에게만 보이고, 로그인하지 않으면 아무것도 그리지 않아요.
 * 로그인 쿠키를 읽어서 꼭 Suspense 안에 둬야 해요.
 */
export async function MyTeamSection() {
  if (!isCafeConfigured()) return null;
  const viewer = await getViewer();
  if (!viewer?.profile) return null;
  if (!viewer.profile.team) return <PickTeamPrompt />;

  // 경기 API가 한도에 걸려도 홈의 오늘 경기는 보여야 해서, 내 팀 카드만 조용히 빼요.
  const digest = await getTeamDigest(viewer.profile.team.id).catch((error: unknown) => {
    console.error(error);
    return null;
  });
  return digest ? <MyTeamCard digest={digest} today={todayKst()} /> : null;
}
