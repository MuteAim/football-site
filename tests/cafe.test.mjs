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

  await t.test("삭제된 태그 댓글의 알림을 정리하고 기존 데이터 위에 스키마를 다시 적용할 수 있다", async () => {
    const row = await comment("@Fan_1 안녕하세요");
    await asUser(writer, () => db.query("delete from public.comments where id = $1", [row.id]));
    assert.equal((await db.query("select count(*)::int as n from public.notifications where comment_id = $1", [row.id])).rows[0].n, 0);
    await db.exec(schema);
    assert.equal((await db.query("select count(*)::int as n from public.notifications where kind = 'update'")).rows[0].n, 4);
    assert.equal((await db.query("select count(*)::int as n from public.profiles")).rows[0].n, 4);
  });
});
