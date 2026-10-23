import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";

const source = await readFile(new URL("../src/lib/penalty.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
const { PENALTY, penaltyDay, shotSetup, shotPosition, judgeShot, summarizeShots, readChallenge } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

function play(day, timings) {
  const shots = [];
  for (const [index, elapsed] of timings.entries()) shots.push(judgeShot(day, index, elapsed, shots.at(-1)?.streak ?? 0));
  return summarizeShots(shots);
}

function perfectTimings(day) {
  return Array.from({ length: 10 }, (_, index) => {
    for (let elapsed = 120; elapsed < 3500; elapsed++) {
      if (judgeShot(day, index, elapsed, 0).grade === "perfect") return elapsed;
    }
    throw new Error("PERFECT 구간이 없어요");
  });
}

test("한국 자정에 도전이 바뀌고, 같은 날에는 조건이 같으며 모든 슛에 성공 구간이 있다", () => {
  assert.equal(penaltyDay(new Date("2026-10-23T14:59:59Z")), "2026-10-23");
  assert.equal(penaltyDay(new Date("2026-10-23T15:00:00Z")), "2026-10-24");
  for (const day of ["2026-10-23", "2026-10-24", "2027-01-01"]) {
    assert.deepEqual(play(day, perfectTimings(day)), { score: PENALTY.maxScore, goals: 10, perfects: 10, bestStreak: 10 });
    for (let i = 0; i < 10; i++) {
      const setup = shotSetup(day, i);
      assert.ok(setup.target - setup.width / 2 > 0 && setup.target + setup.width / 2 < 1000);
      for (let time = 0; time < 3500; time += 13) assert.ok(shotPosition(day, i, time) >= 0 && shotPosition(day, i, time) <= 1000);
    }
  }
  assert.notDeepEqual(shotSetup("2026-10-23", 0), shotSetup("2026-10-24", 0));
});

test("실패·시간 초과는 연속 성공을 끊고, 공유 링크는 유효한 날짜와 범위 안 점수만 받는다", () => {
  const times = perfectTimings("2026-10-23");
  times[4] = null;
  assert.deepEqual(play("2026-10-23", times), { score: 1750, goals: 9, perfects: 9, bestStreak: 5 });
  assert.deepEqual(play("2026-10-23", Array(10).fill(null)), { score: 0, goals: 0, perfects: 0, bestStreak: 0 });
  assert.equal(judgeShot("2026-10-23", 0, 3500, 9).streak, 0);
  assert.deepEqual(readChallenge("2250", "2026-10-23"), { score: 2250, day: "2026-10-23" });
  for (const value of ["2251", "-1", "NaN", "1e3", "150.5", null]) assert.equal(readChallenge(value, "2026-10-23"), null);
  assert.equal(readChallenge("100", "2026-02-30"), null);
});

test("승부차기 실제 DB 채점·순위·권한·재전송", async (t) => {
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
  const users = [1, 2, 3].map((n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`);
  for (const [i, id] of users.entries()) {
    await db.query("insert into auth.users values($1)", [id]);
    if (i < 2) await db.query("insert into public.profiles(id, nickname) values($1, $2)", [id, `선수${i + 1}`]);
  }
  async function asUser(user, sql, params = [], role = "authenticated") {
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user ?? ""]);
    await db.exec(`set role ${role}`);
    try { return (await db.query(sql, params)).rows; }
    finally { await db.exec("reset role"); }
  }
  const start = async (user = users[0]) => {
    const row = (await asUser(user, "select * from public.penalty_start()"))[0];
    return { ...row, day: row.day instanceof Date ? row.day.toISOString().slice(0, 10) : row.day };
  };
  const finish = async (run, times, user = users[0]) => (await asUser(user, "select * from public.penalty_finish($1, $2::jsonb)", [run, JSON.stringify(times)]))[0];
  const age = async (user = users[0], seconds = 60) => db.query("update public.penalty_runs set started_at = clock_timestamp() - $2 * interval '1 second' where user_id = $1", [user, seconds]);
  const board = async (day, user = users[0]) => (await asUser(user, "select public.penalty_board($1) as result", [day]))[0].result;

  await t.test("미가입·비회원은 순위 도전을 시작할 수 없고 표를 직접 고칠 수 없다", async () => {
    await assert.rejects(start(users[2]), /닉네임/);
    await assert.rejects(asUser(null, "select * from public.penalty_start()", [], "anon"), /permission denied/);
    await assert.rejects(asUser(users[0], "select * from public.penalty_runs"), /permission denied/);
    await assert.rejects(asUser(users[0], "insert into public.penalty_scores(day, user_id, score, goals, perfects) values(current_date, auth.uid(), 2250, 10, 10)"), /permission denied/);
  });

  let first;
  await t.test("위조된 슛·너무 빠른 완료·타인의 기록·잦은 시작을 거절한다", async () => {
    first = await start();
    await assert.rejects(start(), /3초/);
    await assert.rejects(finish(first.run_id, Array(10).fill(null), users[1]), /다른 게임/);
    for (const timings of [null, {}, [], Array(9).fill(null), Array(10).fill("120"), Array(10).fill(120.5), Array(10).fill(-1), Array(10).fill(3500)]) {
      await assert.rejects(finish(first.run_id, timings), /기록|범위/);
    }
    await assert.rejects(finish(first.run_id, Array(10).fill(null)), /진행 시간/);
  });

  await t.test("화면과 DB 채점이 같고, 재전송해도 기록은 하나이며 최고점만 남긴다", async () => {
    const day = String(first.day).slice(0, 10);
    const times = perfectTimings(day);
    await age();
    const result = await finish(first.run_id, times);
    assert.deepEqual(result, { score: 2250, goals: 10, perfects: 10, best_streak: 10 });
    assert.deepEqual(await finish(first.run_id, times), result);
    let ranking = await board(day);
    assert.equal(ranking.participants, 1);
    assert.deepEqual(ranking.personal, { score: 2250, rank: 1 });
    const next = await start();
    await age();
    const mixed = times.map((time, index) => index % 3 === 0 ? null : time + 113);
    const expected = play(day, mixed);
    assert.deepEqual(await finish(next.run_id, mixed), { score: expected.score, goals: expected.goals, perfects: expected.perfects, best_streak: expected.bestStreak });
    ranking = await board(day);
    assert.equal(ranking.participants, 1);
    assert.equal(ranking.personal.score, 2250);
    assert.equal((await db.query("select goals from public.profiles where id = $1", [users[0]])).rows[0].goals, 0);
  });

  await t.test("동점은 공동 순위이고 비회원에게도 닉네임과 점수만 공개한다", async () => {
    const other = await start(users[1]);
    const day = String(other.day).slice(0, 10);
    await age(users[1]);
    await finish(other.run_id, perfectTimings(day), users[1]);
    const publicBoard = (await asUser(null, "select public.penalty_board($1) as result", [day], "anon"))[0].result;
    assert.equal(publicBoard.participants, 2);
    assert.equal(publicBoard.personal, null);
    assert.deepEqual(publicBoard.leaders.map((entry) => entry.rank), [1, 1]);
    assert.ok(publicBoard.leaders.every((entry) => !entry.isMe && !('user_id' in entry)));
    assert.deepEqual((await board("2000-01-01")).leaders, []);
  });

  await t.test("게임 만료를 확인하고 스키마 재실행에도 기록이 유지된다", async () => {
    const expired = await start();
    await age(users[0], 301);
    await assert.rejects(finish(expired.run_id, Array(10).fill(null)), /만료/);
    await db.exec(schema);
    assert.equal((await db.query("select count(*)::int as count from public.penalty_scores")).rows[0].count, 2);
  });
});
