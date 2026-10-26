// 레전드 로드 규칙 버전 4의 엔진 스냅샷이에요(커밋 96e6a2c). 규칙이 바뀌기 전에 시작한 순위 도전 커리어를 서버가 그 버전 규칙으로 다시 계산해 저장할 때만 써요.
// 이 파일은 고치지 않아요. 새 규칙을 만들 때는 engine.ts를 고치고, 이전 engine.ts·data.ts를 legacy/v<이전 버전>/에 복사해요.
// 레전드 로드 규칙이에요. 화면과 서버가 같은 코드를 써요.
// 커리어는 시드와 선택 번호만으로 처음부터 다시 계산돼요. 저장도, 순위 검증도 이 성질을 이용해요.
// 그래서 브라우저마다 결과가 달라질 수 있는 Math.random, 날짜, Math.exp 같은 실수 함수를 쓰지 않고
// 정수 연산만 써요. 규칙을 바꾸면 CAREER_VERSION을 올리고 npm run test:career를 실행해 주세요.
import { directionParticle, objectParticle, politeCopula, withParticle } from "../../../korean";
import {
  ATTR_TRAININGS, CLUBS, CONTINENTALS, INJURIES, KEEPER_ATTRS, LEAGUES, MILITARY_CLUB, NATION_ORDER, NATIONS, OUTFIELD_ATTRS,
  POSITION_MOVES, POSITIONS, RIVAL_NAMES, SPECIAL_TRAININGS, TOURNAMENTS, tournamentIn,
  type ClubInfo, type LeagueCode, type NationCode, type Pos,
} from "./data";

export const CAREER_VERSION = 4;

export const CAREER_RULES = {
  startAge: 17,
  /** 이 나이부터 은퇴를 고를 수 있어요. */
  retireFrom: 32,
  /** 이 나이가 되면 은퇴해요. */
  maxAge: 40,
  /** 선택 수 상한. 최대 24시즌에 시즌마다 3번 이하라 넉넉해요. */
  maxChoices: 120,
  nameLength: 10,
  /** 연습 커리어에서 후보를 다시 뽑을 수 있는 상한. 사실상 제한이 없어요. */
  maxRerolls: 999,
  /** 순위 도전 커리어는 후보를 이만큼만 다시 뽑을 수 있어요. 순위가 다시 뽑기 경쟁이 되지 않게 해요. */
  rankedRerolls: 5,
} as const;

/** 선수 이름. 한글·영문·숫자로 시작하고 끝나며 가운데에는 띄어쓰기와 점을 쓸 수 있어요. */
export const NAME_PATTERN = /^[가-힣A-Za-z0-9](?:[가-힣A-Za-z0-9 .]{0,8}[가-힣A-Za-z0-9.])?$/;

export class CareerError extends Error {}

export type Role = "starter" | "rotation" | "bench" | "reserve";
export type Tone = "good" | "risk" | "neutral";
/** 주발과 뛰는 쪽. L은 왼쪽, R은 오른쪽이에요. */
export type Side = "L" | "R";
/**
 * reroll은 스카우트 후보를 다시 뽑은 횟수예요. 없거나 0이면 처음 후보예요.
 * side는 윙어·풀백만 고르고, 다른 포지션에는 없어요.
 */
export type CareerSetup = { name: string; nation: NationCode; league: LeagueCode; pos: Pos; pick: number; reroll?: number; number: number; foot: Side; side?: Side };
export type Traits = {
  /** 전성기 나이 */
  peak: number;
  /** 0 강철 · 1 보통 · 2 유리몸 */
  injury: number;
  /** 1 큰 경기 체질 · 0 보통 · -1 새가슴 */
  clutch: number;
  /** 훈련 태도 0~2 */
  pro: number;
};
export type Candidate = {
  club: string; style: number; attrs: number[]; ovr: number;
  /** 스카우트 평가. 별 반 개 단위라 10이 별 다섯 개예요. 실제 잠재력과 조금 다를 수 있어요. */
  stars: number;
  note: string; potential: number; traits: Traits;
};
export type Choice = { label: string; detail: string; tone: Tone; value: string; club?: string; years?: number };
export type Decision = { kind: "training" | "event" | "offseason"; id: string; title: string; body: string; options: Choice[] };
/** 트로피와 개인상. points는 레전드 점수에 더해지는 값이에요. */
export type Honor = { label: string; points: number };

export type SeasonRecord = {
  year: number; age: number; club: string; loan: boolean; military: boolean; pos: Pos; role: Role;
  /** 프리시즌 훈련 전·후, 시즌이 끝난 뒤의 오버롤 */
  ovrBefore: number; ovrStart: number; ovrEnd: number;
  /** 프리시즌 훈련 전과 비교한 능력치 변화 */
  growth: number[];
  apps: number; starts: number; minutes: number; goals: number; assists: number; cleanSheets: number;
  /** 평균 평점 ×10. 출전이 없으면 0이에요. */
  rating: number;
  rank: number; cup: number; continental: number;
  trophies: Honor[]; awards: Honor[];
  /** 발롱도르 순위. 30위 밖이면 0이에요. */
  ballon: number;
  caps: number; intlGoals: number; tournaments: string[];
  /** 1군 기회가 적은 어린 선수가 뛴 2군 경기. 통산 기록과 점수에는 들어가지 않아요. */
  reserve: { apps: number; goals: number; assists: number } | null;
  /** 같은 시즌 라이벌의 성적. 라이벌이 은퇴한 뒤에는 null이에요. */
  rival: RivalSeason | null;
  highlights: string[]; missed: number; event: string | null;
};

/** 커리어 내내 함께 성장하는 가상의 라이벌. 같은 나이·포지션이고 자기만의 난수로 움직여요. */
export type Rival = {
  name: string; nation: NationCode; pos: Pos;
  ovr: number; potential: number; peakAge: number; club: string; rng: number;
  retiredAge: number | null;
  apps: number; goals: number; assists: number; trophies: number; ballonDor: number; best: number;
  /** 나와의 맞대결 전적 */
  h2h: { won: number; drawn: number; lost: number };
};
export type RivalSeason = {
  club: string; ovr: number; apps: number; goals: number; assists: number; trophies: string[];
  /** 발롱도르 순위. 30위 밖이면 0이에요. */
  ballon: number;
  /** 이번 시즌 맞대결 결과(나 기준). 만나지 않았으면 null이에요. */
  meeting: string | null;
  moved: string | null; retired: boolean;
};

/** 결승에서 승부가 내 선택에 걸린 순간. 고른 결과는 다른 선택처럼 저장돼서 다시 계산돼요. */
type Moment = {
  comp: "cup" | "cont" | "nt";
  /** 대회 이름. 예: "FA컵", "챔피언스리그", "2030 월드컵" */
  name: string;
  opponent: string;
  kind: "penalty" | "save" | "freekick";
  /** 상대의 실제 성향과, 리포트로 보여 주는 성향(가끔 틀려요) */
  style: string; hint: string;
  /** 내 선택이 통하지 않았을 때 그래도 이길 확률(천분율). 마지막 키커는 0이에요. */
  base: number;
};

/** 대표팀 대회를 결승 직전까지 치른 상태. 결정적 순간이 끝나면 마저 마무리해요. */
type TournamentRun = { code: keyof typeof TOURNAMENTS; year: number; key: boolean; caps: number; goals: number; reached: number; finalScored: number };
type NationalResult = { called: boolean; caps: number; goals: number; tournaments: string[]; trophies: Honor[]; awards: Honor[]; points: number };

type Draft = {
  year: number; age: number; club: string; loan: boolean; military: boolean; pos: Pos;
  role: Role; roleFloor: Role | null; ovrBefore: number; ovrStart: number; attrsBefore: number[];
  risk: number; clutch: number; freekick: boolean; care: boolean; major: boolean;
  t: number; games: number; teamForm: number;
  apps: number; starts: number; minutes: number; goals: number; assists: number; cleanSheets: number; ratingSum: number;
  leagueApps: number; leagueGoals: number; leagueAssists: number; cupApps: number; contApps: number;
  missed: number; away: number;
  reserveApps: number; reserveGoals: number; reserveAssists: number; reserveMinutes: number;
  cupAlive: boolean; cup: number; contOn: boolean; contAlive: boolean; cont: number;
  phaseGoals: number; tie: { goals: number; assists: number; played: boolean };
  highlights: string[]; hatTricks: number; event: string | null; extraCaps: number; olympics: boolean; youthCup: boolean;
  /** 결정적 순간을 기다리는 중이면 그 순간, 대표팀 대회 결승에서 멈췄다면 그 대회 진행 상태예요. */
  moment: Moment | null; tour: TournamentRun | null;
  /** 시즌이 끝날 때 대표팀 성적. 결정적 순간이 대표팀 결승에서 나올 수 있어서 시즌 마무리 전에 따로 계산해요. */
  nt: NationalResult | null;
};

export type CareerState = {
  v: number; seed: number; startYear: number; setup: CareerSetup; rng: number; steps: number;
  name: string; nation: NationCode; pos: Pos; style: string; attrs: number[]; potential: number;
  /** 등번호와 주발. side는 윙어·풀백으로 뛸 때의 측면이고, 다른 포지션이면 주발 쪽으로 정해 둬요. */
  number: number; foot: Side; side: Side;
  traits: Traits; revealed: string[];
  age: number; year: number; club: string;
  /** 임대나 군 복무 중일 때 계약한 원 소속팀 */
  parent: string | null;
  contract: number; trust: number; form: number;
  /** 남은 부상 경기 수 */
  injury: number;
  continentalNext: boolean;
  military: "none" | "pending" | "exempt" | "served";
  apps: number; goals: number; caps: number; intlGoals: number;
  peak: number; peakAge: number;
  flags: string[]; recent: string[];
  /** 다음 시즌 하이라이트 맨 앞에 붙일 이적·복귀 소식 */
  notes: string[];
  draft: Draft | null; history: SeasonRecord[];
  rival: Rival;
  /** 방금 끝난 결정적 순간의 결과 한 줄. 다음 선택 때 지워요. */
  lastMoment: string | null;
  phase: "training" | "event" | "offseason" | "retired";
  pending: Decision | null;
  ending: string | null;
};

// ---------- 난수 ----------

type Rng = { rng: number };

/** mulberry32. 정수 연산만 써서 어느 브라우저와 서버에서도 같은 수열이 나와요. */
function next(r: Rng): number {
  r.rng = (r.rng + 0x6d2b79f5) >>> 0;
  let t = r.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
}
const int = (r: Rng, n: number) => (n <= 1 ? 0 : next(r) % n);
const between = (r: Rng, low: number, high: number) => low + int(r, high - low + 1);
/** 천분율 확률 */
const chance = (r: Rng, permille: number) => int(r, 1000) < permille;
const clamp = (value: number, low: number, high: number) => (value < low ? low : value > high ? high : value);

function pick<T>(r: Rng, list: readonly T[]): T {
  return list[int(r, list.length)];
}

function weightedIndex(r: Rng, weights: number[]): number {
  let total = 0;
  for (const weight of weights) total += Math.max(0, weight);
  if (total <= 0) return -1;
  let roll = int(r, total);
  for (let i = 0; i < weights.length; i++) {
    const weight = Math.max(0, weights[i]);
    if (roll < weight) return i;
    roll -= weight;
  }
  return -1;
}

/** 기대값(1/1000 단위)을 chances번의 기회로 나눠 굴려요. 골·도움 수를 정할 때 써요. */
function count(r: Rng, expected: number, chances: number): number {
  const each = clamp(Math.trunc(expected / chances), 0, 950);
  let total = 0;
  for (let i = 0; i < chances; i++) if (chance(r, each)) total++;
  return total;
}

function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// ---------- 조회 도우미 ----------

const leagueClubs = new Map<LeagueCode, ClubInfo[]>();
function clubsIn(league: LeagueCode): ClubInfo[] {
  let list = leagueClubs.get(league);
  if (!list) {
    list = Object.values(CLUBS).filter((club) => club.league === league);
    leagueClubs.set(league, list);
  }
  return list;
}

function leagueAverage(league: LeagueCode): number {
  const clubs = clubsIn(league);
  return Math.trunc(clubs.reduce((sum, club) => sum + club.rating, 0) / clubs.length);
}

/** 전력 순위가 대륙 대회 출전권 안에 드는 구단인지. 다른 구단의 실제 순위는 계산하지 않아서 전력으로 정해요. */
function qualifiesByRating(clubId: string): boolean {
  const club = CLUBS[clubId];
  const league = LEAGUES[club.league];
  if (!league.continental || clubId === MILITARY_CLUB) return false;
  return clubsIn(club.league).filter((other) => other.rating > club.rating).length < league.spots;
}

export function clubName(id: string): string {
  return CLUBS[id]?.name ?? "무소속";
}

export function overall(attrs: number[], pos: Pos): number {
  const weights = POSITIONS[pos].weights;
  let sum = 0;
  for (let i = 0; i < 6; i++) sum += attrs[i] * weights[i];
  return Math.floor((sum + 50) / 100);
}

export function attrLabels(pos: Pos): string[] {
  return pos === "GK" ? KEEPER_ATTRS : OUTFIELD_ATTRS;
}

/** 왼쪽·오른쪽을 나눠 뛰는 포지션 */
export const FLANKS: readonly Pos[] = ["WG", "FB"];
export const FOOT_NAMES: Record<Side, string> = { L: "왼발", R: "오른발" };

/** 화면에 보이는 포지션 약어. 윙어는 LW·RW, 풀백은 LB·RB예요. */
export function positionCode(pos: Pos, side: Side | null | undefined): string {
  if (!side || !FLANKS.includes(pos)) return pos;
  return `${side}${pos === "WG" ? "W" : "B"}`;
}

export function positionName(pos: Pos, side: Side | null | undefined): string {
  return side && FLANKS.includes(pos) ? `${side === "L" ? "왼쪽" : "오른쪽"} ${POSITIONS[pos].name}` : POSITIONS[pos].name;
}

/**
 * 주발과 측면의 궁합. goal·assist는 골·도움 기대값에 곱하는 천분율이에요.
 * 반대발 윙어는 안쪽으로 파고들어 골이 늘고, 정발 윙어·풀백은 측면 크로스로 도움이 늘어요.
 */
export function footFit(pos: Pos, foot: Side, side: Side): { goal: number; assist: number; label: string } {
  const inverted = foot !== side;
  if (pos === "WG") return inverted ? { goal: 1150, assist: 920, label: "반대발 윙어 · 골 ↑ 도움 ↓" } : { goal: 930, assist: 1200, label: "정발 윙어 · 도움 ↑ 골 ↓" };
  if (pos === "FB") return inverted ? { goal: 1250, assist: 950, label: "반대발 풀백 · 골 ↑ 도움 ↓" } : { goal: 1000, assist: 1150, label: "정발 풀백 · 도움 ↑" };
  return { goal: 1000, assist: 1000, label: "" };
}

export const ROLE_LABELS: Record<Role, string> = { starter: "주전", rotation: "로테이션", bench: "백업", reserve: "유망주" };

/** 역할 이름. 1군 밖 선수는 어리면 유망주, 나이가 차면 전력 외예요. */
export function roleName(role: Role, age: number): string {
  return role === "reserve" && age > 21 ? "전력 외" : ROLE_LABELS[role];
}

export const CUP_STAGES = ["", "32강", "16강", "8강", "4강", "준우승", "우승"];
export const CONTINENTAL_STAGES = ["", "리그 페이즈", "16강", "8강", "4강", "준우승", "우승"];

export function seasonLabel(year: number): string {
  return `${year}-${String((year + 1) % 100).padStart(2, "0")}`;
}

/** 이 날짜가 속한 시즌이 시작한 해. 7월부터 새 시즌이에요. */
export function seasonYearOf(date: Date): number {
  const korea = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return korea.getUTCMonth() >= 6 ? korea.getUTCFullYear() : korea.getUTCFullYear() - 1;
}

/** 추정 몸값(10만 유로 단위). 오버롤 5마다 두 배쯤 오르고 나이와 잠재력을 반영해요. */
export function marketValue(ovr: number, age: number, potential: number): number {
  if (ovr < 45) return 1;
  const step = ovr - 45;
  let value = 2 << Math.floor(step / 5);
  value += Math.floor((value * (step % 5)) / 5);
  const ageRate = age <= 21 ? 150 + clamp(potential - ovr, 0, 30) * 5 : age <= 25 ? 130 : age <= 28 ? 100 : age <= 30 ? 70 : age <= 32 ? 40 : 20;
  return Math.max(1, Math.floor((value * ageRate) / 100));
}

export function formatValue(value: number): string {
  return value >= 100 ? `€${Math.round(value / 10)}M` : `€${(value / 10).toFixed(1)}M`;
}

function roleFor(s: CareerState, ovr: number, rating: number): Role {
  const gap = ovr + Math.trunc(s.trust / 2) + Math.trunc(s.form / 2) - rating;
  return gap >= -1 ? "starter" : gap >= -5 ? "rotation" : gap >= -10 ? "bench" : "reserve";
}

const ROLE_RANK: Record<Role, number> = { starter: 3, rotation: 2, bench: 1, reserve: 0 };
const betterRole = (a: Role, b: Role | null): Role => (b && ROLE_RANK[b] > ROLE_RANK[a] ? b : a);

/** 다음 시즌에 그 구단에서 예상되는 역할. 화면의 이적 제안 설명에도 써요. */
export function expectedRole(s: CareerState, clubId: string, fresh = false): Role {
  const ovr = overall(s.attrs, s.pos);
  const gap = ovr + (fresh ? 0 : Math.trunc(s.trust / 2)) - CLUBS[clubId].rating;
  return gap >= -1 ? "starter" : gap >= -5 ? "rotation" : gap >= -10 ? "bench" : "reserve";
}

/** 그 구단에서 주전으로 뛰는 데 필요한 오버롤. 감독 신뢰와 폼이 좋으면 조금 낮아져요. */
export function starterLine(s: CareerState, clubId: string): number {
  return CLUBS[clubId].rating - 1 - Math.trunc(s.trust / 2) - Math.trunc(s.form / 2);
}

function addAttr(s: CareerState, index: number, amount: number) {
  s.attrs[index] = clamp(s.attrs[index] + amount, 10, 99);
}

/** 능력치를 이만큼 바꾸면 오버롤이 얼마나 달라지는지. 훈련 설명에 보여 줘요. */
function ovrGain(s: CareerState, changes: [number, number][]): number {
  const next = [...s.attrs];
  for (const [index, amount] of changes) next[index] = clamp(next[index] + amount, 10, 99);
  return overall(next, s.pos) - overall(s.attrs, s.pos);
}

const gainText = (gain: number) => (gain > 0 ? `오버롤 +${gain}` : "오버롤 변화 적음");

/** 오버롤을 delta만큼 옮겨요. 비중이 큰 능력치가 더 자주 움직이고, 서른 즈음부터는 속도·피지컬이 먼저 떨어져요. */
function shiftOverall(s: CareerState, delta: number) {
  const target = overall(s.attrs, s.pos) + delta;
  const weights = POSITIONS[s.pos].weights;
  for (let guard = 0; guard < 500; guard++) {
    const now = overall(s.attrs, s.pos);
    if (now === target) return;
    const up = now < target;
    const index = weightedIndex(s, weights.map((weight, i) => {
      if (up ? s.attrs[i] >= 99 : s.attrs[i] <= 20) return 0;
      const physical = s.pos !== "GK" && (i === 0 || i === 5);
      return weight + 6 + (!up && s.age >= 29 && physical ? 30 : 0);
    }));
    if (index < 0) return;
    s.attrs[index] += up ? 1 : -1;
  }
}

function note(d: Draft, text: string) {
  if (d.highlights.length < 10) d.highlights.push(text);
}

// ---------- 선수 만들기 ----------

function buildAttrs(r: Rng, pos: Pos, bias: number[], target: number): number[] {
  const attrs = POSITIONS[pos].weights.map((weight, i) => {
    const lean = weight >= 30 ? 6 : weight >= 18 ? 3 : weight >= 10 ? 0 : weight >= 4 ? -7 : -16;
    return clamp(target + lean + bias[i] + between(r, -3, 3), 15, 80);
  });
  for (let guard = 0; guard < 60; guard++) {
    const diff = target - overall(attrs, pos);
    if (diff === 0) break;
    for (let i = 0; i < 6; i++) attrs[i] = clamp(attrs[i] + Math.sign(diff), 15, 85);
  }
  return attrs;
}

function rollTraits(r: Rng, pos: Pos): Traits {
  const growth = int(r, 100);
  const injury = int(r, 100);
  const clutch = int(r, 100);
  const pro = int(r, 100);
  return {
    peak: (growth < 28 ? 24 : growth < 75 ? 27 : 29) + (pos === "GK" ? 2 : 0),
    injury: injury < 20 ? 0 : injury < 80 ? 1 : 2,
    clutch: clutch < 20 ? 1 : clutch < 80 ? 0 : -1,
    pro: pro < 30 ? 2 : pro < 80 ? 1 : 0,
  };
}

function scoutNote(r: Rng, traits: Traits, pos: Pos): string {
  const notes: string[] = [];
  if (traits.pro === 2) notes.push("훈련장에 가장 먼저 나오는 성실파예요.");
  if (traits.pro === 0) notes.push("재능은 있지만 훈련 태도가 들쭉날쭉해요.");
  if (traits.injury === 2) notes.push("유스 시절 잔부상이 잦았어요.");
  if (traits.injury === 0) notes.push("한 번도 크게 다친 적 없는 강철 체력이에요.");
  if (traits.clutch === 1) notes.push("유스 결승전에서 유독 강했어요.");
  if (traits.clutch === -1) notes.push("큰 경기에서 긴장하는 편이에요.");
  if (traits.peak <= (pos === "GK" ? 26 : 24)) notes.push("또래보다 몸이 빨리 여물었어요.");
  if (traits.peak >= (pos === "GK" ? 31 : 29)) notes.push("아직 몸이 덜 여문 늦깎이 유망주예요.");
  return notes.length ? pick(r, notes) : "눈에 띄진 않지만 기본기가 탄탄해요.";
}

/**
 * 같은 시드·국적·리그·포지션·다시 뽑은 횟수면 언제나 같은 세 명이 나와요. 빅클럽·중위권·하위권 유스에서 한 명씩이에요.
 * 다시 뽑지 않은 후보(reroll 0)는 다시 뽑기가 생기기 전과 똑같아서 예전 커리어도 그대로 다시 계산돼요.
 */
export function scoutCandidates(seed: number, nation: NationCode, league: LeagueCode, pos: Pos, reroll = 0): Candidate[] {
  const r: Rng = { rng: (seed ^ hash(`${nation}|${league}|${pos}${reroll ? `|r${reroll}` : ""}`)) >>> 0 };
  for (let i = 0; i < 4; i++) next(r);
  const clubs = clubsIn(league).filter((club) => club.id !== MILITARY_CLUB).sort((a, b) => b.rating - a.rating);
  const third = Math.ceil(clubs.length / 3);
  return [0, 1, 2].map((tier) => {
    const pool = clubs.slice(tier * third, tier === 2 ? clubs.length : (tier + 1) * third);
    const club = pick(r, pool);
    const potential = 64 + int(r, 11) + int(r, 11) + int(r, 10);
    const target = 48 + int(r, 6) + (potential >= 88 ? 1 : 0);
    const style = int(r, POSITIONS[pos].styles.length);
    const attrs = buildAttrs(r, pos, POSITIONS[pos].styles[style].bias, target);
    const traits = rollTraits(r, pos);
    const estimate = potential + between(r, -3, 3);
    const stars = estimate >= 91 ? 10 : estimate >= 87 ? 9 : estimate >= 83 ? 8 : estimate >= 79 ? 7 : estimate >= 75 ? 6 : estimate >= 71 ? 5 : 4;
    return { club: club.id, style, attrs, ovr: overall(attrs, pos), stars, note: scoutNote(r, traits, pos), potential, traits };
  });
}

export function cleanName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

const isSide = (value: unknown): value is Side => value === "L" || value === "R";

function validSetup(setup: CareerSetup): boolean {
  return !!setup && typeof setup.name === "string" && NAME_PATTERN.test(setup.name)
    && Object.hasOwn(NATIONS, setup.nation) && Object.hasOwn(LEAGUES, setup.league) && LEAGUES[setup.league].youth
    && Object.hasOwn(POSITIONS, setup.pos) && Number.isInteger(setup.pick) && setup.pick >= 0 && setup.pick <= 2
    && (setup.reroll === undefined || (Number.isInteger(setup.reroll) && setup.reroll >= 0 && setup.reroll <= CAREER_RULES.maxRerolls))
    && Number.isInteger(setup.number) && setup.number >= 1 && setup.number <= 99 && isSide(setup.foot)
    && (FLANKS.includes(setup.pos) ? isSide(setup.side) : setup.side === undefined);
}

/** 화면이나 저장에서 온 선수 정보를 검사하고 필요한 필드만 복사해요. 저장 모양이 늘 같아서 재계산·식별값이 흔들리지 않아요. */
export function cleanSetup(raw: unknown): CareerSetup {
  const setup = raw as CareerSetup;
  if (!raw || typeof raw !== "object" || !validSetup(setup)) throw new CareerError("선수 정보가 올바르지 않아요.");
  const reroll = setup.reroll ?? 0;
  return {
    name: setup.name, nation: setup.nation, league: setup.league, pos: setup.pos, pick: setup.pick, ...(reroll ? { reroll } : {}),
    number: setup.number, foot: setup.foot, ...(setup.side ? { side: setup.side } : {}),
  };
}

export function createCareer(seed: number, startYear: number, raw: CareerSetup): CareerState {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new CareerError("커리어 번호가 올바르지 않아요.");
  if (!Number.isInteger(startYear) || startYear < 2020 || startYear > 2100) throw new CareerError("시작 시즌이 올바르지 않아요.");
  const setup = cleanSetup(raw);
  const reroll = setup.reroll ?? 0;
  const candidate = scoutCandidates(seed, setup.nation, setup.league, setup.pos, reroll)[setup.pick];
  const s: CareerState = {
    v: CAREER_VERSION, seed, startYear, setup,
    rng: (seed ^ hash(`${setup.nation}|${setup.league}|${setup.pos}|${setup.pick}|career${reroll ? `|r${reroll}` : ""}`)) >>> 0, steps: 0,
    name: setup.name, nation: setup.nation, pos: setup.pos, style: POSITIONS[setup.pos].styles[candidate.style].name,
    attrs: [...candidate.attrs], potential: candidate.potential, number: setup.number, foot: setup.foot, side: setup.side ?? setup.foot,
    traits: { ...candidate.traits }, revealed: [],
    age: CAREER_RULES.startAge, year: startYear, club: candidate.club, parent: null, contract: 3, trust: 0, form: 0, injury: 0,
    continentalNext: qualifiesByRating(candidate.club), military: setup.nation === "KOR" ? "pending" : "none",
    apps: 0, goals: 0, caps: 0, intlGoals: 0, peak: candidate.ovr, peakAge: CAREER_RULES.startAge,
    flags: [], recent: [], notes: [`${clubName(candidate.club)} 유스 출신으로 프로 계약`],
    draft: null, history: [], rival: createRival(seed, setup, candidate.club), lastMoment: null, phase: "training", pending: null, ending: null,
  };
  s.notes.push(`평생의 라이벌 등장 · ${s.rival.name}(${NATIONS[s.rival.nation].name}) · ${clubName(s.rival.club)} 유스`);
  for (let i = 0; i < 4; i++) next(s);
  s.pending = trainingDecision(s);
  return s;
}

/** 같은 나이·포지션의 라이벌을 만들어요. 재능이 뛰어난 편이라 쉽게 따라잡히지 않아요. */
function createRival(seed: number, setup: CareerSetup, club: string): Rival {
  const r: Rng = { rng: (seed ^ hash(`${setup.nation}|${setup.league}|${setup.pos}|rival`)) >>> 0 };
  for (let i = 0; i < 4; i++) next(r);
  const nation = pick(r, NATION_ORDER);
  const [given, family] = RIVAL_NAMES[nation];
  const first = pick(r, given);
  const last = pick(r, family);
  const name = nation === "KOR" ? `${last}${first}` : nation === "JPN" ? `${last} ${first}` : `${first} ${last}`;
  const clubs = clubsIn(NATIONS[nation].home).filter((item) => item.id !== MILITARY_CLUB && item.id !== club);
  const ovr = 49 + int(r, 6);
  return {
    name, nation, pos: setup.pos, ovr, potential: 81 + int(r, 7) + int(r, 7), peakAge: 26 + int(r, 3) + (setup.pos === "GK" ? 2 : 0),
    club: pick(r, clubs).id, rng: r.rng, retiredAge: null,
    apps: 0, goals: 0, assists: 0, trophies: 0, ballonDor: 0, best: ovr, h2h: { won: 0, drawn: 0, lost: 0 },
  };
}

// ---------- 프리시즌 훈련 ----------

function trainingGain(s: CareerState): number {
  const base = s.age <= 23 ? 3 : s.age <= 29 ? 2 : 1;
  const ovr = overall(s.attrs, s.pos);
  return ovr >= s.potential + 2 ? Math.min(base, 1) : base;
}

function trainingDecision(s: CareerState): Decision {
  const keeper = s.pos === "GK";
  const labels = attrLabels(s.pos);
  const gain = trainingGain(s);
  const weights = POSITIONS[s.pos].weights;
  const options: Choice[] = [];
  const chosen: number[] = [];
  for (let n = 0; n < 2; n++) {
    const index = weightedIndex(s, weights.map((weight, i) => (chosen.includes(i) || s.attrs[i] >= 97 ? 0 : weight + 4)));
    if (index < 0) break;
    chosen.push(index);
    const after = Math.min(99, s.attrs[index] + gain);
    options.push({
      label: ATTR_TRAININGS[keeper ? "keeper" : "outfield"][index],
      detail: `${labels[index]} ${s.attrs[index]} → ${after} · ${gainText(ovrGain(s, [[index, gain]]))}`,
      tone: "good",
      value: `attr${index}`,
    });
  }
  const specials: (keyof typeof SPECIAL_TRAININGS)[] = ["tactics", "mental"];
  if (s.age <= 30) specials.push("hell");
  if (s.age >= 26 || s.injury > 0) specials.push("care", "care");
  if (["ST", "WG", "AM", "CM"].includes(s.pos)) specials.push("freekick");
  const [tacticA, tacticB] = keeper ? [3, 4] : [2, 4];
  const specialDetail = {
    hell: `모든 능력치 +1 · ${gainText(ovrGain(s, [0, 1, 2, 3, 4, 5].map((i): [number, number] => [i, 1])))} · 부상 위험 큼`,
    care: SPECIAL_TRAININGS.care.detail,
    tactics: `감독 신뢰 ↑ · ${labels[tacticA]}·${labels[tacticB]} +1`,
    mental: SPECIAL_TRAININGS.mental.detail,
    freekick: SPECIAL_TRAININGS.freekick.detail,
  };
  while (options.length < 3) {
    const id = pick(s, specials);
    if (options.some((option) => option.value === id)) continue;
    options.push({ label: SPECIAL_TRAININGS[id].label, detail: specialDetail[id], tone: id === "hell" ? "risk" : "neutral", value: id });
  }
  const club = CLUBS[s.club];
  const role = roleName(expectedRole(s, s.club), s.age);
  const ovr = overall(s.attrs, s.pos);
  const line = starterLine(s, s.club);
  const outlook = ovr >= line ? "주전 경쟁에서 앞서 있어요." : `주전 기준 오버롤 ${line} · 지금 ${ovr}.`;
  const injured = s.injury > 0 ? ` 부상 회복까지 ${s.injury}경기 남았어요.` : "";
  return {
    kind: "training", id: "training",
    title: `${seasonLabel(s.year)} 프리시즌`,
    body: `${s.age}세, ${club.name}에서 ${s.history.length ? "새 시즌" : "프로 첫 시즌"}을 준비해요. 예상 역할은 ${role}${politeCopula(role)}. ${outlook}${injured}`,
    options,
  };
}

function applyTraining(s: CareerState, value: string): Draft {
  const before = [...s.attrs];
  const ovrBefore = overall(s.attrs, s.pos);
  const gain = trainingGain(s);
  const extras = { risk: 0, clutch: 0, freekick: false, care: false, form: 0 };
  const match = /^attr([0-5])$/.exec(value);
  if (match) addAttr(s, Number(match[1]), gain);
  else if (value === "hell") {
    for (let i = 0; i < 6; i++) addAttr(s, i, 1);
    extras.risk = s.age >= 28 ? 9 : 6;
  } else if (value === "care") {
    extras.risk = -4;
    extras.care = true;
  } else if (value === "tactics") {
    s.trust = clamp(s.trust + 2, -10, 10);
    for (const index of s.pos === "GK" ? [3, 4] : [2, 4]) addAttr(s, index, 1);
  } else if (value === "mental") {
    extras.form = 1;
    extras.clutch = 1;
  } else if (value === "freekick") {
    addAttr(s, 1, 1);
    addAttr(s, 2, 1);
    extras.freekick = true;
  } else throw new CareerError("훈련 선택이 올바르지 않아요.");
  return startSeason(s, before, ovrBefore, extras);
}

// ---------- 시즌 진행 ----------

const CUP_AT = [15, 35, 55, 72, 92];
const CONT_PHASE_AT = [6, 12, 18, 24, 30, 36, 42, 48];
const CONT_KO_AT = [[60, 64], [72, 76], [82, 86], [95]];
const SELECT = {
  league: { starter: 900, rotation: 560, bench: 260, reserve: 60 },
  cup: { starter: 620, rotation: 780, bench: 620, reserve: 300 },
  continental: { starter: 920, rotation: 520, bench: 200, reserve: 30 },
} satisfies Record<string, Record<Role, number>>;
type Competition = keyof typeof SELECT;

function startSeason(s: CareerState, before: number[], ovrBefore: number, extras: { risk: number; clutch: number; freekick: boolean; care: boolean; form: number }): Draft {
  const club = CLUBS[s.club];
  const league = LEAGUES[club.league];
  const ovr = overall(s.attrs, s.pos);
  if (ovr > s.peak) { s.peak = ovr; s.peakAge = s.age; }
  s.form = extras.form + (s.flags.includes(`rested-${s.year}`) ? 1 : 0);
  const military = s.club === MILITARY_CLUB;
  const d: Draft = {
    year: s.year, age: s.age, club: s.club, loan: s.parent !== null && !military, military, pos: s.pos,
    role: roleFor(s, ovr, club.rating), roleFloor: null, ovrBefore, ovrStart: ovr, attrsBefore: before,
    risk: extras.risk, clutch: extras.clutch, freekick: extras.freekick, care: extras.care, major: false,
    t: 0, games: league.games, teamForm: between(s, -3, 3),
    apps: 0, starts: 0, minutes: 0, goals: 0, assists: 0, cleanSheets: 0, ratingSum: 0,
    leagueApps: 0, leagueGoals: 0, leagueAssists: 0, cupApps: 0, contApps: 0,
    missed: 0, away: 0, reserveApps: 0, reserveGoals: 0, reserveAssists: 0, reserveMinutes: 0,
    cupAlive: true, cup: 1, contOn: s.continentalNext && !!league.continental && !military, contAlive: true, cont: 0,
    phaseGoals: 0, tie: { goals: 0, assists: 0, played: false },
    highlights: [...s.notes], hatTricks: 0, event: null, extraCaps: 0, olympics: false, youthCup: false,
    moment: null, tour: null, nt: null,
  };
  if (d.contOn) d.cont = 1;
  s.notes = [];
  s.draft = d;
  return d;
}

function teamStrength(s: CareerState, d: Draft): number {
  const rating = CLUBS[d.club].rating;
  const ovr = overall(s.attrs, s.pos);
  const impact = d.role === "starter" ? clamp(Math.trunc((ovr - rating) / 3), -2, 4)
    : d.role === "rotation" ? clamp(Math.trunc((ovr - rating) / 5), -1, 2) : 0;
  return rating + d.teamForm + impact + Math.trunc(s.form / 2);
}

const DEFENSIVE: Pos[] = ["GK", "CB", "FB", "DM"];

function playMatch(s: CareerState, d: Draft, comp: Competition, opponent: string, oppRating: number, final = false) {
  const none = { played: false, goals: 0, assists: 0 };
  if (s.injury > 0) { s.injury--; d.missed++; return none; }
  if (d.away > 0) { d.away--; return none; }
  if (!chance(s, clamp(SELECT[comp][d.role] + s.form * 40 + s.trust * 12, 0, 985))) {
    if (comp === "league") reserveMatch(s, d);
    return none;
  }
  const start = chance(s, d.role === "starter" ? 950 : d.role === "rotation" ? 600 : d.role === "bench" ? 300 : 200);
  const minutes = start ? (chance(s, 700) ? 90 : between(s, 60, 89)) : between(s, 8, 35);
  const ovr = overall(s.attrs, s.pos);
  const strength = teamStrength(s, d);
  const quality = 1000 + (ovr - 75) * 30;
  const edge = clamp(1000 + (strength - oppRating) * 15, 500, 1500);
  const info = POSITIONS[d.pos];
  const fit = footFit(d.pos, s.foot, s.side);
  const scale = (base: number) => Math.trunc((((base * Math.max(quality, 250)) / 1000) * edge / 1000) * minutes / 90);
  const expectedGoals = clamp(scale(Math.trunc((info.goal * fit.goal) / 1000)) + (d.freekick && info.goal > 0 ? 12 : 0), 0, 2800);
  const goals = count(s, expectedGoals, 4);
  const assists = count(s, clamp(scale(Math.trunc((info.assist * fit.assist) / 1000)), 0, 2000), 3);
  const cleanSheet = minutes >= 60 && chance(s, clamp(330 + (strength - oppRating) * 25, 80, 760));
  // 평점 ×10. 팀 안에서의 실력 차와 절대 실력을 함께 봐요. 보통 주전이 6.8, 월드 클래스가 7.8쯤이에요.
  let rating = 66 + clamp(Math.trunc((ovr - CLUBS[d.club].rating) / 3), -4, 5) + clamp(Math.trunc((ovr - 70) / 6), -3, 5)
    + goals * 8 + assists * 5 + s.form + between(s, -5, 5);
  if (cleanSheet) rating += d.pos === "GK" ? 7 : DEFENSIVE.includes(d.pos) ? 3 : 0;
  if (!start) rating -= 2;
  rating = clamp(rating, 50, 99);

  d.apps++; d.ratingSum += rating; d.minutes += minutes; d.goals += goals; d.assists += assists;
  if (start) d.starts++;
  if (cleanSheet && DEFENSIVE.includes(d.pos)) d.cleanSheets++;
  if (comp === "league") { d.leagueApps++; d.leagueGoals += goals; d.leagueAssists += assists; }
  else if (comp === "cup") d.cupApps++;
  else d.contApps++;
  if (rating >= 75) s.form = Math.min(3, s.form + 1);
  else if (rating <= 60) s.form = Math.max(-3, s.form - 1);

  if (!s.flags.includes("debut")) {
    s.flags.push("debut");
    note(d, `프로 데뷔전 · ${opponent}전 ${start ? "선발" : "교체 출전"}`);
  }
  if (goals && !s.flags.includes("first-goal")) {
    s.flags.push("first-goal");
    note(d, `프로 데뷔골 · ${opponent}전`);
  }
  if (goals >= 3) {
    d.hatTricks++;
    if (d.hatTricks <= 2) note(d, `${goals === 3 ? "해트트릭" : `한 경기 ${goals}골`} · ${opponent}전`);
  }
  const careerGoals = s.goals + d.goals;
  if (goals && Math.floor(careerGoals / 100) > Math.floor((careerGoals - goals) / 100)) note(d, `통산 ${Math.floor(careerGoals / 100) * 100}호 골 · ${opponent}전`);
  if (d.freekick && goals && !s.flags.includes(`fk-goal-${d.year}`) && chance(s, 300)) {
    s.flags.push(`fk-goal-${d.year}`);
    note(d, `환상적인 프리킥 골 · ${opponent}전`);
  }
  if (final && !s.revealed.includes("clutch") && s.traits.clutch !== 0) {
    s.revealed.push("clutch");
    note(d, s.traits.clutch > 0 ? "특성 발견: 큰 경기 체질" : "특성 발견: 큰 무대에 약한 새가슴");
  }
  injuryCheck(s, d, minutes);
  return { played: true, goals, assists };
}

/** 1군에 못 뛴 날, 어린 유망주와 백업은 2군 경기에서 감각을 쌓아요. 통산 기록에는 넣지 않고 성장에만 반쯤 반영해요. */
function reserveMatch(s: CareerState, d: Draft) {
  if (d.age > 22 || d.military || (d.role !== "reserve" && d.role !== "bench") || !chance(s, 800)) return;
  const minutes = between(s, 70, 90);
  const info = POSITIONS[d.pos];
  const fit = footFit(d.pos, s.foot, s.side);
  // 2군 상대는 또래 유망주라 오버롤 58을 보통 실력으로 봐요.
  const quality = Math.max(250, 1000 + (overall(s.attrs, s.pos) - 58) * 30);
  const scale = (base: number) => Math.trunc((((base * quality) / 1000) * 1150) / 1000 * minutes / 90);
  d.reserveApps++;
  d.reserveMinutes += minutes;
  d.reserveGoals += count(s, clamp(scale(Math.trunc((info.goal * fit.goal) / 1000)), 0, 2800), 4);
  d.reserveAssists += count(s, clamp(scale(Math.trunc((info.assist * fit.assist) / 1000)), 0, 2000), 3);
}

function injuryCheck(s: CareerState, d: Draft, minutes: number) {
  const risk = 5 + s.traits.injury * 4 + Math.max(0, s.age - 29) * 2 + d.risk;
  if (!chance(s, Math.trunc((clamp(risk, 1, 60) * Math.max(minutes, 20)) / 90))) return;
  const roll = int(s, 100) + (s.traits.injury - 1) * 8;
  if (roll < 60) {
    s.injury = between(s, 1, 2);
    return;
  }
  if (roll < 93) {
    s.injury = between(s, 3, 8);
    note(d, `${pick(s, INJURIES.moderate)} · ${s.injury}경기 결장`);
    return;
  }
  s.injury = between(s, 12, 30);
  d.major = true;
  note(d, `${pick(s, INJURIES.major)} · 장기 부상`);
  if (s.traits.injury === 2 && !s.revealed.includes("injury")) {
    s.revealed.push("injury");
    note(d, "특성 발견: 부상이 잦은 체질");
  }
}

function leagueOpponent(s: CareerState, d: Draft): ClubInfo {
  const rivals = clubsIn(CLUBS[d.club].league).filter((club) => club.id !== d.club && club.id !== MILITARY_CLUB);
  return pick(s, rivals);
}

function nearClub(s: CareerState, pool: ClubInfo[], rating: number, exclude: string): ClubInfo {
  const near = pool.filter((club) => club.id !== exclude && club.id !== MILITARY_CLUB && Math.abs(club.rating - rating) <= 3);
  const list = near.length ? near : pool.filter((club) => club.id !== exclude && club.id !== MILITARY_CLUB);
  return pick(s, list);
}

const REGION_LEAGUES = {
  europe: ["ENG", "ESP", "GER", "ITA", "FRA", "NED", "POR"],
  asia: ["KOR", "JPN", "KSA"],
  america: ["BRA", "ARG"],
} satisfies Record<string, LeagueCode[]>;

/** 토너먼트 경기를 이길 확률(천분율). 내 골·도움과 큰 경기 체질이 보태져요. */
function finalOdds(s: CareerState, d: Draft, oppRating: number, final = true): number {
  const strength = teamStrength(s, d);
  let p = 500 + (strength - oppRating) * 35;
  if (d.tie.played) p += d.tie.goals * 110 + d.tie.assists * 50 + (final ? (s.traits.clutch + d.clutch) * 40 : 0);
  return clamp(p, 60, 940);
}

function resolveTie(s: CareerState, d: Draft, oppRating: number, final: boolean): boolean {
  return chance(s, finalOdds(s, d, oppRating, final));
}

// ---------- 결정적 순간 ----------

const SIDES = ["L", "C", "R"] as const;
const SIDE_NAMES: Record<string, string> = { L: "왼쪽", C: "가운데", R: "오른쪽" };

/**
 * 결승에 뛰었다면 열에 넷쯤은 승부가 내 발끝에 걸려요. 그때는 시즌을 멈추고 결정을 기다려요.
 * 순간이 시작되면 true예요. 결과는 resolveMoment가 정해요.
 */
function startMoment(s: CareerState, d: Draft, comp: Moment["comp"], name: string, opponent: string, odds: number, played = d.tie.played): boolean {
  if (!played || !chance(s, 420)) return false;
  const shooter = s.attrs[1] >= 72 || d.freekick;
  const kind: Moment["kind"] = s.pos === "GK" ? "save" : shooter && chance(s, 350) ? "freekick" : "penalty";
  const styles = kind === "penalty" ? ["L", "R", "W"] : kind === "save" ? ["L", "R", "P"] : ["curl", "low", "cross"];
  const style = pick(s, styles);
  // 스카우팅 리포트는 다섯 번에 한 번쯤 틀려요.
  const hint = chance(s, 800) ? style : pick(s, styles.filter((item) => item !== style));
  const base = kind === "penalty" ? 0 : kind === "save" ? 450 : Math.max(60, odds - 120);
  d.moment = { comp, name, opponent, kind, style, hint, base };
  s.pending = momentDecision(d.moment);
  s.phase = "event";
  return true;
}

const MOMENT_HINTS: Record<Moment["kind"], Record<string, string>> = {
  penalty: {
    L: "상대 키퍼는 키커가 보기에 왼쪽으로 먼저 몸을 날리는 버릇이 있어요.",
    R: "상대 키퍼는 키커가 보기에 오른쪽으로 먼저 몸을 날리는 버릇이 있어요.",
    W: "상대 키퍼는 끝까지 기다렸다가 반응하는 편이에요.",
  },
  save: {
    L: "상대 키커는 당신의 왼쪽 구석을 즐겨 노려요.",
    R: "상대 키커는 당신의 오른쪽 구석을 즐겨 노려요.",
    P: "상대 키커는 가운데로 강하게 차는 편이에요.",
  },
  freekick: {
    curl: "상대 골키퍼가 수비벽 쪽으로 치우쳐 서 있어요.",
    low: "상대 수비벽은 높이 뛰어오르는 버릇이 있어요.",
    cross: "상대 수비가 공중볼에 약해요.",
  },
};

function momentDecision(m: Moment): Decision {
  const report = `스카우팅 리포트: ${MOMENT_HINTS[m.kind][m.hint]}`;
  if (m.kind === "penalty") {
    return {
      kind: "event", id: "moment", title: `${m.name} 결승 · 마지막 키커`,
      body: `${m.opponent}전 승부차기, 마지막 키커로 당신이 나섰어요. 넣으면 우승이에요. ${report}`,
      options: [
        option("왼쪽 구석으로", "골문 구석은 막기 어렵지만 빗나갈 수 있어요", "neutral", "kick:L"),
        option("가운데로 강하게", "키퍼가 먼저 움직이면 거의 들어가요", "neutral", "kick:C"),
        option("오른쪽 구석으로", "골문 구석은 막기 어렵지만 빗나갈 수 있어요", "neutral", "kick:R"),
      ],
    };
  }
  if (m.kind === "save") {
    return {
      kind: "event", id: "moment", title: `${m.name} 결승 · 마지막 선방`,
      body: `${m.opponent}전 승부차기, 상대의 마지막 키커가 섰어요. 막으면 바로 우승이에요. ${report}`,
      options: [
        option("왼쪽으로 몸을 날린다", "맞히면 막을 수 있어요", "neutral", "dive:L"),
        option("끝까지 버틴다", "가운데로 오면 거의 막아요", "neutral", "dive:C"),
        option("오른쪽으로 몸을 날린다", "맞히면 막을 수 있어요", "neutral", "dive:R"),
      ],
    };
  }
  return {
    kind: "event", id: "moment", title: `${m.name} 결승 · 추가시간 프리킥`,
    body: `${m.opponent}전 동점인 추가시간, 페널티 박스 바로 앞에서 프리킥을 얻었어요. 공 앞에 당신이 섰어요. ${report}`,
    options: [
      option("먼 구석으로 감아 차기", "슈팅이 정확할수록 좋아요", "neutral", "fk:curl"),
      option("수비벽 아래로 깔아 차기", "벽이 뛰어오르는 팀에 잘 통해요", "neutral", "fk:low"),
      option("동료 머리를 노린 크로스", "패스가 좋을수록 좋아요", "neutral", "fk:cross"),
    ],
  };
}

/** 고른 방향으로 결정적 순간을 마무리해요. 이기면 true예요. */
function resolveMoment(s: CareerState, d: Draft, m: Moment, value: string): { won: boolean; text: string } {
  const clutch = (s.traits.clutch + d.clutch) * 30;
  if (m.kind === "penalty") {
    const side = value.slice(5);
    if (!value.startsWith("kick:") || !SIDES.includes(side as (typeof SIDES)[number])) throw new CareerError("결정을 다시 골라 주세요.");
    const dive = SIDES[weightedIndex(s, m.style === "W" ? [25, 50, 25] : m.style === "L" ? [75, 10, 15] : [15, 10, 75])];
    const where = `${SIDE_NAMES[side]}${directionParticle(SIDE_NAMES[side])}`;
    const onTarget = side === "C" ? 960 : clamp(880 + (s.attrs[1] - 70) * 5 + clutch, 650, 985);
    if (!chance(s, onTarget)) return { won: false, text: `${where} 찬 공이 골대를 벗어났어요` };
    const saved = chance(s, dive === side ? (side === "C" ? 950 : 700) : side === "C" ? 150 : 0);
    if (saved) return { won: false, text: `${where} 찼지만 키퍼에게 막혔어요` };
    return { won: true, text: `${where} 침착하게 성공시켰어요` };
  }
  if (m.kind === "save") {
    const side = value.slice(5);
    if (!value.startsWith("dive:") || !SIDES.includes(side as (typeof SIDES)[number])) throw new CareerError("결정을 다시 골라 주세요.");
    const shot = SIDES[weightedIndex(s, m.style === "P" ? [27, 45, 28] : m.style === "L" ? [60, 15, 25] : [25, 15, 60])];
    if (!chance(s, 920)) return { won: true, text: "상대 키커의 슈팅이 골대를 벗어났어요" };
    if (shot === side && chance(s, side === "C" ? 850 : clamp(550 + (s.attrs[0] - 70) * 6 + clutch, 350, 820))) {
      return { won: true, text: `${SIDE_NAMES[side]}${objectParticle(SIDE_NAMES[side])} 읽어 낸 선방으로 승부를 끝냈어요` };
    }
    const won = chance(s, m.base);
    return { won, text: won ? "막지는 못했지만 동료들이 승부차기를 마무리했어요" : "선방에 실패했고 승부차기에서 졌어요" };
  }
  const [, choice] = value.split(":");
  if (!value.startsWith("fk:") || !["curl", "low", "cross"].includes(choice)) throw new CareerError("결정을 다시 골라 주세요.");
  const skill = choice === "cross" ? s.attrs[2] : s.attrs[1];
  const p = (choice === m.style ? 420 : 200) + (skill - 70) * 6 + (d.freekick ? 60 : 0) + clutch;
  if (chance(s, clamp(p, 80, 720))) {
    return { won: true, text: choice === "cross" ? "크로스가 동료 머리에 맞으며 결승골이 터졌어요" : "프리킥이 그대로 그물을 흔들며 결승골이 됐어요" };
  }
  const won = chance(s, m.base);
  return { won, text: won ? "프리킥은 막혔지만 연장 끝에 이겼어요" : "프리킥이 막히고 끝내 졌어요" };
}

function cupTie(s: CareerState, d: Draft, round: number) {
  const club = CLUBS[d.club];
  const league = LEAGUES[club.league];
  const target = leagueAverage(club.league) + [-4, -2, 0, 2, 4][round];
  const opponent = nearClub(s, clubsIn(club.league), target, club.id);
  const final = round === 4;
  d.tie = { goals: 0, assists: 0, played: false };
  const result = playMatch(s, d, "cup", opponent.name, opponent.rating, final);
  d.tie = { goals: result.goals, assists: result.assists, played: result.played };
  if (final && startMoment(s, d, "cup", league.cup, opponent.name, finalOdds(s, d, target))) return;
  if (resolveTie(s, d, target, final || round === 3)) {
    d.cup = final ? 6 : round + 2;
    if (final && result.goals) note(d, `${league.cup} 결승 ${result.goals}골 · 우승을 이끌다`);
  } else {
    if (final) d.cup = 5;
    d.cupAlive = false;
  }
}

function continentalMatch(s: CareerState, d: Draft, round: number, leg: number, legs: number, phaseIndex: number) {
  const league = LEAGUES[CLUBS[d.club].league];
  const comp = CONTINENTALS[league.continental!];
  const region = league.region;
  const pool = REGION_LEAGUES[region].flatMap((code) => clubsIn(code));
  if (round < 0) {
    const opponent = nearClub(s, pool, comp.opp[0] + between(s, -4, 4), d.club);
    const result = playMatch(s, d, "continental", opponent.name, opponent.rating);
    d.phaseGoals += result.goals + result.assists;
    if (phaseIndex === CONT_PHASE_AT.length - 1) {
      const p = clamp(450 + (teamStrength(s, d) - comp.opp[0]) * 45 + d.phaseGoals * 20, 40, 970);
      if (chance(s, p)) d.cont = 2;
      else d.contAlive = false;
    }
    return;
  }
  const oppRating = comp.opp[round + 1];
  const opponent = nearClub(s, pool, oppRating, d.club);
  const final = round === 3;
  if (leg === 0) d.tie = { goals: 0, assists: 0, played: false };
  const result = playMatch(s, d, "continental", opponent.name, opponent.rating, final);
  d.tie.goals += result.goals;
  d.tie.assists += result.assists;
  d.tie.played ||= result.played;
  if (leg < legs - 1) return;
  if (final && startMoment(s, d, "cont", comp.name, opponent.name, finalOdds(s, d, oppRating))) return;
  if (resolveTie(s, d, oppRating, final || round === 2)) {
    d.cont = final ? 6 : round + 3;
    if (final && d.tie.goals) note(d, `${comp.name} 결승 ${d.tie.goals}골 · 정상에 서다`);
  } else {
    if (final) d.cont = 5;
    d.contAlive = false;
  }
}

function at(d: Draft, percent: number): number {
  return Math.floor((d.games * percent) / 100);
}

function playMatchday(s: CareerState, d: Draft) {
  const opponent = leagueOpponent(s, d);
  playMatch(s, d, "league", opponent.name, opponent.rating);
  const cupRound = CUP_AT.findIndex((percent) => at(d, percent) === d.t);
  if (cupRound >= 0 && d.cupAlive) cupTie(s, d, cupRound);
  // 결정적 순간이 시작되면 그날 남은 경기는 결정 뒤로 미뤄요.
  if (s.pending || !d.contOn || !d.contAlive) return;
  const phase = CONT_PHASE_AT.findIndex((percent) => at(d, percent) === d.t);
  if (phase >= 0 && d.cont === 1) continentalMatch(s, d, -1, 0, 1, phase);
  CONT_KO_AT.forEach((legs, round) => legs.forEach((percent, leg) => {
    if (!s.pending && d.contAlive && at(d, percent) === d.t && d.cont === round + 2) continentalMatch(s, d, round, leg, legs.length, -1);
  }));
}

/** until 경기일 전까지 치러요. 결정이 필요해지면 그 경기일까지만 치르고 멈춰요. */
function simulateUntil(s: CareerState, d: Draft, until: number) {
  while (d.t < until) {
    playMatchday(s, d);
    d.t++;
    if (s.pending) return;
  }
}

// ---------- 시즌 중 사건 ----------

type EventCard = { title: string; body: string; options: Choice[] };
type EventDef = {
  weight: number;
  /** 우선 사건은 조건이 맞으면 무조건 나와요. */
  priority?: boolean;
  /** 앞선 선택이 돌아오는 사건. 조건이 맞으면 넷에 셋은 다른 사건보다 먼저 나와요. */
  followUp?: boolean;
  when: (s: CareerState, d: Draft) => boolean;
  card: (s: CareerState, d: Draft) => EventCard;
  /** 결과를 적용하고 시즌 기록에 남길 한 줄을 돌려줘요. */
  apply: (s: CareerState, d: Draft, value: string) => string;
};

const option = (label: string, detail: string, tone: Tone, value: string): Choice => ({ label, detail, tone, value });
const bump = (s: CareerState, amount: number) => { s.trust = clamp(s.trust + amount, -10, 10); };
const lift = (s: CareerState, amount: number) => { s.form = clamp(s.form + amount, -3, 3); };
const keyAttr = (s: CareerState) => {
  const weights = POSITIONS[s.pos].weights;
  let best = 0;
  for (let i = 1; i < 6; i++) if (weights[i] > weights[best] && s.attrs[i] < 97) best = i;
  return best;
};

/** 감독이 권할 만한 포지션. 지금보다 오버롤이 2 넘게 떨어지는 자리는 권하지 않아요. */
function positionMoves(s: CareerState): Pos[] {
  const now = overall(s.attrs, s.pos);
  return POSITION_MOVES[s.pos].filter((target) => overall(s.attrs, target) >= now - 2);
}

/** 아시안게임·올림픽 병역 혜택 대회에 뽑히는지. 23세 이하이거나 와일드카드급 실력이에요. */
function militaryGamesEligible(s: CareerState, ovr: number) {
  return s.nation === "KOR" && s.military === "pending" && ((s.age <= 23 && ovr >= 62) || ovr >= 74);
}

const EVENTS: Record<string, EventDef> = {
  asianGames: {
    weight: 0, priority: true,
    when: (s) => s.year >= 2030 && s.year % 4 === 2 && militaryGamesEligible(s, overall(s.attrs, s.pos)),
    card: (s) => ({
      title: `${s.year} 아시안게임 차출`,
      body: "아시안게임 대표팀에 뽑혔어요. 금메달을 따면 병역 혜택을 받아요. 대회 기간에는 소속팀 경기에 나갈 수 없어요.",
      options: [
        option("아시안게임 출전", "금메달이면 병역 면제 · 소속팀 4경기 결장", "risk", "go"),
        option("소속팀에 남기", "출전 시간 유지 · 감독 신뢰 ↑", "neutral", "stay"),
      ],
    }),
    apply: (s, d, value) => {
      if (value !== "go") { bump(s, 1); return "아시안게임 대신 소속팀에 남았어요."; }
      d.away = 4;
      const ovr = overall(s.attrs, s.pos);
      const p = 330 + (ovr >= 70 ? 150 : 50) + s.traits.clutch * 40;
      if (chance(s, p)) {
        s.military = "exempt";
        note(d, `${s.year} 아시안게임 금메달 · 병역 혜택`);
        s.flags.push(`ag-gold-${s.year}`);
        return "아시안게임 금메달을 목에 걸고 병역 혜택을 받았어요!";
      }
      const medal = chance(s, 500) ? "은메달" : "4강 탈락";
      note(d, `${s.year} 아시안게임 ${medal}`);
      return `아시안게임에서 ${medal}에 그쳤어요.`;
    },
  },
  olympics: {
    weight: 0, priority: true,
    when: (s) => (s.year + 1) % 4 === 0 && militaryGamesEligible(s, overall(s.attrs, s.pos)),
    card: (s) => ({
      title: `${s.year + 1} 올림픽 최종 명단`,
      body: "올림픽 대표팀 최종 명단에 이름이 올랐어요. 동메달 이상이면 병역 혜택을 받아요. 대회는 시즌이 끝난 뒤 열려요.",
      options: [
        option("올림픽 출전", "메달이면 병역 면제 · 휴식 부족", "risk", "go"),
        option("다음 시즌 준비", "다음 시즌 폼 ↑", "neutral", "rest"),
      ],
    }),
    apply: (s, d, value) => {
      if (value === "go") { d.olympics = true; return "올림픽 출전을 결심했어요."; }
      s.flags.push(`rested-${s.year + 1}`);
      return "올림픽 대신 다음 시즌 준비를 택했어요.";
    },
  },
  youthCup: {
    weight: 0, priority: true,
    when: (s) => (s.year + 1) % 2 === 1 && s.age <= 19 && overall(s.attrs, s.pos) >= 56,
    card: (s) => ({
      title: `${s.year + 1} U-20 월드컵 발탁`,
      body: `${NATIONS[s.nation].name} U-20 대표팀 최종 명단에 이름이 올랐어요. 대회는 시즌이 끝난 뒤 열려요. 세계 무대 경험은 성장에 큰 도움이 돼요.`,
      options: [
        option("U-20 월드컵 출전", "세계 무대 경험 · 성장 ↑ · 휴식 부족", "good", "go"),
        option("소속팀 프리시즌 준비", "다음 시즌 폼 ↑", "neutral", "rest"),
      ],
    }),
    apply: (s, d, value) => {
      if (value === "go") { d.youthCup = true; return "U-20 월드컵 출전을 결심했어요."; }
      s.flags.push(`rested-${s.year + 1}`);
      return "U-20 월드컵 대신 소속팀에서 다음 시즌을 준비하기로 했어요.";
    },
  },
  manager: {
    weight: 10,
    when: (_s, d) => !d.military,
    card: () => ({
      title: "감독 교체",
      body: "성적 부진으로 감독이 경질됐어요. 새 감독은 모든 선수를 원점에서 평가하겠다고 해요.",
      options: [
        option("가장 먼저 출근해 눈도장", "감독 신뢰 ↑ · 부상 위험 조금 ↑", "good", "eager"),
        option("평소 루틴대로 묵묵히", "실력대로 평가받아요", "neutral", "calm"),
      ],
    }),
    apply: (s, d, value) => {
      if (value === "eager") { bump(s, 3); d.risk += 2; return "새 감독에게 확실한 눈도장을 찍었어요."; }
      const gain = between(s, -1, 2);
      bump(s, gain);
      return gain > 0 ? "묵묵한 태도가 새 감독의 마음을 얻었어요." : "새 감독의 구상에서 조금 밀려났어요.";
    },
  },
  position: {
    weight: 6,
    when: (s, d) => positionMoves(s).length > 0 && s.age <= 28 && !d.military,
    card: (s) => {
      const target = pick(s, positionMoves(s));
      const now = overall(s.attrs, s.pos);
      const after = overall(s.attrs, target);
      const name = positionName(target, s.side);
      const change = after > now ? `${after}까지 올라요` : after < now ? `${after}까지 내려가요` : "그대로예요";
      return {
        title: "포지션 변경 제안",
        body: `감독이 당신을 ${name}${directionParticle(name)} 써 보고 싶어 해요. 지금 능력치라면 오버롤이 ${now}에서 ${change}.`,
        options: [
          option(`${name}${directionParticle(name)} 변신`, `오버롤 ${now} → ${after} · 감독 신뢰 ↑`, after >= now ? "good" : "risk", `move:${target}`),
          option("원래 포지션 고수", "감독 신뢰 ↓", "neutral", "keep"),
        ],
      };
    },
    apply: (s, d, value) => {
      if (value.startsWith("move:")) {
        const target = value.slice(5) as Pos;
        if (!positionMoves(s).includes(target)) throw new CareerError("포지션 선택이 올바르지 않아요.");
        s.pos = target;
        d.pos = target;
        bump(s, 3);
        // 두 시즌 동안 이 자리를 지키면 완전히 적응해요.
        s.flags.push(`moved-${d.year}:${target}`);
        const name = positionName(target, s.side);
        note(d, `${name}${directionParticle(name)} 포지션 변경`);
        return `${name}${directionParticle(name)} 새 출발을 했어요.`;
      }
      bump(s, -2);
      return "원래 포지션을 지키겠다고 감독에게 말했어요.";
    },
  },
  knock: {
    weight: 8,
    when: (s, d) => d.role !== "reserve" && s.injury === 0,
    card: (s, d) => {
      const rival = leagueOpponent(s, d);
      return {
        title: "부상 투혼?",
        body: `허벅지가 뻐근한데, 다음 경기는 시즌의 분수령인 ${rival.name}전이에요.`,
        options: [
          option("진통제를 맞고 출전", "절반은 영웅 · 절반은 부상 악화", "risk", `play:${rival.name}`),
          option("쉬면서 회복", "2경기 결장 · 위험 없음", "neutral", "rest"),
        ],
      };
    },
    apply: (s, d, value) => {
      if (value.startsWith("play:")) {
        const rival = value.slice(5);
        if (chance(s, 500 + s.traits.clutch * 100)) {
          lift(s, 2); bump(s, 2);
          note(d, `부상 투혼 · ${rival}전 맹활약`);
          return "통증을 참고 뛰며 팀을 구했어요.";
        }
        s.injury = between(s, 5, 9);
        note(d, `무리한 출전으로 부상 악화 · ${s.injury}경기 결장`);
        return "무리한 출전이 부상을 키웠어요.";
      }
      s.injury = Math.max(s.injury, 2);
      return "무리하지 않고 회복을 택했어요.";
    },
  },
  interview: {
    weight: 6,
    when: (_s, d) => d.apps >= 3,
    card: () => ({
      title: "기자회견",
      body: "기자가 \"주전 경쟁, 자신 있나요?\"라고 물어요. 한마디에 분위기가 달라질 수 있어요.",
      options: [
        option("\"제가 최고라는 걸 보여 주겠다\"", "폼이 좋으면 신뢰 ↑ · 아니면 ↓", "risk", "bold"),
        option("\"팀이 이기는 게 먼저\"", "감독 신뢰 조금 ↑", "neutral", "humble"),
      ],
    }),
    apply: (s, _d, value) => {
      if (value === "bold") {
        if (s.form >= 1) { bump(s, 2); return "자신감 넘치는 인터뷰가 화제가 됐어요."; }
        bump(s, -2);
        return "큰소리가 부메랑으로 돌아왔어요.";
      }
      bump(s, 1);
      return "겸손한 인터뷰로 감독의 신뢰를 얻었어요.";
    },
  },
  sns: {
    weight: 4,
    when: (s) => s.age <= 26,
    card: () => ({
      title: "SNS 논란",
      body: "경기 후 올린 SNS 게시물이 팬들 사이에서 논란이 됐어요.",
      options: [
        option("바로 사과문 올리기", "논란 진화 · 폼 조금 ↓", "neutral", "sorry"),
        option("경기력으로 증명하기", "절반은 반전 · 절반은 신뢰 ↓", "risk", "prove"),
      ],
    }),
    apply: (s, d, value) => {
      if (value === "sorry") { lift(s, -1); return "사과문을 올리고 논란을 정리했어요."; }
      if (chance(s, 500)) { lift(s, 2); note(d, "논란을 잠재운 골 세리머니"); return "멋진 활약으로 논란을 잠재웠어요."; }
      bump(s, -2);
      // 다음 시즌에 징계위원회가 열려요.
      s.flags.push(`scandal-${d.year}`);
      return "논란이 길어지며 출전 시간이 줄었어요.";
    },
  },
  coach: {
    weight: 6,
    when: (_s, d) => !d.military,
    card: (s) => {
      const index = keyAttr(s);
      const label = attrLabels(s.pos)[index];
      return {
        title: "개인 코치 제안",
        body: "국가대표 출신 개인 코치가 시즌 중 특별 훈련을 제안했어요. 대신 쉴 시간이 줄어요.",
        options: [
          option(`${label} 집중 특훈`, `${label} +2 · 부상 위험 조금 ↑`, "good", `train:${index}`),
          option("팀 훈련에 집중", "감독 신뢰 ↑", "neutral", "team"),
        ],
      };
    },
    apply: (s, d, value) => {
      if (value.startsWith("train:")) {
        const index = Number(value.slice(6));
        if (!Number.isInteger(index) || index < 0 || index > 5) throw new CareerError("훈련 선택이 올바르지 않아요.");
        addAttr(s, index, 2);
        d.risk += 2;
        return `${attrLabels(s.pos)[index]} 특훈으로 한 단계 성장했어요.`;
      }
      bump(s, 1);
      return "팀 훈련에 집중해 감독의 믿음을 얻었어요.";
    },
  },
  captain: {
    weight: 5,
    when: (s, d) => s.age >= 25 && d.role === "starter" && !d.loan && !d.military && seasonsAt(s, d.club) >= 2 && !s.flags.includes(`captain:${d.club}`),
    card: (s) => ({
      title: "주장 완장",
      body: `감독이 ${clubName(s.club)}의 주장 완장을 맡아 달라고 해요.`,
      options: [
        option("주장 완장을 찬다", "감독 신뢰 ↑↑ · 책임감과 부담", "good", "accept"),
        option("정중히 고사한다", "플레이에 집중 · 폼 ↑", "neutral", "decline"),
      ],
    }),
    apply: (s, d, value) => {
      if (value === "accept") {
        bump(s, 3);
        if (s.traits.clutch < 0) lift(s, -1);
        s.flags.push(`captain:${d.club}`);
        note(d, `${clubName(d.club)} 주장 선임`);
        return "주장 완장을 차고 팀을 이끌기 시작했어요.";
      }
      lift(s, 1);
      return "완장 대신 플레이에 집중하기로 했어요.";
    },
  },
  rival: {
    weight: 7,
    when: (_s, d) => (d.role === "starter" || d.role === "rotation") && !d.military && !d.loan,
    card: () => ({
      title: "경쟁자 영입",
      body: "구단이 같은 포지션에 거액을 들여 새 선수를 데려왔어요. 주전 경쟁이 시작돼요.",
      options: [
        option("훈련량을 늘려 정면 승부", "실력이 앞서면 신뢰 ↑ · 부상 위험 ↑", "risk", "fight"),
        option("에이전트에게 이적 문의", "다음 이적 시장 제안 ↑ · 신뢰 ↓", "neutral", "leave"),
      ],
    }),
    apply: (s, d, value) => {
      if (value === "fight") {
        d.risk += 2;
        if (overall(s.attrs, s.pos) >= CLUBS[d.club].rating) { bump(s, 2); return "경쟁에서 이겨 자리를 지켰어요."; }
        bump(s, -1);
        return "새 경쟁자에게 조금씩 자리를 내줬어요.";
      }
      bump(s, -2);
      s.flags.push(`market-${d.year}`);
      return "에이전트가 조용히 새 팀을 알아보기 시작했어요.";
    },
  },
  callup: {
    weight: 12,
    when: (s, d) => (d.role === "reserve" || d.role === "bench") && s.age <= 20 && !d.military,
    card: () => ({
      title: "1군 테스트",
      body: "1군 감독이 컵 대회에서 당신을 시험해 보려 해요. 눈도장을 찍을 기회예요.",
      options: [
        option("모든 걸 보여 준다", "눈도장 아니면 긴장한 실수", "risk", "all"),
        option("차분하게 기본기 위주로", "감독 신뢰 조금 ↑", "neutral", "safe"),
      ],
    }),
    apply: (s, _d, value) => {
      if (value === "all") {
        if (chance(s, 550 + s.traits.pro * 60)) { bump(s, 3); lift(s, 1); return "1군 감독의 눈에 확실히 들었어요."; }
        bump(s, -1);
        return "긴장한 탓에 실수가 잦았어요.";
      }
      bump(s, 1);
      return "실수 없는 플레이로 가능성을 보여 줬어요.";
    },
  },
  national: {
    weight: 6,
    when: (s, d) => !d.military && overall(s.attrs, s.pos) >= NATIONS[s.nation].callup,
    card: (s) => ({
      title: "대표팀 차출",
      body: `${NATIONS[s.nation].name} 대표팀이 친선 경기에 당신을 불렀어요. 구단은 휴식을 원해요.`,
      options: [
        option("대표팀에 합류한다", "A매치 +2 · 피로 누적", "risk", "go"),
        option("구단에 남아 회복한다", "감독 신뢰 ↑", "neutral", "stay"),
      ],
    }),
    apply: (s, d, value) => {
      if (value === "go") { d.extraCaps += 2; d.risk += 2; return "대표팀 친선 경기에 합류했어요."; }
      bump(s, 2);
      return "구단에 남아 컨디션을 끌어올렸어요.";
    },
  },
  mentor: {
    weight: 6,
    when: (s) => s.age <= 22,
    card: () => ({
      title: "베테랑의 제안",
      body: "팀의 베테랑이 훈련이 끝난 뒤 따로 남아 함께 운동하자고 해요.",
      options: [
        option("매일 남아서 배운다", "잠재력이 깨어날지도 몰라요", "good", "learn"),
        option("동료들과 어울린다", "폼 ↑", "neutral", "friends"),
      ],
    }),
    apply: (s, d, value) => {
      if (value === "learn") {
        if (chance(s, 300 + s.traits.pro * 100)) {
          s.potential = Math.min(99, s.potential + 2);
          note(d, "베테랑과의 특훈 · 잠재력 각성");
          return "베테랑의 노하우를 흡수하며 한계를 넓혔어요.";
        }
        addAttr(s, keyAttr(s), 1);
        return "기본기가 한층 단단해졌어요.";
      }
      lift(s, 1);
      return "동료들과 끈끈해지며 분위기가 올라왔어요.";
    },
  },
  agent: {
    weight: 4,
    when: (s) => s.age >= 20 && s.age <= 30 && !s.flags.some((flag) => flag.startsWith("agent")),
    card: () => ({
      title: "슈퍼 에이전트",
      body: "유명 슈퍼 에이전트가 계약을 제안했어요. 더 큰 구단과 연결해 주겠대요.",
      options: [
        option("계약한다", "이적 제안 ↑ · 감독 신뢰 ↓", "neutral", "sign"),
        option("지금 에이전트와 의리", "폼 ↑", "neutral", "loyal"),
      ],
    }),
    apply: (s, d, value) => {
      if (value === "sign") {
        // 두 시즌쯤 지나면 에이전트가 이적을 밀어붙여요.
        s.flags.push("agent", `agent-${d.year}`);
        bump(s, -1);
        return "슈퍼 에이전트와 손을 잡았어요.";
      }
      lift(s, 1);
      return "지금 에이전트와 의리를 지켰어요.";
    },
  },
  agentPush: {
    weight: 14, followUp: true,
    when: (s, d) => s.flags.includes("agent") && !s.flags.includes("agent-push") && !d.loan && !d.military && s.age <= 32
      && s.flags.some((flag) => /^agent-\d{4}$/.test(flag) && Number(flag.slice(6)) <= d.year - 2),
    card: () => ({
      title: "에이전트의 압박",
      body: "슈퍼 에이전트가 더 큰 계약을 위해 이적을 밀어붙여요. 거절하면 관계가 끝날 수도 있어요.",
      options: [
        option("에이전트를 따른다", "다음 이적 시장에 거액 제안 · 감독 신뢰 ↓↓", "risk", "follow"),
        option("에이전트와 결별한다", "이적 제안 보너스가 사라져요 · 폼 ↑", "neutral", "split"),
      ],
    }),
    apply: (s, d, value) => {
      s.flags.push("agent-push");
      if (value === "follow") {
        s.flags.push(`agentdeal-${d.year}`);
        bump(s, -3);
        return "에이전트의 뜻에 따라 이적 시장에 나서기로 했어요.";
      }
      s.flags = s.flags.filter((flag) => flag !== "agent");
      lift(s, 1);
      return "에이전트와 결별하고 축구에만 집중하기로 했어요.";
    },
  },
  renewal: {
    weight: 6,
    when: (s, d) => d.role === "starter" && s.contract <= 2 && !d.loan && !d.military,
    card: () => ({
      title: "장기 재계약 제안",
      body: "구단이 5년 장기 재계약을 제안했어요. 서명하면 당분간 이적 제안이 줄어요.",
      options: [
        option("5년 재계약", "감독 신뢰 ↑ · 이적 제안 ↓", "good", "sign"),
        option("시즌 끝나고 결정", "이적 시장에서 몸값 확인", "neutral", "wait"),
      ],
    }),
    apply: (s, d, value) => {
      if (value === "sign") {
        s.contract = 6;
        bump(s, 2);
        s.flags.push(`loyal-${d.year}`);
        return "5년 장기 재계약에 서명했어요.";
      }
      return "재계약은 시즌이 끝나고 생각하기로 했어요.";
    },
  },
  crisis: {
    weight: 6,
    when: (_s, d) => (d.role === "bench" || d.role === "rotation") && !d.military,
    card: () => ({
      title: "부상 병동",
      body: "팀에 부상자가 쏟아졌어요. 감독이 당신에게 출전 시간을 더 주려 해요.",
      options: [
        option("모든 경기 풀타임", "출전 ↑↑ · 부상 위험 큼", "risk", "all"),
        option("체력 안배를 요청", "출전 조금 ↑", "neutral", "pace"),
      ],
    }),
    apply: (s, d, value) => {
      if (value === "all") {
        d.roleFloor = "starter";
        d.risk += 4;
        bump(s, 2);
        return "빈자리를 메우며 매 경기 풀타임을 뛰었어요.";
      }
      d.roleFloor = "rotation";
      bump(s, 1);
      return "체력을 아끼며 꾸준히 기회를 받았어요.";
    },
  },
  derby: {
    weight: 6,
    when: (_s, d) => d.role === "starter" || d.role === "rotation",
    card: (s, d) => {
      const club = CLUBS[d.club];
      const rivals = clubsIn(club.league).filter((other) => other.id !== club.id && other.id !== MILITARY_CLUB);
      const rival = rivals.reduce((best, other) => (Math.abs(other.rating - club.rating) < Math.abs(best.rating - club.rating) ? other : best), rivals[0]);
      return {
        title: "라이벌 더비",
        body: `라이벌 ${rival.name}전 더비가 다가와요. 팬들의 기대가 하늘을 찔러요.`,
        options: [
          option("내가 해결한다", "영웅 아니면 역적", "risk", `hero:${rival.name}`),
          option("팀 전술에 충실하게", "감독 신뢰 조금 ↑", "neutral", "team"),
        ],
      };
    },
    apply: (s, d, value) => {
      if (value.startsWith("hero:")) {
        const rival = value.slice(5);
        if (chance(s, 420 + s.traits.clutch * 100 + d.clutch * 60)) {
          lift(s, 2); bump(s, 1);
          note(d, d.pos === "GK" ? `${rival}전 더비 선방 쇼` : `${rival}전 더비 결승골`);
          return "더비의 영웅이 됐어요!";
        }
        lift(s, -1);
        return "더비에서 고개를 숙였어요.";
      }
      bump(s, 1);
      return "전술에 충실한 플레이로 감독의 믿음을 얻었어요.";
    },
  },
  abroad: {
    weight: 8,
    when: (s, d) => LEAGUES[CLUBS[d.club].league].region !== "europe" && s.age <= 25 && overall(s.attrs, s.pos) >= 66
      && !d.loan && !d.military && !s.flags.some((flag) => flag.startsWith("abroad-")),
    card: () => ({
      title: "유럽 스카우트 방문",
      body: "유럽 구단 스카우트들이 다음 경기를 보러 온대요. 해외 진출의 기회가 될 수 있어요.",
      options: [
        option("모든 걸 보여 준다", "다음 이적 시장에 유럽 구단 제안 · 감독 신뢰 조금 ↓", "good", "go"),
        option("지금 팀에서 더 성장한다", "감독 신뢰 ↑", "neutral", "stay"),
      ],
    }),
    apply: (s, d, value) => {
      if (value === "go") {
        s.flags.push(`abroad-${d.year}`);
        bump(s, -1);
        note(d, "유럽 스카우트 앞에서 맹활약");
        return "유럽 스카우트들의 수첩에 이름을 올렸어요.";
      }
      bump(s, 2);
      return "지금 팀에서 더 성장하기로 했어요.";
    },
  },
  bigclub: {
    weight: 7,
    when: (s, d) => d.role === "starter" && !d.loan && !d.military && s.age >= 20 && s.age <= 31
      && overall(s.attrs, s.pos) >= CLUBS[d.club].rating + 3 && biggerClubs(s, d.club).length > 0,
    card: () => ({
      title: "빅클럽 이적설",
      body: "더 큰 구단이 당신을 노린다는 기사가 쏟아졌어요. 팬들은 남아 달라고 외쳐요.",
      options: [
        option("이적을 원한다고 밝힌다", "다음 이적 시장에 빅클럽 제안 · 감독 신뢰 ↓↓", "risk", "go"),
        option("남겠다고 약속한다", "감독 신뢰 ↑↑ · 이적 제안 ↓", "neutral", "stay"),
      ],
    }),
    apply: (s, d, value) => {
      if (value === "go") { s.flags.push(`bigclub-${d.year}`); bump(s, -3); return "빅클럽 이적을 원한다고 공개적으로 밝혔어요."; }
      bump(s, 3);
      s.flags.push(`loyal-${d.year}`);
      return "팬들 앞에서 남겠다고 약속했어요.";
    },
  },
  locker: {
    weight: 5,
    when: (_s, d) => d.apps >= 3 && !d.military,
    card: (s, d) => ({
      title: "라커룸 불화",
      body: "선수단 일부가 감독의 훈련 방식에 반발하고 있어요. 모두가 당신의 선택을 지켜봐요.",
      options: [
        option("감독 편에 선다", "감독 신뢰 ↑↑ · 동료들과 서먹해져 폼 ↓", "neutral", "coach"),
        option("동료들 편에 선다", "팀 분위기 살아나 폼 ↑↑ · 감독 신뢰 ↓", "neutral", "team"),
        // 주장 완장을 찼다면 중재할 수 있어요.
        ...(s.flags.includes(`captain:${d.club}`) ? [option("주장으로서 중재한다", "감독 신뢰 ↑ · 폼 ↑", "good", "captain")] : []),
      ],
    }),
    apply: (s, _d, value) => {
      if (value === "captain") { bump(s, 1); lift(s, 1); return "주장으로서 양쪽을 다독여 라커룸을 하나로 묶었어요."; }
      if (value === "coach") { bump(s, 3); lift(s, -1); return "감독 편에 서서 신뢰를 얻었지만 동료들과는 서먹해졌어요."; }
      lift(s, 2);
      bump(s, -2);
      return "동료들과 뭉쳐 분위기를 살렸지만 감독의 눈 밖에 났어요.";
    },
  },
  veteran: {
    weight: 7,
    when: (s, d) => s.age >= 31 && !d.military,
    card: () => ({
      title: "베테랑의 역할",
      body: "구단이 팀의 어린 유망주를 맡아 이끌어 달라고 부탁해요.",
      options: [
        option("멘토 역할을 맡는다", "감독 신뢰 ↑ · 노쇠화를 조금 늦춰요", "good", "mentor"),
        option("내 경기력에 집중한다", "폼 ↑", "neutral", "focus"),
      ],
    }),
    apply: (s, d, value) => {
      if (value === "mentor") {
        bump(s, 2);
        d.care = true;
        // 두 시즌 뒤 후배가 자라 돌아와요.
        s.flags.push(`mentor-${d.year}`);
        note(d, "후배 유망주의 멘토로 활약");
        return "후배를 이끌며 라커룸의 기둥이 됐어요.";
      }
      lift(s, 1);
      return "자기 경기력 관리에 집중했어요.";
    },
  },

  // ---------- 앞선 선택이 돌아오는 사건 ----------
  surgery: {
    weight: 0, priority: true,
    when: (s, d) => d.major && s.injury >= 10,
    card: () => ({
      title: "수술대에 오를까?",
      body: "큰 부상으로 오래 쉬어야 해요. 수술을 받으면 확실히 회복하지만 복귀가 늦어지고, 재활로 버티면 빨리 돌아오지만 후유증이 남을 수 있어요.",
      options: [
        option("수술을 받는다", "결장 5경기 더 · 후유증 없음", "good", "surgery"),
        option("재활로 버틴다", "결장 절반 · 후유증과 재발 위험", "risk", "rehab"),
      ],
    }),
    apply: (s, d, value) => {
      if (value === "surgery") {
        s.injury += 5;
        d.major = false;
        note(d, "수술을 받고 완벽한 회복을 택했어요");
        return "수술로 확실한 회복을 택했어요.";
      }
      s.injury = Math.trunc(s.injury / 2);
      d.risk += 5;
      note(d, "재활로 버티며 빠른 복귀를 택했어요");
      return "재활로 버티며 빠른 복귀를 택했어요.";
    },
  },
  discipline: {
    weight: 20, followUp: true,
    when: (s, d) => s.flags.includes(`scandal-${d.year - 1}`) && !d.military,
    card: () => ({
      title: "징계위원회",
      body: "지난 시즌 SNS 논란으로 구단 징계위원회가 열렸어요. 태도에 따라 징계 수위가 달라져요.",
      options: [
        option("공개 사과한다", "징계 경감 · 감독 신뢰 조금 ↑", "neutral", "sorry"),
        option("끝까지 버틴다", "3경기 출전 정지 · 팬들이 편들 수도", "risk", "resist"),
      ],
    }),
    apply: (s, d, value) => {
      if (value === "sorry") { bump(s, 1); return "공개 사과로 징계를 줄이고 논란을 마무리했어요."; }
      d.away += 3;
      if (chance(s, 400)) {
        lift(s, 2);
        note(d, "출전 정지 속에서도 팬들의 응원 걸개");
        return "출전 정지를 받았지만 팬들이 끝까지 편을 들어 줬어요.";
      }
      bump(s, -2);
      return "출전 정지에 감독과의 사이까지 틀어졌어요.";
    },
  },
  fanAnger: {
    weight: 16, followUp: true,
    when: (s, d) => s.flags.includes(`bigclub-${d.year - 1}`) && s.history.at(-1)?.club === d.club && !d.military,
    card: () => ({
      title: "등 돌린 팬들",
      body: "이적을 원한다고 했던 당신이 팀에 남자 홈 팬들의 야유가 쏟아져요.",
      options: [
        option("실력으로 마음을 돌린다", "폼이 좋으면 신뢰 회복 · 아니면 폼 ↓", "risk", "prove"),
        option("팬들에게 사과한다", "감독 신뢰 조금 ↑", "neutral", "sorry"),
      ],
    }),
    apply: (s, d, value) => {
      if (value === "sorry") { bump(s, 1); return "팬들 앞에서 고개를 숙이고 다시 시작했어요."; }
      if (s.form >= 1) {
        bump(s, 2);
        note(d, "야유를 환호로 바꾼 활약");
        return "멋진 활약으로 야유를 환호로 바꿨어요.";
      }
      lift(s, -1);
      return "야유 속에 부담감이 커졌어요.";
    },
  },
  loyalLegend: {
    weight: 10,
    when: (s, d) => !d.loan && !d.military && !s.flags.some((flag) => flag.startsWith("legend:"))
      && (seasonsAt(s, d.club) >= 6 || (seasonsAt(s, d.club) >= 4 && s.flags.some((flag) => flag.startsWith("loyal-")))),
    card: (s, d) => ({
      title: "클럽의 상징",
      body: `오랫동안 ${clubName(d.club)}의 유니폼을 입은 당신에게 구단이 특별한 대우를 약속해요.`,
      options: [
        option("이 팀에서 은퇴하겠다고 약속한다", "감독 신뢰 ↑↑ · 여기서 은퇴하면 영구 결번", "good", "promise"),
        option("더 큰 도전을 남겨 둔다", "폼 ↑", "neutral", "open"),
      ],
    }),
    apply: (s, d, value) => {
      if (value === "promise") {
        bump(s, 3);
        s.flags.push(`legend:${d.club}`);
        note(d, `${clubName(d.club)} 영구 결번 약속`);
        return "이 팀에서 커리어를 마치겠다고 약속했어요.";
      }
      lift(s, 1);
      return "아직 더 큰 무대를 꿈꾸기로 했어요.";
    },
  },

  // ---------- 라이벌 ----------
  rivalClash: {
    weight: 10,
    when: (s, d) => s.rival.retiredAge === null && s.rival.club !== d.club && CLUBS[s.rival.club].league === CLUBS[d.club].league
      && (d.role === "starter" || d.role === "rotation"),
    card: (s) => ({
      title: "라이벌 맞대결",
      body: `다음 경기는 라이벌 ${s.rival.name}의 ${clubName(s.rival.club)}전이에요. 언론은 '세기의 맞대결'이라며 떠들썩해요.`,
      options: [
        option("정면 승부를 건다", "이기면 폼 ↑↑ · 지면 폼 ↓", "risk", "duel"),
        option("팀 승리에 집중한다", "감독 신뢰 ↑", "neutral", "team"),
      ],
    }),
    apply: (s, d, value) => {
      const rv = s.rival;
      if (value === "duel") {
        if (chance(s, clamp(450 + s.traits.clutch * 100 + (overall(s.attrs, s.pos) - rv.ovr) * 15, 150, 850))) {
          rv.h2h.won++;
          lift(s, 2);
          note(d, `라이벌 ${rv.name}${withParticle(rv.name)}의 정면 승부 완승`);
          return `라이벌 ${rv.name}${withParticle(rv.name)}의 맞대결에서 완승했어요.`;
        }
        rv.h2h.lost++;
        lift(s, -1);
        return `라이벌 ${rv.name}에게 판정패했어요.`;
      }
      bump(s, 1);
      return "개인 대결보다 팀 승리에 집중했어요.";
    },
  },
  rivalPress: {
    weight: 6,
    when: (s) => s.rival.retiredAge === null && s.age >= 20 && !!s.history.at(-1)?.rival
      && (s.history.at(-1)!.rival!.ovr > overall(s.attrs, s.pos) || s.history.at(-1)!.rival!.goals > s.history.at(-1)!.goals),
    card: (s) => {
      const last = s.history.at(-1)!.rival!;
      return {
        title: "라이벌과의 비교",
        body: `언론이 매주 당신과 라이벌 ${s.rival.name}${objectParticle(s.rival.name)} 비교해요. 지난 시즌 ${s.rival.name}: ${clubName(last.club)} · ${s.rival.pos === "GK" ? `${last.apps}경기` : `${last.goals}골`} · 오버롤 ${last.ovr}.`,
        options: [
          option("실력으로 답하겠다", "핵심 능력치 +1 · 부상 위험 조금 ↑", "good", "answer"),
          option("내 길을 간다", "폼 ↑", "neutral", "own"),
        ],
      };
    },
    apply: (s, d, value) => {
      if (value === "answer") {
        addAttr(s, keyAttr(s), 1);
        d.risk += 2;
        return "비교 기사를 오려 붙여 두고 훈련량을 늘렸어요.";
      }
      lift(s, 1);
      return "비교에 흔들리지 않고 내 길을 가기로 했어요.";
    },
  },
  rivalBallon: {
    weight: 14, followUp: true,
    when: (s) => s.history.at(-1)?.rival?.ballon === 1 && s.history.at(-1)?.ballon !== 1,
    card: (s) => ({
      title: "라이벌의 발롱도르",
      body: `라이벌 ${s.rival.name}의 발롱도르 수상 소식이 들려와요. 마음이 복잡해요.`,
      options: [
        option("이를 악물고 훈련한다", "핵심 능력치 +2 · 부상 위험 ↑", "good", "grind"),
        option("진심으로 축하를 건넨다", "폼 ↑ · 감독 신뢰 ↑", "neutral", "cheer"),
      ],
    }),
    apply: (s, d, value) => {
      if (value === "grind") {
        addAttr(s, keyAttr(s), 2);
        d.risk += 3;
        return "라이벌의 트로피를 자극 삼아 이를 악물었어요.";
      }
      lift(s, 1);
      bump(s, 1);
      return "라이벌에게 축하를 건네며 마음을 다잡았어요.";
    },
  },
  rivalTeammate: {
    weight: 20, followUp: true,
    // 처음 한 팀이 된 시즌에만 나와요.
    when: (s, d) => s.rival.retiredAge === null && s.rival.club === d.club && !d.military
      && !(s.history.at(-1)?.club === d.club && s.history.at(-1)?.rival?.club === d.club),
    card: (s, d) => ({
      title: "라이벌과 한 팀",
      body: s.history.at(-1)?.club === d.club
        ? `라이벌 ${s.rival.name}의 이적이 확정됐어요. 이제 같은 팀이에요.`
        : `새 팀의 라커룸에서 라이벌 ${s.rival.name}${objectParticle(s.rival.name)} 마주쳤어요. 이제 같은 팀이에요.`,
      options: [
        option("주전 경쟁을 선언한다", "실력이 앞서면 신뢰 ↑↑ · 아니면 신뢰 ↓", "risk", "compete"),
        option("최고의 파트너가 된다", "폼 ↑ · 팀 전력 ↑", "good", "partner"),
      ],
    }),
    apply: (s, d, value) => {
      if (value === "compete") {
        if (overall(s.attrs, s.pos) >= s.rival.ovr) { bump(s, 3); return "라이벌과의 주전 경쟁에서 앞서 나갔어요."; }
        bump(s, -2);
        return "라이벌에게 주전 자리를 내줬어요.";
      }
      lift(s, 1);
      d.teamForm += 2;
      note(d, `라이벌 ${s.rival.name}${withParticle(s.rival.name)} 환상의 호흡`);
      return "라이벌과 손을 잡고 팀을 끌어올렸어요.";
    },
  },
};

/** 지금 구단보다 확실히 큰 유럽 구단 가운데 이 선수를 원할 만한 곳 */
function biggerClubs(s: CareerState, clubId: string): ClubInfo[] {
  const ovr = overall(s.attrs, s.pos);
  const current = CLUBS[clubId].rating;
  return Object.values(CLUBS).filter((club) => club.id !== clubId && club.id !== MILITARY_CLUB && club.rating >= current + 3
    && club.rating <= ovr + 4 && LEAGUES[club.league].region === "europe");
}

function seasonsAt(s: CareerState, club: string): number {
  let count = 0;
  for (let i = s.history.length - 1; i >= 0 && s.history[i].club === club; i--) count++;
  return count;
}

function midSeasonEvent(s: CareerState, d: Draft): Decision | null {
  const ids = Object.keys(EVENTS);
  const priority = ids.find((id) => EVENTS[id].priority && EVENTS[id].when(s, d));
  let id: string | undefined = priority;
  if (!id) {
    const followUps = ids.filter((key) => EVENTS[key].followUp && EVENTS[key].when(s, d));
    if (followUps.length && chance(s, 750)) id = pick(s, followUps);
  }
  if (!id) {
    // 첫 시즌에는 늘 사건이 있어서 처음부터 고를 거리가 생겨요.
    if (s.history.length > 0 && !chance(s, 720)) return null;
    const eligible = ids.filter((key) => !EVENTS[key].priority && !s.recent.includes(key) && EVENTS[key].when(s, d));
    const index = weightedIndex(s, eligible.map((key) => EVENTS[key].weight));
    if (index < 0) return null;
    id = eligible[index];
  }
  s.recent = [id, ...s.recent].slice(0, 3);
  const card = EVENTS[id].card(s, d);
  return { kind: "event", id, title: card.title, body: card.body, options: card.options };
}

/** 시즌 중반에 출전 시간을 다시 정해요. 사건으로 바뀐 감독 신뢰와 폼이 바로 반영돼요. */
function halfTime(s: CareerState, d: Draft) {
  const ovr = overall(s.attrs, s.pos);
  const before = d.role;
  d.role = betterRole(roleFor(s, ovr, CLUBS[d.club].rating), d.roleFloor);
  const role = roleName(d.role, d.age);
  if (ROLE_RANK[d.role] > ROLE_RANK[before]) note(d, `시즌 중반 ${role}${directionParticle(role)} 도약`);
  else if (ROLE_RANK[d.role] < ROLE_RANK[before] && d.role !== "reserve") note(d, `시즌 중반 ${role}${directionParticle(role)} 밀려남`);
}

/**
 * 지금 경기일부터 시즌을 이어서 진행해요. 전반기 → 시즌 중 사건 → 후반기 → 대표팀 → 시즌 마무리 순서이고,
 * 결정이 필요하면(사건, 결정적 순간) 그 자리에서 멈췄다가 고른 뒤 다시 불려요.
 */
function advance(s: CareerState, d: Draft) {
  const half = Math.floor(d.games / 2);
  if (d.t < half) {
    simulateUntil(s, d, half);
    if (s.pending) return;
    const event = midSeasonEvent(s, d);
    if (event) {
      s.phase = "event";
      s.pending = event;
      return;
    }
    halfTime(s, d);
  }
  simulateUntil(s, d, d.games);
  if (s.pending) return;
  if (!d.nt) nationalStage(s, d);
  if (s.pending) return;
  endSeason(s, d);
}

/** 결정적 순간의 선택을 반영하고 결과를 시즌 기록에 남겨요. */
function settleMoment(s: CareerState, d: Draft, value: string) {
  const m = d.moment;
  if (!m) throw new CareerError("진행 중인 결정적 순간이 없어요.");
  const { won, text } = resolveMoment(s, d, m, value);
  d.moment = null;
  const headline = `${m.name} 결승 · ${text} · ${won ? "우승!" : "준우승"}`;
  d.highlights.push(headline);
  s.lastMoment = headline;
  if (m.comp === "cup") {
    d.cup = won ? 6 : 5;
    if (!won) d.cupAlive = false;
  } else if (m.comp === "cont") {
    d.cont = won ? 6 : 5;
    if (!won) d.contAlive = false;
  } else if (d.tour && d.nt) {
    addTournament(d.nt, finishTournament(s, d.tour, won));
    d.tour = null;
  }
}

// ---------- 시즌 마무리 ----------

type TournamentResult = { label: string; trophy: Honor | null; awards: Honor[]; points: number; caps: number; goals: number };

/**
 * 대표팀 대회를 치러요. d를 넘기면 결승에서 결정적 순간이 나올 수 있고, 그때는 d.tour에 진행 상태를 남기고 null을 돌려줘요.
 * 남은 결승은 finishTournament가 마무리해요.
 */
function playTournament(s: CareerState, d: Draft | null, code: keyof typeof TOURNAMENTS, key: boolean, ovr: number, year: number): TournamentResult | null {
  const tournament = TOURNAMENTS[code];
  const nation = NATIONS[s.nation];
  // U-20 월드컵은 또래끼리 겨뤄서 전력과 골 기준을 낮춰 봐요.
  const youth = code === "youth";
  const base = youth ? nation.rating - 2 : nation.rating;
  const strength = base + (key ? clamp(Math.trunc((ovr - (youth ? 60 : nation.rating)) / 3), 0, 4) : 0) + between(s, -3, 3);
  const quality = Math.max(250, 1000 + (ovr - (youth ? 68 : 75)) * 30);
  const run: TournamentRun = { code, year, key, caps: 0, goals: 0, reached: -1, finalScored: 0 };
  let played = false;
  const match = (oppRating: number) => {
    played = chance(s, key ? 950 : 500);
    if (!played) return 0;
    run.caps++;
    const edge = clamp(1000 + (strength - oppRating) * 15, 500, 1500);
    const scored = count(s, Math.trunc(((POSITIONS[s.pos].goal * quality) / 1000) * edge / 1000), 4);
    run.goals += scored;
    return scored;
  };
  let groupGoals = 0;
  for (let i = 0; i < 3; i++) groupGoals += match(tournament.group);
  if (!chance(s, clamp(450 + (strength - tournament.group) * 45 + groupGoals * 40, 100, 960))) return finishTournament(s, run, false);
  let won = false;
  for (let round = 0; round < tournament.opp.length; round++) {
    run.reached = round;
    const scored = match(tournament.opp[round]);
    const final = round === tournament.opp.length - 1;
    const p = clamp(500 + (strength - tournament.opp[round]) * 35 + scored * 110 + (final ? s.traits.clutch * 40 : 0), 60, 940);
    if (final && d && !youth && key) {
      run.finalScored = scored;
      const opponent = NATIONS[pick(s, NATION_ORDER.filter((code) => code !== s.nation))].name;
      if (startMoment(s, d, "nt", `${year} ${tournament.name}`, opponent, p, played)) {
        d.tour = run;
        return null;
      }
    }
    if (!chance(s, p)) break;
    if (final) won = true;
  }
  return finishTournament(s, run, won);
}

/** 대회 성적을 이름표·트로피·개인상으로 정리해요. reached가 -1이면 조별리그 탈락이에요. */
function finishTournament(s: CareerState, run: TournamentRun, won: boolean): TournamentResult {
  const tournament = TOURNAMENTS[run.code];
  const youth = run.code === "youth";
  const isWorldCup = run.code === "worldcup";
  const name = `${run.year} ${tournament.name}`;
  if (run.reached < 0) return { label: `${name} 조별리그 탈락`, trophy: null, awards: [], points: 0, caps: run.caps, goals: run.goals };
  const finalRound = tournament.opp.length - 1;
  const label = won ? `${name} 우승` : run.reached === finalRound ? `${name} 준우승` : `${name} ${tournament.rounds[run.reached]}`;
  const awards: Honor[] = [];
  if (run.key && (won || run.reached === finalRound) && chance(s, (won ? 280 : 110) + run.goals * 60)) {
    awards.push({ label: `${name} 골든볼`, points: isWorldCup ? 150 : youth ? 30 : 70 });
  }
  if (run.goals >= (isWorldCup ? 5 : 4) + int(s, 3)) awards.push({ label: `${name} 득점왕`, points: isWorldCup ? 90 : youth ? 20 : 40 });
  const trophyPoints = isWorldCup ? 300 : youth ? 40 : run.code === "asia" ? 90 : 140;
  // 발롱도르 평가에 더하는 값. 유소년 대회는 넣지 않아요.
  const points = youth ? 0 : won ? (isWorldCup ? 120 : 50) : run.reached === finalRound ? (isWorldCup ? 50 : 20) : run.reached >= finalRound - 1 ? (isWorldCup ? 25 : 10) : 0;
  return { label, trophy: won ? { label: `${name} 우승`, points: trophyPoints } : null, awards, points, caps: run.caps, goals: run.goals };
}

function addTournament(result: NationalResult, tournament: TournamentResult) {
  result.caps += tournament.caps;
  result.goals += tournament.goals;
  result.tournaments.push(tournament.label);
  if (tournament.trophy) result.trophies.push(tournament.trophy);
  result.awards.push(...tournament.awards);
  result.points += tournament.points;
}

/** 나이별 기본 성장. 전성기 몇 해 전까지는 빠르게 크고, 전성기가 지나면 조금씩 떨어져요. */
function growthByAge(yearsToPeak: number): number {
  return yearsToPeak >= 8 ? 6 : yearsToPeak >= 6 ? 5 : yearsToPeak >= 4 ? 4 : yearsToPeak >= 2 ? 3 : yearsToPeak >= 0 ? 1
    : yearsToPeak >= -2 ? 0 : yearsToPeak >= -4 ? -1 : yearsToPeak >= -6 ? -2 : -3 + (yearsToPeak + 7);
}

/**
 * 라이벌의 한 시즌. 라이벌만의 난수로 출전·골·우승·성장·이적·은퇴를 정하고, 발롱도르 평가 점수를 돌려줘요.
 * 내 선택이 라이벌의 운을 바꾸지 않도록 난수를 따로 써요.
 */
function rivalSeason(d: Draft, rv: Rival): { season: RivalSeason; score: number } | null {
  if (rv.retiredAge !== null) return null;
  const r: Rng = { rng: rv.rng };
  const club = CLUBS[rv.club];
  const league = LEAGUES[club.league];
  const gap = rv.ovr - club.rating;
  const share = gap >= -1 ? 88 : gap >= -5 ? 58 : gap >= -10 ? 28 : 6;
  const minutes = gap >= -1 ? 82 : gap >= -5 ? 62 : 38;
  const games = league.games + 8;
  const apps = clamp(Math.trunc((games * share) / 100) + between(r, -3, 3), 0, games);
  const info = POSITIONS[rv.pos];
  const quality = Math.max(250, 1000 + (rv.ovr - 75) * 30);
  const edge = clamp(1000 + (club.rating - leagueAverage(club.league)) * 15, 600, 1400);
  const expect = (base: number) => Math.trunc(((((base * quality) / 1000) * edge) / 1000) * apps * minutes / 90 / 1000);
  const goals = Math.max(0, expect(info.goal) + between(r, -2, 2));
  const assists = Math.max(0, expect(info.assist) + between(r, -2, 2));

  // 팀 성적. 리그에서 전력이 높은 구단일수록, 라이벌이 주전으로 활약할수록 우승에 가까워요.
  const above = clubsIn(club.league).filter((other) => other.id !== MILITARY_CLUB && other.rating > club.rating).length;
  const starter = share >= 58;
  const trophies: string[] = [];
  let teamPoints = 0;
  if (apps >= 8 && chance(r, clamp((above === 0 ? 380 : above <= 2 ? 150 : 30) + (starter ? clamp(gap, -2, 6) * 20 : 0), 10, 700))) {
    trophies.push(`${league.name} 우승`);
    teamPoints += Math.trunc((60 * league.prestige) / 100);
  }
  if (chance(r, above <= 2 ? 120 : 50)) {
    trophies.push(`${league.cup} 우승`);
    teamPoints += 15;
  }
  if (league.continental && qualifiesByRating(club.id)) {
    const comp = CONTINENTALS[league.continental];
    const base = league.continental === "ucl" ? (club.rating >= 88 ? 140 : club.rating >= 85 ? 70 : club.rating >= 82 ? 25 : 5) : 150;
    if (chance(r, base + (starter ? clamp(gap, 0, 6) * 10 : 0))) {
      trophies.push(`${comp.name} 우승`);
      teamPoints += comp.weight;
    }
  }

  // 발롱도르 평가. 나와 같은 기준이고, 폼(+2)과 빅클럽 주전의 화제성을 더해 진짜 경쟁자가 돼요.
  const rating = 68 + clamp(Math.trunc(gap / 3), -4, 5) + clamp(Math.trunc((rv.ovr - 70) / 6), -3, 5) + Math.trunc((goals * 8 + assists * 5) / Math.max(apps, 1));
  const output = ["ST", "WG", "AM"].includes(rv.pos) ? goals * 4 + assists * 3 : rv.pos === "GK" ? 0 : goals * 5 + assists * 4;
  const played = Math.trunc(((Math.max(0, rating - 60) * 6 + output) * Math.min(apps, 30)) / 30);
  const hype = starter && club.rating >= 84 ? between(r, 20, 150) : 0;
  const score = apps >= 15 ? Math.trunc((played * (100 + league.prestige)) / 200) + teamPoints + hype : 0;

  // 성장과 노쇠
  let growth = growthByAge(rv.peakAge - d.age);
  if (growth > 0) {
    growth = Math.trunc((growth * (60 + Math.trunc(share / 2)) + 50) / 100) + between(r, -1, 1);
    const room = rv.potential - rv.ovr;
    growth = room <= 0 ? Math.min(growth, 0) : Math.min(growth, room);
  } else growth = Math.min(growth + between(r, -1, 1), 0);
  rv.ovr = clamp(rv.ovr + growth, 40, 99);
  rv.best = Math.max(rv.best, rv.ovr);
  rv.apps += apps;
  rv.goals += goals;
  rv.assists += assists;
  rv.trophies += trophies.length;

  // 실력이 구단을 넘어서면 더 큰 구단으로, 한참 처지면 작은 구단으로 옮겨요.
  let moved: string | null = null;
  const pool = d.age <= 30 && rv.ovr >= club.rating + 3
    ? Object.values(CLUBS).filter((item) => item.rating >= rv.ovr - 4 && item.rating <= rv.ovr + 1 && (rv.ovr < 75 || LEAGUES[item.league].region === "europe"))
    : rv.ovr <= club.rating - 7 ? Object.values(CLUBS).filter((item) => item.rating >= rv.ovr - 2 && item.rating <= rv.ovr + 3) : [];
  const targets = pool.filter((item) => item.id !== club.id && item.id !== MILITARY_CLUB);
  if (targets.length) {
    const target = targets[weightedIndex(r, targets.map((item) => Math.max(1, item.rating - rv.ovr + 6)))];
    rv.club = target.id;
    moved = `${target.name} 이적`;
  }
  let retired = false;
  if (d.age + 1 >= 38 || (d.age + 1 >= 34 && rv.ovr < 76 && chance(r, 500))) {
    rv.retiredAge = d.age + 1;
    retired = true;
  }
  rv.rng = r.rng;
  return { season: { club: club.id, ovr: rv.ovr, apps, goals, assists, trophies, ballon: 0, meeting: null, moved, retired }, score };
}

/**
 * 시즌이 끝날 때 대표팀 일정을 치러요. 결과는 d.nt에 담고, 대회 결승에서 결정적 순간이 나오면 멈춰요.
 * 시즌 마무리(endSeason)는 d.nt를 그대로 옮겨 적어요.
 */
function nationalStage(s: CareerState, d: Draft) {
  const nation = NATIONS[s.nation];
  const ovr = overall(s.attrs, s.pos);
  const called = ovr >= nation.callup - (s.age <= 21 ? 2 : 0) && d.missed * 3 < d.games * 2;
  const result: NationalResult = { called, caps: 0, goals: 0, tournaments: [], trophies: [], awards: [], points: 0 };
  d.nt = result;
  if (!called) return;
  const key = ovr >= nation.callup + 5;
  result.caps = (key ? between(s, 5, 8) : between(s, 2, 5)) + d.extraCaps;
  const quality = Math.max(250, 1000 + (ovr - 75) * 30);
  for (let i = 0; i < result.caps; i++) result.goals += count(s, Math.trunc((POSITIONS[s.pos].goal * quality * 85) / 100000), 4);
  // 한 해에 열리는 성인 대표팀 대회는 하나예요(월드컵과 대륙 대회는 서로 다른 해).
  const [code] = tournamentIn(d.year + 1, nation.region);
  if (!code) return;
  const tournament = playTournament(s, d, code, key, ovr, d.year + 1);
  if (tournament) addTournament(result, tournament);
}

function endSeason(s: CareerState, d: Draft) {
  const club = CLUBS[d.club];
  const league = LEAGUES[club.league];
  const ovr = overall(s.attrs, s.pos);
  const rating = d.apps ? Math.round(d.ratingSum / d.apps) : 0;
  const prestige = league.prestige;
  const trophies: Honor[] = [];
  const awards: Honor[] = [];

  // 리그 순위: 다른 구단은 전력에 운을 더하고, 내 구단은 내 활약을 더해 겨뤄요.
  const regular = d.minutes * 100 >= d.games * 90 * 40;
  const impact = regular ? clamp(Math.trunc((rating - 66) / 2) + Math.trunc((ovr - club.rating) / 4), -2, 6) : 0;
  const strength = club.rating + d.teamForm + impact;
  let rank = 1;
  for (const other of clubsIn(club.league)) {
    if (other.id === club.id || other.id === MILITARY_CLUB) continue;
    const value = other.rating + between(s, -4, 4);
    if (value > strength || (value === strength && chance(s, 500))) rank++;
  }
  if (rank === 1 && d.leagueApps >= 8) trophies.push({ label: `${league.name} 우승`, points: Math.max(20, Math.trunc((70 * prestige) / 100)) });
  if (d.cup === 6 && d.cupApps >= 1) trophies.push({ label: `${league.cup} 우승`, points: Math.max(8, Math.trunc((25 * prestige) / 100)) });
  const continental = league.continental ? CONTINENTALS[league.continental] : null;
  if (continental && d.cont === 6 && d.contApps >= 2) trophies.push({ label: `${continental.name} 우승`, points: league.continental === "ucl" ? 180 : league.continental === "lib" ? 70 : 50 });
  s.continentalNext = !!league.continental && rank <= league.spots && !d.military;

  // 대표팀 성적은 nationalStage가 미리 계산해 뒀어요.
  const nation = NATIONS[s.nation];
  const key = ovr >= nation.callup + 5;
  const nt = d.nt ?? { called: false, caps: 0, goals: 0, tournaments: [], trophies: [], awards: [], points: 0 };
  const caps = nt.caps;
  const intlGoals = nt.goals;
  const tournaments = [...nt.tournaments];
  const intlPoints = nt.points;
  trophies.push(...nt.trophies);
  awards.push(...nt.awards);
  if (s.caps === 0 && caps > 0) note(d, `${nation.name} 국가대표 데뷔`);
  if (s.intlGoals === 0 && intlGoals > 0) note(d, "A매치 데뷔골");
  if (d.olympics) {
    const medal = chance(s, 170 + (key ? 120 : 40) + s.traits.clutch * 30) ? pick(s, ["금메달", "은메달", "동메달"]) : null;
    if (medal) {
      s.military = "exempt";
      trophies.push({ label: `${d.year + 1} 올림픽 ${medal}`, points: medal === "금메달" ? 50 : medal === "은메달" ? 35 : 25 });
      note(d, `${d.year + 1} 올림픽 ${medal} · 병역 혜택`);
    } else note(d, `${d.year + 1} 올림픽 메달 획득 실패`);
  }
  if (s.flags.includes(`ag-gold-${d.year}`)) trophies.push({ label: `${d.year} 아시안게임 금메달`, points: 30 });
  let youthBoost = 0;
  if (d.youthCup) {
    const result = playTournament(s, null, "youth", ovr >= 62, ovr, d.year + 1)!;
    tournaments.push(result.label);
    if (result.trophy) trophies.push(result.trophy);
    awards.push(...result.awards);
    note(d, `${result.label}${result.goals ? ` · ${result.goals}골` : ""}`);
    youthBoost = 1;
  }

  // 이번 시즌 평가. 수상과 발롱도르가 이 값으로 정해져요.
  const individual = Math.max(0, rating - 60) * 6 + (
    ["ST", "WG", "AM"].includes(d.pos) ? d.goals * 4 + d.assists * 3
      : d.pos === "CM" || d.pos === "DM" ? d.goals * 5 + d.assists * 4 + d.cleanSheets
        : d.pos === "GK" ? d.cleanSheets * 2 : d.goals * 5 + d.assists * 4 + d.cleanSheets);
  const played = Math.trunc((individual * Math.min(d.apps, 30)) / 30);
  const teamPoints = (rank === 1 ? Math.trunc((60 * prestige) / 100) : 0) + (d.cup === 6 ? 15 : 0)
    + (continental && d.cont >= 4 ? Math.trunc((continental.weight * (d.cont === 6 ? 100 : d.cont === 5 ? 40 : 20)) / 100) : 0);
  const domestic = Math.trunc((played * (100 + prestige)) / 200) + teamPoints;
  const seasonScore = domestic + intlPoints;
  const scale = (points: number) => Math.max(5, Math.trunc((points * prestige) / 100));

  if (d.leagueGoals >= Math.max(10, Math.trunc((league.scorer * league.games) / 38) + between(s, -4, 6))) awards.push({ label: `${league.name} 득점왕`, points: scale(70) });
  if (d.leagueAssists >= Math.max(8, Math.trunc((11 * league.games) / 38) + between(s, -2, 5))) awards.push({ label: `${league.name} 도움왕`, points: scale(45) });
  if (d.leagueApps >= 20 && domestic > 200 + int(s, 130)) awards.push({ label: `${league.name} 올해의 선수`, points: scale(100) });
  if (d.age <= 21 && d.leagueApps >= 15 && domestic > 90 + int(s, 80)) awards.push({ label: `${league.name} 영플레이어상`, points: scale(40) });
  if (d.leagueApps >= 22 && domestic > 150 + int(s, 90)) awards.push({ label: `${league.name} 올해의 팀`, points: scale(25) });

  // 라이벌도 같은 시즌을 보내요. 라이벌만의 난수를 써서 내 운에 영향을 주지 않아요.
  const rv = s.rival;
  const rivalResult = rivalSeason(d, rv);

  // 발롱도르: 다른 후보 가운데 최고 점수(field)·라이벌과 겨뤄요. 15경기 미만이면 1위가 될 수 없고, 동점이면 내가 앞서요.
  const field = 330 + int(s, 140);
  const rivalScore = rivalResult?.score ?? 0;
  const eligible = d.apps >= 15;
  const othersAbove = (score: number) => (field > score ? 1 + Math.trunc((field - score) / 15) : 0);
  let ballon = 0;
  if (seasonScore >= 150) {
    const place = 1 + othersAbove(seasonScore) + (rivalScore > seasonScore ? 1 : 0);
    ballon = !eligible && place === 1 ? 2 : place <= 30 ? place : 0;
  }
  if (rivalResult && rivalScore >= 150) {
    const place = 1 + othersAbove(rivalScore) + (eligible && seasonScore >= rivalScore ? 1 : 0);
    rivalResult.season.ballon = place <= 30 ? place : 0;
    if (place === 1) {
      rv.ballonDor++;
      note(d, `라이벌 ${rv.name}의 발롱도르 수상`);
    }
  }
  if (ballon === 1 && rivalResult?.season.ballon === 2) note(d, `라이벌 ${rv.name}${objectParticle(rv.name)} 제치고 발롱도르`);

  // 같은 리그 다른 팀이면 시즌에 두 번 맞붙어요.
  if (rivalResult && rivalResult.season.club !== d.club && CLUBS[rivalResult.season.club].league === club.league && d.apps >= 5 && rivalResult.season.apps >= 5) {
    const theirs = CLUBS[rivalResult.season.club].rating + clamp(Math.trunc((rivalResult.season.ovr - CLUBS[rivalResult.season.club].rating) / 3), -2, 4);
    const tally = { won: 0, drawn: 0, lost: 0 };
    for (let game = 0; game < 2; game++) {
      const roll = int(s, 1000);
      const win = clamp(400 + (strength - theirs) * 40, 100, 800);
      const result = roll < win ? "won" : roll < win + 250 ? "drawn" : "lost";
      tally[result]++;
      rv.h2h[result]++;
    }
    rivalResult.season.meeting = [tally.won ? `${tally.won}승` : "", tally.drawn ? `${tally.drawn}무` : "", tally.lost ? `${tally.lost}패` : ""].filter(Boolean).join(" ");
  }
  if (rivalResult?.season.retired) note(d, `라이벌 ${rv.name} ${d.age + 1}세에 은퇴`);
  if (ballon === 1) awards.unshift({ label: `${d.year + 1} 발롱도르`, points: 500 });
  else if (ballon > 0 && ballon <= 3) awards.push({ label: `발롱도르 ${ballon}위`, points: 80 });
  else if (ballon > 0 && ballon <= 10) awards.push({ label: `발롱도르 ${ballon}위`, points: 20 });

  // 두 시즌 전의 선택이 돌아와요.
  if (s.flags.includes(`mentor-${d.year - 2}`)) {
    bump(s, 2);
    note(d, "멘토로 이끌던 후배가 국가대표에 뽑혔어요 · 라커룸의 존경");
  }
  if (s.flags.includes(`moved-${d.year - 2}:${s.pos}`)) {
    const index = keyAttr(s);
    addAttr(s, index, 1);
    note(d, `${POSITIONS[s.pos].name} 완전 적응 · ${attrLabels(s.pos)[index]} +1`);
  }

  // 성장과 노쇠. 2군 출전 시간은 절반만 쳐요.
  const share = clamp(Math.trunc(((d.minutes + Math.trunc(d.reserveMinutes / 2)) * 100) / (d.games * 90)), 0, 100);
  let growth = growthByAge(s.traits.peak - d.age);
  if (growth > 0) {
    const factor = 50 + Math.trunc(share / 2) + s.traits.pro * 5 + (d.age <= 20 && club.rating >= 82 ? 10 : 0) - (d.military ? 20 : 0);
    growth = Math.trunc((growth * factor + 50) / 100);
    if (d.apps >= 10 && rating >= 76) growth++;
    if (d.apps >= 10 && rating <= 62) growth--;
    growth += between(s, -1, 1) + youthBoost;
    const room = s.potential - ovr;
    growth = room <= 0 ? Math.min(growth, 0) : Math.min(growth, room < 6 ? Math.trunc((room + 1) / 2) : room);
  } else {
    if (d.care) growth++;
    if (d.major) growth--;
    growth = Math.min(growth + between(s, -1, 1), 0);
  }
  shiftOverall(s, growth);
  if (d.major && s.pos !== "GK") { addAttr(s, 0, -2); addAttr(s, 5, -1); }
  const ovrEnd = overall(s.attrs, s.pos);
  if (ovrEnd > s.peak) { s.peak = ovrEnd; s.peakAge = d.age; }

  // 숨은 특성은 시간이 지나며 드러나요.
  if (d.age >= 20 && !s.revealed.includes("growth")) {
    s.revealed.push("growth");
    const early = s.traits.peak <= (s.pos === "GK" ? 26 : 24);
    const late = s.traits.peak >= (s.pos === "GK" ? 31 : 29);
    note(d, `특성 발견: ${early ? "조기 개화형 · 전성기가 빨리 와요" : late ? "대기만성형 · 전성기가 늦게 와요" : "표준 성장형"}`);
  }
  if (d.age >= 30 && s.traits.injury === 0 && !s.revealed.includes("injury")) {
    s.revealed.push("injury");
    note(d, "특성 발견: 강철 체력");
  }

  if (d.military) {
    s.military = "served";
    note(d, "김천 상무 전역");
  }
  // 2군에서 꾸준히 뛰면 1군 감독도 눈여겨봐요.
  if (d.reserveApps >= 12) bump(s, 1);

  s.history.push({
    year: d.year, age: d.age, club: d.club, loan: d.loan, military: d.military, pos: d.pos, role: d.role,
    ovrBefore: d.ovrBefore, ovrStart: d.ovrStart, ovrEnd, growth: s.attrs.map((value, i) => value - d.attrsBefore[i]),
    apps: d.apps, starts: d.starts, minutes: d.minutes, goals: d.goals, assists: d.assists, cleanSheets: d.cleanSheets, rating,
    rank, cup: d.cup, continental: d.cont, trophies, awards, ballon, caps, intlGoals, tournaments,
    reserve: d.reserveApps ? { apps: d.reserveApps, goals: d.reserveGoals, assists: d.reserveAssists } : null,
    rival: rivalResult?.season ?? null,
    highlights: d.highlights, missed: d.missed, event: d.event,
  });
  s.apps += d.apps;
  s.goals += d.goals;
  s.caps += caps;
  s.intlGoals += intlGoals;
  s.age++;
  s.year++;
  if (!d.military) s.contract--;
  s.trust = Math.trunc((s.trust * 2) / 3);
  s.form = 0;
  s.injury = Math.min(s.injury, 15);
  s.draft = null;
  s.phase = "offseason";
  s.pending = offseasonDecision(s);
}

// ---------- 이적 시장 ----------

/** 1234567 → "1,234,567". 엔진 글자는 기기 언어 설정에 따라 달라지지 않게 직접 만들어요. */
function comma(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function contractYears(age: number): number {
  return age <= 23 ? 5 : age <= 27 ? 4 : age <= 30 ? 3 : age <= 32 ? 2 : 1;
}

function regionAllowed(s: CareerState, club: ClubInfo, interest: number): boolean {
  const region = LEAGUES[club.league].region;
  if (club.league === "KSA") return s.age >= 28 || interest >= 78;
  if (region === "europe") return true;
  const nationRegion = NATIONS[s.nation].region;
  const currentRegion = LEAGUES[CLUBS[s.club].league].region;
  return region === nationRegion || region === currentRegion || s.age >= 30;
}

function ownerWants(s: CareerState, ovr: number, club: ClubInfo): boolean {
  if (s.age >= 36) return ovr >= club.rating + 2;
  if (s.age >= 33) return ovr >= club.rating - 2;
  if (s.age <= 22) return s.potential >= club.rating - 2 || ovr >= club.rating - 10;
  return ovr >= club.rating - 6;
}

function roleText(s: CareerState, clubId: string) {
  return `전력 ${CLUBS[clubId].rating} · 예상 ${roleName(expectedRole(s, clubId, true), s.age)}`;
}

function offseasonDecision(s: CareerState): Decision {
  const ovr = overall(s.attrs, s.pos);
  const last = s.history.at(-1)!;
  const options: Choice[] = [];
  const legend = retiresAsLegend(s);
  const retire = option("은퇴하기", `${s.age}세 · 통산 ${s.apps}경기 ${s.goals}골 · 지금 은퇴하면 ${legend ? "영구 결번과 함께 " : ""}레전드 점수 ${comma(legacyScore(s) + (legend ? LEGEND_POINTS : 0))}점`, "neutral", "retire");
  const title = `${seasonLabel(s.year)} 이적 시장`;
  if (s.age >= CAREER_RULES.maxAge) {
    return { kind: "offseason", id: "offseason", title: "작별의 시간", body: `${s.age}세. 이제는 축구화를 벗을 때예요.`, options: [retire] };
  }
  if (s.military === "pending" && s.age >= 28) {
    return {
      kind: "offseason", id: "offseason", title: "입영 통지서",
      body: "병역 의무를 미룰 수 있는 마지막 해예요. 김천 상무에서 한 시즌을 뛰며 군 복무를 해요.",
      options: [option("김천 상무 입대", "K리그1 · 한 시즌 복무 · 성장 둔화", "neutral", "military")],
    };
  }
  // 군 복무를 마치면 원 소속팀으로 돌아가요. 계약이 끝난 채 입대했다면 자유 계약 선수예요.
  const owner = s.parent ?? (s.club === MILITARY_CLUB ? null : s.club);
  const ownerClub = owner ? CLUBS[owner] : null;
  const free = s.contract <= 0 || !owner;
  const returning = s.parent !== null;
  if (!free && owner && ownerClub) {
    options.push({
      label: `${returning ? "복귀" : "잔류"} · ${ownerClub.name}`,
      detail: `계약 ${s.contract}년 남음 · ${roleText(s, owner)}`, tone: "neutral", value: "stay", club: owner,
    });
  } else if (owner && ownerClub && ownerWants(s, ovr, ownerClub)) {
    const years = contractYears(s.age);
    options.push({ label: `재계약 · ${ownerClub.name}`, detail: `${years}년 계약 · ${roleText(s, owner)}`, tone: "neutral", value: "renew", club: owner, years });
  }

  const recent = last.apps >= 10 ? clamp(Math.trunc((last.rating - 68) / 2), -3, 4) : 0;
  const interest = ovr + recent + (s.age <= 22 ? Math.trunc(Math.max(0, s.potential - ovr) / 3) : 0)
    - (s.age >= 31 ? (s.age - 30) * 2 : 0) + (s.flags.includes("agent") ? 2 : 0);
  const loyal = s.flags.includes(`loyal-${last.year}`) && !free;
  let wanted = interest >= 60 ? 1 + int(s, 3) : int(s, 2);
  if (s.flags.includes(`market-${last.year}`)) wanted++;
  if (s.flags.includes("agent")) wanted++;
  if (loyal) wanted = Math.min(wanted, 1);
  // 적어도 백업으로 쓸 만한 구단만 연락하고, 아직 덜 여문 유망주에게는 국내 구단만 관심을 보여요.
  const home: LeagueCode[] = [CLUBS[s.club].league, NATIONS[s.nation].home];
  const grown = ovr >= 60;
  const pool = Object.values(CLUBS).filter((club) => club.id !== s.club && club.id !== owner && club.id !== MILITARY_CLUB
    && club.rating <= interest + 2 && club.rating >= interest - 9 && club.rating <= ovr + 10
    && (grown || home.includes(club.league)) && regionAllowed(s, club, interest));
  const offers: ClubInfo[] = [];
  for (let n = 0; n < Math.min(wanted, 3); n++) {
    // 몸값에 맞는 구단 가운데 수준 높은 구단일수록 먼저 연락해요. 어린 선수에게는 국내 구단이 더 자주 연락해요.
    const index = weightedIndex(s, pool.map((club) => {
      const reach = club.rating - (interest - 10);
      return offers.includes(club) ? 0 : (reach * reach + 2) * (s.age <= 21 && home.includes(club.league) ? 2 : 1);
    }));
    if (index < 0) break;
    offers.push(pool[index]);
  }
  // 시즌 중에 해외 진출·빅클럽 이적을 원한다고 밝혔거나 에이전트를 따랐다면 그런 제안이 하나는 와요.
  // 에이전트는 큰 구단이나 거액을 주는 사우디 구단을 데려와요.
  const wish = s.flags.includes(`abroad-${last.year}`)
    ? Object.values(CLUBS).filter((club) => LEAGUES[club.league].region === "europe" && club.rating >= ovr - 8 && club.rating <= ovr + 6)
    : s.flags.includes(`bigclub-${last.year}`) ? biggerClubs(s, owner ?? s.club)
      : s.flags.includes(`agentdeal-${last.year}`)
        ? [...biggerClubs(s, owner ?? s.club), ...Object.values(CLUBS).filter((club) => club.league === "KSA" && club.rating <= ovr + 6)]
        : [];
  const wishes = wish.filter((club) => club.id !== s.club && club.id !== owner && !offers.includes(club));
  if (wishes.length && !offers.some((club) => wish.includes(club))) {
    const choice = wishes[weightedIndex(s, wishes.map((club) => Math.max(1, club.rating - 60)))];
    if (offers.length >= 3) offers.sort((a, b) => b.rating - a.rating).pop();
    offers.push(choice);
  }
  const years = contractYears(s.age);
  for (const club of offers.sort((a, b) => b.rating - a.rating)) {
    const fee = free ? "자유 계약" : `이적료 ${formatValue(marketValue(ovr, s.age, s.potential))}`;
    options.push({
      label: `이적 · ${club.name}`, detail: `${LEAGUES[club.league].name} · ${roleText(s, club.id)} · ${years}년 · ${fee}`,
      tone: "good", value: "transfer", club: club.id, years,
    });
  }

  const share = Math.trunc((last.minutes * 100) / (LEAGUES[CLUBS[last.club].league].games * 90));
  if (s.age <= 22 && !free && share < 35) {
    // 뛸 수 있는 구단으로 보내고, 국내 구단을 더 자주 골라요.
    const loans = Object.values(CLUBS).filter((club) => club.id !== owner && club.id !== s.club && club.id !== MILITARY_CLUB
      && club.rating >= ovr - 4 && club.rating <= ovr + 6 && (grown || home.includes(club.league)) && regionAllowed(s, club, interest));
    const chosen: ClubInfo[] = [];
    for (let n = 1 + int(s, 2); n > 0 && loans.length; n--) {
      const club = loans[weightedIndex(s, loans.map((item) => (home.includes(item.league) ? 3 : 1)))];
      if (!chosen.includes(club)) chosen.push(club);
    }
    for (const club of chosen) {
      options.push({ label: `임대 · ${club.name}`, detail: `${LEAGUES[club.league].name} · 1년 임대 · ${roleText(s, club.id)}`, tone: "good", value: "loan", club: club.id });
    }
  }

  // 아직 젊은데 갈 곳이 없으면 국내에서 수준이 가장 비슷한 구단이 받아 줘요.
  if (!options.length && s.age < 30) {
    const nearby = Object.values(CLUBS).filter((club) => club.id !== MILITARY_CLUB && club.id !== s.club && home.includes(club.league));
    const list = nearby.length ? nearby : Object.values(CLUBS).filter((club) => club.id !== MILITARY_CLUB && club.id !== s.club);
    const club = list.reduce((best, item) => (Math.abs(item.rating - ovr) < Math.abs(best.rating - ovr) ? item : best), list[0]);
    options.push({ label: `이적 · ${club.name}`, detail: `${LEAGUES[club.league].name} · ${roleText(s, club.id)} · ${years}년 · 자유 계약`, tone: "good", value: "transfer", club: club.id, years });
  }
  if (s.age >= CAREER_RULES.retireFrom || !options.length) options.push(retire);

  const status = !free ? `계약이 ${s.contract}년 남았어요.` : !owner ? "전역과 함께 자유 계약 선수가 됐어요." : options.some((item) => item.value === "renew") ? "계약이 끝나 재계약 제안을 받았어요." : "계약이 끝났고 구단은 재계약을 원하지 않아요.";
  const offerCount = options.filter((item) => item.value === "transfer" || item.value === "loan").length;
  const body = options.length === 1 && options[0].value === "retire"
    ? "더 이상 불러 주는 구단이 없어요. 축구화를 벗을 때가 됐어요."
    : `${status} ${offerCount ? `새 제안이 ${offerCount}건 왔어요.` : "다른 구단의 제안은 없어요."}`;
  return { kind: "offseason", id: "offseason", title, body, options };
}

const LEGEND_POINTS = 60;

/** 약속대로 그 팀에서 은퇴하면 등번호가 영구 결번돼요. 임대 중이거나 군 복무 중이면 아니에요. */
function retiresAsLegend(s: CareerState): boolean {
  return !s.parent && s.history.at(-1)?.club === s.club && s.flags.includes(`legend:${s.club}`);
}

function applyOffseason(s: CareerState, choice: Choice) {
  const ovr = overall(s.attrs, s.pos);
  switch (choice.value) {
    case "retire":
      s.phase = "retired";
      s.pending = null;
      s.ending = `${s.age}세에 은퇴`;
      if (retiresAsLegend(s)) s.history.at(-1)!.trophies.push({ label: `${clubName(s.club)} 영구 결번`, points: LEGEND_POINTS });
      return;
    case "military":
      if (s.contract > 0) s.parent = s.parent ?? s.club;
      else s.parent = null;
      s.club = MILITARY_CLUB;
      s.trust = 0;
      s.notes.push("김천 상무 입대");
      break;
    case "stay":
      if (s.parent) {
        s.notes.push(`${clubName(s.parent)} 복귀`);
        s.club = s.parent;
        s.parent = null;
        s.trust = 0;
        s.continentalNext = qualifiesByRating(s.club);
      }
      break;
    case "renew":
      if (s.parent) {
        s.club = s.parent;
        s.parent = null;
        s.continentalNext = qualifiesByRating(s.club);
      }
      s.contract = choice.years ?? 1;
      s.notes.push(`${clubName(s.club)} ${s.contract}년 재계약`);
      break;
    case "transfer": {
      const free = s.contract <= 0;
      s.notes.push(`${clubName(choice.club!)} 이적${free ? " · 자유 계약" : ` · 이적료 ${formatValue(marketValue(ovr, s.age, s.potential))}`}`);
      s.club = choice.club!;
      s.parent = null;
      s.contract = choice.years ?? 1;
      s.trust = 0;
      s.continentalNext = qualifiesByRating(s.club);
      break;
    }
    case "loan":
      s.parent = s.parent ?? s.club;
      s.club = choice.club!;
      s.trust = 0;
      s.continentalNext = qualifiesByRating(s.club);
      s.notes.push(`${clubName(s.club)} 1년 임대`);
      break;
    default:
      throw new CareerError("이적 시장 선택이 올바르지 않아요.");
  }
  s.phase = "training";
  s.pending = trainingDecision(s);
}

// ---------- 선택 적용 ----------

function applyChoice(s: CareerState, index: number) {
  const decision = s.pending;
  if (s.phase === "retired" || !decision) throw new CareerError("이미 끝난 커리어예요.");
  if (!Number.isInteger(index) || index < 0 || index >= decision.options.length) throw new CareerError("선택 번호가 올바르지 않아요.");
  if (s.steps >= CAREER_RULES.maxChoices) throw new CareerError("선택이 너무 많아요.");
  const choice = decision.options[index];
  s.pending = null;
  s.lastMoment = null;
  s.steps++;
  if (decision.kind === "training") {
    advance(s, applyTraining(s, choice.value));
    return;
  }
  if (decision.kind === "event") {
    const d = s.draft;
    if (!d) throw new CareerError("진행 중인 시즌이 없어요.");
    if (decision.id === "moment") {
      settleMoment(s, d, choice.value);
    } else {
      const summary = EVENTS[decision.id].apply(s, d, choice.value);
      d.event = `${decision.title} · ${summary}`;
      halfTime(s, d);
    }
    advance(s, d);
    return;
  }
  applyOffseason(s, choice);
}

/** 화면용. 고른 결과를 담은 새 상태를 돌려주고 원래 상태는 그대로 둬요. */
export function choose(state: CareerState, index: number): CareerState {
  const next = structuredClone(state);
  applyChoice(next, index);
  return next;
}

export type CareerSave = { v: number; seed: number; startYear: number; setup: CareerSetup; choices: number[] };

/** 시드와 선택만으로 커리어를 처음부터 다시 계산해요. 서버의 순위 검증도 이 함수를 써요. */
export function replayCareer(save: CareerSave): CareerState {
  if (!save || save.v !== CAREER_VERSION) throw new CareerError("게임 규칙이 바뀌어서 이 커리어는 이어 할 수 없어요.");
  if (!Array.isArray(save.choices) || save.choices.length > CAREER_RULES.maxChoices) throw new CareerError("선택 기록이 올바르지 않아요.");
  const s = createCareer(save.seed, save.startYear, save.setup);
  for (const index of save.choices) applyChoice(s, index);
  return s;
}

// ---------- 은퇴 정리 ----------

export type CareerSummary = {
  name: string; nation: NationCode; pos: Pos; number: number; foot: Side; side: Side; seasons: number; firstYear: number; lastYear: number; retiredAge: number;
  apps: number; goals: number; assists: number; cleanSheets: number; caps: number; intlGoals: number;
  peakOvr: number; peakAge: number; ballonDor: number; awards: number; trophies: number;
  honors: { label: string; count: number }[];
  clubs: string[]; score: number; grade: string; title: string; lastClub: string;
  rival: { name: string; nation: NationCode; best: number; goals: number; assists: number; trophies: number; ballonDor: number;
    h2h: Rival["h2h"]; retiredAge: number | null; lastClub: string; beat: boolean };
};

/**
 * 라이벌을 넘어섰는지. 발롱도르 수 → 최고 오버롤 → 트로피 수 순서로 비교해요.
 * 은퇴할 때 라이벌은 아직 뛰고 있을 수도 있어서 그때까지의 기록으로 비교해요.
 */
export function beatRival(s: CareerState): boolean {
  const totals = careerTotals(s.history);
  const rv = s.rival;
  if (totals.ballonDor !== rv.ballonDor) return totals.ballonDor > rv.ballonDor;
  if (s.peak !== rv.best) return s.peak > rv.best;
  return totals.trophies > rv.trophies;
}

export function careerTotals(history: SeasonRecord[]) {
  const totals = { apps: 0, goals: 0, assists: 0, cleanSheets: 0, caps: 0, intlGoals: 0, ballonDor: 0, awards: 0, trophies: 0 };
  for (const season of history) {
    totals.apps += season.apps;
    totals.goals += season.goals;
    totals.assists += season.assists;
    totals.cleanSheets += season.cleanSheets;
    totals.caps += season.caps;
    totals.intlGoals += season.intlGoals;
    totals.trophies += season.trophies.length;
    for (const award of season.awards) {
      if (award.label.endsWith("발롱도르")) totals.ballonDor++;
      else if (!award.label.startsWith("발롱도르 ")) totals.awards++;
    }
  }
  return totals;
}

/** 레전드 점수의 출처. 다 더하면 레전드 점수예요. */
export type LegacyBreakdown = { trophies: number; awards: number; ballon: number; records: number; national: number; peak: number; rival: number };

export function legacyBreakdown(s: CareerState): LegacyBreakdown {
  const totals = careerTotals(s.history);
  const sheets = s.pos === "GK" || s.pos === "CB" || s.pos === "FB" ? 2 : s.pos === "DM" ? 1 : 0;
  const parts: LegacyBreakdown = {
    trophies: 0, awards: 0, ballon: 0,
    records: totals.goals * 3 + totals.assists * 2 + totals.cleanSheets * sheets,
    national: totals.caps * 3 + totals.intlGoals * 4,
    peak: Math.max(0, s.peak - 60) * 25,
    // 라이벌: 맞대결 1승마다 10점, 커리어로 라이벌을 넘어서면 150점
    rival: s.rival.h2h.won * 10 + (s.history.length && beatRival(s) ? 150 : 0),
  };
  for (const season of s.history) {
    for (const trophy of season.trophies) parts.trophies += trophy.points;
    for (const award of season.awards) {
      if (award.label.includes("발롱도르")) parts.ballon += award.points;
      else parts.awards += award.points;
    }
  }
  return parts;
}

export function legacyScore(s: CareerState): number {
  const parts = legacyBreakdown(s);
  return parts.trophies + parts.awards + parts.ballon + parts.records + parts.national + parts.peak + parts.rival;
}

export function legacyGrade(score: number): string {
  return score >= 9000 ? "GOAT" : score >= 6000 ? "월드 클래스 레전드" : score >= 4000 ? "빅클럽 레전드"
    : score >= 2500 ? "국가대표 스타" : score >= 1500 ? "믿음직한 베테랑" : score >= 800 ? "성실한 프로" : "아쉬운 재능";
}

/** clubs는 군 팀을 뺀 서로 다른 소속팀이에요. */
function careerTitle(s: CareerState, totals: ReturnType<typeof careerTotals>, clubs: string[]): string {
  const honors = s.history.flatMap((season) => season.trophies.map((trophy) => trophy.label));
  const ucl = honors.filter((label) => label.endsWith("챔피언스리그 우승") && !label.startsWith("AFC")).length;
  const legend = honors.find((label) => label.endsWith(" 영구 결번"));
  if (totals.ballonDor >= 3) return `발롱도르 ${totals.ballonDor}회의 전설`;
  if (honors.some((label) => /^\d{4} 월드컵 우승$/.test(label))) return "월드컵 챔피언";
  if (totals.ballonDor) return s.rival.ballonDor && beatRival(s) ? "라이벌을 넘어선 발롱도르 위너" : "발롱도르 위너";
  if (legend) return `${legend.replace(" 영구 결번", "")}의 영원한 레전드`;
  if (s.rival.ballonDor >= 2) return "영원한 2인자";
  if (ucl >= 2) return "빅이어 수집가";
  if (clubs.length === 1 && s.history.length >= 12) return "원클럽맨";
  if (totals.goals >= 400) return "골 머신";
  if (s.peakAge >= 30 && s.peak >= 80) return "늦게 핀 꽃";
  if (clubs.length >= 9) return "저니맨";
  if (s.pos === "GK") return s.peak >= 85 ? "철벽 수문장" : "든든한 수문장";
  if (s.pos === "CB") return s.peak >= 85 ? "통곡의 벽" : "묵묵한 수비수";
  if (s.pos === "ST") return s.peak >= 85 ? "득점 기계" : "골잡이";
  if (s.pos === "WG") return s.peak >= 85 ? "측면의 지배자" : "측면의 질주자";
  return s.peak >= 85 ? "중원의 지휘자" : "팀의 살림꾼";
}

export function summarizeCareer(s: CareerState): CareerSummary {
  const totals = careerTotals(s.history);
  const clubs: string[] = [];
  for (const season of s.history) {
    const name = clubName(season.club);
    if (clubs.at(-1) !== name) clubs.push(name);
  }
  const counts = new Map<string, number>();
  for (const season of s.history) {
    for (const honor of [...season.awards, ...season.trophies]) {
      // 연도는 떼고 모아요. 발롱도르 4~10위는 '톱10' 하나로 묶어요.
      const label = honor.label.replace(/^\d{4} /, "").replace(/^발롱도르 ([4-9]|10)위$/, "발롱도르 톱10");
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }
  const unique = [...new Set(s.history.filter((season) => !season.military).map((season) => season.club))];
  const score = legacyScore(s);
  return {
    name: s.name, nation: s.nation, pos: s.pos, number: s.number, foot: s.foot, side: s.side, seasons: s.history.length,
    firstYear: s.startYear, lastYear: s.year, retiredAge: s.age,
    apps: totals.apps, goals: totals.goals, assists: totals.assists, cleanSheets: totals.cleanSheets,
    caps: totals.caps, intlGoals: totals.intlGoals, peakOvr: s.peak, peakAge: s.peakAge,
    ballonDor: totals.ballonDor, awards: totals.awards, trophies: totals.trophies,
    honors: [...counts].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
    clubs, score, grade: legacyGrade(score), title: careerTitle(s, totals, unique),
    lastClub: clubName(s.history.at(-1)?.club ?? s.club),
    rival: {
      name: s.rival.name, nation: s.rival.nation, best: s.rival.best, goals: s.rival.goals, assists: s.rival.assists,
      trophies: s.rival.trophies, ballonDor: s.rival.ballonDor, h2h: { ...s.rival.h2h }, retiredAge: s.rival.retiredAge,
      lastClub: clubName(s.rival.club), beat: beatRival(s),
    },
  };
}
