import { archiveCareer, type RetiredCareer } from "./archive";
import { POSITIONS, type Pos } from "./data";
import { clubName, FOOT_NAMES, legacyBreakdown, positionName, summarizeCareer, type CareerSave, type CareerState, type LegacyBreakdown } from "./engine";

// 공유 카드에 담는 은퇴 기록이에요. 서버가 시드와 선택 기록으로 다시 계산한 결과만 만들어요.
export const CARD_CODE = /^[A-Za-z0-9]{10}$/;
export type CardSeason = { age: number; ovrEnd: number; club: string };
export type CareerCard = Omit<RetiredCareer, "id" | "retiredAt" | "ranked"> & {
  curve: CardSeason[];
  breakdown: LegacyBreakdown;
  rival: { name: string; beat: boolean; ballonDor: number; won: number; drawn: number; lost: number };
};
export type SharedCard = { card: CareerCard; nickname: string; createdAt: string };

export function buildCareerCard(state: CareerState, save: CareerSave): CareerCard {
  const { v, name, nation, pos, number, foot, side, score, grade, title, totals, clubs, honors } = archiveCareer(state, save, false);
  const summary = summarizeCareer(state);
  return {
    v, name, nation, pos, number, foot, side, score, grade, title, totals, clubs, honors,
    curve: state.history.map((season) => ({ age: season.age, ovrEnd: season.ovrEnd, club: season.club })),
    breakdown: legacyBreakdown(state),
    rival: { name: summary.rival.name, beat: summary.rival.beat, ballonDor: summary.rival.ballonDor, ...summary.rival.h2h },
  };
}

/** 카드에 보여 줄 마지막 소속팀 이름 */
export function cardLastClub(card: CareerCard): string {
  const last = card.curve.at(-1);
  return last ? clubName(last.club) : card.clubs.at(-1)?.name ?? "";
}

/** 카드의 "등번호 · 포지션 · 주발" 한 줄. 초기화 전에 만든 카드에는 등번호와 주발이 없어서 있는 것만 보여 줘요. */
export function cardPlayerLine(card: CareerCard): string {
  const position = Object.hasOwn(POSITIONS, card.pos) ? positionName(card.pos as Pos, card.side) : card.pos;
  return [card.number ? `${card.number}번` : "", position, card.foot ? FOOT_NAMES[card.foot] : ""].filter(Boolean).join(" · ");
}
