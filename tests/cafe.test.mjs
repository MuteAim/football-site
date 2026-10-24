import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import ts from "typescript";

// 앱과 같은 소스를 실행하되 Node의 실험적 TypeScript 로더에는 의존하지 않아요.
const source = await readFile(new URL("../src/lib/cafe/mentions.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
const { activeMention, mentionMatches } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

test("태그 검색은 커서 위치·한글 입력·닉네임 경계를 지킨다", () => {
  assert.deepEqual(activeMention("안녕 @토트넘 팬", 6), { query: "토트", start: 3, end: 7 });
  assert.deepEqual(activeMention("@ㄱ", 2), { query: "ㄱ", start: 0, end: 2 });
  assert.deepEqual(activeMention("@", 1), { query: "", start: 0, end: 1 });
  for (const text of ["a@user", "https://site/@user", "@@user", "@abcdefghijklmn"]) {
    assert.equal(activeMention(text, text.length), null);
    assert.deepEqual(mentionMatches(text), []);
  }
  assert.deepEqual(mentionMatches("(@토트넘), @Fan_1! @토트넘").map((m) => m.nickname), ["토트넘", "Fan_1", "토트넘"]);
});

test("실제 PostgreSQL 스키마의 태그·알림·권한", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  const schema = await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8");
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    alter default privileges in schema public grant usage on sequences to authenticated;
    create publication supabase_realtime;
  `);
  await db.exec(schema);
  const ids = [1, 2, 3, 4].map((n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`);
  const [writer, owner, parentOwner, tagged] = ids;
  const names = ["작성자", "글주인", "댓글주인", "Fan_1"];
  for (const [index, id] of ids.entries()) {
    await db.query("insert into auth.users values ($1)", [id]);
    await db.query("insert into public.profiles (id, nickname, is_admin) values ($1, $2, $3)", [id, names[index], index === 0]);
  }
  const post = (await db.query("insert into public.posts (board, user_id, title, body) values ('free', $1, '테스트', '본문') returning id", [owner])).rows[0].id;
  const parent = (await db.query("insert into public.comments (post_id, user_id, body, created_at) values ($1, $2, '원래 댓글', now() - interval '1 minute') returning id", [post, parentOwner])).rows[0].id;
  await db.exec("delete from public.notifications");

  // Supabase처럼 역할과 인증 주체를 분리해 RLS와 칸별 권한도 검사해요.
  async function asUser(id, work, role = "authenticated") {
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
    await db.exec(`set role ${role}`);
    try { return await work(); }
    finally { await db.exec("reset role"); }
  }
  async function isolated(work) {
    await db.exec("begin");
    try { await work(); }
    finally { await db.exec("rollback"); }
  }
  async function comment(body, parentId = null) {
    return asUser(writer, async () => (await db.query(
      "insert into public.comments (post_id, parent_id, body) values ($1, $2, $3) returning id, mentions",
      [post, parentId, body],
    )).rows[0]);
  }

  await t.test("여러 태그·대소문자·자기 태그를 처리하고 겹치는 답글 알림은 하나만 만든다", () => isolated(async () => {
    const row = await comment("@글주인 @댓글주인 @fan_1 @Fan_1 @작성자 @없는회원", parent);
    assert.equal(row.mentions.length, 4);
    const notices = (await db.query("select user_id, kind from public.notifications order by user_id")).rows;
    assert.deepEqual(notices, [owner, parentOwner, tagged].map((user_id) => ({ user_id, kind: "mention" })));
    await db.query("update public.profiles set nickname = '바뀐닉네임' where id = $1", [tagged]);
    const saved = (await db.query("select mentions from public.comments where id = $1", [row.id])).rows[0].mentions;
    assert.ok(saved.some((m) => m.id === tagged && m.nickname === "Fan_1"));
  }));

  await t.test("이메일·URL·긴 닉네임·없는 회원은 태그하지 않고 기존 댓글 알림은 유지한다", () => isolated(async () => {
    const row = await comment("mail@Fan_1 https://example.com/@Fan_1 @@Fan_1 @abcdefghijklmn @없는회원");
    assert.deepEqual(row.mentions, []);
    assert.deepEqual((await db.query("select user_id, kind from public.notifications")).rows, [{ user_id: owner, kind: "comment" }]);
  }));

  await t.test("태그 없는 답글은 댓글 주인과 글 주인에게 각각 알려 준다", () => isolated(async () => {
    await comment("답글입니다", parent);
    const rows = (await db.query("select user_id, kind from public.notifications order by user_id")).rows;
    assert.deepEqual(rows, [{ user_id: owner, kind: "comment" }, { user_id: parentOwner, kind: "reply" }]);
  }));

  await t.test("본문과 관계없는 태그 대상이나 가짜 알림을 직접 넣을 수 없다", async () => {
    await assert.rejects(asUser(writer, () => db.query(
      "insert into public.comments (post_id, body, mentions) values ($1, '가짜', $2)", [post, JSON.stringify([{ id: tagged, nickname: "Fan_1" }])],
    )), /permission denied/);
    await assert.rejects(asUser(writer, () => db.query(
      "insert into public.notifications (user_id, kind) values ($1, 'mention')", [tagged],
    )), /permission denied/);
  });

  await t.test("운영자만 업데이트를 등록하고 회원별로 한 번씩 알린다", async () => {
    await assert.rejects(asUser(owner, () => db.query(
      "insert into public.site_updates (version, title, body) values ('denied', '제목', '내용')",
    )), /row-level security/);
    await asUser(writer, () => db.query(
      "insert into public.site_updates (version, title, body) values ('2026.10.23', '회원 태그', '댓글에서 태그해 보세요')",
    ));
    assert.equal((await db.query("select count(*)::int as n from public.notifications where kind = 'update'")).rows[0].n, 4);
    await assert.rejects(asUser(writer, () => db.query(
      "insert into public.site_updates (version, title, body) values ('2026.10.23', '중복', '중복')",
    )), /unique constraint/);
    assert.equal((await db.query("select count(*)::int as n from public.notifications where kind = 'update'")).rows[0].n, 4);
    assert.equal((await db.query("select count(*)::int as n from public.admin_logs where area = 'update'")).rows[0].n, 1);
  });

  await t.test("운영자만 골을 지급하고 같은 요청은 한 번만 반영하며 내역·운영 기록을 남긴다", () => isolated(async () => {
    // 실패해도 이 테스트의 트랜잭션이 깨지지 않게 한 번씩 savepoint 안에서 실행해요.
    async function attempt(by, sql, params) {
      await db.exec("savepoint attempt");
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [by]);
      await db.exec("set role authenticated");
      try {
        const { rows } = await db.query(sql, params);
        await db.exec("reset role");
        await db.exec("release savepoint attempt");
        return rows;
      } catch (error) {
        await db.exec("rollback to savepoint attempt");
        throw error;
      }
    }
    const grant = async (by, nickname, amount, reason, request) =>
      (await attempt(by, "select * from public.admin_grant_goals($1, $2, $3, $4)", [nickname, amount, reason, request]))[0];
    const request = "11111111-1111-4111-8111-111111111111";
    await assert.rejects(grant(owner, "Fan_1", 100, "보상", request), /운영자만/);
    await assert.rejects(attempt(owner,
      "insert into public.goal_events (user_id, kind, ref, day, amount) values ($1, 'reward', 'x', current_date, 100)", [owner],
    ), /permission denied|row-level security/);
    const before = (await db.query("select goals from public.profiles where id = $1", [tagged])).rows[0].goals;
    assert.deepEqual(await grant(writer, " fan_1 ", 100, " 레전드 로드 초기화 보상 ", request), { nickname: "Fan_1", goals: before + 100 }, "닉네임은 대소문자·앞뒤 공백을 가리지 않아요");
    await assert.rejects(grant(writer, "Fan_1", 100, "보상", request), /이미 처리한/);
    await grant(writer, "Fan_1", 5, "이벤트", "22222222-2222-4222-8222-222222222222");
    assert.equal((await db.query("select goals from public.profiles where id = $1", [tagged])).rows[0].goals, before + 105);
    for (const [nickname, amount, reason] of [["없는회원", 10, "보상"], ["Fan_1", 0, "보상"], ["Fan_1", 10001, "보상"], ["Fan_1", 10, " "], ["Fan_1", 10, "가".repeat(41)]]) {
      await assert.rejects(grant(writer, nickname, amount, reason, "33333333-3333-4333-8333-333333333333"), /찾지 못했|골까지|이유/);
    }
    const events = await asUser(tagged, async () => (await db.query("select kind, amount, note from public.goal_events where user_id = $1 order by id", [tagged])).rows);
    assert.deepEqual(events, [{ kind: "reward", amount: 100, note: "레전드 로드 초기화 보상" }, { kind: "reward", amount: 5, note: "이벤트" }]);
    const logs = (await db.query("select actor_id, target, changes from public.admin_logs where area = 'goals' order by id")).rows;
    assert.deepEqual(logs.map((log) => [log.actor_id, log.target, log.changes.amount, log.changes.reason]), [[writer, tagged, 100, "레전드 로드 초기화 보상"], [writer, tagged, 5, "이벤트"]]);
  }));

  await t.test("화면에 보인 내 알림만 읽고 새 알림과 다른 회원의 알림은 남긴다", () => isolated(async () => {
    const mine = (await db.query("select id from public.notifications where user_id = $1", [owner])).rows[0].id;
    const other = (await db.query("select id from public.notifications where user_id = $1", [tagged])).rows[0].id;
    await comment("새 댓글");
    await asUser(owner, () => db.query("select public.read_notification_items($1::bigint[])", [[mine, other]]));
    const visible = await asUser(owner, () => db.query("select id, read_at from public.notifications order by id"));
    assert.equal(visible.rows.length, 2);
    assert.ok(visible.rows[0].read_at);
    assert.equal(visible.rows[1].read_at, null);
    assert.equal((await db.query("select read_at from public.notifications where id = $1", [other])).rows[0].read_at, null);
  }));

  // ---------- 선수 맞히기 ----------
  const quizStart = (id) => asUser(id, async () => (await db.query("select * from public.quiz_start()")).rows[0]);
  const quizAnswer = (id, round, choice) =>
    asUser(id, async () => (await db.query("select * from public.quiz_answer($1, $2)", [round, choice])).rows[0]);
  const myQuiz = (id) => asUser(id, async () => (await db.query("select * from public.my_quiz()")).rows[0]);
  // 정답 번호는 DB 관리자만 읽을 수 있어요. 테스트가 정답을 알아내 맞히거나 일부러 틀리려고 써요.
  const answerOf = async (round) => (await db.query("select answer from public.quiz_rounds where id = $1", [round])).rows[0].answer;
  /** 거절돼야 하는 명령. 트랜잭션 안에서 실패한 명령은 뒤 명령까지 막아서, 저장점으로 되돌려 역할과 설정도 원래대로 해요. */
  async function denied(id, sql, params, pattern) {
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
    await db.exec("savepoint denied");
    await db.exec("set role authenticated");
    try {
      await assert.rejects(db.query(sql, params), pattern);
    } finally {
      await db.exec("rollback to savepoint denied");
    }
  }

  await t.test("문제는 보기 4개만 보이고 정답·문제 은행은 회원이 읽을 수 없으며 안 푼 문제는 다시 준다", () => isolated(async () => {
    const first = await quizStart(owner);
    assert.ok(first.round_id);
    assert.equal(first.choices.length, 4);
    assert.equal(new Set(first.choices).size, 4);
    assert.deepEqual([first.played, first.earned, first.streak], [1, 0, 0]);
    const again = await quizStart(owner);
    assert.equal(again.round_id, first.round_id);
    assert.equal(again.played, 1);
    const row = (await db.query("select choices, answer, answer_pid from public.quiz_rounds where id = $1", [first.round_id])).rows[0];
    const name = (await db.query("select name from public.quiz_players where pid = $1", [row.answer_pid])).rows[0].name;
    assert.equal(row.choices[row.answer - 1], name);
    await denied(owner, "select * from public.quiz_rounds", [], /permission denied/);
    await denied(owner, "select * from public.quiz_players", [], /permission denied/);
    // 가입(닉네임) 전에는 문제를 내지 않아요.
    const stranger = "00000000-0000-4000-8000-000000000009";
    await db.query("insert into auth.users values ($1)", [stranger]);
    assert.equal((await asUser(stranger, () => db.query("select * from public.quiz_start()"))).rows.length, 0);
  }));

  await t.test("정답은 연승만큼 골을 주되 5골까지고, 틀리면 연승이 끊기며, 하루 5문제까지만 낸다", () => isolated(async () => {
    const prizes = [];
    for (let i = 0; i < 5; i++) {
      const { round_id } = await quizStart(owner);
      const result = await quizAnswer(owner, round_id, await answerOf(round_id));
      assert.equal(result.correct, true);
      assert.deepEqual([result.streak, result.played], [i + 1, i + 1]);
      prizes.push(result.prize);
    }
    assert.deepEqual(prizes, [1, 2, 3, 4, 5]);
    const full = await quizStart(owner);
    assert.equal(full.round_id, null);
    assert.deepEqual([full.played, full.earned, full.streak], [5, 15, 5]);

    // 어제 낸 문제로 돌려 두면 오늘 다시 5문제를 낼 수 있고 연승은 이어져요.
    await db.query("update public.quiz_rounds set day = day - 1 where user_id = $1", [owner]);
    const sixth = await quizStart(owner);
    assert.ok(sixth.round_id);
    assert.deepEqual([sixth.played, sixth.earned, sixth.streak], [1, 0, 5]);
    const capped = await quizAnswer(owner, sixth.round_id, await answerOf(sixth.round_id));
    assert.deepEqual([capped.prize, capped.streak], [5, 6]);
    const { round_id: seventh } = await quizStart(owner);
    const wrong = await quizAnswer(owner, seventh, ((await answerOf(seventh)) % 4) + 1);
    assert.deepEqual([wrong.correct, wrong.prize, wrong.streak], [false, 0, 0]);
    assert.equal(wrong.answer_name, (await db.query("select choices[answer] as name from public.quiz_rounds where id = $1", [seventh])).rows[0].name);
    const { round_id: eighth } = await quizStart(owner);
    const restart = await quizAnswer(owner, eighth, await answerOf(eighth));
    assert.deepEqual([restart.prize, restart.streak, restart.played, restart.earned], [1, 1, 3, 6]);

    const amounts = (await db.query("select amount from public.goal_events where user_id = $1 and kind = 'quiz' order by id", [owner])).rows;
    assert.deepEqual(amounts.map((r) => r.amount), [1, 2, 3, 4, 5, 5, 1]);
    assert.deepEqual((await db.query("select goals, quiz_streak from public.profiles where id = $1", [owner])).rows[0], { goals: 21, quiz_streak: 1 });
    const answers = (await db.query("select answer_pid from public.quiz_rounds where user_id = $1", [owner])).rows.map((r) => r.answer_pid);
    assert.equal(new Set(answers).size, answers.length);
  }));

  await t.test("내 상태는 본인 것만 보이고 다른 회원의 문제나 이미 푼 문제는 답할 수 없다", () => isolated(async () => {
    const mine = await quizStart(owner);
    const status = await myQuiz(owner);
    assert.deepEqual([status.round_id, status.choices, status.streak, status.played, status.earned], [mine.round_id, mine.choices, 0, 1, 0]);
    assert.equal((await myQuiz(tagged)).round_id, null);
    const answerSql = "select * from public.quiz_answer($1, $2)";
    await denied(tagged, answerSql, [mine.round_id, 1], /없는 문제이거나 이미 푼 문제/);
    await denied(owner, answerSql, [mine.round_id, 9], /보기 번호/);
    await quizAnswer(owner, mine.round_id, await answerOf(mine.round_id));
    await denied(owner, answerSql, [mine.round_id, 1], /이미 푼 문제/);
    assert.equal((await myQuiz(owner)).round_id, null);
  }));

  await t.test("삭제된 태그 댓글의 알림을 정리하고 기존 데이터 위에 스키마를 다시 적용할 수 있다", async () => {
    const row = await comment("@Fan_1 안녕하세요");
    await asUser(writer, () => db.query("delete from public.comments where id = $1", [row.id]));
    assert.equal((await db.query("select count(*)::int as n from public.notifications where comment_id = $1", [row.id])).rows[0].n, 0);
    const pool = (await db.query("select count(*)::int as n from public.quiz_players")).rows[0].n;
    assert.ok(pool >= 300);
    await db.exec(schema);
    assert.equal((await db.query("select count(*)::int as n from public.notifications where kind = 'update'")).rows[0].n, 4);
    assert.equal((await db.query("select count(*)::int as n from public.profiles")).rows[0].n, 4);
    assert.equal((await db.query("select count(*)::int as n from public.quiz_players")).rows[0].n, pool);
  });
});
