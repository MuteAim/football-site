"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { finishPenalty, getPenaltySnapshot, startPenalty } from "@/lib/cafe/penalty-actions";
import { PENALTY, judgeShot, penaltyDay, penaltyTitle, shotPosition, shotSetup, summarizeShots, type PenaltySnapshot, type Shot } from "@/lib/penalty";
import { BallIcon, TrophyIcon } from "../Icons";
import { cardClass, mutedClass, primaryButtonClass, secondaryButtonClass } from "../ui";
import { PenaltyPitch } from "./PenaltyPitch";
import styles from "./penalty.module.css";

type Phase = "ready" | "playing" | "feedback" | "result";
const BEST_KEY = "football-penalty-best-v1";
const shotLabel = { perfect: "PERFECT!", goal: "GOAL!", saved: "선방!", timeout: "시간 초과" };

function readBest(day: string): number {
  try {
    const saved = JSON.parse(localStorage.getItem(BEST_KEY) ?? "null");
    return saved?.day === day && Number.isInteger(saved.score) && saved.score >= 0 && saved.score <= PENALTY.maxScore ? saved.score : 0;
  } catch { return 0; }
}

/** 프레임마다 React 트리 전체를 그리지 않고 게이지 위치만 갱신해요. 클릭 시에도 같은 시계를 사용해요. */
function ShotControl({ day, index, onShoot }: { day: string; index: number; onShoot: (elapsed: number | null) => void }) {
  const marker = useRef<HTMLDivElement>(null);
  const clock = useRef<HTMLSpanElement>(null);
  const started = useRef<number | null>(null);
  const fired = useRef(false);
  const setup = shotSetup(day, index);

  const shoot = useCallback(() => {
    if (fired.current || started.current === null) return;
    const elapsed = Math.round(performance.now() - started.current);
    if (elapsed < PENALTY.minShotMs) return;
    fired.current = true;
    onShoot(elapsed >= PENALTY.shotMs ? null : elapsed);
  }, [onShoot]);

  useEffect(() => {
    started.current ??= performance.now();
    let frame = 0;
    const tick = () => {
      if (fired.current) return;
      const elapsed = performance.now() - started.current!;
      if (marker.current) marker.current.style.left = `${shotPosition(day, index, elapsed) / 10}%`;
      if (clock.current) clock.current.textContent = `${Math.max(0, (PENALTY.shotMs - elapsed) / 1000).toFixed(1)}초`;
      if (elapsed >= PENALTY.shotMs) {
        fired.current = true;
        onShoot(null);
      } else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement;
      if (target.closest("a, input, textarea, select, [contenteditable=true]") || (target.closest("button") && !target.closest("[data-shoot]"))) return;
      event.preventDefault();
      shoot();
    };
    window.addEventListener("keydown", onKey);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("keydown", onKey); };
  }, [day, index, onShoot, shoot]);

  return (
    <div className="px-5 pb-5 sm:px-7">
      <div className="mb-3 flex justify-between gap-2 text-xs font-semibold text-white/70">
        <span>금색 한가운데를 노리세요</span><span ref={clock} className="w-12 text-right tabular-nums" aria-hidden="true">3.5초</span>
      </div>
      <div className="relative h-7 rounded-full bg-white/10 ring-1 ring-white/15" aria-hidden="true">
        <div className="absolute inset-y-0 rounded-full bg-lime-300/50" style={{ left: `${(setup.target - setup.width / 2) / 10}%`, width: `${setup.width / 10}%` }} />
        <div className="absolute inset-y-0 bg-amber-300" style={{ left: `${(setup.target - setup.width / 6) / 10}%`, width: `${setup.width / 30}%` }} />
        <div ref={marker} className="absolute -top-1 h-9 w-1.5 -translate-x-1/2 rounded-full bg-white shadow-[0_0_12px_#fff8]" style={{ left: `${shotPosition(day, index, 0) / 10}%` }} />
      </div>
      <button type="button" data-shoot onClick={shoot} className="mt-5 flex h-16 w-full touch-manipulation items-center justify-center gap-2 rounded-2xl bg-[#d4f77d] text-xl font-black text-[#152d21] shadow-[0_5px_0_#83aa45] transition active:translate-y-1 active:shadow-none">
        <BallIcon className="size-6" /> 슛!
        <span className="ml-2 hidden rounded border border-current/25 px-2 py-0.5 text-[11px] font-semibold sm:block">SPACE</span>
      </button>
    </div>
  );
}

export function PenaltyGame({ initial, challenge }: { initial: PenaltySnapshot; challenge: { score: number; day: string } | null }) {
  const [snapshot, setSnapshot] = useState(initial);
  const [phase, setPhase] = useState<Phase>("ready");
  const [day, setDay] = useState(initial.day);
  const [shots, setShots] = useState<Shot[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [best, setBest] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState<"none" | "saving" | "saved" | "failed">("none");
  const [shareText, setShareText] = useState("");
  const [shareNote, setShareNote] = useState("");
  const [starting, startAction] = useTransition();
  const [saving, saveAction] = useTransition();
  const generation = useRef(0);
  const startLock = useRef(false);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const arena = useRef<HTMLElement>(null);
  const summary = summarizeShots(shots);
  const index = Math.min(shots.length, PENALTY.shots - 1);
  const last = shots.at(-1) ?? null;
  const activeChallenge = challenge?.day === day ? challenge : null;
  const ranked = snapshot.member && snapshot.available;

  useEffect(() => {
    const frame = requestAnimationFrame(() => setBest(readBest(initial.day)));
    return () => cancelAnimationFrame(frame);
  }, [initial.day]);

  const save = useCallback((id: string, played: Shot[], playedDay: string, version: number) => {
    setSaveState("saving");
    setError("");
    saveAction(async () => {
      const result = await finishPenalty(id, played.map((shot) => shot.elapsed));
      if (version !== generation.current) return;
      if ("error" in result) { setSaveState("failed"); setError(result.error); return; }
      setSaveState("saved");
      const next = await getPenaltySnapshot(playedDay);
      if (version === generation.current && next.available) setSnapshot(next);
    });
  }, []);

  useEffect(() => {
    if (phase !== "feedback") return;
    const timer = window.setTimeout(() => {
      if (shots.length < PENALTY.shots) { setPhase("playing"); return; }
      const score = summarizeShots(shots).score;
      const previous = readBest(day);
      setNewBest(score > previous);
      setBest(Math.max(score, previous));
      try { localStorage.setItem(BEST_KEY, JSON.stringify({ day, score: Math.max(score, previous) })); } catch {}
      setPhase("result");
      if (runId) save(runId, shots, day, generation.current);
    }, PENALTY.feedbackMs);
    return () => window.clearTimeout(timer);
  }, [phase, shots, day, runId, save]);

  useEffect(() => { if (phase === "result") resultHeading.current?.focus(); }, [phase]);

  function start(practice = false) {
    if (startLock.current || saving) return;
    startLock.current = true;
    const version = ++generation.current;
    setError("");
    startAction(async () => {
      try {
        let nextDay = penaltyDay();
        let id: string | null = null;
        if (ranked && !practice) {
          const started = await startPenalty();
          if ("error" in started) { setError(started.error); return; }
          nextDay = started.day;
          id = started.runId;
        }
        if (version !== generation.current) return;
        if (nextDay !== snapshot.day) setSnapshot(await getPenaltySnapshot(nextDay));
        if (version !== generation.current) return;
        setDay(nextDay); setRunId(id); setShots([]); setSaveState("none");
        setShareNote(""); setShareText(""); setNewBest(false); setBest(readBest(nextDay));
        if (window.matchMedia("(max-width: 1023px)").matches) arena.current?.scrollIntoView({ block: "start", behavior: "auto" });
        setPhase("playing");
      } finally { startLock.current = false; }
    });
  }

  const shoot = useCallback((elapsed: number | null) => {
    if (phase !== "playing") return;
    setShots((previous) => [...previous, judgeShot(day, previous.length, elapsed, previous.at(-1)?.streak ?? 0)]);
    setPhase("feedback");
  }, [phase, day]);

  async function share() {
    const url = `${location.origin}/games/penalty?score=${summary.score}&day=${day}`;
    const text = `⚽ 승부차기 러시 · ${day}\n${summary.score}점 / ${summary.goals}골 / PERFECT ${summary.perfects}번\n내 기록을 넘을 수 있을까?`;
    setShareNote("");
    if (navigator.share) {
      try { await navigator.share({ title: "내 승부차기 기록에 도전!", text, url }); return; }
      catch (reason) { if (reason instanceof Error && reason.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(`${text}\n${url}`); setShareNote("도전 링크를 복사했어요. 친구에게 보내 보세요!"); }
    catch { setShareText(`${text}\n${url}`); setShareNote("아래 내용을 복사해서 친구에게 보내 주세요."); }
  }

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div>
        {challenge ? <div className="mb-4 rounded-2xl bg-amber-100 px-4 py-3 text-sm text-amber-950 dark:bg-amber-300/10 dark:text-amber-100">
          {activeChallenge ? <>친구의 도전장 도착! <strong>{activeChallenge.score.toLocaleString("ko-KR")}점</strong>을 넘어보세요.</> : <>친구는 {challenge.day}에 {challenge.score}점을 기록했어요. 오늘은 새로운 슛 조건으로 도전해요.</>}
        </div> : null}
        <section ref={arena} className="overflow-hidden rounded-3xl bg-[#102c26] text-white shadow-xl shadow-emerald-950/10" aria-label="승부차기 게임">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-7">
            <div><p className="text-[10px] font-bold tracking-[.18em] text-lime-200/70">PENALTY RUSH</p><p className="mt-1 text-xs text-white/60">{phase === "ready" ? "10번의 슛, 한 번의 역전" : runId ? "오늘의 순위 도전" : "연습 경기"}</p></div>
            <div className="text-right"><span className="text-3xl font-black tracking-tight tabular-nums">{summary.score.toLocaleString("ko-KR")}</span><span className="ml-1 text-xs text-white/60">점</span></div>
          </div>
          {phase === "result" ? (
            <div className={`${styles.result} px-5 py-8 text-center sm:px-8`}>
              <p className="text-xs font-bold tracking-widest text-lime-200">FULL TIME</p>
              <h2 ref={resultHeading} tabIndex={-1} className="mt-3 text-2xl font-black outline-none">{penaltyTitle(summary.score)}</h2>
              <p className="mt-3 text-6xl font-black tracking-tighter text-[#d4f77d] tabular-nums">{summary.score.toLocaleString("ko-KR")}<span className="ml-2 text-lg tracking-normal">점</span></p>
              <p className="mt-3 min-h-6 text-sm text-lime-100">{activeChallenge ? summary.score > activeChallenge.score ? "친구의 기록을 넘어섰어요!" : summary.score === activeChallenge.score ? "친구와 동점! 다음엔 역전을 노려보세요." : `친구 기록까지 ${activeChallenge.score - summary.score + 1}점!` : newBest ? "이 기기에서 오늘 최고 기록을 세웠어요!" : `이 기기의 오늘 최고 기록 ${best.toLocaleString("ko-KR")}점`}</p>
              <dl className="my-6 grid grid-cols-3 divide-x divide-white/10 rounded-2xl bg-white/5 py-4">
                {[['성공', `${summary.goals}/10`], ['PERFECT', `${summary.perfects}번`], ['최대 연속', `${summary.bestStreak}골`]].map(([label, value]) => <div key={label}><dt className="text-[11px] text-white/60">{label}</dt><dd className="mt-1 text-xl font-extrabold tabular-nums">{value}</dd></div>)}
              </dl>
              <p role="status" className="mb-4 text-sm text-white/70">{saveState === "saving" ? "오늘의 순위에 기록하는 중…" : saveState === "saved" ? "기록 저장 완료! 오늘의 최고 점수가 순위에 반영됐어요." : saveState === "failed" ? "아직 순위에 저장되지 않았어요." : "연습 기록이에요. 순위 도전 기록과는 따로 남아요."}</p>
              {saveState === "failed" && runId ? <button type="button" disabled={saving} onClick={() => save(runId, shots, day, generation.current)} className="mb-3 h-11 w-full rounded-xl border border-white/30 text-sm font-bold">기록 저장 다시 시도</button> : null}
              <button type="button" onClick={() => start()} disabled={starting || saving} className="h-13 w-full rounded-xl bg-[#d4f77d] text-base font-extrabold text-[#152d21] transition hover:bg-lime-200 disabled:opacity-50">{starting ? "경기 준비 중…" : saving ? "기록 저장 중…" : "한 판 더 도전"}</button>
              <button type="button" onClick={() => void share()} className="mt-3 h-12 w-full rounded-xl border border-white/20 text-sm font-bold transition hover:bg-white/10">친구에게 도전장 보내기 ↗</button>
              {shareNote ? <p role="status" className="mt-3 text-xs text-lime-100">{shareNote}</p> : null}
              {shareText ? <textarea aria-label="복사할 도전장" readOnly value={shareText} onFocus={(event) => event.target.select()} className="mt-3 h-28 w-full rounded-xl bg-black/20 p-3 text-xs" /> : null}
            </div>
          ) : (
            <>
              <div className="relative">
                <PenaltyPitch day={day} index={phase === "feedback" ? Math.max(0, shots.length - 1) : index} shot={phase === "feedback" ? last : null} />
                {phase === "ready" ? <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0b211c]/45 px-5 text-center backdrop-blur-[1px]"><span className="rounded-full border border-lime-200/30 bg-[#16362a]/80 px-3 py-1 text-[11px] font-bold text-lime-200">손끝으로 결정하는 승부</span><p className="mt-3 text-3xl leading-tight font-black sm:text-4xl">딱 한 번의 타이밍.<br /><span className="text-[#d4f77d]">넣을 수 있겠어?</span></p><p className="mt-3 text-xs text-white/80">10번의 슛 · 최대 약 43초 · 매일 새로운 코스</p></div> : null}
                {phase === "feedback" && last ? <div key={shots.length} className={`${styles.result} absolute inset-0 flex items-center justify-center`}><div className="rounded-2xl bg-[#071913]/85 px-7 py-3 text-center shadow-lg"><p className={`text-3xl font-black italic ${last.grade === "perfect" ? "text-amber-300" : last.streak ? "text-lime-200" : "text-white"}`}>{shotLabel[last.grade]}</p><p className="mt-1 text-sm font-bold">{last.points ? `+${last.points}점${last.streak > 1 ? ` · ${last.streak}연속 성공` : ""}` : "다음 슛에서 다시 노려요"}</p></div></div> : null}
              </div>
              {phase === "playing" ? <ShotControl key={shots.length} day={day} index={index} onShoot={shoot} /> : phase === "feedback" ? <div className="flex h-[153px] items-center justify-center px-5 text-sm font-semibold text-white/60">{shots.length === PENALTY.shots ? "최종 기록을 확인하고 있어요" : `${shots.length + 1}번째 슛 준비…`}</div> : <div className="px-5 pb-5 sm:px-7"><button type="button" disabled={starting} onClick={() => start()} className="h-14 w-full rounded-2xl bg-[#d4f77d] text-lg font-black text-[#152d21] transition hover:bg-lime-200 disabled:opacity-50">{starting ? "경기 준비 중…" : ranked ? "오늘의 순위에 도전 →" : "바로 킥오프 →"}</button><p className="mt-3 text-center text-xs text-white/60">{ranked ? "오늘 최고 기록으로 경쟁해요. 재도전은 자유롭게!" : "로그인 없이 바로 플레이 · 설치 없이 무료"}</p></div>}
            </>
          )}
          <div className="flex items-center gap-2 border-t border-white/10 px-5 py-3 sm:px-7" aria-label={`${shots.length}번 슛 완료, ${summary.goals}골`}>
            {Array.from({ length: PENALTY.shots }, (_, i) => <span key={i} aria-label={`${i + 1}번째 ${shots[i] ? shotLabel[shots[i].grade] : "대기"}`} className={`flex size-6 flex-1 items-center justify-center rounded-md text-[10px] font-bold ${shots[i]?.grade === "perfect" ? "bg-amber-300 text-amber-950" : shots[i]?.streak ? "bg-lime-300 text-lime-950" : shots[i] ? "bg-white/10 text-white/50" : i === shots.length && phase === "playing" ? "bg-white/20 ring-1 ring-white/60" : "bg-white/5 text-white/35"}`}>{shots[i] ? shots[i].streak ? "●" : "×" : i + 1}</span>)}
          </div>
        </section>
        <div role="status" aria-live="polite" className="sr-only">{phase === "playing" ? `${index + 1}번째 슛. 3.5초 안에 버튼이나 스페이스 키를 누르세요.` : phase === "feedback" && last ? `${shotLabel[last.grade]} ${last.points}점. 합계 ${summary.score}점.` : ""}</div>
        {error ? <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">{error}</p> : null}
        {ranked && (phase === "ready" || phase === "result") ? <button type="button" disabled={starting || saving} onClick={() => start(true)} className={`mt-3 w-full ${secondaryButtonClass}`}>순위 부담 없이 연습하기</button> : null}
        {!snapshot.member && (phase === "ready" || phase === "result") ? <div className={`mt-4 flex flex-wrap items-center justify-between gap-3 p-4 ${cardClass}`}><p className="text-sm"><strong>내 닉네임으로 순위에 도전!</strong><br /><span className={`text-xs ${mutedClass}`}>로그인하면 다음 경기부터 순위에 참여해요.</span></p><Link href="/cafe/login?next=%2Fgames%2Fpenalty" prefetch={false} className={primaryButtonClass}>로그인</Link></div> : null}
      </div>
      <aside className="space-y-4">
        <section className={`${cardClass} p-5`}>
          <div className="flex items-center gap-2"><TrophyIcon className="size-5 text-amber-500" /><h2 className="font-extrabold">오늘의 승부사</h2></div>
          <p className={`mt-1 text-xs ${mutedClass}`}>{day.slice(5).replace("-", ".")} · 한국 시간 자정에 새 도전</p>
          {snapshot.available ? <>
            <p className={`mt-4 text-xs ${mutedClass}`}>{snapshot.board.participants}명 참여 · 상위 20명</p>
            {snapshot.board.leaders.length ? <ol className="mt-2 divide-y divide-zinc-100 dark:divide-white/5">{snapshot.board.leaders.map((leader) => <li key={leader.nickname} className={`flex items-center gap-2 py-3 ${leader.isMe ? "font-bold text-emerald-700 dark:text-emerald-300" : ""}`}><span className={`w-6 text-sm font-black tabular-nums ${leader.rank <= 3 ? "text-amber-600 dark:text-amber-300" : mutedClass}`}>{leader.rank}</span><span className="min-w-0 flex-1 truncate text-sm">{leader.nickname}{leader.isMe ? " (나)" : ""}</span><span className="text-sm font-bold tabular-nums">{leader.score.toLocaleString("ko-KR")}<span className={`ml-0.5 text-[10px] font-normal ${mutedClass}`}>점</span></span></li>)}</ol> : <p className={`py-8 text-center text-sm ${mutedClass}`}>오늘의 첫 승부사가 되어 보세요.</p>}
            {snapshot.board.personal ? <p className="mt-3 rounded-xl bg-emerald-500/10 p-3 text-center text-sm font-semibold">내 최고 {snapshot.board.personal.score.toLocaleString("ko-KR")}점 · {snapshot.board.personal.rank}위</p> : null}
          </> : <p className={`py-6 text-sm leading-relaxed ${mutedClass}`}>지금은 순위를 불러올 수 없어요. 연습 경기와 친구 도전장은 계속 즐길 수 있어요.</p>}
          <p className={`mt-3 text-[11px] leading-relaxed ${mutedClass}`}>하루 최고 기록 하나로 겨뤄요. 같은 점수는 공동 순위예요.</p>
        </section>
        <section className={`${cardClass} p-5`}>
          <h2 className="font-bold">한 번만 알면 끝</h2>
          <ol className="mt-4 space-y-3 text-sm leading-relaxed"><li><strong className="mr-2 text-emerald-600 dark:text-emerald-400">01</strong>흰 막대가 초록 구간에 오면 <strong>슛!</strong></li><li><strong className="mr-2 text-emerald-600 dark:text-emerald-400">02</strong>금색 중앙은 <strong>PERFECT 150점</strong>, 초록 구간은 100점이에요.</li><li><strong className="mr-2 text-emerald-600 dark:text-emerald-400">03</strong>연속 성공하면 슛마다 보너스가 25점씩, 최대 100점까지 붙어요.</li></ol>
          <p className={`mt-4 border-t border-zinc-100 pt-3 text-xs leading-relaxed dark:border-white/10 ${mutedClass}`}>한 슛은 3.5초. 뒤로 갈수록 빨라지고 구간이 좁아져요. 게임 점수는 카페의 골 포인트와 별개예요.</p>
        </section>
        <Link href="/cafe/game" prefetch={false} className={`block rounded-xl px-2 py-2 text-center text-sm ${mutedClass} hover:underline`}>축구 지식도 자신 있다면? 선수 맞히기 →</Link>
      </aside>
    </div>
  );
}
