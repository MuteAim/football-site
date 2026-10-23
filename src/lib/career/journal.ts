import {
  CAREER_RULES, CareerError, choose, clubName, overall, replayCareer,
  type CareerSave, type CareerState, type Decision, type SeasonRecord,
} from "./engine";

export type CareerEntry = {
  step: number; kind: Decision["kind"]; title: string; body: string;
  choice: string; detail: string; outcome: string | null;
  ovrBefore: number; ovrAfter: number;
};

export type SeasonJournal = {
  season: SeasonRecord; attrsBefore: number[]; attrsAfter: number[]; entries: CareerEntry[];
};

function outcome(before: CareerState, after: CareerState): string | null {
  const decision = before.pending!;
  if (decision.id === "moment") return after.lastMoment;
  if (decision.kind === "event") {
    const event = after.draft?.event ?? after.history.at(-1)?.event;
    return event?.startsWith(`${decision.title} · `) ? event.slice(decision.title.length + 3) : event ?? null;
  }
  if (decision.kind === "offseason") {
    if (after.phase === "retired") return after.ending ?? `${after.age}세에 은퇴했어요.`;
    return before.club !== after.club
      ? `${clubName(before.club)} → ${clubName(after.club)} · 계약 ${after.contract}년`
      : `${clubName(after.club)}에서 다음 시즌을 준비해요. · 계약 ${after.contract}년`;
  }
  return null;
}

/** 저장된 시드·선택을 한 번 따라가며 기록집을 복원해요. 게임 규칙과 저장 형식은 바꾸지 않아요. */
export function buildCareerJournal(save: CareerSave): SeasonJournal[] {
  if (!Array.isArray(save.choices) || save.choices.length > CAREER_RULES.maxChoices) throw new CareerError("선택 기록이 올바르지 않아요.");
  let state = replayCareer({ ...save, choices: [] });
  const entries = new Map<number, CareerEntry[]>();
  const seasons: SeasonJournal[] = [];
  for (const index of save.choices) {
    const decision = state.pending;
    const next = choose(state, index);
    // 시즌 종료 때 엔진의 연도가 이미 올라가므로 이적·은퇴 선택은 막 끝난 시즌에 붙여요.
    const year = decision!.kind === "offseason" ? state.history.at(-1)!.year : state.year;
    const list = entries.get(year) ?? [];
    list.push({
      step: next.steps, kind: decision!.kind, title: decision!.title, body: decision!.body,
      choice: decision!.options[index].label, detail: decision!.options[index].detail,
      outcome: outcome(state, next), ovrBefore: overall(state.attrs, state.pos), ovrAfter: overall(next.attrs, next.pos),
    });
    entries.set(year, list);
    if (next.history.length > state.history.length) {
      const season = next.history.at(-1)!;
      seasons.push({
        season, attrsBefore: next.attrs.map((value, i) => value - season.growth[i]),
        attrsAfter: [...next.attrs], entries: list,
      });
    }
    state = next;
  }
  // 은퇴 때 영구 결번처럼 마지막 시즌의 수상이 추가될 수 있어 최종 기록으로 맞춰요.
  return seasons.map((entry, index) => ({ ...entry, season: state.history[index] }));
}
