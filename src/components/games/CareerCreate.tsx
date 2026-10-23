"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { CLUBS, LEAGUES, NATION_ORDER, NATIONS, POSITION_ORDER, POSITIONS, YOUTH_LEAGUES, type LeagueCode, type NationCode, type Pos } from "@/lib/career/data";
import { CAREER_RULES, cleanName, clubName, NAME_PATTERN, scoutCandidates, seasonLabel, type CareerSetup } from "@/lib/career/engine";
import { DiceIcon } from "../Icons";
import { cardClass, errorTextClass, inputClass, mutedClass, secondaryButtonClass } from "../ui";
import { AttrBars, ClubBadge, Stars } from "./CareerParts";
import styles from "./career.module.css";

const TIERS = [
  { label: "빅클럽 유스", hint: "훈련 시설 최고 · 1군 경쟁 치열" },
  { label: "중위권 유스", hint: "성장과 출전의 균형" },
  { label: "하위권 유스", hint: "일찍 1군 기회" },
];

const chipClass = "flex cursor-pointer items-center justify-center rounded-xl px-2 py-2.5 text-center text-sm font-semibold ring-1 ring-zinc-950/10 transition hover:bg-zinc-50 has-[:checked]:bg-emerald-700 has-[:checked]:text-white has-[:checked]:ring-emerald-700 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-emerald-500 dark:ring-white/10 dark:hover:bg-white/5 dark:has-[:checked]:bg-zinc-100 dark:has-[:checked]:text-zinc-950";

export function CareerCreate({ seed, startYear, ranked, onCreate, onCancel }: {
  seed: number; startYear: number; ranked: boolean;
  onCreate: (setup: CareerSetup) => void; onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [nation, setNation] = useState<NationCode>("KOR");
  const [league, setLeague] = useState<LeagueCode>("KOR");
  const [pos, setPos] = useState<Pos>("ST");
  const [pick, setPick] = useState(0);
  // 다시 뽑은 횟수. 연습은 사실상 무제한이고, 순위 도전은 정해진 횟수까지만 돼요.
  const [reroll, setReroll] = useState(0);
  const [touched, setTouched] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);
  const candidates = useMemo(() => scoutCandidates(seed, nation, league, pos, reroll), [seed, nation, league, pos, reroll]);
  const rerollsLeft = (ranked ? CAREER_RULES.rankedRerolls : CAREER_RULES.maxRerolls) - reroll;
  const clean = cleanName(name);
  const nameError = !clean ? "선수 이름을 지어 주세요." : !NAME_PATTERN.test(clean) ? `한글·영문·숫자로 ${CAREER_RULES.nameLength}자까지 지을 수 있어요.` : "";

  function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (nameError) {
      nameInput.current?.focus();
      return;
    }
    onCreate({ name: clean, nation, league, pos, pick, ...(reroll ? { reroll } : {}) });
  }

  return (
    <form onSubmit={submit} className={`${cardClass} p-5 sm:p-6`} aria-labelledby="career-create" noValidate>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="sport-eyebrow text-emerald-700 dark:text-emerald-400">NEW CAREER · {ranked ? "오늘의 순위 도전" : "연습 커리어"}</p>
          <h2 id="career-create" className="mt-1 text-xl font-black tracking-tight">나만의 선수 만들기</h2>
          <p className={`mt-1 text-sm ${mutedClass}`}>{seasonLabel(startYear)} 시즌, {CAREER_RULES.startAge}세 유망주로 출발해요.</p>
        </div>
        <button type="button" onClick={onCancel} className={`shrink-0 rounded-lg px-2 py-1 text-xs font-semibold ${mutedClass} hover:bg-zinc-950/5 dark:hover:bg-white/10`}>취소</button>
      </div>

      <label className="mt-6 block text-sm font-bold" htmlFor="career-name">선수 이름</label>
      <input
        ref={nameInput} id="career-name" value={name} maxLength={CAREER_RULES.nameLength} autoComplete="off" placeholder="예: 김유망"
        aria-invalid={touched && !!nameError} aria-describedby="career-name-help"
        onChange={(event) => setName(event.target.value)} onBlur={() => setTouched(true)}
        className={`mt-2 ${inputClass}`}
      />
      <p id="career-name-help" className={`mt-1.5 text-xs ${touched && nameError ? errorTextClass : mutedClass}`}>
        {touched && nameError ? nameError : "순위에는 닉네임과 함께 이 이름이 보여요. 실명 대신 별명을 추천해요."}
      </p>

      <fieldset className="mt-6">
        <legend className="text-sm font-bold">국적</legend>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {NATION_ORDER.map((code) => (
            <label key={code} className={chipClass}>
              <input type="radio" name="career-nation" value={code} checked={nation === code} className="sr-only"
                onChange={() => { setNation(code); setLeague(NATIONS[code].home); }} />
              {NATIONS[code].name}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-6 block text-sm font-bold" htmlFor="career-league">출발 리그</label>
      <select id="career-league" value={league} onChange={(event) => setLeague(event.target.value as LeagueCode)}
        className="mt-2 h-11 w-full rounded-xl bg-zinc-100 px-3 text-[15px] ring-1 ring-transparent outline-none focus:ring-emerald-500 dark:bg-white/[0.06]">
        {YOUTH_LEAGUES.map((code) => <option key={code} value={code}>{LEAGUES[code].name}{code === NATIONS[nation].home ? " (고국)" : ""}</option>)}
      </select>
      <p className={`mt-1.5 text-xs ${mutedClass}`}>해외 유스에서 출발할 수도 있어요. 대표팀은 국적을 따라가요.</p>

      <fieldset className="mt-6">
        <legend className="text-sm font-bold">포지션</legend>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {POSITION_ORDER.map((code) => (
            <label key={code} className={`${chipClass} flex-col gap-0.5 py-2`}>
              <input type="radio" name="career-pos" value={code} checked={pos === code} className="sr-only" onChange={() => setPos(code)} />
              <span className="text-[15px] font-black">{code}</span>
              <span className="text-[10px] leading-tight font-medium opacity-75">{POSITIONS[code].name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-7">
        <legend className="text-sm font-bold">스카우트 리포트</legend>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <p className={`min-w-0 flex-1 basis-56 text-xs leading-relaxed ${mutedClass}`}>
            세 명 중 한 명을 골라요. 별점은 스카우트의 예상이라 실제 잠재력과 다를 수 있어요.
            {ranked ? ` 순위 도전은 ${CAREER_RULES.rankedRerolls}번까지 다시 뽑을 수 있어요.` : " 마음에 드는 팀이 없으면 다시 뽑아 보세요."}
          </p>
          <button type="button" disabled={rerollsLeft <= 0} onClick={() => setReroll((count) => count + 1)}
            aria-describedby="career-reroll-status"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-bold text-zinc-700 ring-1 ring-zinc-950/10 transition hover:bg-zinc-50 active:scale-[0.98] disabled:opacity-50 dark:bg-[#24252a] dark:text-zinc-200 dark:ring-white/10 dark:hover:bg-zinc-800">
            <DiceIcon className="size-4" />
            {ranked ? (rerollsLeft > 0 ? `다시 뽑기 · ${rerollsLeft}회 남음` : "다시 뽑기 끝") : "다시 뽑기"}
          </button>
        </div>
        <p id="career-reroll-status" role="status" className="sr-only">{reroll ? `새 유망주 세 명을 데려왔어요. ${reroll}번 다시 뽑았어요.` : ""}</p>
        <div key={reroll} className={`mt-3 grid gap-3 md:grid-cols-3 ${reroll ? styles.swap : ""}`}>
          {candidates.map((candidate, index) => {
            const club = CLUBS[candidate.club];
            return (
              <label key={`${candidate.club}-${index}`} className="relative flex cursor-pointer flex-col rounded-2xl p-4 ring-1 ring-zinc-950/10 transition hover:bg-zinc-50 has-[:checked]:bg-emerald-500/[0.07] has-[:checked]:ring-2 has-[:checked]:ring-emerald-600 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-emerald-500 dark:ring-white/10 dark:hover:bg-white/[0.04] dark:has-[:checked]:ring-emerald-400">
                <input type="radio" name="career-pick" value={index} checked={pick === index} onChange={() => setPick(index)} className="sr-only" />
                <span className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block text-[11px] font-bold text-emerald-700 dark:text-emerald-400">{TIERS[index].label}</span>
                    <span className="mt-1 flex min-w-0 items-center gap-1.5 text-sm font-extrabold">
                      <ClubBadge name={club.name} className="size-5 text-[10px]" />
                      <span className="truncate">{clubName(candidate.club)}</span>
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-center rounded-xl bg-[#102c26] px-2.5 py-1.5 text-white">
                    <span className="text-xl leading-none font-black tabular-nums">{candidate.ovr}</span>
                    <span className="text-[9px] font-bold text-lime-200">OVR</span>
                  </span>
                </span>
                <span className={`mt-2 block text-xs ${mutedClass}`}>{POSITIONS[pos].styles[candidate.style].name} · {TIERS[index].hint}</span>
                <span className="mt-2 flex items-center gap-2 text-zinc-400"><Stars value={candidate.stars} /></span>
                <span className="mt-2 block min-h-10 text-xs leading-relaxed">“{candidate.note}”</span>
                <span className="mt-3 block"><AttrBars attrs={candidate.attrs} pos={pos} light /></span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <button type="submit" className="mt-6 flex h-14 w-full items-center justify-center rounded-2xl bg-[#d4f77d] text-lg font-black text-[#152d21] shadow-[0_4px_0_#83aa45] transition hover:bg-lime-200 active:translate-y-0.5 active:shadow-none">
        {clean && !nameError ? `${clean}의 커리어 시작 →` : "커리어 시작 →"}
      </button>
      <button type="button" onClick={onCancel} className={`mt-3 w-full ${secondaryButtonClass} sm:hidden`}>처음으로</button>
    </form>
  );
}
