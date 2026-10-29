// 레전드 로드 규칙 버전별 엔진이에요. 서버가 순위 기록을 다시 계산할 때 커리어가 시작된 버전의 규칙을 그대로 써요.
// 규칙이 바뀌는 배포 중에 진행 중이던 순위 도전 커리어도, 구 버전 화면에서 은퇴하면 그 버전으로 계산해 저장할 수 있어요.
// 새 버전을 만들 때: engine.ts의 CAREER_VERSION을 올리기 전에 engine.ts·data.ts를 legacy/v<이전 버전>/에 복사하고 아래 목록에 더해요.
import * as current from "./engine";
import * as v6 from "./legacy/v6/engine";
import * as v5 from "./legacy/v5/engine";
import * as v4 from "./legacy/v4/engine";
import type { CareerSave, CareerSetup, CareerSummary } from "./engine";

export type CareerEngine = {
  version: number;
  cleanSetup: (raw: unknown) => CareerSetup;
  /** 시드와 선택으로 커리어를 다시 계산해 은퇴했는지와 요약을 돌려줘요. 은퇴 전이면 summary가 null이에요. */
  replay: (save: CareerSave) => { retired: boolean; summary: CareerSummary | null };
};

function wrap(engine: typeof current | typeof v6 | typeof v5 | typeof v4): CareerEngine {
  return {
    version: engine.CAREER_VERSION,
    cleanSetup: engine.cleanSetup,
    replay: (save) => {
      // 버전마다 상태 타입이 조금씩 다를 수 있어서 같은 버전의 replayCareer·summarizeCareer를 짝지어 써요.
      const state = engine.replayCareer({ ...save, v: engine.CAREER_VERSION });
      return { retired: state.phase === "retired", summary: state.phase === "retired" ? engine.summarizeCareer(state as never) : null };
    },
  };
}

const ENGINES: readonly CareerEngine[] = [wrap(current), wrap(v6), wrap(v5), wrap(v4)];

/** 서버가 다시 계산할 수 있는 규칙 버전. 첫 번째가 지금 버전이에요. */
export const SUPPORTED_CAREER_VERSIONS: readonly number[] = ENGINES.map((engine) => engine.version);

/** 그 버전의 엔진. 모르는 버전이면 null이에요. */
export function careerEngine(version: unknown): CareerEngine | null {
  return ENGINES.find((engine) => engine.version === version) ?? null;
}
