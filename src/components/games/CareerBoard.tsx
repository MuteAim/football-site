import Link from "next/link";
import type { CareerSnapshot } from "@/lib/career/board";
import { POSITIONS, type Pos } from "@/lib/career/data";
import { TrophyIcon } from "../Icons";
import { cardClass, mutedClass } from "../ui";

/** 4-3-3 자리. 좌표는 세로 경기장 안의 % 위치예요. */
const ELEVEN: { pos: Pos; slot: number; x: number; y: number }[] = [
  { pos: "ST", slot: 1, x: 50, y: 12 },
  { pos: "WG", slot: 1, x: 17, y: 20 },
  { pos: "WG", slot: 2, x: 83, y: 20 },
  { pos: "CM", slot: 1, x: 29, y: 39 },
  { pos: "AM", slot: 1, x: 71, y: 39 },
  { pos: "DM", slot: 1, x: 50, y: 55 },
  { pos: "FB", slot: 1, x: 14, y: 69 },
  { pos: "CB", slot: 1, x: 37, y: 75 },
  { pos: "CB", slot: 2, x: 63, y: 75 },
  { pos: "FB", slot: 2, x: 86, y: 69 },
  { pos: "GK", slot: 1, x: 50, y: 90 },
];

export function CareerBoard({ snapshot }: { snapshot: CareerSnapshot }) {
  const { board } = snapshot;
  const filled = new Map(board.eleven.map((entry) => [`${entry.position}-${entry.slot}`, entry]));
  return (
    <aside className="space-y-4">
      <section className={`${cardClass} p-5`}>
        <div className="flex items-center gap-2"><TrophyIcon className="size-5 text-amber-500" /><h2 className="font-extrabold">오늘의 레전드</h2></div>
        <p className={`mt-1 text-xs ${mutedClass}`}>{snapshot.day.slice(5).replace("-", ".")} · 오늘 은퇴한 선수로 겨뤄요</p>
        {snapshot.available ? (
          <>
            <p className={`mt-4 text-xs ${mutedClass}`}>{board.participants}명 참여 · 상위 20명</p>
            {board.leaders.length ? (
              <ol className="mt-2 divide-y divide-zinc-100 dark:divide-white/5">
                {board.leaders.map((leader) => (
                  <li key={`${leader.nickname}-${leader.rank}`} className={`flex items-center gap-2 py-2.5 ${leader.isMe ? "text-emerald-700 dark:text-emerald-300" : ""}`}>
                    <span className={`w-6 shrink-0 text-sm font-black tabular-nums ${leader.rank <= 3 ? "text-amber-600 dark:text-amber-300" : mutedClass}`}>{leader.rank}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{leader.name} <span className={`text-[11px] font-semibold ${mutedClass}`}>{leader.position}</span></span>
                      <span className={`block truncate text-[11px] ${mutedClass}`}>{leader.nickname}{leader.isMe ? " (나)" : ""}{leader.ballonDor ? ` · 발롱도르 ${leader.ballonDor}회` : ""} · OVR {leader.peakOvr}</span>
                    </span>
                    <span className="shrink-0 text-sm font-extrabold tabular-nums">{leader.score.toLocaleString("ko-KR")}</span>
                  </li>
                ))}
              </ol>
            ) : <p className={`py-8 text-center text-sm ${mutedClass}`}>오늘의 첫 레전드가 되어 보세요.</p>}
            {board.personal ? <p className="mt-3 rounded-xl bg-emerald-500/10 p-3 text-center text-sm font-semibold">내 최고 {board.personal.score.toLocaleString("ko-KR")}점 · {board.personal.rank}위</p> : null}
          </>
        ) : (
          <p className={`py-6 text-sm leading-relaxed ${mutedClass}`}>지금은 순위를 불러올 수 없어요. 연습 커리어와 친구 도전장은 그대로 즐길 수 있어요.</p>
        )}
        <p className={`mt-3 text-[11px] leading-relaxed ${mutedClass}`}>회원마다 그날 최고 레전드 점수 하나로 겨뤄요. 같은 점수는 공동 순위예요.</p>
      </section>

      <section className={`${cardClass} p-5`}>
        <h2 className="font-extrabold">오늘의 베스트 11</h2>
        <p className={`mt-1 text-xs ${mutedClass}`}>4-3-3 · 포지션마다 오늘 가장 높은 점수</p>
        <div className="relative mt-4 aspect-[3/4] overflow-hidden rounded-2xl bg-[#17442f]" role="list" aria-label="오늘의 베스트 11">
          <svg viewBox="0 0 300 400" className="absolute inset-0 size-full text-white/15" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="12" y="12" width="276" height="376" rx="4" />
            <path d="M12 200h276M95 12v52h110V12M95 388v-52h110v52M125 12v20h50V12M125 388v-20h50v20" />
            <circle cx="150" cy="200" r="38" />
          </svg>
          {ELEVEN.map(({ pos, slot, x, y }) => {
            const entry = filled.get(`${pos}-${slot}`);
            return (
              <div key={`${pos}-${slot}`} role="listitem" className="absolute flex w-[4.5rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center" style={{ left: `${x}%`, top: `${y}%` }}
                aria-label={entry ? `${POSITIONS[pos].name} ${entry.name}, ${entry.nickname}, ${entry.score}점` : `${POSITIONS[pos].name} 빈자리`}>
                <span className={`flex size-8 items-center justify-center rounded-full text-[10px] font-black ${entry ? "bg-[#d4f77d] text-[#102c26]" : "border border-dashed border-white/30 text-white/40"}`}>{pos}</span>
                <span className="mt-0.5 w-full truncate text-[10px] leading-tight font-bold text-white">{entry ? entry.name : "비어 있음"}</span>
                {entry ? <span className="w-full truncate text-[9px] leading-tight text-white/60">{entry.nickname}</span> : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className={`${cardClass} p-5`}>
        <h2 className="font-bold">이렇게 즐겨요</h2>
        <ol className="mt-4 space-y-3 text-sm leading-relaxed">
          <li><strong className="mr-2 text-emerald-600 dark:text-emerald-400">01</strong>유스 선수 셋 중 한 명을 골라 17세에 출발해요.</li>
          <li><strong className="mr-2 text-emerald-600 dark:text-emerald-400">02</strong>시즌마다 <strong>훈련·사건·이적</strong>을 골라요. 출전 시간이 성장을 좌우해요.</li>
          <li><strong className="mr-2 text-emerald-600 dark:text-emerald-400">03</strong>은퇴하면 트로피·수상·기록으로 <strong>레전드 점수</strong>가 매겨져요.</li>
        </ol>
        <p className={`mt-4 border-t border-zinc-100 pt-3 text-xs leading-relaxed dark:border-white/10 ${mutedClass}`}>
          한국 선수는 28세 전에 아시안게임 금메달이나 올림픽 메달을 따지 못하면 김천 상무에서 군 복무를 해요. 구단·능력치는 게임용 가상 수치예요.
        </p>
      </section>
      <Link href="/games/penalty" prefetch={false} className={`block rounded-xl px-2 py-2 text-center text-sm ${mutedClass} hover:underline`}>손끝 감각도 자신 있다면? 승부차기 러시 →</Link>
    </aside>
  );
}
