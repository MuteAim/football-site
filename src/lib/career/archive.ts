import { clubName, summarizeCareer, type CareerSave, type CareerState, type CareerSummary } from "./engine";

// 경기 엔진 버전과 별개인 요약 보관함. 선택·사건·시즌 원본은 저장하지 않아요.
export const CAREER_ARCHIVE_KEY = "football-career-archive-v1";
const TOTAL_KEYS = ["seasons", "firstYear", "lastYear", "retiredAge", "apps", "goals", "assists", "cleanSheets", "caps", "intlGoals", "peakOvr", "ballonDor", "awards", "trophies"] as const;
type Totals = Pick<CareerSummary, (typeof TOTAL_KEYS)[number]>;
export type ClubCareer = { club: string; name: string; seasons: number; apps: number; goals: number; assists: number; cleanSheets: number };
export type RetiredCareer = {
  v: 1; id: string; retiredAt: string; ranked: boolean;
  name: string; nation: string; pos: string; score: number; grade: string; title: string;
  totals: Totals; clubs: ClubCareer[]; honors: { label: string; count: number }[];
};
type ArchiveStorage = Pick<Storage, "getItem" | "setItem">;

/** 같은 저장을 새로 고치거나 다시 가져와도 한 번만 보관해요. 원본 선택은 식별값 계산에만 사용해요. */
function retirementId(save: CareerSave): string {
  const { v, seed, startYear, setup, choices } = save;
  const text = JSON.stringify([v, seed, startYear, setup.name, setup.nation, setup.pos, setup.league, setup.pick, setup.reroll ?? 0, choices]);
  let a = 2166136261, b = 5381;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ text.charCodeAt(i);
  }
  return `career-${seed}-${(a >>> 0).toString(16)}-${(b >>> 0).toString(16)}`;
}

export function archiveCareer(state: CareerState, save: CareerSave, ranked: boolean, retiredAt = new Date().toISOString()): RetiredCareer {
  if (state.phase !== "retired") throw new Error("은퇴한 선수만 보관할 수 있어요.");
  const summary = summarizeCareer(state);
  const clubs = new Map<string, ClubCareer>();
  for (const season of state.history) {
    const row = clubs.get(season.club) ?? { club: season.club, name: clubName(season.club), seasons: 0, apps: 0, goals: 0, assists: 0, cleanSheets: 0 };
    row.seasons++;
    row.apps += season.apps;
    row.goals += season.goals;
    row.assists += season.assists;
    row.cleanSheets += season.cleanSheets;
    clubs.set(season.club, row);
  }
  return {
    v: 1, id: retirementId(save), retiredAt, ranked,
    name: summary.name, nation: summary.nation, pos: summary.pos, score: summary.score, grade: summary.grade, title: summary.title,
    totals: Object.fromEntries(TOTAL_KEYS.map((key) => [key, summary[key]])) as Totals,
    clubs: [...clubs.values()], honors: summary.honors.map((honor) => ({ ...honor })),
  };
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("보관함 형식을 읽지 못했어요.");
  return value as Record<string, unknown>;
}
function text(value: unknown, max = 160): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error("보관함의 이름이나 칭호가 올바르지 않아요.");
  return value;
}
function count(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > 1_000_000_000) throw new Error("보관함의 기록 숫자가 올바르지 않아요.");
  return value;
}
function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("보관함의 기록 목록이 올바르지 않아요.");
  return value;
}

/** 가져온 파일의 필요한 필드만 복사해요. 원본 게임 데이터가 섞여 있어도 보관하지 않아요. */
function parseEntry(value: unknown): RetiredCareer {
  const entry = object(value), totals = object(entry.totals);
  if (entry.v !== 1 || typeof entry.ranked !== "boolean") throw new Error("지원하지 않는 보관함 형식이에요.");
  const retiredAt = text(entry.retiredAt, 40);
  if (!Number.isFinite(Date.parse(retiredAt))) throw new Error("은퇴 날짜가 올바르지 않아요.");
  return {
    v: 1, id: text(entry.id), retiredAt, ranked: entry.ranked,
    name: text(entry.name), nation: text(entry.nation), pos: text(entry.pos), score: count(entry.score), grade: text(entry.grade), title: text(entry.title),
    totals: Object.fromEntries(TOTAL_KEYS.map((key) => [key, count(totals[key])])) as Totals,
    clubs: list(entry.clubs).map((value) => {
      const row = object(value);
      return { club: text(row.club), name: text(row.name), seasons: count(row.seasons), apps: count(row.apps), goals: count(row.goals), assists: count(row.assists), cleanSheets: count(row.cleanSheets) };
    }),
    honors: list(entry.honors).map((value) => { const honor = object(value); return { label: text(honor.label), count: count(honor.count) }; }),
  };
}

export function readRetirements(storage: ArchiveStorage): RetiredCareer[] {
  return list(JSON.parse(storage.getItem(CAREER_ARCHIVE_KEY) ?? "[]")).map(parseEntry);
}

export function mergeRetirements(existing: RetiredCareer[], incoming: RetiredCareer[]): RetiredCareer[] {
  const entries = new Map(existing.map((entry) => [entry.id, entry]));
  for (const entry of incoming) if (!entries.has(entry.id)) entries.set(entry.id, entry);
  return [...entries.values()].sort((a, b) => Date.parse(b.retiredAt) - Date.parse(a.retiredAt));
}

export function saveRetirements(storage: ArchiveStorage, incoming: RetiredCareer[]): RetiredCareer[] {
  // 읽기나 쓰기 실패 시 기존 값을 지우거나 최근 N명으로 잘라서 덮어쓰지 않아요.
  const existing = readRetirements(storage);
  const entries = mergeRetirements(existing, incoming);
  if (entries.length !== existing.length) storage.setItem(CAREER_ARCHIVE_KEY, JSON.stringify(entries));
  return entries;
}

export function exportRetirements(entries: RetiredCareer[]): string {
  return JSON.stringify({ format: "legend-road-retirements", version: 1, entries }, null, 2);
}

export function importRetirements(source: string): RetiredCareer[] {
  const file = object(JSON.parse(source));
  if (file.format !== "legend-road-retirements" || file.version !== 1) throw new Error("레전드 로드 은퇴 보관함 백업 파일을 골라 주세요.");
  return list(file.entries).map(parseEntry);
}
