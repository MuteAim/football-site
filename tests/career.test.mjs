import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import ts from "typescript";

// 앱과 같은 소스를 실행해요. 파일끼리의 상대 경로 import는 변환한 data: 주소로 바꿔 이어 붙여요.
const root = fileURLToPath(new URL("..", import.meta.url));
const loaded = new Map();
async function moduleUrl(file) {
  if (loaded.has(file)) return loaded.get(file);
  const source = await readFile(file, "utf8");
  let { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
  for (const specifier of new Set([...outputText.matchAll(/from "(\.{1,2}\/[^"]+)"/g)].map((match) => match[1]))) {
    outputText = outputText.replaceAll(`from "${specifier}"`, `from "${await moduleUrl(resolve(dirname(file), `${specifier}.ts`))}"`);
  }
  const url = `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`;
  loaded.set(file, url);
  return url;
}
const load = async (path) => import(await moduleUrl(resolve(root, path)));
const E = await load("src/lib/career/engine.ts");
const D = await load("src/lib/career/data.ts");
const B = await load("src/lib/career/board.ts");
const J = await load("src/lib/career/journal.ts");

/** 테스트용 결정적 난수. 같은 순서로 같은 커리어를 만들어요. */
function lcg(seed) {
  let state = seed >>> 0;
  return (n) => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state % n; };
}

function play(seed, setup, pickChoice) {
  let state = E.createCareer(seed, 2026, setup);
  const choices = [];
  while (state.phase !== "retired") {
    const index = pickChoice(state, choices.length);
    choices.push(index);
    state = E.choose(state, index);
  }
  return { state, choices };
}

const baseSetup = { name: "손흥민2", nation: "KOR", league: "KOR", pos: "WG", pick: 0 };

test("기록집은 기존 저장에서 성적·능력치·모든 선택을 복원하고 은퇴와 이적도 해당 시즌에 남긴다", () => {
  let moments = 0, transfers = 0;
  for (const pos of ["WG", "GK"]) for (let seed = 1; seed <= 24; seed++) {
    const setup = { ...baseSetup, pos, reroll: seed % 3 };
    const save = { v: E.CAREER_VERSION, seed, startYear: 2026, setup, choices: [] };
    let state = E.createCareer(seed, 2026, setup);
    const expected = [];
    let beforeAttrs;
    const momentResults = [];
    while (state.pending) {
      if (state.phase === "training") beforeAttrs = [...state.attrs];
      const index = (save.choices.length + seed) % state.pending.options.length;
      const decision = state.pending;
      const next = E.choose(state, index);
      save.choices.push(index);
      if (next.history.length > state.history.length) expected.push({ season: next.history.at(-1), before: beforeAttrs, after: [...next.attrs] });
      if (decision.id === "moment") { moments++; momentResults.push([next.steps, next.lastMoment]); }
      if (decision.kind === "offseason" && next.club !== state.club) transfers++;
      state = next;
    }
    const snapshot = JSON.stringify(save);
    const journal = J.buildCareerJournal(save);
    assert.equal(JSON.stringify(save), snapshot, "저장 입력을 변경하면 안 돼요");
    assert.deepEqual(journal.map((entry) => entry.season), state.history);
    for (const [index, entry] of journal.entries()) {
      assert.deepEqual(entry.attrsBefore, expected[index].before);
      assert.deepEqual(entry.attrsAfter, expected[index].after);
      assert.equal(entry.entries[0].kind, "training");
      assert.ok(entry.entries.every((event) => event.choice && event.body));
    }
    const entries = journal.flatMap((entry) => entry.entries);
    assert.deepEqual(entries.map((entry) => entry.step), save.choices.map((_, i) => i + 1), "선택이 누락되거나 중복되면 안 돼요");
    for (const [step, result] of momentResults) assert.equal(entries.find((entry) => entry.step === step).outcome, result);
    assert.equal(entries.at(-1).choice, "은퇴하기");
    assert.ok(entries.at(-1).outcome);
    assert.deepEqual(J.buildCareerJournal(JSON.parse(snapshot)), journal, "새로고침·코드 가져오기도 같은 기록이어야 해요");
    // 다음 시즌 훈련을 이미 시작했어도 지난 시즌의 능력치로 돌아볼 수 있어요.
    const cutoff = journal[1].entries[0].step;
    const partial = J.buildCareerJournal({ ...save, choices: save.choices.slice(0, cutoff) });
    assert.deepEqual(partial[0], journal[0]);
  }
  assert.ok(moments > 0, "결승 선택 결과 복원도 검사해야 해요");
  assert.ok(transfers > 0, "이적 기록도 검사해야 해요");
  assert.throws(() => J.buildCareerJournal({ v: -1, seed: 1, startYear: 2026, setup: baseSetup, choices: [] }));
});

test("같은 시드와 선택이면 커리어가 똑같이 다시 계산되고, 고르기는 원래 상태를 바꾸지 않는다", () => {
  const { state, choices } = play(20261023, baseSetup, (s, step) => (step * 7 + 3) % s.pending.options.length);
  const replayed = E.replayCareer({ v: E.CAREER_VERSION, seed: 20261023, startYear: 2026, setup: baseSetup, choices });
  assert.deepEqual(JSON.parse(JSON.stringify(replayed)), JSON.parse(JSON.stringify(state)));
  assert.deepEqual(E.summarizeCareer(replayed), E.summarizeCareer(state));

  const start = E.createCareer(7, 2026, baseSetup);
  const snapshot = JSON.stringify(start);
  E.choose(start, 0);
  assert.equal(JSON.stringify(start), snapshot);
});

test("은퇴하는 순간 받은 영구 결번도 마지막 시즌 기록집에 남는다", () => {
  const setup = { ...baseSetup, nation: "ENG", league: "ENG", pick: 2 };
  for (let seed = 1; seed <= 60; seed++) {
    const { state, choices } = play(seed, setup, (s) => {
      const stay = s.pending.options.findIndex((option) => option.value === "stay" || option.value === "renew");
      return stay >= 0 ? stay : 0;
    });
    const honor = state.history.at(-1).trophies.find((entry) => entry.label.endsWith("영구 결번"));
    if (!honor) continue;
    const journal = J.buildCareerJournal({ v: E.CAREER_VERSION, seed, startYear: 2026, setup, choices });
    assert.ok(journal.at(-1).season.trophies.some((entry) => entry.label === honor.label));
    assert.deepEqual(journal.map((entry) => entry.season), state.history);
    return;
  }
  assert.fail("영구 결번 커리어를 검사하지 못했어요");
});

test("후보 선수는 시드마다 고정이고, 시작 능력치와 스카우트 별점이 범위 안이다", () => {
  for (const league of D.YOUTH_LEAGUES) {
    for (const pos of D.POSITION_ORDER) {
      const candidates = E.scoutCandidates(99, "ENG", league, pos);
      assert.deepEqual(candidates, E.scoutCandidates(99, "ENG", league, pos));
      assert.equal(candidates.length, 3);
      const ratings = candidates.map((candidate) => D.CLUBS[candidate.club].rating);
      assert.ok(ratings[0] >= ratings[1] && ratings[1] >= ratings[2], `${league} 빅클럽 → 하위권 순서`);
      for (const candidate of candidates) {
        assert.equal(D.CLUBS[candidate.club].league, league);
        assert.notEqual(candidate.club, D.MILITARY_CLUB);
        assert.ok(candidate.ovr >= 47 && candidate.ovr <= 55, `${pos} 시작 오버롤 ${candidate.ovr}`);
        assert.ok(candidate.stars >= 4 && candidate.stars <= 10);
        assert.ok(candidate.attrs.every((value) => Number.isInteger(value) && value >= 15 && value <= 85));
      }
    }
  }
  assert.notDeepEqual(E.scoutCandidates(99, "ENG", "ENG", "ST"), E.scoutCandidates(100, "ENG", "ENG", "ST"));
});

test("후보를 다시 뽑으면 새 세 명이 나오고, 다시 뽑은 커리어도 같은 결과로 다시 계산된다", () => {
  const first = E.scoutCandidates(77, "KOR", "ENG", "WG");
  assert.deepEqual(E.scoutCandidates(77, "KOR", "ENG", "WG", 0), first, "다시 뽑지 않은 후보는 예전과 같아요");
  const rolls = [1, 2, 3].map((reroll) => E.scoutCandidates(77, "KOR", "ENG", "WG", reroll));
  for (const roll of rolls) {
    assert.notDeepEqual(roll, first);
    assert.deepEqual(roll.map((candidate) => D.CLUBS[candidate.club].league), ["ENG", "ENG", "ENG"]);
  }
  assert.deepEqual(E.scoutCandidates(77, "KOR", "ENG", "WG", 2), rolls[1]);

  const setup = { ...baseSetup, league: "ENG", pick: 1, reroll: 3 };
  const { state, choices } = play(77, setup, (s, step) => (step * 5 + 1) % s.pending.options.length);
  assert.equal(state.setup.reroll, 3);
  assert.equal(state.history[0].club, rolls[2][1].club, "고른 후보의 구단에서 시작해요");
  const replayed = E.replayCareer({ v: E.CAREER_VERSION, seed: 77, startYear: 2026, setup, choices });
  assert.deepEqual(JSON.parse(JSON.stringify(replayed)), JSON.parse(JSON.stringify(state)));
  let other = null;
  try { other = E.replayCareer({ v: E.CAREER_VERSION, seed: 77, startYear: 2026, setup: { ...setup, reroll: 2 }, choices }); } catch {}
  assert.ok(!other || JSON.stringify(other) !== JSON.stringify(state), "다른 횟수로 다시 계산하면 다른 커리어예요");

  assert.equal("reroll" in E.createCareer(77, 2026, { ...baseSetup, reroll: 0 }).setup, false, "0번은 예전 저장 모양 그대로예요");
  assert.deepEqual(E.createCareer(77, 2026, { ...baseSetup, reroll: 0 }), E.createCareer(77, 2026, baseSetup));
  for (const reroll of [-1, 1.5, E.CAREER_RULES.maxRerolls + 1, "1", null]) {
    assert.throws(() => E.createCareer(77, 2026, { ...baseSetup, reroll }), E.CareerError, String(reroll));
  }
  assert.ok(E.CAREER_RULES.rankedRerolls < E.CAREER_RULES.maxRerolls);
});

/** "이에요"는 받침 뒤에, "예요"는 받침 없는 말 뒤에 와요. */
function copulaOk(text) {
  for (const [, before, ending] of text.matchAll(/([가-힣])(이에요|예요)/g)) {
    const batchim = (before.charCodeAt(0) - 0xac00) % 28 !== 0;
    if ((ending === "이에요") !== batchim) return false;
  }
  return true;
}

/** 고르기 전에 결정 카드가 규칙을 지키는지 살펴요. */
function checkDecision(s, seen) {
  const decision = s.pending;
  for (const text of [decision.body, ...decision.options.flatMap((option) => [option.label, option.detail])]) assert.ok(copulaOk(text), text);
  if (decision.kind === "training") {
    for (const option of decision.options.filter((item) => item.value.startsWith("attr"))) assert.match(option.detail, /→ \d+ · 오버롤/);
  }
  if (decision.kind === "offseason") {
    const ovr = E.overall(s.attrs, s.pos);
    const home = [D.CLUBS[s.club].league, D.NATIONS[s.nation].home];
    for (const option of decision.options.filter((item) => item.value === "transfer" && !item.detail.endsWith("자유 계약"))) {
      const club = D.CLUBS[option.club];
      assert.ok(club.rating <= ovr + 10, `${club.name}(${club.rating})이 오버롤 ${ovr} 선수에게 제안`);
      if (ovr < 60) assert.ok(home.includes(club.league), `덜 여문 유망주(${ovr})에게 해외 제안: ${club.name}`);
      seen.offers++;
    }
  }
  if (decision.kind === "event" && decision.id !== "moment" && s.history.length === 0) seen.firstEvents++;
}

test("무작위로 수백 번 골라도 규칙이 깨지지 않고 모든 커리어가 은퇴로 끝난다", () => {
  const random = lcg(42);
  const seen = { ballon: 0, military: 0, exempt: 0, loan: 0, transfer: 0, offers: 0, firstEvents: 0, reserve: 0, youthCup: 0 };
  for (let n = 0; n < 300; n++) {
    const nation = D.NATION_ORDER[random(D.NATION_ORDER.length)];
    const setup = {
      name: "테스트", nation, league: random(2) ? D.NATIONS[nation].home : D.YOUTH_LEAGUES[random(D.YOUTH_LEAGUES.length)],
      pos: D.POSITION_ORDER[random(D.POSITION_ORDER.length)], pick: random(3),
    };
    const { state, choices } = play(random(2 ** 31) * 2 + random(2), setup, (s) => {
      checkDecision(s, seen);
      return random(s.pending.options.length);
    });
    assert.equal(state.phase, "retired");
    assert.ok(choices.length <= E.CAREER_RULES.maxChoices);
    assert.ok(state.age >= 30 && state.age <= E.CAREER_RULES.maxAge, `은퇴 나이 ${state.age}`);
    assert.ok(state.attrs.every((value) => Number.isInteger(value) && value >= 10 && value <= 99));
    for (const [index, season] of state.history.entries()) {
      assert.equal(season.age, E.CAREER_RULES.startAge + index);
      assert.ok(season.apps >= 0 && season.goals >= 0 && season.assists >= 0 && season.minutes <= season.apps * 90);
      assert.ok(season.rating === 0 || (season.rating >= 50 && season.rating <= 99));
      assert.ok(season.ballon >= 0 && season.ballon <= 30);
      if (season.military) {
        assert.equal(season.club, D.MILITARY_CLUB);
        assert.ok(season.age >= 28);
        seen.military++;
      }
      if (season.loan) seen.loan++;
      if (season.reserve) {
        assert.ok(season.age <= 22 && !season.military && season.reserve.apps > 0, "2군은 22세 이하 유망주·백업만 뛰어요");
        seen.reserve++;
      }
      if (season.tournaments.some((label) => label.includes("U-20 월드컵"))) {
        assert.ok(season.age <= 19);
        seen.youthCup++;
      }
    }
    if (state.nation === "KOR") {
      const served = state.history.filter((season) => season.military).length;
      if (state.military === "exempt") { assert.equal(served, 0); seen.exempt++; }
      else assert.equal(served, 1, "병역 미필로 은퇴할 수 없어요");
    } else assert.equal(state.history.filter((season) => season.military).length, 0);
    const summary = E.summarizeCareer(state);
    assert.ok(Number.isInteger(summary.score) && summary.score >= 0 && summary.score <= B.MAX_CAREER_SCORE);
    const parts = E.legacyBreakdown(state);
    assert.equal(Object.values(parts).reduce((sum, value) => sum + value, 0), summary.score, "점수 내역의 합이 레전드 점수예요");
    assert.equal(summary.seasons, state.history.length);
    assert.ok(summary.peakOvr >= state.history[0].ovrStart && summary.peakOvr <= 99);
    assert.ok(summary.clubs.length >= 1 && summary.lastClub);
    seen.ballon += summary.ballonDor;
    seen.transfer += summary.clubs.length > 1 ? 1 : 0;
  }
  assert.ok(seen.military > 0 && seen.exempt > 0, "병역 복무와 면제가 모두 나와요");
  assert.ok(seen.loan > 0 && seen.transfer > 0 && seen.offers > 0, "임대와 이적이 모두 나와요");
  assert.equal(seen.firstEvents, 300, "첫 시즌에는 늘 사건이 있어요");
  assert.ok(seen.reserve > 0 && seen.youthCup > 0, "2군 경기와 U-20 월드컵이 나와요");
});

/** 이어지는 사건이 잘 나오도록 사건을 일으키는 쪽을 자주 골라요. 나머지는 무작위예요. */
function storyPicker(random) {
  const prefer = { sns: "prove", bigclub: "go", agent: "sign", loyalLegend: "promise" };
  return (s) => {
    const { kind, id, options } = s.pending;
    const index = (value) => options.findIndex((option) => option.value === value);
    if (kind === "event" && prefer[id] && index(prefer[id]) >= 0) return index(prefer[id]);
    if (kind === "offseason" && random(10) < 6) {
      const stay = options.findIndex((option) => option.value === "stay" || option.value === "renew");
      if (stay >= 0) return stay;
    }
    return random(options.length);
  };
}

test("라이벌·결정적 순간·이어지는 사건이 규칙대로 움직인다", () => {
  const random = lcg(2027);
  const pickStory = storyPicker(random);
  const seen = new Set();
  const hints = { right: 0, total: 0 };
  let replayedMoment = false;
  for (let n = 0; n < 300; n++) {
    const nation = D.NATION_ORDER[random(D.NATION_ORDER.length)];
    const setup = { name: "라이벌", nation, league: D.NATIONS[nation].home, pos: D.POSITION_ORDER[random(D.POSITION_ORDER.length)], pick: random(3) };
    const seed = random(2 ** 31);
    let state = E.createCareer(seed, 2026, setup);
    assert.notEqual(state.rival.club, state.club, "라이벌은 다른 구단 유스에서 시작해요");
    const choices = [];
    let moments = 0;
    while (state.phase !== "retired") {
      const { kind, id, options, title, body } = state.pending;
      const d = state.draft;
      if (kind === "event") {
        seen.add(id);
        const last = state.history.at(-1);
        if (id === "moment") {
          const m = d.moment;
          assert.ok(m && title.startsWith(`${m.name} 결승`), title);
          assert.equal(m.kind === "save", state.pos === "GK", "골키퍼는 선방, 필드 플레이어는 킥");
          assert.deepEqual(options.map((option) => option.value.split(":")[0]), Array(3).fill({ penalty: "kick", save: "dive", freekick: "fk" }[m.kind]));
          assert.ok(body.includes("스카우팅 리포트"));
          hints.total++;
          if (m.hint === m.style) hints.right++;
        }
        if (id === "discipline") assert.ok(state.flags.includes(`scandal-${d.year - 1}`));
        if (id === "fanAnger") assert.ok(state.flags.includes(`bigclub-${d.year - 1}`) && last.club === d.club);
        if (id === "agentPush") assert.ok(state.flags.includes("agent") && !state.flags.includes("agent-push"));
        if (id === "surgery") assert.ok(d.major && state.injury >= 10);
        if (id === "rivalTeammate") assert.equal(state.rival.club, d.club);
        if (id === "rivalClash") assert.ok(state.rival.club !== d.club && D.CLUBS[state.rival.club].league === D.CLUBS[d.club].league);
        if (id === "rivalBallon") assert.equal(last.rival.ballon, 1);
        for (const text of [title, body, ...options.map((option) => option.label)]) assert.ok(copulaOk(text), text);
      }
      const index = pickStory(state);
      const before = state;
      choices.push(index);
      state = E.choose(state, index);
      if (id === "moment") {
        moments++;
        const m = before.draft.moment;
        assert.match(state.lastMoment, new RegExp(`^${m.name} 결승 · .+ · (우승!|준우승)$`));
        const won = state.lastMoment.endsWith("우승!");
        const season = state.draft?.year === before.draft.year ? null : state.history.at(-1);
        const highlights = season ? season.highlights : state.draft.highlights;
        assert.ok(highlights.includes(state.lastMoment), "결정적 순간은 시즌 하이라이트에 남아요");
        if (season && m.comp === "cup") assert.equal(season.cup, won ? 6 : 5);
        if (season && m.comp === "cont") assert.equal(season.continental, won ? 6 : 5);
        if (season && m.comp === "nt") assert.ok(season.tournaments.includes(`${m.name} ${won ? "우승" : "준우승"}`), season.tournaments.join());
      } else assert.equal(state.lastMoment, null, "결정적 순간 결과는 다음 선택 때 지워요");
    }
    if (moments && !replayedMoment) {
      const replayed = E.replayCareer({ v: E.CAREER_VERSION, seed, startYear: 2026, setup, choices });
      assert.deepEqual(JSON.parse(JSON.stringify(replayed)), JSON.parse(JSON.stringify(state)), "결정적 순간이 있어도 다시 계산하면 같아요");
      replayedMoment = true;
    }

    // 라이벌의 통산 기록은 시즌 기록의 합이고, 은퇴하면 그다음 시즌부터 기록이 없어요.
    const rv = state.rival;
    const seasons = state.history.map((season) => season.rival).filter(Boolean);
    assert.equal(rv.pos, setup.pos);
    assert.ok(D.NATION_ORDER.includes(rv.nation) && rv.name.length >= 2);
    assert.equal(rv.apps, seasons.reduce((sum, season) => sum + season.apps, 0));
    assert.equal(rv.goals, seasons.reduce((sum, season) => sum + season.goals, 0));
    assert.equal(rv.trophies, seasons.reduce((sum, season) => sum + season.trophies.length, 0));
    assert.equal(rv.ballonDor, seasons.filter((season) => season.ballon === 1).length);
    assert.ok(rv.best >= Math.max(...seasons.map((season) => season.ovr)) && rv.best <= 99);
    assert.ok(state.history.every((season) => !(season.ballon === 1 && season.rival?.ballon === 1)), "발롱도르는 한 해에 한 명");
    const retiredAt = state.history.findIndex((season) => season.rival?.retired);
    if (rv.retiredAge !== null) {
      assert.ok(retiredAt >= 0 && rv.retiredAge >= 34 && rv.retiredAge <= 38);
      assert.ok(state.history.slice(retiredAt + 1).every((season) => season.rival === null));
    } else assert.equal(retiredAt, -1);
    for (const value of Object.values(rv.h2h)) assert.ok(Number.isInteger(value) && value >= 0);
    const summary = E.summarizeCareer(state);
    assert.equal(summary.rival.beat, E.beatRival(state));
    assert.equal(E.legacyBreakdown(state).rival, rv.h2h.won * 10 + (summary.rival.beat ? 150 : 0));

    // 영구 결번은 약속한 팀에서 은퇴할 때만 받아요.
    const legend = state.history.flatMap((season) => season.trophies).filter((honor) => honor.label.endsWith("영구 결번"));
    if (legend.length) {
      assert.equal(legend.length, 1);
      assert.ok(state.history.at(-1).trophies.includes(legend[0]));
      assert.ok(state.flags.includes(`legend:${state.history.at(-1).club}`));
      seen.add("legendRetired");
    }
  }
  for (const id of ["moment", "discipline", "fanAnger", "agentPush", "surgery", "loyalLegend", "rivalClash", "rivalPress", "rivalBallon", "rivalTeammate", "legendRetired"]) {
    assert.ok(seen.has(id), `${id} 사건이 한 번은 나와요`);
  }
  const ratio = hints.right / hints.total;
  assert.ok(hints.total >= 100 && ratio > 0.7 && ratio < 0.9, `스카우팅 리포트 적중률 ${ratio}`);
});

test("잘못된 선수 정보·선택·버전은 거절한다", () => {
  for (const name of ["", " 공백", "열한글자가넘는이름이야", "<b>", "a\nb"]) {
    assert.throws(() => E.createCareer(1, 2026, { ...baseSetup, name }), E.CareerError, name);
  }
  assert.equal(E.cleanName("  손   흥민  "), "손 흥민");
  for (const patch of [{ nation: "XXX" }, { league: "ENG2" }, { league: "KSA" }, { pos: "LW" }, { pick: 3 }, { pick: 1.5 }]) {
    assert.throws(() => E.createCareer(1, 2026, { ...baseSetup, ...patch }), E.CareerError, JSON.stringify(patch));
  }
  for (const [seed, year] of [[-1, 2026], [2 ** 32, 2026], [1.5, 2026], [1, 1999]]) {
    assert.throws(() => E.createCareer(seed, year, baseSetup), E.CareerError);
  }
  const state = E.createCareer(3, 2026, baseSetup);
  for (const index of [-1, 3, 1.5, Number.NaN]) assert.throws(() => E.choose(state, index), E.CareerError);
  const { state: retired, choices } = play(3, baseSetup, () => 0);
  assert.throws(() => E.choose(retired, 0), E.CareerError);
  assert.throws(() => E.replayCareer({ v: E.CAREER_VERSION, seed: 3, startYear: 2026, setup: baseSetup, choices: [...choices, 0] }), E.CareerError);
  assert.throws(() => E.replayCareer({ v: E.CAREER_VERSION + 1, seed: 3, startYear: 2026, setup: baseSetup, choices }), E.CareerError);
});

test("도전장 링크는 유효한 날짜와 범위 안의 점수만 받는다", () => {
  assert.deepEqual(B.readCareerChallenge("4321", "2026-10-23"), { score: 4321, day: "2026-10-23" });
  for (const value of ["100001", "-1", "1e3", "12.5", "NaN", null]) assert.equal(B.readCareerChallenge(value, "2026-10-23"), null);
  assert.equal(B.readCareerChallenge("100", "2026-02-30"), null);
  assert.equal(B.careerDay(new Date("2026-10-23T14:59:59Z")), "2026-10-23");
  assert.equal(B.careerDay(new Date("2026-10-23T15:00:00Z")), "2026-10-24");
  assert.equal(E.seasonYearOf(new Date("2026-06-30T14:59:59Z")), 2025);
  assert.equal(E.seasonYearOf(new Date("2026-06-30T15:00:00Z")), 2026);
});

test("레전드 로드 실제 DB 시작·기록·순위·권한", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    alter default privileges in schema public grant usage on sequences to authenticated;
    create publication supabase_realtime;
  `);
  const schema = await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8");
  await db.exec(schema);
  const users = [1, 2, 3, 4].map((n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`);
  for (const [i, id] of users.entries()) {
    await db.query("insert into auth.users values($1)", [id]);
    if (i < 3) await db.query("insert into public.profiles(id, nickname) values($1, $2)", [id, `감독${i + 1}`]);
  }
  async function as(user, sql, params = [], role = "authenticated") {
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user ?? ""]);
    await db.exec(`set role ${role}`);
    try { return (await db.query(sql, params)).rows; }
    finally { await db.exec("reset role"); }
  }
  const start = async (user) => (await as(user, "select * from public.career_start()"))[0];
  const age = (user, seconds = 120) => db.query("update public.career_runs set started_at = clock_timestamp() - $2 * interval '1 second' where user_id = $1", [user, seconds]);
  const record = async (user, run, entry) => (await as(null, "select * from public.career_record($1, $2, $3::jsonb)", [user, run, JSON.stringify(entry)], "service_role"))[0];
  const board = async (user, day) => (await as(user, "select public.career_board($1) as result", [day]))[0].result;
  /** 서버 동작과 같은 방법으로 다시 계산한 은퇴 기록 */
  function retire(seed, startYear, setup) {
    // 포지션을 바꾸지 않아야 베스트 11 자리를 예상할 수 있어요.
    const { choices } = play(seed, setup, (s) => (s.pending.kind === "offseason" ? s.pending.options.length - 1
      : Math.max(0, s.pending.options.findIndex((option) => !option.value.startsWith("move:")))));
    const summary = E.summarizeCareer(E.replayCareer({ v: E.CAREER_VERSION, seed, startYear, setup, choices }));
    return {
      position: summary.pos, name: summary.name, nation: summary.nation, club: summary.lastClub, score: summary.score,
      ballonDor: summary.ballonDor, peakOvr: summary.peakOvr, goals: summary.goals, assists: summary.assists,
      apps: summary.apps, trophies: summary.trophies, seasons: summary.seasons,
    };
  }

  await t.test("회원만 시작하고, 표와 기록 함수는 직접 쓸 수 없다", async () => {
    await assert.rejects(start(users[3]), /닉네임/);
    await assert.rejects(as(null, "select * from public.career_start()", [], "anon"), /permission denied/);
    await assert.rejects(as(users[0], "select * from public.career_runs"), /permission denied/);
    await assert.rejects(as(users[0], "select * from public.career_records"), /permission denied/);
    await assert.rejects(as(users[0], "select * from public.career_record($1, gen_random_uuid(), '{}'::jsonb)", [users[0]]), /permission denied/);
  });

  let first;
  let entry;
  await t.test("시드와 시작 시즌을 서버가 정하고, 너무 잦은 시작과 너무 빠른 은퇴를 막는다", async () => {
    first = await start(users[0]);
    assert.ok(Number(first.seed) >= 0 && Number(first.seed) <= 4294967295);
    assert.ok(first.start_year >= 2025);
    await assert.rejects(start(users[0]), /3초/);
    entry = retire(Number(first.seed), first.start_year, { ...baseSetup, name: "첫 선수" });
    await assert.rejects(record(users[0], first.run_id, entry), /너무 짧아요/);
    await assert.rejects(record(users[1], first.run_id, entry), /새 커리어/);
  });

  await t.test("기록은 한 번만 반영되고, 같은 포지션은 최고 점수만 남는다", async () => {
    await age(users[0]);
    const saved = await record(users[0], first.run_id, entry);
    assert.equal(saved.is_new, true);
    const again = await record(users[0], first.run_id, { ...entry, score: entry.score + 999 });
    assert.equal(again.is_new, false);
    assert.equal(String(again.record_day), String(saved.record_day));
    const day = new Date(saved.record_day).toISOString().slice(0, 10);
    let result = await board(users[0], day);
    assert.equal(result.participants, 1);
    assert.deepEqual(result.personal, { score: entry.score, rank: 1 });

    await age(users[0], 4);
    const second = await start(users[0]);
    await age(users[0]);
    await record(users[0], second.run_id, { ...entry, name: "낮은 점수", score: Math.max(0, entry.score - 1) });
    result = await board(users[0], day);
    assert.equal(result.leaders[0].name, entry.name);
    assert.equal(result.leaders[0].score, entry.score);
  });

  await t.test("회원마다 최고 기록 하나로 순위를 매기고, 베스트 11은 포지션별로 뽑는다", async () => {
    const day = new Date((await db.query("select recorded_day from public.career_runs where user_id = $1", [users[0]])).rows[0].recorded_day).toISOString().slice(0, 10);
    const entries = [
      [users[1], { ...entry, name: "센터백1", position: "CB", score: entry.score + 500 }],
      [users[1], { ...entry, name: "윙어", position: "WG", score: 10 }],
      [users[2], { ...entry, name: "센터백2", position: "CB", score: entry.score + 500 }],
    ];
    for (const [user, item] of entries) {
      await age(user, 4);
      const run = await start(user);
      await age(user);
      await record(user, run.run_id, item);
    }
    const result = await board(null, day);
    assert.equal(result.participants, 3);
    assert.equal(result.personal, null);
    assert.deepEqual(result.leaders.map((leader) => [leader.nickname, leader.rank]), [["감독2", 1], ["감독3", 1], ["감독1", 3]]);
    assert.ok(result.leaders.every((leader) => !leader.isMe && !("user_id" in leader)));
    const cbs = result.eleven.filter((slot) => slot.position === "CB");
    assert.deepEqual(cbs.map((slot) => slot.slot), [1, 2]);
    assert.equal(entry.position, "WG");
    assert.deepEqual(result.eleven.filter((slot) => slot.position === "WG").map((slot) => slot.name), [entry.name, "윙어"]);
    assert.equal((await as(null, "select public.career_board('2000-01-01') as result", [], "anon"))[0].result.leaders.length, 0);
  });

  await t.test("스키마를 다시 실행해도 기록이 남는다", async () => {
    const before = (await db.query("select count(*)::int as count from public.career_records")).rows[0].count;
    await db.exec(schema);
    assert.equal((await db.query("select count(*)::int as count from public.career_records")).rows[0].count, before);
  });
});
