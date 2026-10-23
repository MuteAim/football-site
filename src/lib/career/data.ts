// 레전드 로드의 고정 자료예요. 능력치와 구단 전력은 게임용 가상 수치이고 실제 선수·구단과 관계없어요.
// 여기나 engine.ts의 규칙을 바꾸면 engine.ts의 CAREER_VERSION을 꼭 올려 주세요.
// 저장된 커리어와 서버의 순위 검증이 시드와 선택만으로 처음부터 다시 계산하기 때문에,
// 규칙이 바뀌면 예전 커리어의 결과가 달라져요.

export type Pos = "ST" | "WG" | "AM" | "CM" | "DM" | "FB" | "CB" | "GK";
export type NationCode = "KOR" | "JPN" | "ENG" | "ESP" | "FRA" | "GER" | "ITA" | "POR" | "NED" | "BRA" | "ARG";
export type LeagueCode = "KOR" | "JPN" | "ENG" | "ENG2" | "ESP" | "GER" | "ITA" | "FRA" | "NED" | "POR" | "BRA" | "ARG" | "KSA";

export const POSITION_ORDER: Pos[] = ["ST", "WG", "AM", "CM", "DM", "FB", "CB", "GK"];
export const OUTFIELD_ATTRS = ["속도", "슈팅", "패스", "드리블", "수비", "피지컬"];
export const KEEPER_ATTRS = ["반응", "다이빙", "핸들링", "위치 선정", "킥", "피지컬"];

type Style = { name: string; bias: number[] };
type PositionInfo = {
  name: string;
  /** 능력치 6개의 오버롤 비중(%). 합이 100이에요. */
  weights: number[];
  /** 90분당 기대 골·도움(1/1000 단위). 오버롤과 팀 전력으로 다시 보정해요. */
  goal: number;
  assist: number;
  styles: Style[];
};

export const POSITIONS: Record<Pos, PositionInfo> = {
  ST: {
    name: "스트라이커", weights: [18, 38, 6, 20, 0, 18], goal: 430, assist: 120,
    styles: [
      { name: "골문 앞 포처", bias: [2, 6, -2, 1, 0, -2] },
      { name: "타깃맨", bias: [-5, 3, 0, -2, 1, 7] },
      { name: "스피드 스트라이커", bias: [7, 1, -1, 2, 0, -3] },
    ],
  },
  WG: {
    name: "윙어", weights: [28, 18, 14, 32, 0, 8], goal: 270, assist: 220,
    styles: [
      { name: "스피드 윙어", bias: [7, 0, -1, 2, 0, -2] },
      { name: "테크니션", bias: [-2, 0, 3, 6, 0, -2] },
      { name: "인사이드 포워드", bias: [1, 6, -1, 2, 0, -1] },
    ],
  },
  AM: {
    name: "공격형 미드필더", weights: [10, 20, 32, 32, 0, 6], goal: 230, assist: 260,
    styles: [
      { name: "플레이메이커", bias: [-1, -1, 6, 2, 0, -2] },
      { name: "섀도 스트라이커", bias: [2, 6, -1, 1, 0, -1] },
      { name: "드리블러", bias: [2, 0, 0, 6, 0, -2] },
    ],
  },
  CM: {
    name: "중앙 미드필더", weights: [6, 10, 36, 22, 14, 12], goal: 110, assist: 160,
    styles: [
      { name: "박스 투 박스", bias: [2, 1, -1, 0, 2, 4] },
      { name: "딥라잉 플레이메이커", bias: [-2, -1, 6, 1, 1, -1] },
      { name: "공격형 8번", bias: [0, 4, 1, 3, -2, -1] },
    ],
  },
  DM: {
    name: "수비형 미드필더", weights: [6, 4, 26, 10, 34, 20], goal: 45, assist: 80,
    styles: [
      { name: "앵커", bias: [-1, -1, 0, -1, 5, 3] },
      { name: "레지스타", bias: [-1, 1, 6, 1, 0, -2] },
      { name: "파이터", bias: [1, 0, -2, -1, 3, 5] },
    ],
  },
  FB: {
    name: "풀백", weights: [26, 2, 16, 12, 30, 14], goal: 35, assist: 120,
    styles: [
      { name: "공격형 풀백", bias: [4, 1, 3, 2, -3, 0] },
      { name: "수비형 풀백", bias: [0, -1, -1, -1, 5, 2] },
      { name: "인버티드 풀백", bias: [-1, 0, 5, 2, 0, -1] },
    ],
  },
  CB: {
    name: "센터백", weights: [12, 0, 8, 4, 46, 30], goal: 50, assist: 25,
    styles: [
      { name: "파이터", bias: [-1, 0, -2, -1, 2, 5] },
      { name: "빌드업 수비수", bias: [0, 0, 5, 2, 1, -2] },
      { name: "스위퍼", bias: [5, 0, 1, 1, 2, -3] },
    ],
  },
  GK: {
    name: "골키퍼", weights: [26, 24, 20, 22, 6, 2], goal: 0, assist: 5,
    styles: [
      { name: "반사신경형", bias: [6, 2, -1, -1, 0, 0] },
      { name: "안정형", bias: [-1, 0, 4, 3, 0, 1] },
      { name: "스위퍼 키퍼", bias: [0, -1, -1, 3, 5, 1] },
    ],
  },
};

/** 감독이 권할 수 있는 포지션 변경. 오버롤 비중이 바뀌어 같은 능력치라도 오버롤이 달라져요. */
export const POSITION_MOVES: Record<Pos, Pos[]> = {
  ST: ["WG"],
  WG: ["ST", "AM", "FB"],
  AM: ["WG", "CM"],
  CM: ["AM", "DM"],
  DM: ["CM", "CB"],
  FB: ["WG", "CB"],
  CB: ["DM", "FB"],
  GK: [],
};

type Nation = {
  name: string;
  /** 대표팀 전력 */
  rating: number;
  /** 이 오버롤부터 대표팀에 뽑혀요. 21세 이하는 2 낮게 봐요. */
  callup: number;
  home: LeagueCode;
  region: "asia" | "europe" | "america";
};

export const NATIONS: Record<NationCode, Nation> = {
  KOR: { name: "대한민국", rating: 76, callup: 71, home: "KOR", region: "asia" },
  JPN: { name: "일본", rating: 78, callup: 73, home: "JPN", region: "asia" },
  ENG: { name: "잉글랜드", rating: 86, callup: 81, home: "ENG", region: "europe" },
  ESP: { name: "스페인", rating: 87, callup: 82, home: "ESP", region: "europe" },
  FRA: { name: "프랑스", rating: 87, callup: 83, home: "FRA", region: "europe" },
  GER: { name: "독일", rating: 85, callup: 81, home: "GER", region: "europe" },
  ITA: { name: "이탈리아", rating: 83, callup: 79, home: "ITA", region: "europe" },
  POR: { name: "포르투갈", rating: 85, callup: 80, home: "POR", region: "europe" },
  NED: { name: "네덜란드", rating: 83, callup: 79, home: "NED", region: "europe" },
  BRA: { name: "브라질", rating: 86, callup: 82, home: "BRA", region: "america" },
  ARG: { name: "아르헨티나", rating: 87, callup: 82, home: "ARG", region: "america" },
};
export const NATION_ORDER = Object.keys(NATIONS) as NationCode[];

type Continental = {
  name: string;
  /** 리그 페이즈(조별) 통과와 16강·8강·4강·결승 상대 전력 */
  opp: number[];
  /** 발롱도르 평가에서 우승의 무게 */
  weight: number;
};

export const CONTINENTALS = {
  ucl: { name: "챔피언스리그", opp: [80, 83, 85, 86, 87], weight: 100 },
  acl: { name: "AFC 챔피언스리그", opp: [66, 70, 72, 73, 74], weight: 30 },
  lib: { name: "코파 리베르타도레스", opp: [70, 74, 76, 77, 78], weight: 40 },
} satisfies Record<string, Continental>;
export type ContinentalCode = keyof typeof CONTINENTALS;

type League = {
  name: string;
  /** 리그 경기 수 */
  games: number;
  /** 리그 수준. 수상과 발롱도르 평가에 곱해요(100이 최고). */
  prestige: number;
  /** 보통 시즌의 득점왕 골 수 */
  scorer: number;
  cup: string;
  continental: ContinentalCode | null;
  /** 다음 시즌 대륙 대회에 나가는 순위 */
  spots: number;
  region: "asia" | "europe" | "america";
  /** 처음 커리어를 시작할 수 있는 리그 */
  youth: boolean;
  /** [구단 이름, 전력]. 전력은 그 팀 주전의 평균 오버롤쯤이에요. */
  clubs: [string, number][];
};

export const LEAGUES: Record<LeagueCode, League> = {
  KOR: {
    name: "K리그1", games: 38, prestige: 45, scorer: 17, cup: "코리아컵", continental: "acl", spots: 2, region: "asia", youth: true,
    clubs: [["전북 현대", 72], ["울산 HD", 71], ["포항 스틸러스", 70], ["FC 서울", 70], ["대전 하나시티즌", 69], ["강원 FC", 68], ["인천 유나이티드", 67], ["광주 FC", 67], ["제주 SK", 67], ["수원 FC", 66], ["FC 안양", 66], ["김천 상무", 69]],
  },
  JPN: {
    name: "J1리그", games: 38, prestige: 48, scorer: 18, cup: "일왕배", continental: "acl", spots: 2, region: "asia", youth: true,
    clubs: [["비셀 고베", 72], ["가시마 앤틀러스", 72], ["산프레체 히로시마", 72], ["요코하마 F. 마리노스", 71], ["가와사키 프론탈레", 71], ["우라와 레즈", 71], ["마치다 젤비아", 71], ["감바 오사카", 70], ["가시와 레이솔", 70], ["나고야 그램퍼스", 69], ["세레소 오사카", 69], ["FC 도쿄", 69], ["교토 상가", 69], ["아비스파 후쿠오카", 68], ["도쿄 베르디", 67], ["시미즈 에스펄스", 67], ["알비렉스 니가타", 66], ["요코하마 FC", 66], ["쇼난 벨마레", 66], ["파지아노 오카야마", 65]],
  },
  ENG: {
    name: "프리미어리그", games: 38, prestige: 100, scorer: 24, cup: "FA컵", continental: "ucl", spots: 4, region: "europe", youth: true,
    clubs: [["맨시티", 89], ["아스널", 89], ["리버풀", 88], ["첼시", 85], ["뉴캐슬", 82], ["맨유", 82], ["토트넘", 81], ["애스턴 빌라", 81], ["노팅엄", 78], ["브라이턴", 78], ["크리스털 팰리스", 78], ["본머스", 77], ["브렌트퍼드", 77], ["풀럼", 76], ["에버턴", 76], ["리즈", 74], ["선덜랜드", 74], ["입스위치", 72], ["헐 시티", 71], ["코번트리", 71]],
  },
  ENG2: {
    name: "챔피언십", games: 46, prestige: 42, scorer: 22, cup: "FA컵", continental: null, spots: 0, region: "europe", youth: false,
    clubs: [["웨스트햄", 75], ["울버햄튼", 74], ["번리", 73], ["사우샘프턴", 72], ["셰필드 유나이티드", 70], ["미들즈브러", 70], ["노리치", 69], ["웨스트브롬", 69], ["왓퍼드", 68], ["버밍엄", 68], ["스토크", 67], ["블랙번", 67], ["브리스톨 시티", 67], ["렉섬", 67], ["밀월", 66], ["스완지", 66], ["프레스턴", 66], ["QPR", 65], ["더비 카운티", 65], ["포츠머스", 64], ["찰턴", 64], ["카디프", 64], ["볼턴", 63], ["링컨 시티", 62]],
  },
  ESP: {
    name: "라리가", games: 38, prestige: 98, scorer: 24, cup: "코파 델 레이", continental: "ucl", spots: 4, region: "europe", youth: true,
    clubs: [["레알 마드리드", 89], ["바르셀로나", 89], ["아틀레티코", 85], ["빌바오", 80], ["비야레알", 80], ["레알 베티스", 79], ["레알 소시에다드", 78], ["셀타 비고", 76], ["세비야", 76], ["발렌시아", 75], ["오사수나", 75], ["라요 바예카노", 74], ["헤타페", 74], ["에스파뇰", 74], ["알라베스", 73], ["엘체", 72], ["레반테", 71], ["말라가", 70], ["데포르티보", 70], ["라싱 산탄데르", 69]],
  },
  GER: {
    name: "분데스리가", games: 34, prestige: 95, scorer: 26, cup: "DFB 포칼", continental: "ucl", spots: 4, region: "europe", youth: true,
    clubs: [["바이에른 뮌헨", 89], ["레버쿠젠", 83], ["도르트문트", 83], ["라이프치히", 81], ["슈투트가르트", 79], ["프랑크푸르트", 79], ["프라이부르크", 77], ["호펜하임", 77], ["묀헨글라트바흐", 75], ["마인츠", 75], ["브레멘", 75], ["우니온 베를린", 74], ["아우크스부르크", 73], ["쾰른", 73], ["함부르크", 73], ["샬케", 71], ["파더보른", 70], ["엘버스베르크", 69]],
  },
  ITA: {
    name: "세리에 A", games: 38, prestige: 94, scorer: 23, cup: "코파 이탈리아", continental: "ucl", spots: 4, region: "europe", youth: true,
    clubs: [["인터 밀란", 86], ["나폴리", 84], ["AC 밀란", 83], ["유벤투스", 83], ["아탈란타", 81], ["AS 로마", 81], ["라치오", 78], ["코모", 78], ["볼로냐", 78], ["피오렌티나", 77], ["토리노", 75], ["우디네세", 74], ["제노아", 73], ["파르마", 73], ["사수올로", 73], ["칼리아리", 72], ["레체", 71], ["베네치아", 70], ["몬차", 70], ["프로시노네", 69]],
  },
  FRA: {
    name: "리그 1", games: 34, prestige: 88, scorer: 22, cup: "쿠프 드 프랑스", continental: "ucl", spots: 3, region: "europe", youth: true,
    clubs: [["파리 생제르맹", 89], ["마르세유", 81], ["모나코", 80], ["릴", 79], ["리옹", 79], ["니스", 77], ["렌", 77], ["랑스", 77], ["스트라스부르", 76], ["툴루즈", 74], ["브레스트", 74], ["오세르", 72], ["파리 FC", 72], ["앙제", 71], ["르아브르", 71], ["로리앙", 71], ["르망", 69], ["트루아", 69]],
  },
  NED: {
    name: "에레디비시", games: 34, prestige: 68, scorer: 24, cup: "KNVB 베커", continental: "ucl", spots: 2, region: "europe", youth: true,
    clubs: [["PSV", 80], ["아약스", 79], ["페예노르트", 79], ["AZ 알크마르", 77], ["트벤테", 75], ["위트레흐트", 74], ["NEC", 72], ["고어헤드 이글스", 72], ["헤이렌베인", 71], ["스파르타 로테르담", 70], ["흐로닝언", 70], ["즈볼레", 68], ["시타르트", 68], ["엑셀시오르", 67], ["빌럼 II", 67], ["덴하흐", 67], ["캄뷔르", 66], ["텔스타르", 66]],
  },
  POR: {
    name: "프리메이라 리가", games: 34, prestige: 68, scorer: 24, cup: "타사 드 포르투갈", continental: "ucl", spots: 2, region: "europe", youth: true,
    clubs: [["벤피카", 81], ["포르투", 81], ["스포르팅", 81], ["브라가", 77], ["비토리아 기마랑이스", 73], ["파말리캉", 72], ["질 비센트", 71], ["이스토릴", 70], ["모레이렌스", 70], ["아로카", 69], ["히우 아브", 69], ["카사 피아", 69], ["산타 클라라", 69], ["나시오날", 68], ["알베르카", 68], ["에스트렐라", 67], ["비세우", 66], ["마리티무", 66]],
  },
  BRA: {
    name: "브라질 세리에 A", games: 38, prestige: 60, scorer: 17, cup: "코파 두 브라질", continental: "lib", spots: 4, region: "america", youth: true,
    clubs: [["플라멩구", 79], ["팔메이라스", 79], ["보타포구", 76], ["크루제이루", 75], ["상파울루", 75], ["플루미넨시", 75], ["아틀레치쿠 미네이루", 75], ["코린치앙스", 74], ["그레미우", 73], ["인테르나시오나우", 73], ["바이아", 73], ["바스쿠 다 가마", 72], ["산투스", 72], ["브라간치누", 72], ["포르탈레자", 70], ["세아라", 70], ["미라솔", 70], ["비토리아", 69], ["스포르트 헤시피", 68], ["주벤투지", 68]],
  },
  ARG: {
    name: "아르헨티나 리가", games: 34, prestige: 58, scorer: 15, cup: "코파 아르헨티나", continental: "lib", spots: 3, region: "america", youth: true,
    clubs: [["리버 플레이트", 77], ["보카 주니어스", 76], ["라싱 클루브", 74], ["벨레스 사르스필드", 72], ["인디펜디엔테", 72], ["에스투디안테스", 72], ["탈레레스", 71], ["산로렌소", 71], ["로사리오 센트랄", 71], ["라누스", 70], ["아르헨티노스 주니어스", 70], ["우라칸", 69], ["뉴웰스 올드 보이스", 69], ["고도이 크루스", 69], ["티그레", 68], ["벨그라노", 68], ["반필드", 67], ["플라텐세", 67], ["인스티투토", 66], ["바라카스 센트랄", 66]],
  },
  KSA: {
    name: "사우디 프로리그", games: 34, prestige: 48, scorer: 26, cup: "킹스컵", continental: "acl", spots: 2, region: "asia", youth: false,
    clubs: [["알 힐랄", 78], ["알 나스르", 78], ["알 이티하드", 77], ["알 아흘리", 77], ["알 카디시야", 74], ["알 이티파크", 72], ["알 샤밥", 71], ["알 타아원", 70], ["네옴", 70], ["알 파테흐", 68], ["알 칼리즈", 68], ["알 리야드", 67], ["다막", 67], ["알 오크두드", 66], ["알 파이하", 66], ["알 하젬", 65], ["알 콜루드", 65], ["알 나즈마", 64]],
  },
};
export const LEAGUE_ORDER = Object.keys(LEAGUES) as LeagueCode[];
export const YOUTH_LEAGUES = LEAGUE_ORDER.filter((code) => LEAGUES[code].youth);

/** 구단 번호는 "리그:순번"이에요. 순번은 위 목록의 자리라서 목록 순서를 바꾸면 버전을 올려야 해요. */
export type ClubInfo = { id: string; name: string; rating: number; league: LeagueCode };
export const CLUBS: Record<string, ClubInfo> = Object.fromEntries(
  LEAGUE_ORDER.flatMap((league) => LEAGUES[league].clubs.map(([name, rating], index) => {
    const id = `${league}:${index}`;
    return [id, { id, name, rating, league }];
  })),
);
export const MILITARY_CLUB = "KOR:11";

type Tournament = { name: string; group: number; opp: number[]; rounds: string[] };

/** 대표팀 대회. rounds는 조별리그 다음 토너먼트 라운드 이름이에요. */
export const TOURNAMENTS = {
  worldcup: { name: "월드컵", group: 76, opp: [79, 82, 84, 86, 87], rounds: ["32강", "16강", "8강", "4강", "결승"] },
  asia: { name: "아시안컵", group: 64, opp: [68, 72, 75, 77], rounds: ["16강", "8강", "4강", "결승"] },
  europe: { name: "유로", group: 76, opp: [79, 82, 84, 85], rounds: ["16강", "8강", "4강", "결승"] },
  america: { name: "코파 아메리카", group: 74, opp: [79, 83, 85], rounds: ["8강", "4강", "결승"] },
  /** U-20 월드컵은 홀수 해에 열려요. 시즌 중 발탁 사건으로 나가고, 대표팀 경기 수에는 넣지 않아요. */
  youth: { name: "U-20 월드컵", group: 74, opp: [75, 77, 79, 80], rounds: ["16강", "8강", "4강", "결승"] },
} satisfies Record<string, Tournament>;
export type TournamentCode = keyof typeof TOURNAMENTS;

/** 시즌이 끝나는 해에 열리는 대표팀 대회 */
export function tournamentIn(endYear: number, region: Nation["region"]): TournamentCode[] {
  const list: TournamentCode[] = [];
  if (endYear >= 2030 && endYear % 4 === 2) list.push("worldcup");
  if (region === "asia" ? endYear % 4 === 3 : endYear % 4 === 0) list.push(region);
  return list;
}

export const INJURIES = {
  minor: ["발목 염좌", "허벅지 타박상", "종아리 근육 경련", "감기 몸살"],
  moderate: ["햄스트링 부상", "발목 인대 부상", "허벅지 근육 파열", "갈비뼈 타박상"],
  major: ["무릎 십자인대 파열", "발등 골절", "아킬레스건 부상"],
};

/** 프리시즌 능력치 훈련 이름. 순서가 능력치 순서와 같아요. */
export const ATTR_TRAININGS = {
  outfield: ["스프린트 훈련", "슈팅 특훈", "패스·시야 훈련", "1:1 드리블 특훈", "수비 위치 선정 훈련", "웨이트 트레이닝"],
  keeper: ["반응 속도 훈련", "다이빙 훈련", "캐칭·핸들링 훈련", "위치 선정 훈련", "빌드업 킥 훈련", "웨이트 트레이닝"],
};

export const SPECIAL_TRAININGS: Record<"hell" | "care" | "tactics" | "mental" | "freekick", { label: string; detail: string }> = {
  hell: { label: "지옥 훈련", detail: "모든 능력치 +1 · 부상 위험 큼" },
  care: { label: "컨디션 관리", detail: "부상 위험 ↓ · 노쇠화를 늦춰요" },
  tactics: { label: "전술 훈련", detail: "감독 신뢰 ↑ · 패스·수비 +1" },
  mental: { label: "멘탈 코칭", detail: "시즌 초반 폼 ↑ · 큰 경기에 강해져요" },
  freekick: { label: "프리킥 특훈", detail: "슈팅·패스 +1 · 프리킥 골 기회" },
};
