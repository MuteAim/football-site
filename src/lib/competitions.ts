// football-data.org 무료 플랜에서 볼 수 있는 대회 목록이에요.
// 배열 순서가 상단 메뉴와 홈 화면의 대회 정렬 순서가 됩니다.
export type CompetitionInfo = {
  code: string;
  name: string;
  short: string;
  region: string;
  emblem: string;
};

export const COMPETITIONS: CompetitionInfo[] = [
  { code: "PL", name: "프리미어리그", short: "EPL", region: "잉글랜드", emblem: "https://crests.football-data.org/PL.png" },
  { code: "PD", name: "라리가", short: "라리가", region: "스페인", emblem: "https://crests.football-data.org/laliga.png" },
  { code: "BL1", name: "분데스리가", short: "분데스", region: "독일", emblem: "https://crests.football-data.org/BL1.png" },
  { code: "SA", name: "세리에 A", short: "세리에A", region: "이탈리아", emblem: "https://crests.football-data.org/c111.png" },
  { code: "FL1", name: "리그 1", short: "리그1", region: "프랑스", emblem: "https://crests.football-data.org/FL1.png" },
  { code: "CL", name: "UEFA 챔피언스리그", short: "챔스", region: "유럽", emblem: "https://crests.football-data.org/CL.png" },
  { code: "ELC", name: "챔피언십", short: "챔피언십", region: "잉글랜드 2부", emblem: "https://crests.football-data.org/ELC.png" },
  { code: "DED", name: "에레디비시", short: "에레디비시", region: "네덜란드", emblem: "https://crests.football-data.org/ED.png" },
  { code: "PPL", name: "프리메이라 리가", short: "포르투갈", region: "포르투갈", emblem: "https://crests.football-data.org/PPL.png" },
  { code: "BSA", name: "브라질 세리에 A", short: "브라질", region: "브라질", emblem: "https://crests.football-data.org/bsa.png" },
  { code: "CLI", name: "코파 리베르타도레스", short: "리베르타도레스", region: "남미", emblem: "https://crests.football-data.org/CLI.svg" },
  { code: "WC", name: "FIFA 월드컵", short: "월드컵", region: "국가대표", emblem: "https://crests.football-data.org/wm26.png" },
  { code: "EC", name: "UEFA 유로", short: "유로", region: "국가대표", emblem: "https://crests.football-data.org/ec.png" },
];

const BY_CODE = new Map(COMPETITIONS.map((c) => [c.code, c]));

export function getCompetition(code: string): CompetitionInfo | undefined {
  return BY_CODE.get(code);
}

export function competitionOrder(code: string): number {
  const index = COMPETITIONS.findIndex((c) => c.code === code);
  return index === -1 ? COMPETITIONS.length : index;
}
