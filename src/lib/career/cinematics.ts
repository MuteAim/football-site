import { clubName, seasonLabel, type CareerState, type Honor, type SeasonRecord } from "./engine";

type Scene = { id: string; player: string; subtitle: string; duration: number };
export type FinalCinematic = Scene & {
  type: "final"; title: string; opponent: string; kind: "penalty" | "save" | "freekick";
  won: boolean; shot: "goal" | "saved" | "wide"; direction: "L" | "C" | "R"; result: string;
};
export type AwardCinematic = Scene & { type: "awards"; title: string; honors: string[]; ballonDor: boolean };
export type CareerCinematicScene = FinalCinematic | AwardCinematic;

/** 수상 내역만 사용하는 화면 연출이에요. 경기 규칙과 난수에는 관여하지 않아요. */
export function seasonCeremony(season: SeasonRecord, player: string, id = `awards-${season.year}`, honors: Honor[] = [...season.trophies, ...season.awards]): AwardCinematic | null {
  if (!honors.length) return null;
  const sorted = [...honors].sort((a, b) => b.points - a.points);
  return {
    id, type: "awards", player, subtitle: `${seasonLabel(season.year)} · ${clubName(season.club)}`, duration: 3600,
    title: sorted[0].label, honors: [...new Set(sorted.map((honor) => honor.label))],
    ballonDor: honors.some((honor) => honor.label.endsWith("발롱도르")),
  };
}

/** 방금 선택으로 생긴 결승 결과·수상만 보여 줘요. 불러온 기록은 자동 재생하지 않아요. */
export function careerCinematics(before: CareerState, after: CareerState, index: number): CareerCinematicScene[] {
  const scenes: CareerCinematicScene[] = [];
  const moment = before.pending?.id === "moment" ? before.draft?.moment : null;
  if (moment && after.lastMoment) {
    const result = after.lastMoment;
    const choice = before.pending!.options[index]?.value ?? "";
    const selected = choice.split(":")[1];
    // 선방에 실패해도 동료 덕분에 우승할 수 있어, 슈팅 결과와 팀의 우승을 구분해요.
    const shot = result.includes("골대를 벗어") ? "wide"
      : moment.kind === "save" ? result.includes("선방으로") ? "saved" : "goal"
        : /막혔|막히/.test(result) ? "saved" : "goal";
    scenes.push({
      id: `final-${after.steps}`, type: "final", player: before.name, title: moment.name, opponent: moment.opponent,
      subtitle: moment.kind === "save" ? "승부를 가를 마지막 선방" : moment.kind === "freekick" ? "추가시간, 단 한 번의 프리킥" : "우승을 가를 마지막 키커",
      kind: moment.kind, shot, direction: selected === "L" || selected === "R" ? selected : "C",
      won: result.endsWith(" · 우승!"), result, duration: 2600,
    });
  }
  const season = after.history.at(-1);
  if (season) {
    const old = before.history.at(-1);
    const oldLabels = old?.year === season.year ? new Set([...old.trophies, ...old.awards].map((honor) => honor.label)) : new Set<string>();
    const honors = [...season.trophies, ...season.awards].filter((honor) => !oldLabels.has(honor.label));
    const ceremony = seasonCeremony(season, after.name, `awards-${after.steps}`, honors);
    if (ceremony) scenes.push(ceremony);
  }
  return scenes;
}
