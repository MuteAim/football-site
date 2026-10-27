"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { finishCareerRun, getCareerRetirements, getCareerSnapshot, saveCareerRetirements, shareCareerCard, startCareerRun } from "@/lib/cafe/career-actions";
import { BOARD_SIZE, careerDay, wouldRank, type CareerBoard as CareerBoardData, type CareerSnapshot } from "@/lib/career/board";
import { NATIONS } from "@/lib/career/data";
import {
  CAREER_RULES, CAREER_VERSION, CareerError, choose, createCareer, FOOT_NAMES, legacyBreakdown, positionName, replayCareer, seasonLabel, seasonYearOf, summarizeCareer,
  type CareerSave, type CareerSetup, type CareerState, type CareerSummary, type SeasonRecord,
} from "@/lib/career/engine";
import { confirmDialog, showToast } from "../feedback";
import { TrophyIcon } from "../Icons";
import { cardClass, mutedClass, primaryButtonClass, secondaryButtonClass } from "../ui";
import { CareerBoard } from "./CareerBoard";
import { CareerCreate } from "./CareerCreate";
import { CareerCinematic } from "./CareerCinematic";
import { careerCinematics, seasonCeremony, type CareerCinematicScene } from "@/lib/career/cinematics";
import { DecisionCard, HalfSeason, HistoryTable, OvrChart, PlayerCard, RivalCard, ScoreBreakdown, SeasonReport, SimulationCard } from "./CareerParts";
import { TurnHeader, turnResult, type TurnResult } from "./CareerTurn";
import { buildCareerJournal } from "@/lib/career/journal";
import { CareerJournal } from "./CareerJournal";
import { archiveCareer, CAREER_ARCHIVE_BATCH, CAREER_LEGACY_KEYS, mergeRetirements, readRetirements, saveRetirements, type RetiredCareer } from "@/lib/career/archive";
import { adoptCareerStorage, careerKeys } from "@/lib/career/storage";
import { CareerArchive, type CloudState } from "./CareerArchive";
import styles from "./career.module.css";

/** 브라우저에 남기는 커리어. 상태 대신 시드와 선택만 저장하고 불러올 때 다시 계산해요. */
type Stored = CareerSave & { runId: string | null; recorded: string | null; card?: string | null };
type Pending = { seed: number; startYear: number; runId: string | null };
type Busy = { title: string; from: number; to: number; ms: number; previous: CareerState; result: TurnResult | null };
type RankState = { state: "none" | "saving" | "saved" | "failed"; message: string };

const QUICK_KEY = "football-career-quick";
const SIM_MS = 650;

function parseStored(value: unknown): Stored | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<Stored>;
  if (typeof item.v !== "number" || !Number.isInteger(item.seed) || !Number.isInteger(item.startYear) || !item.setup || typeof item.setup !== "object"
    || !Array.isArray(item.choices) || item.choices.length > CAREER_RULES.maxChoices || !item.choices.every((choice) => Number.isInteger(choice))) return null;
  return {
    v: item.v, seed: item.seed!, startYear: item.startYear!, setup: item.setup as CareerSetup, choices: item.choices,
    runId: typeof item.runId === "string" ? item.runId : null, recorded: typeof item.recorded === "string" ? item.recorded : null, card: typeof item.card === "string" ? item.card : null,
  };
}

/** key는 지금 계정의 커리어 칸이에요(careerKeys). */
function readStored(key: string): Stored | null {
  try { return parseStored(JSON.parse(localStorage.getItem(key) ?? "null")); } catch { return null; }
}

function writeStored(key: string, value: Stored | null) {
  try {
    if (value) localStorage.setItem(key, JSON.stringify(value));
    else localStorage.removeItem(key);
  } catch {}
}

/** 다른 기기로 옮기는 커리어 코드. 시드와 선택만 담겨서 짧아요. */
function encodeStored(value: Stored): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeStored(code: string): Stored | null {
  try {
    const binary = atob(code.trim());
    return parseStored(JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)))));
  } catch { return null; }
}

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

/** 짧은 결과로 바뀌어도 페이지 끝이 현재 화면 위로 당겨지지 않게 해요. */
function keepViewport(root: HTMLDivElement | null) {
  if (root) root.style.minHeight = `${Math.max(0, Math.ceil(window.innerHeight - root.getBoundingClientRect().top))}px`;
}

export function CareerGame({ initial, challenge }: { initial: CareerSnapshot; challenge: { score: number; day: string } | null }) {
  const [snapshot, setSnapshot] = useState(initial);
  const [screen, setScreen] = useState<"loading" | "intro" | "create" | "play">("loading");
  const [stored, setStored] = useState<Stored | null>(null);
  const [career, setCareer] = useState<CareerState | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [archive, setArchive] = useState<RetiredCareer[]>([]);
  const [archiveError, setArchiveError] = useState("");
  const [busy, setBusy] = useState<Busy | null>(null);
  const [cinematics, setCinematics] = useState<CareerCinematicScene[]>([]);
  const [quick, setQuick] = useState(false);
  const [result, setResult] = useState<TurnResult | null>(null);
  const [rank, setRank] = useState<RankState>({ state: "none", message: "" });
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [shareNote, setShareNote] = useState("");
  const [shareText, setShareText] = useState("");
  const [importCode, setImportCode] = useState("");
  const [makingCard, setMakingCard] = useState(false);
  const [cardError, setCardError] = useState("");
  const [starting, startAction] = useTransition();
  const [saving, saveAction] = useTransition();
  const loaded = useRef(false);
  const lastPick = useRef(0);
  const focusDecision = useRef(false);
  const gameRoot = useRef<HTMLDivElement>(null);
  const ranked = snapshot.member && snapshot.available;
  // 같은 브라우저를 여러 계정이 써도 섞이지 않게 계정마다 다른 칸에 저장해요. 계정이 바뀌면 page.tsx가 이 화면을 새로 만들어요.
  const keys = useMemo(() => careerKeys(initial.owner), [initial.owner]);
  const journal = useMemo(() => stored ? buildCareerJournal(stored) : [], [stored]);
  const finishCinematic = useCallback(() => setCinematics((scenes) => scenes.slice(1)), []);

  const [cloud, setCloud] = useState<CloudState>(initial.member ? "syncing" : "local");
  const archiveRef = useRef<RetiredCareer[]>([]);
  const cloudStarted = useRef(false);
  const cloudReady = useRef(false);

  /** 계정 보관함에 나눠 보내요. 이미 있는 선수는 DB가 건너뛰어요. */
  const uploadRetirements = useCallback(async (entries: RetiredCareer[]): Promise<CloudState> => {
    for (let i = 0; i < entries.length; i += CAREER_ARCHIVE_BATCH) {
      const saved = await saveCareerRetirements(entries.slice(i, i + CAREER_ARCHIVE_BATCH));
      if ("unavailable" in saved) return "local";
      if ("error" in saved) return "failed";
    }
    return "synced";
  }, []);

  const storeRetirements = useCallback((entries: RetiredCareer[]) => {
    let saved = true;
    try {
      setArchive(saveRetirements(localStorage, entries, keys.archive));
      setArchiveError("");
    } catch {
      // 실패한 기록도 화면과 백업에는 남겨요. 기존 저장을 지우지는 않아요.
      setArchive((previous) => mergeRetirements(previous, entries));
      setArchiveError("은퇴 기록을 브라우저에 저장하지 못했어요. 저장 공간과 브라우저 설정을 확인하고 다시 시도해 주세요. 창을 닫기 전 ‘보관함 백업’으로 기록을 내려받을 수 있어요.");
      saved = false;
    }
    // 계정 보관함을 처음 맞춘 뒤부터는 새로 보관한 선수만 바로 보내요.
    if (cloudReady.current) {
      setCloud("syncing");
      void uploadRetirements(entries).then(setCloud);
    }
    return saved;
  }, [keys, uploadRetirements]);

  /** 계정에 있던 선수는 이 브라우저로 가져오고, 이 브라우저에만 있던 선수는 계정에 올려요. */
  const syncCloud = useCallback(async () => {
    const remote = await getCareerRetirements();
    if ("unavailable" in remote) { setCloud("local"); return; }
    if ("error" in remote) { setCloud("failed"); return; }
    const known = new Set(remote.entries.map((entry) => entry.id));
    const missing = archiveRef.current.filter((entry) => !known.has(entry.id));
    storeRetirements(remote.entries);
    cloudReady.current = true;
    setCloud(missing.length ? await uploadRetirements(missing) : "synced");
  }, [storeRetirements, uploadRetirements]);

  const restore = useCallback((value: Stored) => {
    const state = replayCareer(value);
    // 업데이트 전 은퇴한 현재 선수도 복원할 수 있는 기록으로 보관해요.
    if (state.phase === "retired") storeRetirements([archiveCareer(state, value, !!value.runId)]);
    setStored(value);
    setCareer(state);
    setResult(value.choices.length ? turnResult(replayCareer({ ...value, choices: value.choices.slice(0, -1) }), state, value.choices.at(-1)!) : null);
    // 순위 도전 커리어가 은퇴했는데 기록이 없으면(저장 중 창을 닫는 등) 다시 시도할 수 있게 해요.
    setRank(value.recorded ? { state: "saved", message: `${value.recorded} 순위에 기록된 커리어예요.` }
      : value.runId && state.phase === "retired" ? { state: "failed", message: "" } : { state: "none", message: "" });
    setScreen("play");
  }, [storeRetirements]);

  // 저장된 커리어를 한 번만 불러와요. 이 화면은 숨겨졌다가 다시 보여도 상태를 그대로 들고 있어요.
  // 불러오기 전에 정리되면(개발 모드의 두 번 실행 등) 다음 실행에서 다시 불러와요.
  useEffect(() => {
    if (loaded.current) return;
    const frame = requestAnimationFrame(() => {
      loaded.current = true;
      // 레전드 로드를 초기화하기 전의 보관함은 지우고, 계정을 나누기 전 칸과 로그인 전 기록을 지금 계정 칸으로 옮겨요.
      try { for (const key of CAREER_LEGACY_KEYS) localStorage.removeItem(key); } catch {}
      try { adoptCareerStorage(localStorage, initial.owner); } catch {}
      try { setArchive(readRetirements(localStorage, keys.archive)); }
      catch { setArchiveError("기존 은퇴 보관함을 읽지 못했어요. 브라우저 저장 접근을 확인해 주세요. 기존 데이터는 지우지 않았어요."); }
      try { setQuick(localStorage.getItem(QUICK_KEY) === "1"); } catch {}
      const value = readStored(keys.save);
      if (!value) { setScreen("intro"); return; }
      try {
        if (value.v !== CAREER_VERSION) throw new CareerError("레전드 로드가 업데이트되어 진행 중이던 커리어는 이어 할 수 없어요. 새 선수로 다시 시작해 주세요.");
        restore(value);
      } catch (reason) {
        writeStored(keys.save, null);
        setNote(reason instanceof CareerError ? reason.message : "저장된 커리어를 불러오지 못했어요.");
        setScreen("intro");
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [initial.owner, keys, restore]);

  useEffect(() => { archiveRef.current = archive; }, [archive]);

  // 브라우저 보관함을 읽은 뒤 계정 보관함과 한 번 맞춰요.
  useEffect(() => {
    if (screen === "loading" || !snapshot.member || cloudStarted.current) return;
    cloudStarted.current = true;
    void syncCloud();
  }, [screen, snapshot.member, syncCloud]);

  function retryCloud() {
    cloudReady.current = false;
    setCloud("syncing");
    void syncCloud();
  }

  useEffect(() => {
    if (!busy) return;
    const timer = window.setTimeout(() => {
      // 연출 중 사용자가 직접 움직였다면 그때의 위치를 지켜요.
      keepViewport(gameRoot.current);
      setBusy(null);
    }, busy.ms);
    return () => window.clearTimeout(timer);
  }, [busy]);

  // 키보드로 고른 경우에만 다음 결정으로 초점을 이어 줘요. 선택 때문에 화면을 스크롤하지 않아요.
  useEffect(() => {
    if (busy || cinematics.length || !focusDecision.current) return;
    focusDecision.current = false;
    document.getElementById("career-decision")?.focus({ preventScroll: true });
  }, [busy, career, cinematics.length]);

  function changeQuick(value: boolean) {
    setQuick(value);
    try { localStorage.setItem(QUICK_KEY, value ? "1" : "0"); } catch {}
  }

  const submit = useCallback((value: Stored) => {
    if (!value.runId) return;
    setRank({ state: "saving", message: "" });
    saveAction(async () => {
      const result = await finishCareerRun(value.runId!, value.setup, value.choices, value.v);
      if ("error" in result) { setRank({ state: "failed", message: result.error }); return; }
      const next = { ...value, recorded: result.day };
      writeStored(keys.save, next);
      setStored(next);
      setRank({ state: "saved", message: `오늘의 순위에 기록했어요! 레전드 점수 ${result.score.toLocaleString("ko-KR")}점` });
      const board = await getCareerSnapshot(result.day);
      if (board.available) setSnapshot(board);
    });
  }, [keys]);

  async function begin(practice = false) {
    if (starting || saving) return;
    // 보관에 실패한 채 새 선수가 현재 저장을 덮어쓰는 일을 막아요.
    if (career?.phase === "retired" && stored && !storeRetirements([archiveCareer(career, stored, !!stored.runId)])) {
      setError("은퇴 선수 보관함의 저장 오류를 해결한 뒤 새 커리어를 시작해 주세요.");
      return;
    }
    if (career && career.phase !== "retired") {
      const ok = await confirmDialog({ title: "진행 중인 커리어를 그만둘까요?", description: `${career.name}의 기록은 사라지고 새 선수로 시작해요.`, confirmLabel: "새로 시작", tone: "danger" });
      if (!ok) return;
    }
    setError("");
    startAction(async () => {
      if (ranked && !practice) {
        const started = await startCareerRun();
        if ("error" in started) { setError(started.error); return; }
        setPending({ seed: started.seed, startYear: started.startYear, runId: started.runId });
      } else {
        setPending({ seed: randomSeed(), startYear: seasonYearOf(new Date()), runId: null });
      }
      setScreen("create");
      if (gameRoot.current) gameRoot.current.style.minHeight = "";
      window.scrollTo({ top: 0 });
    });
  }

  function create(setup: CareerSetup) {
    if (!pending) return;
    try {
      const state = createCareer(pending.seed, pending.startYear, setup);
      const value: Stored = { v: CAREER_VERSION, seed: pending.seed, startYear: pending.startYear, setup, choices: [], runId: pending.runId, recorded: null, card: null };
      writeStored(keys.save, value);
      setStored(value);
      setCareer(state);
      setPending(null);
      setRank({ state: "none", message: "" });
      setShareNote("");
      setShareText("");
      setCardError("");
      setResult(null);
      setScreen("play");
      focusDecision.current = true;
      window.scrollTo({ top: 0 });
    } catch (reason) {
      setError(reason instanceof CareerError ? reason.message : "선수를 만들지 못했어요.");
    }
  }

  /** 만들기를 그만두면 하던 커리어로 돌아가요. 서버에서 새 순위 도전이 시작됐다면 이전 커리어는 연습으로 남아요. */
  function cancelCreate() {
    if (pending?.runId && stored?.runId && stored.runId !== pending.runId && !stored.recorded) {
      const value = { ...stored, runId: null };
      writeStored(keys.save, value);
      setStored(value);
      setNote("새 순위 도전을 시작해서 이 커리어는 연습 커리어로 바뀌었어요.");
    }
    setPending(null);
    setScreen(career ? "play" : "intro");
  }

  /** time은 클릭 이벤트 시각이에요. 빠른 두 번 클릭이 바로 다음에 뜬 결정까지 고르지 않게 잠깐 막아요. */
  function pick(index: number, time: number, keyboard: boolean) {
    if (!career || !stored || busy || cinematics.length || !career.pending) return;
    if (time - lastPick.current < 400) return;
    lastPick.current = time;
    const kind = career.pending.kind;
    let next: CareerState;
    try { next = choose(career, index); } catch (reason) {
      setError(reason instanceof CareerError ? reason.message : "선택을 반영하지 못했어요.");
      return;
    }
    const value = { ...stored, choices: [...stored.choices, index] };
    keepViewport(gameRoot.current);
    writeStored(keys.save, value);
    setStored(value);
    setCareer(next);
    setResult(turnResult(career, next, index));
    setError("");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scenes = !reduce ? careerCinematics(career, next, index) : [];
    setCinematics(scenes);
    if (kind !== "offseason" && !scenes.length && !reduce && !quick) {
      const title = `${seasonLabel(career.year)} 시즌 ${next.phase === "event" ? "전반기" : kind === "event" ? "후반기" : ""} 진행 중`.replace("  ", " ");
      setBusy({ title, from: kind === "event" ? 50 : 0, to: next.phase === "event" ? 50 : 100, ms: SIM_MS, previous: career, result });
    }
    focusDecision.current = keyboard || scenes.length > 0;
    if (next.phase === "retired") retire(next, value);
  }

  function retire(state: CareerState, value: Stored) {
    storeRetirements([archiveCareer(state, value, !!value.runId)]);
    if (value.runId) submit(value);
  }

  function importCareer() {
    const value = decodeStored(importCode);
    if (!value) { setError("커리어 코드를 읽지 못했어요. 복사한 코드를 그대로 붙여 넣어 주세요."); return; }
    try {
      restore(value);
      writeStored(keys.save, value);
      setImportCode("");
      setError("");
      showToast("커리어를 불러왔어요.");
    } catch (reason) {
      setError(reason instanceof CareerError ? reason.message : "커리어 코드를 불러오지 못했어요.");
    }
  }

  async function copyCode() {
    if (!stored) return;
    try {
      await navigator.clipboard.writeText(encodeStored(stored));
      showToast("커리어 코드를 복사했어요. 다른 기기에서 붙여 넣으면 이어 할 수 있어요.");
    } catch {
      setShareText(encodeStored(stored));
      setShareNote("아래 커리어 코드를 복사해 다른 기기에서 붙여 넣어 주세요.");
    }
  }

  /** 공유 창이 없으면 클립보드로, 그것도 안 되면 직접 복사할 글을 보여 줘요. */
  async function send(title: string, text: string, url: string, copied: string) {
    setShareNote("");
    setShareText("");
    if (navigator.share) {
      try { await navigator.share({ title, text, url }); return; }
      catch (reason) { if (reason instanceof Error && reason.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(`${text}\n${url}`); setShareNote(copied); }
    catch { setShareText(`${text}\n${url}`); setShareNote("아래 내용을 복사해서 친구에게 보내 주세요."); }
  }

  function share(summary: CareerSummary) {
    const url = `${location.origin}/games/career?score=${summary.score}&day=${careerDay()}`;
    const text = `⚽ 레전드 로드 · ${summary.number}번 ${summary.name} (${positionName(summary.pos, summary.side)}, ${NATIONS[summary.nation].name})\n「${summary.title}」 레전드 점수 ${summary.score.toLocaleString("ko-KR")}점\n발롱도르 ${summary.ballonDor}회 · 최고 OVR ${summary.peakOvr} · ${summary.apps}경기 ${summary.goals}골\n내 커리어를 넘을 수 있을까?`;
    return send("내 축구 인생에 도전!", text, url, "도전장을 복사했어요. 친구에게 보내 보세요!");
  }

  /** 공유 카드는 처음 한 번만 서버에서 만들고, 받은 주소를 저장해 두었다가 다시 써요. */
  async function shareCard(summary: CareerSummary) {
    if (!stored || makingCard) return;
    let code = stored.card ?? null;
    if (!code) {
      setCardError("");
      setMakingCard(true);
      const made = await shareCareerCard({ v: stored.v, seed: stored.seed, startYear: stored.startYear, setup: stored.setup, choices: stored.choices });
      setMakingCard(false);
      if ("error" in made) { setCardError(made.error); return; }
      code = made.code;
      const next = { ...stored, card: code };
      writeStored(keys.save, next);
      setStored(next);
    }
    const text = `⚽ 레전드 로드 · ${summary.number}번 ${summary.name}의 축구 인생\n「${summary.title}」 레전드 점수 ${summary.score.toLocaleString("ko-KR")}점 · ${summary.grade}\n${summary.seasons}시즌 ${summary.apps}경기 ${summary.pos === "GK" ? `무실점 ${summary.cleanSheets}경기` : `${summary.goals}골 ${summary.assists}도움`} · 발롱도르 ${summary.ballonDor}회`;
    await send(`${summary.name} · 레전드 로드`, text, `${location.origin}/games/career/card/${code}`, "공유 카드 링크를 복사했어요. 친구에게 보내 보세요!");
  }

  function replayAwards(season: SeasonRecord) {
    if (!career || busy || cinematics.length) return;
    const scene = seasonCeremony(season, career.name, `replay-${season.year}`);
    if (scene) setCinematics([scene]);
  }

  const displayed = busy?.previous ?? career;
  const last = displayed?.history.at(-1);
  const lastJournal = last ? journal.find((entry) => entry.season.year === last.year) : undefined;
  const summary = displayed?.phase === "retired" ? summarizeCareer(displayed) : null;

  return (
    <div ref={gameRoot} className="grid min-w-0 grid-cols-1 items-start gap-5 [overflow-anchor:none] lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-4">
        {challenge ? (
          <p className="rounded-2xl bg-amber-100 px-4 py-3 text-sm text-amber-950 dark:bg-amber-300/10 dark:text-amber-100">
            친구의 도전장 도착! {challenge.day}에 남긴 <strong>레전드 점수 {challenge.score.toLocaleString("ko-KR")}점</strong>을 넘어 보세요.
          </p>
        ) : null}
        {note ? <p role="status" className={`${cardClass} px-4 py-3 text-sm`}>{note}</p> : null}

        {screen === "loading" ? (
          <div className="h-[460px] animate-pulse rounded-3xl bg-[#102c26]" aria-busy="true" aria-label="커리어 불러오는 중" />
        ) : screen === "create" && pending ? (
          <CareerCreate key={pending.seed} seed={pending.seed} startYear={pending.startYear} ranked={!!pending.runId} onCreate={create} onCancel={cancelCreate} />
        ) : screen === "play" && displayed ? (
          <>
            {summary ? null : <PlayerCard state={displayed} onNew={() => void begin()} newDisabled={starting || !!busy || cinematics.length > 0} />}
            {summary ? (
              <>
                <RetiredCard summary={summary} state={displayed} rank={rank} saving={saving} starting={starting} challenge={challenge} archived={!archiveError && archive.length > 0} cloud={cloud}
                  onRetry={() => stored && submit(stored)} onShare={() => void share(summary)} onNew={() => void begin()}
                  member={snapshot.member} card={stored?.card ?? null} makingCard={makingCard} cardError={cardError} onCard={() => void shareCard(summary)}
                  shareNote={shareNote} shareText={shareText} ranked={ranked} practiceRun={!stored?.runId} board={snapshot.available ? snapshot.board : null} />
                <details className={`${cardClass} group/player`}>
                  <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-bold">
                    은퇴 당시 선수 카드
                    <span className={`text-xs font-semibold ${mutedClass} group-open/player:hidden`}>펼치기</span>
                    <span className={`hidden text-xs font-semibold ${mutedClass} group-open/player:inline`}>접기</span>
                  </summary>
                  <div className="p-3 pt-0"><PlayerCard state={displayed} /></div>
                </details>
              </>
            ) : (
              <div className="relative" aria-busy={!!busy || cinematics.length > 0}>
                <div inert={!!busy} aria-hidden={busy ? true : undefined} className={`space-y-3 ${busy ? "opacity-25" : ""}`}>
                  <TurnHeader state={displayed} result={busy ? busy.result : result} quick={quick} onQuick={changeQuick}>
                    {displayed.pending ? <DecisionCard key={displayed.steps} decision={displayed.pending} onPick={pick} disabled={!!busy || cinematics.length > 0} /> : null}
                  </TurnHeader>
                  {displayed.phase === "event" ? <HalfSeason state={displayed} /> : null}
                  {last ? (
                    <details key={last.year} id="career-report" open className={`${cardClass} group/report`}>
                      <summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-4 text-sm font-bold">
                        {seasonLabel(last.year)} 시즌 리포트
                        <span className={`shrink-0 text-xs ${mutedClass} group-open/report:hidden`}>펼치기</span>
                        <span className={`hidden shrink-0 text-xs ${mutedClass} group-open/report:inline`}>접기</span>
                      </summary>
                      <div id="career-season-result"><SeasonReport season={last} previous={displayed.history.at(-2)} journal={lastJournal} onCelebrate={() => replayAwards(last)} /></div>
                    </details>
                  ) : null}
                  <RivalCard state={displayed} />
                </div>
                {busy ? <div className="absolute inset-0 flex flex-col justify-center p-2"><div className="sticky top-24 bottom-4"><SimulationCard {...busy} /></div></div> : null}
              </div>
            )}
            {summary ? <CareerJournal seasons={journal} side={displayed.side} onCelebrate={replayAwards} /> : <HistoryTable history={displayed.history} />}
            {!summary ? (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void copyCode()} className={secondaryButtonClass}>커리어 코드 복사</button>
              </div>
            ) : null}
            {!summary && shareNote ? <p role="status" className={`text-xs ${mutedClass}`}>{shareNote}</p> : null}
            {!summary && shareText ? <textarea aria-label="커리어 코드" readOnly value={shareText} onFocus={(event) => event.target.select()} className="h-24 w-full rounded-xl bg-zinc-100 p-3 text-xs dark:bg-white/[0.06]" /> : null}
          </>
        ) : (
          <Intro ranked={ranked} member={snapshot.member} starting={starting} onStart={() => void begin()} onPractice={() => void begin(true)}
            importCode={importCode} onImportCode={setImportCode} onImport={importCareer} />
        )}
        {error ? <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">{error}</p> : null}
        {screen !== "loading" ? <CareerArchive entries={archive} error={archiveError} member={snapshot.member} cloud={cloud} onCloudRetry={retryCloud} onImport={storeRetirements} onRetry={() => { if (storeRetirements(archive)) setError(""); }} /> : null}
      </div>
      <CareerBoard snapshot={snapshot} />
      {cinematics[0] ? <CareerCinematic key={cinematics[0].id} scene={cinematics[0]} onDone={finishCinematic} /> : null}
    </div>
  );
}

function Intro({ ranked, member, starting, onStart, onPractice, importCode, onImportCode, onImport }: {
  ranked: boolean; member: boolean; starting: boolean;
  onStart: () => void; onPractice: () => void; importCode: string; onImportCode: (value: string) => void; onImport: () => void;
}) {
  return (
    <>
      <section className={`relative overflow-hidden rounded-3xl bg-[#102c26] px-6 py-8 text-white sm:px-8 sm:py-10 ${styles.reveal}`}>
        <TrophyIcon className="pointer-events-none absolute -right-6 -bottom-6 size-56 text-amber-200/10" />
        <span className="relative rounded-full bg-[#d4f77d] px-3 py-1 text-[10px] font-black tracking-wider text-[#102c26]">NEW · 로그인 없이 플레이</span>
        <p className="relative mt-7 text-xs font-bold tracking-widest text-lime-200/70">ROAD TO BALLON D&apos;OR</p>
        <h2 className="relative mt-2 text-3xl leading-tight font-black tracking-tight sm:text-4xl">열일곱 살 유망주,<br /><span className="text-[#d4f77d]">발롱도르</span>까지 갈 수 있을까?</h2>
        <p className="relative mt-3 max-w-md text-sm leading-relaxed text-white/75">훈련, 이적, 국가대표. 시즌마다 고른 길이 쌓여 나만의 축구 인생이 돼요.</p>
        <ul className="relative mt-6 grid gap-2 text-xs text-white/80 sm:grid-cols-3">
          <li className="rounded-xl bg-white/[0.06] px-3 py-2.5">훈련·사건·이적 선택</li>
          <li className="rounded-xl bg-white/[0.06] px-3 py-2.5">K리그부터 빅리그까지</li>
          <li className="rounded-xl bg-white/[0.06] px-3 py-2.5">레전드 점수로 순위 경쟁</li>
        </ul>
        <button type="button" disabled={starting} onClick={onStart} className="relative mt-7 h-14 w-full rounded-2xl bg-[#d4f77d] text-lg font-black text-[#152d21] shadow-[0_4px_0_#83aa45] transition hover:bg-lime-200 active:translate-y-0.5 active:shadow-none disabled:opacity-60 sm:w-auto sm:px-10">
          {starting ? "구단과 계약하는 중…" : ranked ? "오늘의 순위에 도전 →" : "새 커리어 시작 →"}
        </button>
        <p className="relative mt-3 text-xs text-white/60">{ranked ? "은퇴하는 순간 레전드 점수가 오늘의 순위에 올라가요." : "설치 없이 무료 · 이 브라우저에 자동 저장돼요"}</p>
      </section>
      {ranked ? <button type="button" disabled={starting} onClick={onPractice} className={`w-full ${secondaryButtonClass}`}>순위 부담 없이 연습 커리어</button> : null}
      {!member ? (
        <div className={`p-4 ${cardClass}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm"><strong>로그인하면 내 닉네임으로 순위에!</strong><br /><span className={`text-xs ${mutedClass}`}>카카오·구글 계정으로 바로 시작해요. 로그인 없이 하던 커리어도 그대로 남아요.</span></p>
            <Link href="/cafe/login?next=%2Fgames%2Fcareer" prefetch={false} className={primaryButtonClass}>로그인</Link>
          </div>
          <ul className={`mt-3 grid gap-1.5 text-xs sm:grid-cols-3 ${mutedClass}`}>
            <li className="rounded-lg bg-zinc-950/[0.04] px-2.5 py-2 dark:bg-white/[0.05]">🏆 오늘의 순위·베스트 11 등재</li>
            <li className="rounded-lg bg-zinc-950/[0.04] px-2.5 py-2 dark:bg-white/[0.05]">🗂️ 은퇴 기록을 어느 기기에서나</li>
            <li className="rounded-lg bg-zinc-950/[0.04] px-2.5 py-2 dark:bg-white/[0.05]">📇 친구에게 보낼 공유 카드</li>
          </ul>
        </div>
      ) : null}
      <details className={`${cardClass} group`}>
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-bold">다른 기기의 커리어 이어 하기</summary>
        <div className="border-t border-zinc-100 px-5 py-4 dark:border-white/[0.07]">
          <p className={`text-xs leading-relaxed ${mutedClass}`}>커리어 화면 아래의 ‘커리어 코드 복사’로 받은 코드를 붙여 넣어요. 지금 브라우저의 커리어는 덮어써요.</p>
          <textarea value={importCode} onChange={(event) => onImportCode(event.target.value)} aria-label="커리어 코드"
            className="mt-3 h-20 w-full rounded-xl bg-zinc-100 p-3 text-xs outline-none focus:ring-1 focus:ring-emerald-500 dark:bg-white/[0.06]" />
          <button type="button" disabled={!importCode.trim()} onClick={onImport} className={`mt-2 ${secondaryButtonClass}`}>불러오기</button>
        </div>
      </details>
    </>
  );
}

/**
 * 연습 커리어가 은퇴하면 "순위 도전이었다면 몇 위"인지 보여 주고, 다음 커리어를 순위 도전으로 이어 줘요.
 * 비회원에게는 로그인하면 달라지는 점을 함께 보여 줘요. 로그인하고 돌아와도 이 은퇴 화면은 그대로예요.
 */
function RankTeaser({ score, board, member, starting, onNew }: {
  score: number; board: CareerBoardData | null; member: boolean; starting: boolean; onNew: () => void;
}) {
  const place = board ? wouldRank(board, score) : null;
  const headline = !board ? "다음 커리어는 오늘의 순위에 도전해 보세요"
    : !board.leaders.length ? "오늘 첫 번째 레전드가 될 수 있는 기록이에요!"
      : place ? `이 기록이면 오늘의 순위 ${place}위예요!` : `오늘 상위 ${BOARD_SIZE}명까지 조금 더! 다음 커리어로 도전해 보세요`;
  return (
    <div className="mx-5 mb-4 rounded-2xl bg-[#d4f77d] p-4 text-[#102c26] sm:mx-8" data-rank-teaser>
      <p className="text-base font-black">{headline}</p>
      <p className="mt-1 text-xs leading-relaxed text-[#102c26]/75">
        연습 커리어라 순위에는 오르지 않았어요. {member ? "‘오늘의 순위에 도전’으로 시작하면 은퇴하는 순간 순위에 올라가요." : "로그인하고 시작한 커리어는 은퇴하는 순간 오늘의 순위에 올라가요."}
      </p>
      {member ? (
        <button type="button" disabled={starting} onClick={onNew}
          className="mt-3 h-12 w-full rounded-xl bg-[#102c26] text-sm font-black text-[#d4f77d] transition hover:bg-[#173d34] disabled:opacity-60">
          {starting ? "구단과 계약하는 중…" : "오늘의 순위에 도전 →"}
        </button>
      ) : (
        <>
          <ul className="mt-3 grid gap-1 text-xs font-semibold sm:grid-cols-3">
            <li>🏆 오늘의 순위·베스트 11에 내 닉네임</li>
            <li>🗂️ 은퇴 기록을 계정에 보관</li>
            <li>📇 친구에게 보낼 공유 카드</li>
          </ul>
          <Link href="/cafe/login?next=%2Fgames%2Fcareer" prefetch={false}
            className="mt-3 flex h-12 items-center justify-center rounded-xl bg-[#102c26] text-sm font-black text-[#d4f77d] transition hover:bg-[#173d34]">
            로그인하고 순위에 도전 →
          </Link>
        </>
      )}
    </div>
  );
}

function RetiredCard({ summary, state, rank, saving, starting, challenge, ranked, practiceRun, archived, cloud, onRetry, onShare, onNew, shareNote, shareText, member, card, makingCard, cardError, onCard, board }: {
  board: CareerBoardData | null;
  summary: CareerSummary; state: CareerState; rank: RankState; saving: boolean; starting: boolean; challenge: { score: number; day: string } | null;
  ranked: boolean; practiceRun: boolean; archived: boolean; cloud: CloudState; onRetry: () => void; onShare: () => void; onNew: () => void; shareNote: string; shareText: string;
  member: boolean; card: string | null; makingCard: boolean; cardError: string; onCard: () => void;
}) {
  const stats: [string, string][] = [
    ["시즌", `${summary.seasons}`], ["경기", summary.apps.toLocaleString("ko-KR")],
    summary.pos === "GK" ? ["무실점", `${summary.cleanSheets}`] : ["골", `${summary.goals}`], ["도움", `${summary.assists}`],
    ["A매치", `${summary.caps}`], ["최고 OVR", `${summary.peakOvr}`], ["발롱도르", `${summary.ballonDor}`], ["트로피", `${summary.trophies}`],
  ];
  const status = rank.state === "saving" ? "오늘의 순위에 기록하는 중…" : rank.state === "saved" ? rank.message
    : rank.state === "failed" ? `아직 순위에 기록되지 않았어요. ${rank.message}` : "";
  return (
    <section className={`overflow-hidden rounded-3xl bg-[#102c26] text-white ${styles.reveal}`} aria-labelledby="career-decision">
      <div className="px-5 pt-7 pb-6 text-center sm:px-8">
        <p className="text-xs font-bold tracking-widest text-amber-200/80">RETIRED · {summary.firstYear}–{summary.lastYear} · {summary.retiredAge}세 은퇴</p>
        <h2 id="career-decision" tabIndex={-1} className="mt-3 text-3xl font-black tracking-tight outline-none">{summary.name}</h2>
        <p className="mt-1 text-xs text-white/65">{summary.number}번 · {positionName(summary.pos, summary.side)} · {FOOT_NAMES[summary.foot]} · {NATIONS[summary.nation].name} · 구단 {summary.clubs.length}곳</p>
        <p className="mt-4 inline-flex rounded-full bg-amber-300/15 px-4 py-1.5 text-sm font-extrabold text-amber-200">「{summary.title}」</p>
        <p className="mt-5 text-[11px] font-bold tracking-widest text-lime-200/70">LEGEND SCORE</p>
        <p className="mt-1 text-6xl font-black tracking-tighter text-[#d4f77d] tabular-nums">{summary.score.toLocaleString("ko-KR")}<span className="ml-2 text-lg tracking-normal">점</span></p>
        <p className="mt-2 text-sm font-bold">{summary.grade}</p>
        <a href="#career-journal" className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-white/25 px-4 text-sm font-bold hover:bg-white/10">시즌별 기록·이벤트 보기 ↓</a>
        {challenge ? (
          <p className="mt-2 text-sm text-lime-100">
            {summary.score > challenge.score ? "친구의 기록을 넘어섰어요!" : summary.score === challenge.score ? "친구와 동점! 다음엔 역전을 노려 보세요." : `친구 기록까지 ${(challenge.score - summary.score + 1).toLocaleString("ko-KR")}점!`}
          </p>
        ) : null}
      </div>
      {practiceRun && (ranked || !member) ? <RankTeaser score={summary.score} board={board} member={member} starting={starting} onNew={onNew} /> : null}
      <dl className="mx-5 grid grid-cols-4 gap-y-4 rounded-2xl bg-white/[0.05] py-4 text-center sm:mx-8">
        {stats.map(([label, value]) => (
          <div key={label}><dt className="text-[10px] text-white/55">{label}</dt><dd className={`mt-0.5 text-lg font-extrabold tabular-nums ${label === "발롱도르" && value !== "0" ? "text-amber-300" : ""}`}>{value}</dd></div>
        ))}
      </dl>
      <div className="mx-5 mt-4 rounded-2xl bg-white/[0.06] p-4 sm:mx-8">
        <h3 className="text-sm font-extrabold">내 선수의 축구 인생을 자랑해 보세요</h3>
        <p className="mt-1 text-xs leading-relaxed text-white/65">공유 카드에는 통산·팀별 기록, 수상 내역, 커리어 곡선이 담겨요. 서버가 다시 계산한 기록이라 조작할 수 없어요.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {member ? (
            <button type="button" disabled={makingCard} onClick={onCard} className="h-12 rounded-xl bg-[#d4f77d] text-sm font-black text-[#102c26] transition hover:bg-lime-200 disabled:opacity-60">
              {makingCard ? "카드 만드는 중…" : card ? "공유 카드 보내기 ↗" : "공유 카드 만들기 ↗"}
            </button>
          ) : (
            <Link href="/cafe/login?next=%2Fgames%2Fcareer" prefetch={false} className="flex h-12 items-center justify-center rounded-xl bg-white/10 text-sm font-bold hover:bg-white/15">로그인하고 공유 카드 만들기</Link>
          )}
          <button type="button" onClick={onShare} className="h-12 rounded-xl border border-white/20 text-sm font-bold transition hover:bg-white/10">친구에게 도전장 보내기 ↗</button>
        </div>
        {card ? <a href={`/games/career/card/${card}`} target="_blank" rel="noopener" className="mt-2 inline-flex min-h-9 items-center text-xs font-bold text-lime-200 underline">내 공유 카드 열어 보기 ↗</a> : null}
        {cardError ? <p role="alert" className="mt-2 text-xs text-rose-200">{cardError}</p> : null}
        {shareNote ? <p role="status" className="mt-2 text-xs text-lime-100">{shareNote}</p> : null}
        {shareText ? <textarea aria-label="복사할 도전장" readOnly value={shareText} onFocus={(event) => event.target.select()} className="mt-2 h-28 w-full rounded-xl bg-black/20 p-3 text-xs" /> : null}
      </div>
      <div className="space-y-4 px-5 py-6 text-sm sm:px-8">
        {summary.honors.length ? (
          <div>
            <h3 className="text-xs font-bold text-white/60">트로피와 수상</h3>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {summary.honors.slice(0, 12).map((honor) => (
                <li key={honor.label} className={`rounded-full px-2.5 py-1 text-xs font-bold ${honor.label.includes("발롱도르") && !honor.label.endsWith("위") ? "bg-amber-300 text-amber-950" : "bg-white/10 text-white/90"}`}>
                  {honor.label}{honor.count > 1 ? ` ×${honor.count}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div>
          <h3 className="text-xs font-bold text-white/60">레전드 점수는 이렇게 모였어요</h3>
          <div className="mt-2"><ScoreBreakdown parts={legacyBreakdown(state)} /></div>
        </div>
        {state.history.length >= 2 ? (
          <div>
            <h3 className="text-xs font-bold text-white/60">커리어 곡선 · 시즌이 끝날 때의 오버롤</h3>
            <div className="mt-2"><OvrChart history={state.history} dark /></div>
          </div>
        ) : null}
        <RivalCompare summary={summary} />
        <div>
          <h3 className="text-xs font-bold text-white/60">커리어 발자취</h3>
          <p className="mt-1 leading-relaxed">{summary.clubs.join(" → ")}</p>
        </div>
        {status ? <p role="status" className="rounded-xl bg-black/20 px-3 py-2 text-xs leading-relaxed text-white/80">{status}</p> : null}
        <p role="status" className="rounded-xl bg-white/10 px-3 py-2 text-xs leading-relaxed text-white/85">
          {archived ? `은퇴 요약을 ${cloud === "synced" ? "내 계정과 이 브라우저에" : "이 브라우저에"} 보관했어요. 새 커리어를 시작해도 통산·팀별 기록과 수상·칭호는 남아요.` : "은퇴 요약을 아직 보관하지 못했어요. 아래 보관함의 저장 상태를 확인해 주세요."}
          <a href="#career-archive" className="mt-2 block min-h-8 content-center font-bold text-lime-200 underline">내 기록실 보기 ↓</a>
        </p>
        {rank.state === "failed" ? <button type="button" disabled={saving} onClick={onRetry} className="h-11 w-full rounded-xl border border-white/30 text-sm font-bold disabled:opacity-50">순위 기록 다시 시도</button> : null}
        <button type="button" disabled={starting || saving} onClick={onNew} className="h-13 w-full rounded-xl bg-[#d4f77d] text-base font-extrabold text-[#152d21] transition hover:bg-lime-200 disabled:opacity-50">
          {starting ? "구단과 계약하는 중…" : saving ? "기록 저장 중…" : ranked ? "새 커리어로 순위 도전" : "새 커리어 시작"}
        </button>
      </div>
    </section>
  );
}

/** 은퇴할 때 평생의 라이벌과 커리어를 나란히 비교해요. 앞선 쪽 숫자를 강조해요. */
function RivalCompare({ summary }: { summary: CareerSummary }) {
  const rival = summary.rival;
  const rows: [string, number, number][] = [
    ["최고 OVR", summary.peakOvr, rival.best],
    ...(summary.pos === "GK" ? [] : [["골", summary.goals, rival.goals] as [string, number, number]]),
    ["트로피", summary.trophies, rival.trophies],
    ["발롱도르", summary.ballonDor, rival.ballonDor],
  ];
  const { won, drawn, lost } = rival.h2h;
  return (
    <div>
      <h3 className="text-xs font-bold text-white/60">평생의 라이벌 · {rival.name} ({NATIONS[rival.nation].name})</h3>
      <p className={`mt-1 font-extrabold ${rival.beat ? "text-[#d4f77d]" : "text-white/85"}`}>
        {rival.beat ? "라이벌을 넘어섰어요! 레전드 점수 +150" : "이번에는 라이벌이 한 발 앞섰어요."}
      </p>
      <table className="mt-2 w-full rounded-xl bg-white/[0.05] text-center text-sm tabular-nums">
        <thead>
          <tr className="text-[10px] text-white/55">
            <th scope="col" className="py-2 font-semibold"><span className="sr-only">항목</span></th>
            <th scope="col" className="py-2 font-semibold">나</th>
            <th scope="col" className="py-2 font-semibold">{rival.name}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, mine, theirs]) => (
            <tr key={label} className="border-t border-white/[0.06]">
              <th scope="row" className="py-1.5 text-xs font-semibold text-white/60">{label}</th>
              <td className={`py-1.5 ${mine > theirs ? "font-black text-[#d4f77d]" : "text-white/80"}`}>{mine.toLocaleString("ko-KR")}</td>
              <td className={`py-1.5 ${theirs > mine ? "font-black text-rose-300" : "text-white/80"}`}>{theirs.toLocaleString("ko-KR")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-white/65">
        맞대결 {won}승 {drawn}무 {lost}패 · {rival.retiredAge === null ? `라이벌은 ${rival.lastClub}에서 아직 뛰고 있어요` : `라이벌은 ${rival.retiredAge}세에 ${rival.lastClub}에서 은퇴`}
      </p>
    </div>
  );
}
