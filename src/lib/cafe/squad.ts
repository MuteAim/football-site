// 드림 스쿼드의 포메이션과 FC온라인 카드 정보예요. 서버와 스쿼드 만들기 화면(브라우저)이 같이 써요.
// 포메이션 이름과 자리 수는 supabase/schema.sql의 squads_values_check와 같아야 해요.

/** 피치 위 한 자리. x는 왼쪽에서부터, y는 상대 골문(위)에서부터의 비율(%)이에요. */
export type SquadSlot = { label: string; x: number; y: number };

const GK: SquadSlot = { label: "GK", x: 50, y: 90 };
const BACK_FOUR: SquadSlot[] = [
  { label: "LB", x: 13, y: 69 },
  { label: "LCB", x: 37, y: 74 },
  { label: "RCB", x: 63, y: 74 },
  { label: "RB", x: 87, y: 69 },
];
const BACK_THREE: SquadSlot[] = [
  { label: "LCB", x: 26, y: 73 },
  { label: "CB", x: 50, y: 75 },
  { label: "RCB", x: 74, y: 73 },
];
const TWO_STRIKERS: SquadSlot[] = [
  { label: "LS", x: 36, y: 15 },
  { label: "RS", x: 64, y: 15 },
];
const FRONT_THREE: SquadSlot[] = [
  { label: "LW", x: 17, y: 22 },
  { label: "ST", x: 50, y: 14 },
  { label: "RW", x: 83, y: 22 },
];

/** 자리 순서는 골키퍼, 수비, 미드필더, 공격수이고 줄마다 왼쪽부터예요. 포메이션을 바꾸면 같은 순서 자리로 옮겨 가요. */
export const FORMATIONS = {
  "4-3-3": [
    GK,
    ...BACK_FOUR,
    { label: "LCM", x: 27, y: 48 },
    { label: "CM", x: 50, y: 53 },
    { label: "RCM", x: 73, y: 48 },
    ...FRONT_THREE,
  ],
  "4-2-3-1": [
    GK,
    ...BACK_FOUR,
    { label: "LDM", x: 36, y: 55 },
    { label: "RDM", x: 64, y: 55 },
    { label: "LAM", x: 17, y: 33 },
    { label: "CAM", x: 50, y: 36 },
    { label: "RAM", x: 83, y: 33 },
    { label: "ST", x: 50, y: 14 },
  ],
  "4-4-2": [
    GK,
    ...BACK_FOUR,
    { label: "LM", x: 13, y: 45 },
    { label: "LCM", x: 37, y: 50 },
    { label: "RCM", x: 63, y: 50 },
    { label: "RM", x: 87, y: 45 },
    ...TWO_STRIKERS,
  ],
  "4-1-2-1-2": [
    GK,
    ...BACK_FOUR,
    { label: "CDM", x: 50, y: 57 },
    { label: "LCM", x: 27, y: 46 },
    { label: "RCM", x: 73, y: 46 },
    { label: "CAM", x: 50, y: 34 },
    ...TWO_STRIKERS,
  ],
  "3-5-2": [
    GK,
    ...BACK_THREE,
    { label: "LWB", x: 11, y: 46 },
    { label: "LDM", x: 35, y: 55 },
    { label: "RDM", x: 65, y: 55 },
    { label: "RWB", x: 89, y: 46 },
    { label: "CAM", x: 50, y: 36 },
    ...TWO_STRIKERS,
  ],
  "3-4-3": [
    GK,
    ...BACK_THREE,
    { label: "LM", x: 13, y: 47 },
    { label: "LCM", x: 37, y: 52 },
    { label: "RCM", x: 63, y: 52 },
    { label: "RM", x: 87, y: 47 },
    ...FRONT_THREE,
  ],
} satisfies Record<string, SquadSlot[]>;

export type Formation = keyof typeof FORMATIONS;

export const FORMATION_NAMES = Object.keys(FORMATIONS) as Formation[];

export function isFormation(value: string): value is Formation {
  return Object.hasOwn(FORMATIONS, value);
}

/** 모르는 포메이션이면 4-3-3 자리로 그려요. */
export function slotsOf(formation: string): SquadSlot[] {
  return isFormation(formation) ? FORMATIONS[formation] : FORMATIONS["4-3-3"];
}

export const SQUAD_SIZE = 11;

export const SQUAD_LIMITS = {
  name: 30,
  /** 한 회원이 만들 수 있는 스쿼드 수 */
  perMember: 30,
} as const;

/** 스쿼드 한 자리에 넣은 카드. spid는 FC온라인 카드 번호예요. */
export type SquadPlayer = { spid: number; name: string };

/** 피치 위에 쓰는 짧은 이름. 자리가 좁아서 마지막 낱말만 써요("리오넬 메시"면 "메시"). */
export function pitchName(name: string): string {
  return name.trim().split(/\s+/).at(-1) ?? name;
}

// 카드 번호의 끝 6자리는 선수 번호, 앞자리는 시즌 번호예요. 같은 선수의 카드는 시즌이 달라도 선수 번호가 같아요.
export function playerIdOf(spid: number): number {
  return spid % 1_000_000;
}

export function seasonIdOf(spid: number): number {
  return Math.floor(spid / 1_000_000);
}

const PHOTO_CDN = "https://fco.dn.nexoncdn.co.kr/live/externalAssets/common";

/** 선수 얼굴 사진. 같은 선수의 모든 카드가 같이 써요. */
export function facePhoto(pid: number): string {
  return `${PHOTO_CDN}/players/p${pid}.png`;
}

/** 카드 사진 후보. 그 시즌 카드의 동작 사진을 먼저 쓰고, 없는 카드는 얼굴 사진을 써요. */
export function cardPhotos(spid: number): string[] {
  return [`${PHOTO_CDN}/playersAction/p${spid}.png`, facePhoto(playerIdOf(spid))];
}

/** FC온라인 시즌. image는 카드 위에 붙이는 시즌 아이콘이에요. */
export type FcSeason = { name: string; image: string };

export type FcSeasons = Record<number, FcSeason>;

/** 넥슨 Open API 이용 약관에 따라, FC온라인 자료를 보여 주는 곳에 적는 출처 */
export const NEXON_CREDIT = "Data based on NEXON Open API";
