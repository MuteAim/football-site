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
const A = await load("src/lib/career/archive.ts");
const G = await load("src/lib/career/badges.ts");
const C = await load("src/lib/career/card.ts");
const K = await load("src/lib/career/crests.ts");
const T = await load("src/lib/career/storage.ts");
const M = await load("src/lib/career/cinematics.ts");
const V = await load("src/lib/career/versions.ts");
const E6 = await load("src/lib/career/legacy/v6/engine.ts");
const E5 = await load("src/lib/career/legacy/v5/engine.ts");
const E4 = await load("src/lib/career/legacy/v4/engine.ts");

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

const baseSetup = { name: "손흥민2", nation: "KOR", league: "KOR", pos: "WG", pick: 0, number: 7, foot: "R", side: "L" };
/** baseSetup을 바꾼 선수 정보. 측면은 윙어·풀백만 가져요. */
function S(patch = {}) {
  const { side, ...rest } = { ...baseSetup, ...patch };
  return E.FLANKS.includes(rest.pos) ? { ...rest, side: side ?? "L" } : rest;
}

test("수상 연출은 내 선수의 실제 수상만 모으고 발롱도르 수상과 순위를 구분한다", () => {
  const {state}=play(31,baseSetup,()=>0);
  const season={...state.history[0],trophies:[{label:'챔피언스리그 우승',points:180}],awards:[{label:'2030 발롱도르',points:500},{label:'득점왕',points:70}]};
  const snapshot=JSON.stringify(season);
  const scene=M.seasonCeremony(season,'테스트');
  assert.equal(scene.title,'2030 발롱도르');
  assert.equal(scene.ballonDor,true);
  assert.deepEqual(scene.honors,['2030 발롱도르','챔피언스리그 우승','득점왕']);
  assert.equal(scene.player,'테스트');
  assert.equal(JSON.stringify(season),snapshot,'기록의 정렬이나 난수를 바꾸지 않아요');
  assert.equal(M.seasonCeremony({...season,trophies:[],awards:[{label:'발롱도르 2위',points:80}]},'테스트').ballonDor,false);
  assert.equal(M.seasonCeremony({...season,trophies:[],awards:[]},'테스트'),null);
});

test("새로 받은 상만 연출하고 다음 선택이나 기존 기록을 불러올 때는 중복하지 않는다", () => {
  const before=E.createCareer(31,2026,baseSetup);
  assert.deepEqual(M.careerCinematics(before,E.choose(before,0),0),[]);
  const season={...play(31,baseSetup,()=>0).state.history[0],trophies:[{label:'K리그1 우승',points:30}],awards:[]};
  const after={...before,steps:3,history:[season]};
  assert.equal(M.careerCinematics(before,after,0).length,1);
  assert.deepEqual(M.careerCinematics(after,{...after,steps:4},0),[]);
  const retiring={...after,steps:5,phase:'retired',history:[{...season,trophies:[...season.trophies,{label:'영구 결번',points:60}]}]};
  assert.deepEqual(M.careerCinematics(after,retiring,0)[0].honors,['영구 결번']);
});

test("결승 연출은 슈팅·선방 결과와 동료 덕분에 우승한 결과를 정확히 나눈다", () => {
  const before=E.choose(E.createCareer(31,2026,baseSetup),0);
  for(const [kind,text,won,shot]of[
    ['penalty','왼쪽으로 침착하게 성공시켰어요',true,'goal'],
    ['penalty','왼쪽으로 찼지만 키퍼에게 막혔어요',false,'saved'],
    ['save','왼쪽을 읽어 낸 선방으로 승부를 끝냈어요',true,'saved'],
    ['save','상대 키커의 슈팅이 골대를 벗어났어요',true,'wide'],
    ['save','막지는 못했지만 동료들이 승부차기를 마무리했어요',true,'goal'],
    ['save','선방에 실패했고 승부차기에서 졌어요',false,'goal'],
    ['freekick','프리킥은 막혔지만 연장 끝에 이겼어요',true,'saved'],
  ]){
    const start=structuredClone(before);
    start.pending={kind:'event',id:'moment',title:'결승',body:'',options:[{label:'왼쪽',detail:'',tone:'neutral',value:kind==='save'?'dive:L':'kick:L'}]};
    start.draft.moment={comp:'cup',name:'FA컵',opponent:'라이벌',kind,style:'L',hint:'L',base:0};
    const after={...start,steps:start.steps+1,lastMoment:`FA컵 결승 · ${text} · ${won?'우승!':'준우승'}`};
    const snapshot=JSON.stringify([start,after]);
    const [scene]=M.careerCinematics(start,after,0);
    assert.equal(scene.type,'final');
    assert.equal(scene.shot,shot,text);
    assert.equal(scene.won,won,text);
    assert.equal(JSON.stringify([start,after]),snapshot);
  }
});

test("은퇴 보관함은 통산·팀별 합계와 모든 수상·칭호만 남기고 복귀·임대·군 팀도 실제 소속으로 합산한다", () => {
  const { state, choices } = play(19, baseSetup, () => 0);
  const save = { v: E.CAREER_VERSION, seed: 19, startYear: 2026, setup: baseSetup, choices };
  const sample = state.history[0];
  state.history = [
    { ...sample, club: "tottenham", apps: 20, goals: 5, assists: 2 },
    { ...sample, club: "seoul", loan: true, apps: 10, goals: 3, assists: 4 },
    { ...sample, club: "tottenham", apps: 30, goals: 7, assists: 8 },
    { ...sample, club: "gimcheon", military: true, apps: 15, goals: 2, assists: 1, trophies: [{ label: "김천 영구 결번", points: 80 }] },
  ];
  const record = A.archiveCareer(state, save, false, "2026-10-24T12:00:00.000Z");
  const summary = E.summarizeCareer(state);
  assert.equal(record.clubs.length, 3);
  assert.deepEqual(record.clubs.map(({ club, seasons, apps, goals, assists }) => ({ club, seasons, apps, goals, assists })), [
    { club: "tottenham", seasons: 2, apps: 50, goals: 12, assists: 10 },
    { club: "seoul", seasons: 1, apps: 10, goals: 3, assists: 4 },
    { club: "gimcheon", seasons: 1, apps: 15, goals: 2, assists: 1 },
  ]);
  for (const key of ["seasons", "apps", "goals", "assists", "cleanSheets"]) {
    assert.equal(record.totals[key], summary[key]);
    assert.equal(record.clubs.reduce((sum, club) => sum + club[key], 0), record.totals[key]);
  }
  assert.deepEqual(record.honors, summary.honors);
  assert.ok(record.honors.some((honor) => honor.label.includes("영구 결번")));
  assert.equal(record.title, summary.title);
  assert.deepEqual(Object.keys(record).sort(), ["v", "id", "retiredAt", "ranked", "name", "nation", "pos", "number", "foot", "side", "score", "grade", "title", "totals", "clubs", "honors"].sort());
  assert.equal(A.archiveCareer(state, { ...save, setup: S({ reroll: 0 }) }, false).id, record.id, "이전 저장의 생략된 reroll은 0과 같아요");
  assert.throws(() => A.archiveCareer(E.createCareer(19, 2026, baseSetup), save, false));
});

test("브라우저 저장은 계정마다 나뉘고, 로그인하면 로그인 전 기록만 가져가며 다른 회원 칸은 건드리지 않는다", () => {
  const { state, choices } = play(29, baseSetup, () => 0);
  const save = { v: E.CAREER_VERSION, seed: 29, startYear: 2026, setup: baseSetup, choices };
  const entry = (id) => ({ ...A.archiveCareer(state, save, false, "2026-10-24T12:00:00.000Z"), id });
  const memory = () => {
    const map = new Map();
    return { map, getItem: (key) => map.has(key) ? map.get(key) : null, setItem: (key, value) => { map.set(key, String(value)); }, removeItem: (key) => { map.delete(key); } };
  };
  const A1 = "aaaaaaaa-0000-4000-8000-000000000001", B1 = "bbbbbbbb-0000-4000-8000-000000000002";
  const guest = T.careerKeys(null), a = T.careerKeys(A1), b = T.careerKeys(B1);
  assert.deepEqual(guest, { save: "football-career-v1:guest", archive: "football-career-archive-v2:guest" });
  assert.notEqual(a.save, b.save);

  // 계정을 나누기 전 칸은 처음 들어온 사람에게 한 번 넘어가요.
  const store = memory();
  store.setItem(T.CAREER_SAVE_KEY, "legacy-save");
  store.setItem(A.CAREER_ARCHIVE_KEY, JSON.stringify([entry("legacy")]));
  T.adoptCareerStorage(store, A1);
  assert.equal(store.getItem(a.save), "legacy-save");
  assert.deepEqual(A.readRetirements(store, a.archive).map((item) => item.id), ["legacy"]);
  assert.equal(store.getItem(T.CAREER_SAVE_KEY), null);
  assert.equal(store.getItem(A.CAREER_ARCHIVE_KEY), null);

  // 로그아웃하면 비회원 칸만 보여요. 회원 A의 칸은 그대로예요.
  T.adoptCareerStorage(store, null);
  assert.equal(store.getItem(guest.save), null);
  assert.equal(store.getItem(a.save), "legacy-save");

  // 비회원으로 하던 기록은 다음에 로그인한 회원 B가 가져가고, A의 칸은 B에게 가지 않아요.
  store.setItem(guest.save, "guest-save");
  store.setItem(guest.archive, JSON.stringify([entry("guest")]));
  T.adoptCareerStorage(store, B1);
  assert.equal(store.getItem(b.save), "guest-save");
  assert.deepEqual(A.readRetirements(store, b.archive).map((item) => item.id), ["guest"]);
  assert.equal(store.getItem(guest.save), null);
  assert.equal(store.getItem(guest.archive), null);
  assert.deepEqual(A.readRetirements(store, a.archive).map((item) => item.id), ["legacy"], "A의 보관함은 그대로예요");
  assert.equal(store.getItem(a.save), "legacy-save");

  // 회원에게 진행 중인 커리어가 있으면 비회원 커리어는 덮어쓰지 않고 남겨 두고, 은퇴 보관함만 합쳐요.
  store.setItem(guest.save, "second-guest");
  store.setItem(guest.archive, JSON.stringify([entry("guest2")]));
  T.adoptCareerStorage(store, B1);
  assert.equal(store.getItem(b.save), "guest-save");
  assert.equal(store.getItem(guest.save), "second-guest");
  assert.deepEqual(A.readRetirements(store, b.archive).map((item) => item.id).sort(), ["guest", "guest2"]);

  // 읽을 수 없는 보관함은 지우지 않아요.
  store.setItem(guest.archive, "{broken");
  T.adoptCareerStorage(store, B1);
  assert.equal(store.getItem(guest.archive), "{broken");
});

test("은퇴 보관함은 10명을 넘어 누적되고 복원·백업 병합은 중복 없이 저장하며 오류 시 원본을 지우지 않는다", () => {
  const { state, choices } = play(23, S({ pos: "GK" }), () => 0);
  const save = { v: E.CAREER_VERSION, seed: 23, startYear: 2026, setup: S({ pos: "GK" }), choices };
  const record = A.archiveCareer(state, save, false, "2026-10-24T12:00:00.000Z");
  let raw = null;
  let writes = 0;
  const storage = { getItem: () => raw, setItem: (_key, value) => { raw = value; writes++; } };
  const twelve = Array.from({ length: 12 }, (_, i) => ({ ...record, id: `${record.id}-${i}`, name: `선수${i}` }));
  for (const entry of twelve) A.saveRetirements(storage, [entry]);
  assert.equal(A.readRetirements(storage).length, 12);
  A.saveRetirements(storage, [{ ...twelve[0], retiredAt: "2026-10-25T12:00:00.000Z" }]);
  assert.equal(writes, 12, "새로고침할 때 다시 쓰거나 날짜를 바꾸지 않아요");
  assert.equal(A.readRetirements(storage)[0].retiredAt, twelve[0].retiredAt);
  const backup = A.exportRetirements(A.readRetirements(storage));
  assert.deepEqual(A.importRetirements(backup), twelve);
  A.saveRetirements(storage, A.importRetirements(backup));
  assert.equal(A.readRetirements(storage).length, 12);
  const polluted = JSON.parse(backup);
  polluted.entries[0].choices = [0, 1];
  polluted.entries[0].history = state.history;
  assert.deepEqual(A.importRetirements(JSON.stringify(polluted)), twelve, "요약 외 필드는 가져오지 않아요");
  polluted.entries[0].totals.goals = -1;
  assert.throws(() => A.importRetirements(JSON.stringify(polluted)));
  assert.throws(() => A.importRetirements(JSON.stringify(save)));
  const before = raw;
  assert.throws(() => A.saveRetirements({ getItem: () => raw, setItem: () => { throw new Error("quota"); } }, [record]));
  assert.equal(raw, before);
  raw = "{broken";
  assert.throws(() => A.saveRetirements(storage, [record]));
  assert.equal(raw, "{broken");
});

test("내 기록실은 통산 합계·포지션별 최고 선수를 계산하고 배지는 처음 달성한 선수와 진행값을 남긴다", () => {
  assert.equal(G.careerBadges([]).filter((badge) => badge.value >= badge.target).length, 0);
  assert.equal(G.careerRecords([]).bestScore, null);
  const base = { v: 2, ranked: false, nation: "KOR", number: 9, foot: "R", side: "R", grade: "성실한 프로", title: "골잡이", honors: [],
    totals: { seasons: 10, firstYear: 2026, lastYear: 2036, retiredAge: 27, apps: 300, goals: 100, assists: 50, cleanSheets: 0, caps: 20, intlGoals: 5, peakOvr: 80, ballonDor: 0, awards: 0, trophies: 2 } };
  const club = (id, seasons) => ({ club: id, name: id, seasons, apps: 1, goals: 0, assists: 0, cleanSheets: 0 });
  const entries = [
    { ...base, id: "a", name: "첫째", pos: "ST", score: 1200, retiredAt: "2026-10-01T00:00:00Z", clubs: [club("KOR:0", 3), club("ENG:0", 7)],
      honors: [{ label: "챔피언스리그 우승", count: 1 }, { label: "AFC 챔피언스리그 우승", count: 2 }] },
    { ...base, id: "b", name: "둘째", pos: "GK", score: 9500, retiredAt: "2026-10-02T00:00:00Z", clubs: [club("ESP:0", 13), club("KOR:11", 2)],
      totals: { ...base.totals, seasons: 15, ballonDor: 5, cleanSheets: 220, goals: 0 }, honors: [{ label: "월드컵 우승", count: 1 }, { label: "U-20 월드컵 우승", count: 1 }] },
    { ...base, id: "c", name: "셋째", pos: "ST", score: 3000, retiredAt: "2026-10-03T00:00:00Z", clubs: [club("GER:0", 5), club("ITA:0", 4), club("FRA:0", 3)],
      totals: { ...base.totals, ballonDor: 1 }, honors: [{ label: "AFC 챔피언스리그 우승", count: 1 }] },
  ];
  const records = G.careerRecords(entries);
  assert.equal(records.players, 3);
  assert.equal(records.bestScore.name, "둘째");
  assert.equal(records.goals, 200);
  assert.equal(records.ballonDor, 6);
  assert.equal(records.byPosition.find((row) => row.pos === "ST").entry.name, "셋째");
  assert.equal(records.byPosition.find((row) => row.pos === "CB").entry, null);
  const badges = Object.fromEntries(G.careerBadges([...entries].reverse()).map((badge) => [badge.id, badge]));
  const got = (id) => badges[id].value >= badges[id].target;
  assert.equal(badges.first.by, "첫째", "은퇴 순서로 처음 달성한 선수를 찾아요");
  assert.equal(badges.ballon.by, "둘째");
  assert.ok(got("ballon5") && got("goat") && got("worldcup") && got("sheets"));
  assert.equal(badges.ucl.by, "첫째", "AFC 챔피언스리그는 빅이어가 아니에요");
  assert.ok(got("oneclub"), "군 팀은 원클럽맨 판정에서 빼요");
  assert.ok(got("k2big") && got("big3"));
  assert.equal(badges.k2big.by, "첫째");
  assert.ok(!got("hall10") && badges.hall10.value === 3);
  assert.equal(badges.allpos.value, 2);
  assert.ok(!got("goals") && badges.goals.value === 100);
});

test("공유 카드는 다시 계산한 은퇴 기록과 커리어 곡선·점수 출처·라이벌을 담는다", () => {
  const { state, choices } = play(31, baseSetup, () => 0);
  const save = { v: E.CAREER_VERSION, seed: 31, startYear: 2026, setup: baseSetup, choices };
  const card = C.buildCareerCard(E.replayCareer(save), save);
  const summary = E.summarizeCareer(state);
  assert.equal(card.score, summary.score);
  assert.equal(card.curve.length, summary.seasons);
  assert.equal(card.curve.at(-1).ovrEnd, state.history.at(-1).ovrEnd);
  assert.equal(Object.values(card.breakdown).reduce((a, b) => a + b, 0), card.score);
  assert.equal(card.rival.name, summary.rival.name);
  assert.equal(card.id, undefined);
  assert.equal(card.choices, undefined);
  assert.ok(JSON.stringify(card).length < 32768, "DB 카드 크기 제한 안쪽");
  assert.ok(C.CARD_CODE.test("Ab3dE6gH9k") && !C.CARD_CODE.test("short") && !C.CARD_CODE.test("Ab3dE6gH9k/"));
});

test("기록집은 기존 저장에서 성적·능력치·모든 선택을 복원하고 은퇴와 이적도 해당 시즌에 남긴다", () => {
  let moments = 0, transfers = 0;
  for (const pos of ["WG", "GK"]) for (let seed = 1; seed <= 24; seed++) {
    const setup = S({ pos, reroll: seed % 3 });
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
  const setup = S({ nation: "ENG", league: "ENG", pick: 2 });
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

  const setup = S({ league: "ENG", pick: 1, reroll: 3 });
  const { state, choices } = play(77, setup, (s, step) => (step * 5 + 1) % s.pending.options.length);
  assert.equal(state.setup.reroll, 3);
  assert.equal(state.history[0].club, rolls[2][1].club, "고른 후보의 구단에서 시작해요");
  const replayed = E.replayCareer({ v: E.CAREER_VERSION, seed: 77, startYear: 2026, setup, choices });
  assert.deepEqual(JSON.parse(JSON.stringify(replayed)), JSON.parse(JSON.stringify(state)));
  let other = null;
  try { other = E.replayCareer({ v: E.CAREER_VERSION, seed: 77, startYear: 2026, setup: { ...setup, reroll: 2 }, choices }); } catch {}
  assert.ok(!other || JSON.stringify(other) !== JSON.stringify(state), "다른 횟수로 다시 계산하면 다른 커리어예요");

  assert.equal("reroll" in E.createCareer(77, 2026, S({ reroll: 0 })).setup, false, "0번은 예전 저장 모양 그대로예요");
  assert.deepEqual(E.createCareer(77, 2026, S({ reroll: 0 })), E.createCareer(77, 2026, baseSetup));
  for (const reroll of [-1, 1.5, E.CAREER_RULES.maxRerolls + 1, "1", null]) {
    assert.throws(() => E.createCareer(77, 2026, S({ reroll })), E.CareerError, String(reroll));
  }
  assert.ok(E.CAREER_RULES.rankedRerolls < E.CAREER_RULES.maxRerolls);
});

/** 훈련 단계의 상태에서 한 시즌을 끝내고 돌려줘요. 프리시즌은 능력치 훈련을 시즌마다 돌아가며(pick이 있으면 그 번째) 고르고, 나머지는 첫 선택지를 골라요. */
function runSeason(state, pick = state.history.length) {
  const seasons = state.history.length;
  while (state.history.length === seasons) {
    const attrs = state.pending.options.filter((option) => option.value.startsWith("attr"));
    const index = state.pending.kind === "training" ? state.pending.options.indexOf(attrs[pick % attrs.length]) : 0;
    state = E.choose(state, index);
  }
  return state;
}

/** 오버롤은 거의 그대로 두고 능력치 둘을 반대로 움직인 복사본. 10~99 범위를 벗어나면 null이에요. */
function tilt(state, [up, upBy], [down, downBy]) {
  const copy = structuredClone(state);
  copy.attrs[up] += upBy;
  copy.attrs[down] -= downBy;
  return copy.attrs.every((value) => value >= 10 && value <= 99) ? copy : null;
}

test("능력치가 오버롤과 따로 골·도움에 영향을 주고, 훈련은 핵심 능력치를 늘 고를 수 있고 집중한 능력치는 노쇠화에서 지켜진다", () => {
  for (const pos of D.POSITION_ORDER) {
    const state = E.createCareer(5, 2026, S({ pos }));
    const offered = state.pending.options.filter((option) => option.value.startsWith("attr")).map((option) => Number(option.value.slice(4)));
    const weights = D.POSITIONS[pos].weights;
    const core = [0, 1, 2, 3, 4, 5].sort((a, b) => weights[b] - weights[a] || a - b).slice(0, 3);
    for (const i of core) assert.ok(offered.includes(i), `${pos} 핵심 능력치 ${E.attrLabels(pos)[i]}`);
    const guide = E.attrGuide(pos);
    for (const i of offered) assert.ok(weights[i] >= 8 || guide.some((item) => item.attrs.includes(i)), `${pos}에 의미 없는 훈련 ${E.attrLabels(pos)[i]}`);
    assert.ok(guide.some((item) => item.label === "부상 예방" && item.attrs.includes(5)));
    assert.equal(guide.some((item) => item.label === "골"), pos !== "GK");
    assert.equal(guide.some((item) => item.label === "무실점"), ["GK", "CB", "FB", "DM"].includes(pos));
    assert.ok(E.GROWTH_ROOMS.includes(E.growthRoom(state)));
    for (const option of state.pending.options.filter((item) => item.value.startsWith("attr"))) {
      const index = Number(option.value.slice(4));
      const effects = guide.filter((item) => item.attrs.includes(index)).map((item) => item.label);
      if (effects.length) assert.ok(option.detail.includes(`${effects.join("·")} ↑`), option.detail);
    }
  }
  assert.ok(E.createCareer(5, 2026, S({ pos: "ST" })).pending.options.every((option) => option.value !== "attr4"), "스트라이커에게 수비 훈련은 안 나와요");

  // 같은 오버롤이라도 슈팅이 높으면 골이, 패스가 높으면 도움이 많아요. 21세부터 한 시즌씩 비교해요.
  const tally = { sharp: 0, blunt: 0, passer: 0, finisher: 0 };
  for (let seed = 1; seed <= 60; seed++) {
    let striker = E.createCareer(seed, 2026, S({ pos: "ST", name: "테스트" }));
    let playmaker = E.createCareer(seed, 2026, S({ pos: "AM", name: "테스트" }));
    for (let n = 0; n < 4; n++) { striker = runSeason(striker); playmaker = runSeason(playmaker); }
    assert.equal(striker.phase, "offseason");
    striker = E.choose(striker, striker.pending.options.findIndex((option) => option.value === "stay" || option.value === "renew"));
    playmaker = E.choose(playmaker, playmaker.pending.options.findIndex((option) => option.value === "stay" || option.value === "renew"));
    if (striker.phase !== "training" || playmaker.phase !== "training") continue;
    // ST 비중 [18,38,6,20,0,18]: 슈팅 ±10과 피지컬 ∓21은 오버롤이 거의 같아요. AM 비중 [10,20,32,32,0,6]: 패스 ±10과 슈팅 ∓16도 그래요.
    const sharp = tilt(striker, [1, 10], [5, 21]), blunt = tilt(striker, [1, -10], [5, -21]);
    const passer = tilt(playmaker, [2, 10], [1, 16]), finisher = tilt(playmaker, [2, -10], [1, -16]);
    if (sharp && blunt) {
      assert.ok(Math.abs(E.overall(sharp.attrs, "ST") - E.overall(blunt.attrs, "ST")) <= 1);
      tally.sharp += runSeason(sharp, 2).history.at(-1).goals;
      tally.blunt += runSeason(blunt, 2).history.at(-1).goals;
    }
    if (passer && finisher) {
      assert.ok(Math.abs(E.overall(passer.attrs, "AM") - E.overall(finisher.attrs, "AM")) <= 1);
      tally.passer += runSeason(passer, 3).history.at(-1).assists;
      tally.finisher += runSeason(finisher, 3).history.at(-1).assists;
    }
  }
  assert.ok(tally.blunt > 100 && tally.finisher > 100, `비교할 표본이 충분해야 해요: ${JSON.stringify(tally)}`);
  assert.ok(tally.sharp > tally.blunt * 1.1, `슈팅이 높은 쪽이 더 넣어야 해요: ${tally.sharp} vs ${tally.blunt}`);
  assert.ok(tally.passer > tally.finisher * 1.1, `패스가 높은 쪽이 더 도와야 해요: ${tally.passer} vs ${tally.finisher}`);

  // 성장이 끝난 선수가 집중 훈련한 능력치는 그 시즌에 떨어지지 않아요. 나이와 전성기만 바꿔 노쇠기로 만들어요.
  for (let seed = 1; seed <= 20; seed++) {
    const veteran = structuredClone(E.createCareer(seed, 2026, S({ pos: "ST", name: "베테랑" })));
    veteran.age = 34;
    veteran.traits.peak = 27;
    const index = veteran.pending.options.findIndex((option) => option.value.startsWith("attr"));
    const focus = Number(veteran.pending.options[index].value.slice(4));
    assert.equal(focus, 1, "스트라이커의 첫 훈련은 비중이 가장 큰 슈팅이에요");
    const before = veteran.attrs[focus];
    const after = runSeason(veteran);
    const season = after.history.at(-1);
    assert.ok(season.ovrEnd <= season.ovrStart, "서른넷은 더 성장하지 않아요");
    assert.ok(after.attrs[focus] >= before + 1, `집중한 슈팅은 떨어지지 않아요: ${before} → ${after.attrs[focus]}`);
  }
});

test("클럽의 상징으로 은퇴를 약속하면 바로 다음 시즌부터 은퇴까지 재계약을 선택할 수 있다", () => {
  const seed = 111;
  const setup = S({ nation: "ENG", league: "ENG", pos: "ST" });
  const choices = Array(21).fill(0);
  const before = E.replayCareer({ v: E.CAREER_VERSION, seed, startYear: 2026, setup, choices });
  assert.equal(before.pending.id, "loyalLegend");
  assert.equal(before.age, 24);
  assert.equal(before.contract, 1);
  const club = before.club;
  const promise = before.pending.options.findIndex((option) => option.value === "promise");
  let state = E.choose(before, promise);
  choices.push(promise);
  assert.equal(state.phase, "offseason");
  assert.equal(state.contract, 0);
  assert.ok(state.flags.includes(`legend:${club}`));
  assert.ok(state.pending.options.some((option) => option.value === "renew" && option.club === club), "약속 직후 계약이 끝나도 이적만 강요하지 않아요");

  // 구단에 남거나 떠나는 결정은 계속 선수가 해요. 다른 도전을 택하면 기존 재계약 기준을 써요.
  const transfer = state.pending.options.findIndex((option) => option.value === "transfer");
  assert.ok(transfer >= 0);
  assert.notEqual(E.choose(state, transfer).club, club);
  const open = E.choose(before, before.pending.options.findIndex((option) => option.value === "open"));
  assert.ok(!open.pending.options.some((option) => option.value === "renew"));

  let renewals = 0;
  while (state.phase !== "retired") {
    assert.equal(state.club, club);
    let index = 0;
    if (state.phase === "offseason") {
      if (state.age >= E.CAREER_RULES.maxAge) {
        assert.deepEqual(state.pending.options.map((option) => option.value), ["retire"]);
      } else {
        index = state.pending.options.findIndex((option) => option.value === "stay" || option.value === "renew");
        assert.ok(index >= 0, `${state.age}세에도 약속한 구단에 남을 수 있어요`);
        if (state.pending.options[index].value === "renew") renewals++;
      }
    }
    choices.push(index);
    state = E.choose(state, index);
  }
  assert.ok(renewals > 1, "한 번만이 아니라 계약이 만료될 때마다 재계약해요");
  assert.equal(state.age, E.CAREER_RULES.maxAge);
  assert.equal(state.history.flatMap((season) => season.trophies).filter((honor) => honor.label.endsWith("영구 결번")).length, 1);
  assert.deepEqual(E.replayCareer({ v: E.CAREER_VERSION, seed, startYear: 2026, setup, choices }), state);
});

test("레전드의 재계약 보장은 약속한 구단에만 적용한다", () => {
  const veteran = E.createCareer(1, 2026, S({ nation: "ENG", league: "ENG", pos: "ST" }));
  veteran.age = 35;
  veteran.contract = 1;
  veteran.attrs.fill(20);
  veteran.potential = 20;
  for (const promisedClub of [veteran.club, "seoul", null]) {
    const state = structuredClone(veteran);
    state.flags = promisedClub ? [`legend:${promisedClub}`] : [];
    const after = runSeason(state);
    assert.equal(after.contract, 0);
    assert.equal(after.pending.options.some((option) => option.value === "renew"), promisedClub === veteran.club);
  }
});

test("서버는 커리어가 시작된 규칙 버전의 엔진으로 다시 계산하고, 이전 버전 스냅샷은 지금 엔진과 섞이지 않는다", async () => {
  assert.deepEqual(V.SUPPORTED_CAREER_VERSIONS, [E.CAREER_VERSION, 6, 5, 4]);
  assert.equal(E6.CAREER_VERSION, 6);
  assert.equal(E5.CAREER_VERSION, 5);
  assert.equal(E4.CAREER_VERSION, 4);
  assert.equal(V.careerEngine(3), null);
  assert.equal(V.careerEngine("5"), null);
  assert.equal(V.careerEngine(E.CAREER_VERSION).version, E.CAREER_VERSION);
  // 버전 4 화면이 끝낸 커리어: 버전 4 엔진으로 고른 선택을 서버가 버전 4 규칙으로 다시 계산해요.
  let old = E4.createCareer(19, 2026, baseSetup);
  const choices = [];
  while (old.phase !== "retired") { const index = (choices.length * 7 + 3) % old.pending.options.length; choices.push(index); old = E4.choose(old, index); }
  const save = { v: 4, seed: 19, startYear: 2026, setup: baseSetup, choices };
  const legacy = V.careerEngine(4).replay(save);
  assert.equal(legacy.retired, true);
  assert.deepEqual(legacy.summary, E4.summarizeCareer(old));
  assert.ok(B.careerRecordOf(legacy.summary).score === legacy.summary.score && legacy.summary.score > 0);
  // 같은 선택을 지금 규칙으로 돌리면 다른 커리어가 되거나 끝나지 않아요. 그래서 버전별 엔진이 필요해요.
  let differs = false;
  try { const now = V.careerEngine(E.CAREER_VERSION).replay(save); differs = !now.retired || JSON.stringify(now.summary) !== JSON.stringify(legacy.summary); } catch { differs = true; }
  assert.ok(differs);
  // 은퇴 전 커리어는 요약을 주지 않아요.
  assert.deepEqual(V.careerEngine(4).replay({ ...save, choices: choices.slice(0, 5) }), { retired: false, summary: null });
  // 스냅샷은 지금 엔진·자료를 가져오지 않아요.
  for (const file of ["src/lib/career/legacy/v4/engine.ts", "src/lib/career/legacy/v4/data.ts", "src/lib/career/legacy/v5/engine.ts", "src/lib/career/legacy/v5/data.ts", "src/lib/career/legacy/v6/engine.ts", "src/lib/career/legacy/v6/data.ts"]) {
    const source = await readFile(resolve(root, file), "utf8");
    assert.ok(!/from "\.\.\/\.\.\/(engine|data)"/.test(source) && !source.includes('from "../../versions"'), `${file}이 지금 엔진을 가져와요`);
  }
});

test("재계약 보장 이전인 버전 5의 순위 기록은 기존 규칙으로 검증한다", () => {
  const seed = 76;
  const setup = S({ nation: "ENG", league: "ENG", pos: "ST" });
  const choices = Array(22).fill(0);
  let old = E5.replayCareer({ v: 5, seed, startYear: 2026, setup, choices });
  assert.ok(old.flags.includes(`legend:${old.club}`));
  assert.ok(old.pending.options.every((option) => option.value === "transfer"), "기존 규칙의 선택 번호와 결과를 보존해요");
  while (old.phase !== "retired") {
    choices.push(0);
    old = E5.choose(old, 0);
  }
  const save = { v: 5, seed, startYear: 2026, setup, choices };
  assert.deepEqual(V.careerEngine(5).replay(save), { retired: true, summary: E5.summarizeCareer(old) });
  assert.deepEqual(V.careerEngine(5).replay({ ...save, choices: choices.slice(0, 22) }), { retired: false, summary: null });
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
    const attrs = decision.options.filter((item) => item.value.startsWith("attr"));
    assert.ok(attrs.length >= 1 && attrs.length <= 4 && decision.options.length === attrs.length + 2, `능력치 훈련 1~4개와 특별 훈련 2개: ${decision.options.map((item) => item.value).join(",")} 능력치 ${s.attrs.join(",")}`);
    if (attrs.length < 3) { assert.ok(s.attrs.filter((value) => value >= 97).length >= 2, `다 찬 능력치가 아닌데 훈련이 적어요: ${s.attrs.join(",")}`); seen.capped++; }
    for (const option of attrs) {
      assert.match(option.detail, /→ \d+ · /);
      assert.ok(!option.detail.includes("변화 적음"), option.detail);
      assert.ok(/시즌 성장 집중|노쇠화 방지/.test(option.detail), option.detail);
    }
    assert.match(decision.body, /성장 전망: (성장 여지 많음|성장 여지 있음|성장 한계 근접|성장 한계 도달|성장 마감)\.$/);
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
  const seen = { ballon: 0, military: 0, exempt: 0, loan: 0, transfer: 0, offers: 0, firstEvents: 0, reserve: 0, youthCup: 0, capped: 0 };
  for (let n = 0; n < 300; n++) {
    const nation = D.NATION_ORDER[random(D.NATION_ORDER.length)];
    const setup = {
      name: "테스트", nation, league: random(2) ? D.NATIONS[nation].home : D.YOUTH_LEAGUES[random(D.YOUTH_LEAGUES.length)],
      pos: D.POSITION_ORDER[random(D.POSITION_ORDER.length)], pick: random(3), number: 1 + random(99), foot: random(2) ? "L" : "R", side: random(2) ? "L" : "R",
    };
    if (!E.FLANKS.includes(setup.pos)) delete setup.side;
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
  const prefer = { sns: "prove", bigclub: "go", agent: "sign", loyalLegend: "promise", documentary: "allow", fanAward: "donate", hometown: "clinic", veteran: "mentor", shirtNumber: "take" };
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
    const setup = S({ name: "라이벌", nation, league: D.NATIONS[nation].home, pos: D.POSITION_ORDER[random(D.POSITION_ORDER.length)], pick: random(3) });
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
        // 좋은 소식은 어느 쪽을 골라도 득이 되는 선택지라 모두 good 톤이에요.
        if (["fanAward", "sponsor", "shirtNumber", "youngStar", "documentary", "documentaryRelease", "firstChild", "peakCondition", "hometown", "charityHonor", "managerPraise", "ntCaptain", "testimonial", "protege"].includes(id)) {
          assert.ok(options.length === 2 && options.every((option) => option.tone === "good"), `${id} 선택지는 모두 좋은 쪽이에요`);
        }
        if (id === "documentaryRelease") assert.ok(state.flags.includes(`docu-${d.year - 1}`));
        if (id === "charityHonor") assert.ok(state.flags.includes(`charity-${d.year - 1}`));
        if (id === "protege") assert.ok(state.flags.includes(`mentor-${d.year - 2}`) && last.club === d.club);
        if (id === "ntCaptain") assert.ok(state.caps >= 30 && state.age >= 26);
        if (id === "testimonial") assert.ok(state.age >= 32 && state.history.slice(-6).every((season) => season.club === d.club));
        if (id === "shirtNumber") assert.ok(options[0].detail.startsWith(`등번호 ${state.number} → `));
      }
      const index = pickStory(state);
      const before = state;
      choices.push(index);
      state = E.choose(state, index);
      if (id === "shirtNumber" && state.number !== before.number) {
        assert.equal(options[index].value, "take");
        assert.ok(state.number >= 1 && state.number <= 11 && state.number !== before.number);
        seen.add("numberChanged");
      } else if (kind === "event") assert.equal(state.number, before.number, "등번호는 전설의 등번호 사건에서만 바뀌어요");
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
    assert.equal(summary.number, state.number, "은퇴 요약과 순위 기록은 바뀐 등번호를 따라가요");
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
  for (const id of ["moment", "discipline", "fanAnger", "agentPush", "surgery", "loyalLegend", "rivalClash", "rivalPress", "rivalBallon", "rivalTeammate", "legendRetired",
    "fanAward", "sponsor", "shirtNumber", "youngStar", "documentary", "documentaryRelease", "firstChild", "peakCondition", "hometown", "charityHonor", "managerPraise", "ntCaptain", "testimonial", "protege", "numberChanged"]) {
    assert.ok(seen.has(id), `${id} 사건이 한 번은 나와요`);
  }
  const ratio = hints.right / hints.total;
  assert.ok(hints.total >= 100 && ratio > 0.7 && ratio < 0.9, `스카우팅 리포트 적중률 ${ratio}`);
});

test("엠블럼이 있는 리그의 구단은 모두 엠블럼을 찾는다", () => {
  for (const league of ["ENG", "ENG2", "ESP", "GER", "ITA", "FRA", "NED", "POR", "BRA"]) {
    for (const [name] of D.LEAGUES[league].clubs) assert.match(K.clubCrest(name) ?? "", /^https:\/\/crests\.football-data\.org\/.+\.png$/, name);
  }
  assert.equal(K.clubCrest("전북 현대"), null);
});

test("주발과 측면이 골·도움에 영향을 주고 화면 표기가 LW·RW·LB·RB로 나온다", () => {
  assert.deepEqual([["WG", "L"], ["WG", "R"], ["FB", "L"], ["FB", "R"], ["ST", "L"], ["CB", null]].map(([pos, side]) => E.positionCode(pos, side)), ["LW", "RW", "LB", "RB", "ST", "CB"]);
  assert.equal(E.positionName("FB", "R"), "오른쪽 풀백");
  const totals = (patch) => {
    const sum = { goals: 0, assists: 0 };
    for (let seed = 1; seed <= 40; seed++) {
      const { state } = play(seed, S({ league: "ENG", ...patch }), () => 0);
      const t = E.careerTotals(state.history);
      sum.goals += t.goals;
      sum.assists += t.assists;
    }
    return sum;
  };
  const inverted = totals({ foot: "R", side: "L" });
  const natural = totals({ foot: "L", side: "L" });
  assert.ok(inverted.goals > natural.goals, `반대발 윙어 골 ${inverted.goals} > 정발 ${natural.goals}`);
  assert.ok(natural.assists > inverted.assists, `정발 윙어 도움 ${natural.assists} > 반대발 ${inverted.assists}`);
  const state = E.createCareer(5, 2026, S({ pos: "CM", foot: "L" }));
  assert.equal(state.side, "L", "윙어·풀백이 아니면 측면은 주발 쪽으로 정해 둬요");
  assert.equal(state.number, 7);
});

test("잘못된 선수 정보·선택·버전은 거절한다", () => {
  for (const name of ["", " 공백", "열한글자가넘는이름이야", "<b>", "a\nb"]) {
    assert.throws(() => E.createCareer(1, 2026, S({ name })), E.CareerError, name);
  }
  assert.equal(E.cleanName("  손   흥민  "), "손 흥민");
  for (const patch of [{ nation: "XXX" }, { league: "ENG2" }, { league: "KSA" }, { pos: "LW" }, { pick: 3 }, { pick: 1.5 },
    { number: 0 }, { number: 100 }, { number: 7.5 }, { number: "7" }, { foot: "B" }, { foot: undefined }, { side: undefined }, { side: "C" }]) {
    assert.throws(() => E.createCareer(1, 2026, { ...baseSetup, ...patch }), E.CareerError, JSON.stringify(patch));
  }
  assert.throws(() => E.createCareer(1, 2026, { ...S({ pos: "ST" }), side: "L" }), E.CareerError, "윙어·풀백이 아니면 측면이 없어요");
  assert.deepEqual(Object.keys(E.cleanSetup({ ...baseSetup, extra: 1 })).sort(), ["foot", "league", "name", "nation", "number", "pick", "pos", "side"]);
  for (const [seed, year] of [[-1, 2026], [2 ** 32, 2026], [1.5, 2026], [1, 1999]]) {
    assert.throws(() => E.createCareer(seed, year, baseSetup), E.CareerError);
  }
  const state = E.createCareer(3, 2026, baseSetup);
  for (const index of [-1, state.pending.options.length, 1.5, Number.NaN]) assert.throws(() => E.choose(state, index), E.CareerError);
  const { state: retired, choices } = play(3, baseSetup, () => 0);
  assert.throws(() => E.choose(retired, 0), E.CareerError);
  assert.throws(() => E.replayCareer({ v: E.CAREER_VERSION, seed: 3, startYear: 2026, setup: baseSetup, choices: [...choices, 0] }), E.CareerError);
  assert.throws(() => E.replayCareer({ v: E.CAREER_VERSION + 1, seed: 3, startYear: 2026, setup: baseSetup, choices }), E.CareerError);
});

test("도전장 링크는 유효한 날짜와 범위 안의 점수만 받는다", () => {
  assert.deepEqual(B.readCareerChallenge("4321", "2026-10-23"), { score: 4321, day: "2026-10-23" });
  const leaders = (scores) => ({ ...B.EMPTY_CAREER_BOARD, leaders: scores.map((score) => ({ score })) });
  assert.equal(B.wouldRank(B.EMPTY_CAREER_BOARD, 10), 1, "아무도 없으면 1위");
  assert.equal(B.wouldRank(leaders([900, 500, 500, 100]), 500), 2, "같은 점수는 공동 순위");
  assert.equal(B.wouldRank(leaders([900, 500]), 50), 3);
  const full = Array.from({ length: B.BOARD_SIZE }, (_, i) => 1000 - i * 10);
  assert.equal(B.wouldRank(leaders(full), full.at(-1)), B.BOARD_SIZE, "20위와 같으면 공동 20위");
  assert.equal(B.wouldRank(leaders(full), full.at(-1) - 1), null, "상위 20명 밖");
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
    return B.careerRecordOf(E.summarizeCareer(E.replayCareer({ v: E.CAREER_VERSION, seed, startYear, setup, choices })));
  }

  await t.test("회원만 시작하고, 표와 기록 함수는 직접 쓸 수 없다", async () => {
    await assert.rejects(start(users[3]), /닉네임/);
    await assert.rejects(as(null, "select * from public.career_start()", [], "anon"), /permission denied/);
    await assert.rejects(as(users[0], "select * from public.career_runs"), /permission denied/);
    await assert.rejects(as(users[0], "select * from public.career_records"), /permission denied/);
    await assert.rejects(as(users[0], "select * from public.career_record($1, gen_random_uuid(), '{}'::jsonb)", [users[0]]), /permission denied/);
  });

  await t.test("기존 회원·포지션 키를 선수별 키로 옮겨도 기록과 권한이 유지되고 재실행할 수 있다", async () => {
    const run = "10000000-0000-4000-8000-000000000001";
    await db.exec("alter table public.career_records drop constraint career_records_pkey; alter table public.career_records add primary key(day, user_id, position)");
    await db.query("insert into public.career_records(day,user_id,position,run_id,player_name,nation,club,score,ballon_dor,peak_ovr,goals,assists,apps,trophies,seasons) values ('2026-10-25',$1,'CB',$2,'기존선수','ENG','seoul',5094,0,90,20,10,600,3,20)", [users[0], run]);
    const before = (await db.query("select * from public.career_records where run_id = $1", [run])).rows;
    const migration = await readFile(new URL("../supabase/migrations/20261026090000_career_player_records.sql", import.meta.url), "utf8");
    await db.exec(migration);
    await db.exec(migration);
    assert.deepEqual((await db.query("select * from public.career_records where run_id = $1", [run])).rows, before);
    assert.equal((await db.query("select pg_get_constraintdef(oid) as definition from pg_constraint where conrelid = 'public.career_records'::regclass and conname = 'career_records_pkey'")).rows[0].definition, "PRIMARY KEY (day, user_id, run_id)");
    assert.equal((await board(null, "2026-10-25")).eleven[0].score, 5094);
    assert.equal((await board(null, "2026-10-25")).allTime, undefined, "선수별 기록 마이그레이션만 적용한 DB는 역대 베스트 11이 없어요");
    // 역대 베스트 11 마이그레이션은 그 뒤에 몇 번을 실행해도 같아요.
    const allTime = await readFile(new URL("../supabase/migrations/20261029090000_career_all_time_eleven.sql", import.meta.url), "utf8");
    await db.exec(allTime);
    await db.exec(allTime);
    assert.deepEqual((await board(null, "2026-10-25")).allTime.map((slot) => [slot.name, slot.day]), [["기존선수", "2026-10-25"]]);
    assert.equal((await db.query("select count(*)::int as n from pg_indexes where indexname = 'career_records_eleven_idx'")).rows[0].n, 1);
    await assert.rejects(as(users[0], "insert into public.career_records select * from public.career_records"), /permission denied/);
    await db.query("delete from public.career_records where run_id = $1", [run]);
  });

  let first;
  let entry;
  await t.test("시드와 시작 시즌을 서버가 정하고, 너무 잦은 시작과 너무 빠른 은퇴를 막는다", async () => {
    first = await start(users[0]);
    assert.ok(Number(first.seed) >= 0 && Number(first.seed) <= 4294967295);
    assert.ok(first.start_year >= 2025);
    await assert.rejects(start(users[0]), /3초/);
    entry = retire(Number(first.seed), first.start_year, S({ name: "첫 선수" }));
    await assert.rejects(record(users[0], first.run_id, entry), /너무 짧아요/);
    await assert.rejects(record(users[1], first.run_id, entry), /새 커리어/);
  });

  await t.test("같은 커리어는 한 번만 반영하고, 같은 회원·포지션의 다른 선수 기록은 각각 보관한다", async () => {
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
    const stored = (await db.query("select player_name from public.career_records where day = $1 and user_id = $2 and position = $3 order by achieved_at", [day, users[0], entry.position])).rows;
    assert.deepEqual(stored.map((row) => row.player_name), [entry.name, "낮은 점수"]);
  });

  await t.test("베스트 11 센터백은 회원 구분 없이 상위 두 선수이고, 양쪽 윙어·풀백도 같은 회원이 차지할 수 있다", async () => {
    await db.exec("begin");
    try {
      const day = new Date((await db.query("select recorded_day from public.career_runs where user_id = $1", [users[0]])).rows[0].recorded_day).toISOString().slice(0, 10);
      const entries = [
        [users[1], { ...entry, name: "알베승", position: "CB", side: null, score: 5094 }],
        [users[2], { ...entry, name: "권디니", position: "CB", side: null, score: 4528 }],
        [users[1], { ...entry, name: "푸욜", position: "CB", side: null, score: 4869 }],
        [users[1], { ...entry, name: "낮은센터백", position: "CB", side: null, score: 4000 }],
        [users[0], { ...entry, name: "왼쪽윙어", position: "WG", side: "L", score: 9000 }],
        [users[0], { ...entry, name: "오른쪽윙어", position: "WG", side: "R", score: 8000 }],
        [users[0], { ...entry, name: "왼쪽풀백", position: "FB", side: "L", score: 7000 }],
        [users[0], { ...entry, name: "오른쪽풀백", position: "FB", side: "R", score: 6000 }],
      ];
      for (const [user, item] of entries) {
        await age(user, 4);
        const run = await start(user);
        await age(user);
        await record(user, run.run_id, item);
      }
      const result = await board(null, day);
      assert.deepEqual(result.eleven.filter((slot) => slot.position === "CB").map((slot) => [slot.slot, slot.name, slot.score, slot.nickname]), [
        [1, "알베승", 5094, "감독2"], [2, "푸욜", 4869, "감독2"],
      ]);
      for (const pos of ["WG", "FB"]) {
        assert.deepEqual(result.eleven.filter((slot) => slot.position === pos).map((slot) => [slot.side, slot.slot, slot.nickname]), [["L", 1, "감독1"], ["R", 1, "감독1"]]);
      }
      assert.equal(result.participants, 3);
      assert.equal(result.leaders.length, 3, "전체 순위는 계속 회원별 최고 점수 하나예요");
      assert.equal((await board(users[0], day)).personal.score, 9000);
    } finally { await db.exec("rollback"); }
  });

  await t.test("역대 베스트 11은 날짜와 상관없이 포지션별 최고 기록이고 은퇴한 날을 함께 돌려준다", async () => {
    await db.exec("begin");
    try {
      const day = new Date((await db.query("select recorded_day from public.career_runs where user_id = $1", [users[0]])).rows[0].recorded_day).toISOString().slice(0, 10);
      const entries = [
        [users[1], { ...entry, name: "오늘센터백", position: "CB", side: null, score: 4000 }],
        [users[2], { ...entry, name: "옛날센터백", position: "CB", side: null, score: 9500 }],
        [users[2], { ...entry, name: "옛날왼쪽윙어", position: "WG", side: "L", score: entry.score + 1 }],
        [users[1], { ...entry, name: "옛날골키퍼", position: "GK", side: null, score: 10 }],
      ];
      const runs = [];
      for (const [user, item] of entries) {
        await age(user, 4);
        const run = await start(user);
        await age(user);
        await record(user, run.run_id, item);
        runs.push(run.run_id);
      }
      // 뒤의 세 선수는 지난주에 은퇴한 것으로 바꿔요. 오늘의 베스트 11에서는 빠지고 역대에는 남아요.
      await db.query("update public.career_records set day = $1::date - 7 where run_id = any($2::uuid[])", [day, runs.slice(1)]);
      const result = await board(null, day);
      const today = result.eleven;
      assert.deepEqual(today.filter((slot) => slot.position === "CB").map((slot) => slot.name), ["오늘센터백"]);
      assert.deepEqual(today.filter((slot) => slot.position === "WG").map((slot) => [slot.side, slot.name]), [["L", entry.name]]);
      assert.ok(today.every((slot) => !("day" in slot)), "오늘의 베스트 11에는 은퇴한 날이 없어요");
      const all = result.allTime;
      const past = new Date(`${day}T00:00:00Z`); past.setUTCDate(past.getUTCDate() - 7);
      const pastDay = past.toISOString().slice(0, 10);
      assert.deepEqual(all.filter((slot) => slot.position === "CB").map((slot) => [slot.slot, slot.name, slot.score, slot.nickname, slot.day]), [
        [1, "옛날센터백", 9500, "감독3", pastDay], [2, "오늘센터백", 4000, "감독2", day],
      ]);
      assert.deepEqual(all.filter((slot) => slot.position === "WG").map((slot) => [slot.side, slot.name, slot.day]), [["L", "옛날왼쪽윙어", pastDay]]);
      assert.deepEqual(all.filter((slot) => slot.position === "GK").map((slot) => [slot.name, slot.day]), [["옛날골키퍼", pastDay]]);
      assert.ok(all.every((slot) => slot.slot <= (slot.position === "CB" ? 2 : 1) && /^\d{4}-\d{2}-\d{2}$/.test(slot.day)));
      assert.equal(result.participants, 2, "오늘의 순위는 오늘 은퇴한 선수만 세요");
      // 기록이 없는 날을 물어도 역대 베스트 11은 그대로예요.
      const empty = await board(null, "2000-01-01");
      assert.equal(empty.eleven.length, 0);
      assert.deepEqual(empty.allTime, all);
    } finally { await db.exec("rollback"); }
  });

  await t.test("회원마다 최고 기록 하나로 순위를 매기고, 베스트 11은 포지션별로 뽑는다", async () => {
    const day = new Date((await db.query("select recorded_day from public.career_runs where user_id = $1", [users[0]])).rows[0].recorded_day).toISOString().slice(0, 10);
    const entries = [
      [users[1], { ...entry, name: "센터백1", position: "CB", side: null, score: entry.score + 500 }],
      [users[1], { ...entry, name: "오른쪽윙어", position: "WG", side: "R", score: 10 }],
      [users[2], { ...entry, name: "센터백2", position: "CB", side: null, score: entry.score + 500 }],
      [users[2], { ...entry, name: "왼쪽윙어2", position: "WG", side: "L", score: 5 }],
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
    assert.deepEqual(result.leaders.map((leader) => [leader.number, leader.side]), [[7, null], [7, null], [7, "L"]]);
    assert.ok(result.leaders.every((leader) => !leader.isMe && !("user_id" in leader)));
    const cbs = result.eleven.filter((slot) => slot.position === "CB");
    assert.deepEqual(cbs.map((slot) => slot.slot), [1, 2]);
    assert.equal(entry.position, "WG");
    assert.deepEqual(result.eleven.filter((slot) => slot.position === "WG").map((slot) => [slot.side, slot.slot, slot.name]), [["L", 1, entry.name], ["R", 1, "오른쪽윙어"]],
      "윙어는 왼쪽·오른쪽 최고 기록이 한 자리씩이에요");
    await age(users[2], 4);
    const bad = await start(users[2]);
    await age(users[2]);
    await assert.rejects(record(users[2], bad.run_id, { ...entry, position: "CB", side: "L" }), /check/, "센터백에는 측면이 없어요");
    assert.equal((await as(null, "select public.career_board('2000-01-01') as result", [], "anon"))[0].result.leaders.length, 0);
  });

  await t.test("은퇴 보관함은 본인 것만 저장·조회하고 같은 선수는 한 번만 남는다", async () => {
    const save = async (user, entries, role) => (await as(user, "select public.career_archive_save($1::jsonb) as added", [JSON.stringify(entries)], role))[0].added;
    const list = async (user) => (await as(user, "select public.career_archive_list() as result"))[0].result;
    const setup = S({ name: "보관맨" });
    const { choices } = play(7, setup, () => 0);
    const save7 = { v: E.CAREER_VERSION, seed: 7, startYear: 2026, setup, choices };
    const older = A.archiveCareer(E.replayCareer(save7), save7, false, "2026-10-20T12:00:00.000Z");
    const newer = { ...older, id: "career-test-newer", retiredAt: "2026-10-24T12:00:00.000Z" };

    await assert.rejects(save(null, [older], "anon"), /permission denied/);
    await assert.rejects(save(users[3], [older]), /닉네임/);
    await assert.rejects(as(users[0], "select * from public.career_retirements"), /permission denied/);
    assert.equal(await save(users[0], [older, newer]), 2);
    assert.equal(await save(users[0], [{ ...older, name: "덮어쓰기" }]), 0, "다른 기기에서 다시 보내도 처음 내용을 지켜요");
    assert.deepEqual((await list(users[0])).map((entry) => [entry.id, entry.name]), [[newer.id, newer.name], [older.id, older.name]]);
    assert.deepEqual((await list(users[0])).map(A.parseRetirement)[1], older);
    assert.deepEqual(await list(users[1]), []);
    assert.deepEqual(await list(null), []);
    await assert.rejects(save(users[0], Array.from({ length: 101 }, (_, i) => ({ ...older, id: `many-${i}` }))), /100명/);
    await assert.rejects(save(users[0], [{ ...older, id: "huge", clubs: Array.from({ length: 400 }, (_, i) => ({ ...older.clubs[0], club: `c${i}` })) }]), /check/);
    assert.equal((await list(users[0])).length, 2, "거절한 요청은 아무것도 남기지 않아요");
  });

  await t.test("공유 카드는 서버 키로만 만들고 같은 선수는 같은 주소, 누구나 주소로 읽는다", async () => {
    const make = async (user, career, card) => (await as(null, "select public.career_card_save($1, $2, $3::jsonb) as code", [user, career, JSON.stringify(card)], "service_role"))[0].code;
    const read = async (code, role = "anon") => (await as(null, "select public.career_card($1) as result", [code], role))[0].result;
    const card = { name: "카드맨", score: 1234 };
    await assert.rejects(as(users[0], "select public.career_card_save($1, 'x', '{}'::jsonb)", [users[0]]), /permission denied/);
    await assert.rejects(as(null, "select * from public.career_cards", [], "anon"), /permission denied/);
    await assert.rejects(make(users[3], "career-x", card), /닉네임/);
    const code = await make(users[0], "career-x", card);
    assert.match(code, /^[A-Za-z0-9]{10}$/);
    assert.equal(await make(users[0], "career-x", { ...card, score: 9 }), code, "다시 공유하면 같은 주소");
    assert.notEqual(await make(users[1], "career-x", card), code, "다른 회원은 다른 주소");
    const shared = await read(code);
    assert.deepEqual(shared.card, card);
    assert.equal(shared.nickname, "감독1");
    assert.ok(!("user_id" in shared));
    assert.equal(await read("AAAAAAAAAA"), null);
    await assert.rejects(make(users[0], "huge", { blob: "x".repeat(40000) }), /check/);
  });

  await t.test("스키마를 다시 실행해도 기록이 남는다", async () => {
    const before = (await db.query("select (select count(*) from public.career_records) + (select count(*) from public.career_retirements) + (select count(*) from public.career_cards) as count")).rows[0].count;
    await db.exec(schema);
    assert.equal((await db.query("select (select count(*) from public.career_records) + (select count(*) from public.career_retirements) + (select count(*) from public.career_cards) as count")).rows[0].count, before);
  });
});
