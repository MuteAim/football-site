import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const root = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(import.meta.url);
const loaded = new Map();
async function moduleUrl(file) {
  if (loaded.has(file)) return loaded.get(file);
  let { outputText } = ts.transpileModule(await readFile(file, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } });
  for (const specifier of new Set([...outputText.matchAll(/from "([^"]+)"/g)].map((match) => match[1]))) {
    let url;
    if (specifier.startsWith(".") || specifier.startsWith("@/")) {
      const path = specifier.startsWith("@/") ? resolve(root, "src", specifier.slice(2)) : resolve(dirname(file), specifier);
      url = await moduleUrl(existsSync(`${path}.ts`) ? `${path}.ts` : `${path}.tsx`);
    } else url = pathToFileURL(require.resolve(specifier)).href;
    outputText = outputText.replaceAll(`from "${specifier}"`, `from "${url}"`);
  }
  const url = `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`;
  loaded.set(file, url);
  return url;
}

/** 실제 라인업 컴포넌트에 허용되는 최대 길이의 이름·닉네임을 채워 화면을 검사해요. */
export async function careerBoardFixture() {
  const { CareerBoard } = await import(await moduleUrl(resolve(root, "src/components/games/CareerBoard.tsx")));
  const slots = [["WG", "L"], ["ST"], ["WG", "R"], ["CM"], ["DM"], ["AM"], ["FB", "L"], ["CB"], ["CB"], ["FB", "R"], ["GK"]];
  const eleven = slots.map(([position, side], i) => ({
    position, side, slot: i === 8 ? 2 : 1,
    name: i % 2 ? "WWWWWWWWWW" : "가나다라마바사아자차", nickname: i % 2 ? "WWWWWWWWWWWW" : "가나다라마바사아자차카타",
    score: 100000 - i * 1000, peakOvr: 99, ballonDor: 5,
  }));
  const snapshot = {
    day: "2026-10-25", available: true, member: false, owner: null,
    board: { participants: 11, personal: null, eleven, leaders: eleven.map((entry, i) => ({ ...entry, rank: i + 1, nation: "KOR", club: "", goals: 1000, isMe: i === 0 })) },
  };
  return { html: renderToStaticMarkup(createElement(CareerBoard, { snapshot })), eleven };
}

/** 실제 엔진에서 결승·수상 직전 저장을 찾아요. 테스트용 결과를 게임에 주입하지 않아요. */
export async function cinematicFixtures() {
  const E = await import(await moduleUrl(resolve(root, "src/lib/career/engine.ts")));
  const D = await import(await moduleUrl(resolve(root, "src/lib/career/data.ts")));
  const M = await import(await moduleUrl(resolve(root, "src/lib/career/cinematics.ts")));
  const roles = { starter: 3, rotation: 2, bench: 1, reserve: 0 };
  let final, awards, keeper;
  for (const pos of ["ST", "GK"]) {
    seeds: for (let seed = 1; seed <= 240; seed++) {
      const setup = { name: "연출테스트", nation: "ENG", league: "ENG", pos, pick: 2, number: pos === "GK" ? 1 : 9, foot: "R" };
      if (E.scoutCandidates(seed, "ENG", "ENG", pos)[2].potential < 84) continue;
      let state = E.createCareer(seed, 2026, setup);
      const choices = [];
      while (state.pending) {
        const { options, kind } = state.pending;
        let index = 0;
        if (kind === "offseason") {
          const rank = (option) => option.value === "retire" ? -1000 : !option.club ? 0 : roles[E.expectedRole(state, option.club, true)] * 100 + D.LEAGUES[D.CLUBS[option.club].league].prestige;
          index = options.reduce((best, option, i) => rank(option) > rank(options[best]) ? i : best, 0);
        } else if (kind === "training") {
          const gain = (option) => Number(/오버롤 \+(\d+)/.exec(option.detail)?.[1] ?? 0);
          index = options.reduce((best, option, i) => gain(option) > gain(options[best]) ? i : best, 0);
        } else index = (seed + state.year) % options.length;
        const next = E.choose(state, index);
        const scenes = M.careerCinematics(state, next, index);
        const capture = () => ({ save: { v: E.CAREER_VERSION, seed, startYear: 2026, setup, choices: [...choices] }, index, scenes });
        if (!final && scenes.some((scene) => scene.type === "final")) final = capture();
        if (!keeper && scenes.some((scene) => scene.type === "final" && scene.kind === "save" && scene.shot === "goal" && scene.direction !== "C")) keeper = capture();
        const award = scenes.find((scene) => scene.type === "awards");
        if (award && (!awards || award.ballonDor)) awards = capture();
        choices.push(index);
        state = next;
        if (pos === "ST" && final && awards?.scenes.some((scene) => scene.type === "awards" && scene.ballonDor)) break seeds;
        if (final && awards && keeper) return { final, awards, keeper };
      }
    }
  }
  if (!final || !awards || !keeper) throw new Error("결승·선방·수상 연출을 검증할 실제 커리어를 찾지 못했어요.");
  return { final, awards, keeper };
}

/** 유망주 영입과 입단 후 테스트 직전의 실제 선택 기록이에요. 화면과 저장 복원을 함께 확인해요. */
export async function prospectFixtures() {
  const E = await import(await moduleUrl(resolve(root, "src/lib/career/engine.ts")));
  const setup = { name: "미래스타", nation: "KOR", league: "KOR", pos: "ST", pick: 2, number: 9, foot: "R" };
  for (let seed = 1; seed <= 400; seed++) {
    if (E.scoutCandidates(seed, setup.nation, setup.league, setup.pos)[setup.pick].potential < 84) continue;
    let state = E.createCareer(seed, 2026, setup);
    const choices = [];
    let offer, joined;
    while (state.pending && state.age <= 22) {
      let index = 0;
      const prospect = state.pending.options.findIndex((option) => option.prospect);
      const capture = (pick) => ({ save: { v: E.CAREER_VERSION, seed, startYear: 2026, setup, choices: [...choices] }, index: pick });
      if (!offer && prospect >= 0) {
        index = prospect;
        offer = capture(index);
      }
      if (offer && state.pending.id === "prospectTest") return { offer, joined, test: capture(0) };
      state = E.choose(state, index);
      choices.push(index);
      if (offer && !joined) joined = capture(0);
    }
  }
  throw new Error("유망주 영입과 1군 테스트를 검증할 실제 커리어를 찾지 못했어요.");
}
