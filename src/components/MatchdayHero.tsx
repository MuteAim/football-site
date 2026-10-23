import Link from "next/link";
import type { Match } from "@/lib/football-data";
import { getCompetition } from "@/lib/competitions";
import { matchHref } from "@/lib/match-dates";
import { isFinished, isLive, matchScore, statusLabel } from "@/lib/match-display";
import { teamName } from "@/lib/teams-ko";
import { formatKickoff, formatMonthDayLong, formatWeekdayLong, relativeDayLabel, toKstDateKey } from "@/lib/time";
import { Crest } from "./Crest";
import { ChevronRightIcon, PitchLines } from "./Icons";

/** 이미 받은 경기에서 골라서, 첫 화면을 위해 API를 더 부르지 않아요. */
export function MatchdayHero({ matches, selected, today }: { matches: Match[]; selected: string; today: string }) {
  const live = matches.filter(isLive);
  const featured = live[0]
    ?? matches.find((match) => !isFinished(match) && !statusLabel(match))
    ?? matches.filter(isFinished).at(-1);
  const score = featured && (isLive(featured) || isFinished(featured)) ? matchScore(featured) : null;
  const href = featured ? matchHref(toKstDateKey(featured.utcDate), featured.id, today) : null;
  const competition = featured ? getCompetition(featured.competition.code) : null;
  const relative = relativeDayLabel(selected, today);

  return (
    <section aria-label="경기 센터" className="stadium-panel mb-5 overflow-hidden rounded-3xl p-5 sm:p-7">
      <PitchLines className="pointer-events-none absolute -top-8 -right-12 h-80 w-[480px] -rotate-12 text-white/[0.07]" />
      <div className="relative grid items-center gap-6 sm:grid-cols-[1fr_0.85fr]">
        <div>
          <p className="sport-eyebrow flex items-center gap-2 text-[#d4f77d]">
            <span className="h-px w-5 bg-current" aria-hidden /> MATCH CENTER
          </p>
          <h1 className="mt-3 text-3xl leading-tight font-extrabold tracking-tight sm:text-4xl">
            {formatMonthDayLong(selected)}<span className="ml-2 text-white/70">경기</span>
          </h1>
          <p className="mt-2 text-sm text-white/65">
            {relative ? `${relative} · ` : ""}{formatWeekdayLong(selected)}
            <span className="mx-2 text-white/25" aria-hidden>/</span>축구의 모든 순간을 함께.
          </p>
          <dl className="mt-5 flex gap-5 sm:gap-7">
            <div className="flex items-baseline gap-1.5"><dt className="text-xs text-white/65">경기</dt><dd className="score-digits order-first text-2xl">{matches.length}</dd></div>
            <div className="flex items-baseline gap-1.5"><dt className="text-xs text-white/65">대회</dt><dd className="score-digits order-first text-2xl">{new Set(matches.map((match) => match.competition.code)).size}</dd></div>
            <div className="flex items-baseline gap-1.5"><dt className="text-xs text-white/65">진행 중</dt><dd className="score-digits order-first text-2xl text-[#d4f77d]">{live.length}</dd></div>
          </dl>
        </div>
        {featured && href ? (
          <Link href={href} prefetch={false} aria-label={`${teamName(featured.homeTeam)} 대 ${teamName(featured.awayTeam)} 경기 보기`}
            className="group hidden rounded-2xl border border-white/15 bg-white/[0.06] p-4 transition hover:border-[#d4f77d]/50 hover:bg-white/10 sm:block">
            <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
              <span className={isLive(featured) ? "text-[#d4f77d]" : "text-white/70"}>
                {isLive(featured) ? "● 지금 진행 중" : isFinished(featured) ? "최근 경기 결과" : "다가오는 경기"}
              </span>
              <span className="truncate text-white/55">{competition?.name ?? featured.competition.name}</span>
            </div>
            <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              {[featured.homeTeam, featured.awayTeam].map((team, index) => (
                <div key={`${index}-${team.id}`} className={`flex min-w-0 flex-col items-center gap-2 ${index === 1 ? "col-start-3 row-start-1" : ""}`}>
                  <span className="flex size-12 items-center justify-center rounded-xl bg-white"><Crest src={team.crest} size={32} /></span>
                  <span className="w-full truncate text-center text-xs font-semibold">{teamName(team)}</span>
                </div>
              ))}
              <div className="col-start-2 row-start-1 text-center">
                <p className="score-digits whitespace-nowrap text-3xl">{score ? `${score.home} : ${score.away}` : formatKickoff(featured.utcDate)}</p>
                <p className="mt-2 text-[10px] text-white/55">{score ? score.note ?? "스코어" : "한국 시간"}</p>
              </div>
            </div>
            <p className="mt-4 flex items-center justify-center gap-1 border-t border-white/10 pt-3 text-[11px] font-semibold text-[#d4f77d]">
              경기 상세 · 응원톡 <ChevronRightIcon className="size-3.5 transition group-hover:translate-x-0.5" />
            </p>
          </Link>
        ) : (
          <div className="hidden border-l border-white/15 pl-7 sm:block">
            <p className="text-lg font-bold">킥오프를 기다리는 시간도<br />축구 이야기로.</p>
            <Link href="/cafe" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#d4f77d]">팬들의 카페로 <ChevronRightIcon className="size-4" /></Link>
          </div>
        )}
      </div>
    </section>
  );
}
