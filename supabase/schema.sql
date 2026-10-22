-- 해외축구 카페 DB 설정
-- Supabase 대시보드 > SQL Editor에 이 파일 내용을 통째로 붙여 넣고 Run을 누르세요.
-- 여러 번 실행해도 괜찮아요. 이미 있는 글과 회원은 그대로 두고 규칙만 다시 맞춰요.

-- ---------- 표 ----------

-- 카페 회원. 소셜 로그인 뒤 닉네임을 정하면 한 줄이 생겨요.
-- 매니저(is_manager)는 아무 글이나 지울 수 있어요. 대시보드에서 직접 true로 바꿔 주세요.
create table if not exists public.profiles (
  id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  nickname text not null check (nickname ~ '^[가-힣A-Za-z0-9_]{2,12}$'),
  is_manager boolean not null default false,
  created_at timestamptz not null default now()
);
-- 대소문자만 다른 닉네임도 같은 닉네임으로 봐요.
create unique index if not exists profiles_nickname_key on public.profiles (lower(nickname));

-- 응원팀. 고를 때 팀 이름과 엠블럼 주소를 같이 적어 둬서, 글 목록을 보여 줄 때 경기 API를 부르지 않아요.
-- 나중에 생긴 칸이라 이미 만든 DB에도 붙도록 따로 추가해요.
alter table public.profiles add column if not exists team_id integer;
alter table public.profiles add column if not exists team_name text;
alter table public.profiles add column if not exists team_crest text;
-- 세 칸은 다 같이 비우거나 다 같이 채워요. 엠블럼은 football-data.org 그림만 받아요.
alter table public.profiles drop constraint if exists profiles_team_check;
alter table public.profiles add constraint profiles_team_check check (
  num_nulls(team_id, team_name, team_crest) in (0, 3)
  and team_id > 0
  and char_length(team_name) between 1 and 30
  and team_crest ~ '^https://crests\.football-data\.org/[A-Za-z0-9_.-]+$'
);

-- 게시글. 추천·댓글 수는 아래 트리거가 알아서 세요.
create table if not exists public.posts (
  id bigint generated always as identity primary key,
  board text not null,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 100),
  body text not null check (char_length(btrim(body)) between 1 and 10000),
  view_count integer not null default 0,
  like_count integer not null default 0,
  comment_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
-- 게시판 목록은 src/lib/cafe/boards.ts와 같아야 해요. 게시판을 늘리면 여기도 고치고 다시 실행하세요.
alter table public.posts drop constraint if exists posts_board_check;
alter table public.posts add constraint posts_board_check
  check (board in ('free', 'PL', 'PD', 'BL1', 'SA', 'FL1', 'CL', 'etc'));
create index if not exists posts_board_idx on public.posts (board, id desc);
create index if not exists posts_user_idx on public.posts (user_id, created_at desc);

create table if not exists public.comments (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists comments_post_idx on public.comments (post_id, id);
create index if not exists comments_user_idx on public.comments (user_id, created_at desc);

-- 답글. 댓글 바로 아래 한 단계만 달 수 있어요(답글에 다시 답글을 달면 같은 댓글 아래에 붙여요).
-- 답글이 달린 댓글을 지우면 내용만 지우고 deleted_at을 적어서 "삭제된 댓글" 자리로 남겨요.
-- 나중에 생긴 칸이라 이미 만든 DB에도 붙도록 따로 추가해요.
alter table public.comments add column if not exists parent_id bigint references public.comments (id) on delete cascade;
alter table public.comments add column if not exists deleted_at timestamptz;
create index if not exists comments_parent_idx on public.comments (parent_id);
alter table public.comments drop constraint if exists comments_body_check;
alter table public.comments add constraint comments_body_check
  check (deleted_at is not null or char_length(btrim(body)) between 1 and 1000);

-- 추천. 한 사람이 한 글에 한 번만 할 수 있어요.
create table if not exists public.post_likes (
  post_id bigint not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- 경기별 응원톡. match_id는 football-data.org의 경기 번호예요.
create table if not exists public.match_talks (
  id bigint generated always as identity primary key,
  match_id integer not null check (match_id > 0),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  side text check (side in ('home', 'away')),
  body text not null check (char_length(btrim(body)) between 1 and 200),
  created_at timestamptz not null default now()
);
create index if not exists match_talks_match_idx on public.match_talks (match_id, id desc);
create index if not exists match_talks_user_idx on public.match_talks (user_id, created_at desc);

-- 승부 예측. 경기마다 한 사람이 하나만 고르고, 킥오프 전까지 바꿀 수 있어요.
-- 킥오프 시각과 결과는 경기 API에만 있어서, 순위를 셀 때 서버가 킥오프 뒤에 고친 예측을 빼요.
-- 그래서 고친 시각(updated_at)은 회원이 못 바꾸고 DB가 적어요.
-- competition은 결과를 찾을 대회 코드예요. 틀린 코드를 넣으면 결과를 못 찾아 순위에서 빠질 뿐이에요.
create table if not exists public.match_predictions (
  match_id integer not null check (match_id > 0),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  competition text not null check (competition ~ '^[A-Z0-9]{2,5}$'),
  pick text not null check (pick in ('home', 'draw', 'away')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (match_id, user_id)
);
create index if not exists match_predictions_user_idx on public.match_predictions (user_id);

-- 골. 출석과 승부 예측 적중으로 받고 등급 배지에 써요. 돈 가치가 없는 자랑용이에요.
-- 회원은 골을 직접 바꿀 수 없어요. 출석은 DB 함수(check_in)가, 예측 적중은 서버만 가진 비밀 키로 settle_match가 적어요.
alter table public.profiles add column if not exists goals integer not null default 0;
alter table public.profiles add column if not exists attendance_streak integer not null default 0;
alter table public.profiles add column if not exists last_attended date;

-- 골 내역. 같은 사람이 같은 이유로 같은 대상(출석 날짜, 경기 번호)에서 두 번 받지 못해요.
-- day는 한국 날짜예요. 예측 골은 킥오프 날짜로 적어서 하루 상한을 셀 때 써요.
create table if not exists public.goal_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('attendance', 'streak', 'prediction', 'minority')),
  ref text not null,
  day date not null,
  amount integer not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (user_id, kind, ref)
);
create index if not exists goal_events_user_idx on public.goal_events (user_id, id desc);

-- 정산을 마친 경기. 한 경기는 한 번만 정산해요.
create table if not exists public.settled_matches (
  match_id integer primary key,
  result text not null check (result in ('home', 'draw', 'away')),
  kickoff timestamptz not null,
  settled_at timestamptz not null default now()
);

-- 아직 정산하지 않은 예측이 있는 경기. 서버가 정산할 경기를 찾을 때만 써요.
create or replace view public.unsettled_matches with (security_invoker = true) as
  select distinct p.match_id, p.competition
  from public.match_predictions p
  where not exists (select 1 from public.settled_matches s where s.match_id = p.match_id);

-- ---------- 숫자 자동 계산 ----------
-- 회원은 글의 숫자 칸을 직접 고칠 수 없어서, 추천·댓글이 생기거나 지워질 때 DB가 대신 세요.

create or replace function public.sync_post_like_count() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
  else
    update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end $$;

drop trigger if exists post_likes_count on public.post_likes;
create trigger post_likes_count after insert or delete on public.post_likes
  for each row execute function public.sync_post_like_count();

create or replace function public.sync_post_comment_count() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id;
  elsif old.deleted_at is null then
    -- "삭제된 댓글" 자리는 남길 때 이미 빼서 다시 빼지 않아요.
    update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end $$;

drop trigger if exists comments_count on public.comments;
create trigger comments_count after insert or delete on public.comments
  for each row execute function public.sync_post_comment_count();

-- 답글이 달린 댓글을 지우면, 남의 답글이 같이 사라지지 않게 내용만 지우고 자리를 남겨요.
-- 글을 지우거나 회원이 탈퇴해서 지워질 때는(글이나 회원이 이미 없으면) 답글까지 그냥 다 지워요.
create or replace function public.keep_comment_with_replies() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.comments r where r.parent_id = old.id)
     and exists (select 1 from public.posts p where p.id = old.post_id)
     and exists (select 1 from public.profiles u where u.id = old.user_id) then
    if old.deleted_at is null then
      update public.comments set body = '', deleted_at = now() where id = old.id;
      update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
    end if;
    return null;
  end if;
  return old;
end $$;

drop trigger if exists comments_keep_replied on public.comments;
create trigger comments_keep_replied before delete on public.comments
  for each row execute function public.keep_comment_with_replies();

-- "삭제된 댓글" 자리에 남은 답글이 다 지워지면 그 자리도 지워요.
create or replace function public.remove_empty_deleted_parent() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.parent_id is not null then
    delete from public.comments c
    where c.id = old.parent_id
      and c.deleted_at is not null
      and not exists (select 1 from public.comments r where r.parent_id = c.id);
  end if;
  return null;
end $$;

drop trigger if exists comments_remove_empty_parent on public.comments;
create trigger comments_remove_empty_parent after delete on public.comments
  for each row execute function public.remove_empty_deleted_parent();

-- 예측을 바꾸면 고친 시각을 DB가 적어요.
create or replace function public.touch_prediction() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists match_predictions_touch on public.match_predictions;
create trigger match_predictions_touch before update on public.match_predictions
  for each row execute function public.touch_prediction();

-- 골 내역이 생기면 회원의 골 합계를 올려요.
create or replace function public.add_goals() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set goals = goals + new.amount where id = new.user_id;
  return null;
end $$;

drop trigger if exists goal_events_add on public.goal_events;
create trigger goal_events_add after insert on public.goal_events
  for each row execute function public.add_goals();

-- 출석. 한국 날짜로 하루 한 번 10골, 7일 연속마다 30골을 더 줘요.
-- 이미 출석했으면 0골을 돌려주고, 닉네임을 정하기 전이면 아무것도 돌려주지 않아요.
create or replace function public.check_in()
returns table (awarded integer, streak integer, goals integer)
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  today date := (now() at time zone 'Asia/Seoul')::date;
  last_day date;
  days integer;
begin
  -- 여러 기기에서 동시에 들어와도 한 번만 세도록 내 줄을 잠가요.
  select p.last_attended, p.attendance_streak into last_day, days
  from public.profiles p where p.id = me for update;
  if not found then
    return;
  end if;

  if last_day = today then
    return query select 0, p.attendance_streak, p.goals from public.profiles p where p.id = me;
    return;
  end if;

  days := case when last_day = today - 1 then days + 1 else 1 end;
  update public.profiles p set last_attended = today, attendance_streak = days where p.id = me;
  insert into public.goal_events (user_id, kind, ref, day, amount) values (me, 'attendance', today::text, today, 10);
  if days % 7 = 0 then
    insert into public.goal_events (user_id, kind, ref, day, amount) values (me, 'streak', today::text, today, 30);
  end if;
  return query
    select case when days % 7 = 0 then 40 else 10 end, days, p.goals from public.profiles p where p.id = me;
end $$;

-- 내 출석 상태. 출석 칸은 다른 회원에게 보이지 않아서 본인은 이 함수로 읽어요.
create or replace function public.my_attendance()
returns table (streak integer, last_attended date)
language sql stable security definer set search_path = '' as $$
  select p.attendance_streak, p.last_attended from public.profiles p where p.id = (select auth.uid());
$$;

-- 승부 예측 정산. 서버가 경기 API에서 확인한 결과로 부르고, 서버의 비밀 키(service_role)로만 부를 수 있어요.
-- 킥오프 전에 고른 예측만 세요. 맞히면 10골, 5명 이상 참여한 경기에서 적중자가 30% 이하면 10골을 더 줘요.
-- 예측으로 받는 골은 킥오프 날짜(한국) 기준 하루 50골까지예요.
create or replace function public.settle_match(target integer, outcome text, kickoff timestamptz)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  kick_day date := (kickoff at time zone 'Asia/Seoul')::date;
  participants integer;
  hitters integer;
  minority boolean;
  winner uuid;
  room integer;
begin
  insert into public.settled_matches (match_id, result, kickoff) values (target, outcome, kickoff)
  on conflict (match_id) do nothing;
  if not found then
    return 0;
  end if;

  select count(*), count(*) filter (where p.pick = outcome) into participants, hitters
  from public.match_predictions p
  where p.match_id = target and p.updated_at < kickoff;
  minority := participants >= 5 and hitters * 10 <= participants * 3;

  for winner in
    select p.user_id from public.match_predictions p
    where p.match_id = target and p.updated_at < kickoff and p.pick = outcome
  loop
    -- 같은 회원의 다른 경기 정산과 겹쳐도 하루 상한을 넘지 않게 회원마다 차례를 지켜요.
    perform pg_advisory_xact_lock(hashtext(winner::text));
    select 50 - coalesce(sum(e.amount), 0) into room
    from public.goal_events e
    where e.user_id = winner and e.day = kick_day and e.kind in ('prediction', 'minority');
    if room > 0 then
      insert into public.goal_events (user_id, kind, ref, day, amount)
      values (winner, 'prediction', target::text, kick_day, least(10, room));
      room := room - least(10, room);
    end if;
    if minority and room > 0 then
      insert into public.goal_events (user_id, kind, ref, day, amount)
      values (winner, 'minority', target::text, kick_day, least(10, room));
    end if;
  end loop;
  return hitters;
end $$;

-- 조회수 올리기. 로그인하지 않은 방문자도 부를 수 있어요.
create or replace function public.count_post_view(target bigint) returns void
language sql security definer set search_path = '' as $$
  update public.posts set view_count = view_count + 1 where id = target;
$$;
grant execute on function public.count_post_view(bigint) to anon, authenticated;

create or replace function public.is_cafe_manager() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and is_manager);
$$;

-- ---------- 권한 ----------
-- 읽기는 누구나, 쓰기는 가입한 회원 본인만 할 수 있어요.
-- 칸 단위로 권한을 줘서 회원이 매니저 표시나 조회수·추천 수를 직접 바꾸지 못하게 막아요.

revoke all on public.profiles, public.posts, public.comments, public.post_likes, public.match_talks,
  public.match_predictions, public.goal_events, public.settled_matches, public.unsettled_matches
  from anon, authenticated;

grant select on public.posts, public.comments, public.match_talks, public.match_predictions to anon, authenticated;
grant select on public.post_likes, public.goal_events to authenticated;
-- 회원 정보는 공개해도 되는 칸만 보여요. 언제 들어왔는지 알 수 있는 출석 칸은 본인만 my_attendance로 봐요.
grant select (id, nickname, is_manager, goals, team_id, team_name, team_crest, created_at) on public.profiles
  to anon, authenticated;
revoke all on function public.my_attendance() from public, anon;
grant execute on function public.my_attendance() to authenticated;

-- 골은 DB 함수로만 생겨요. 출석은 회원이, 예측 정산은 서버의 비밀 키(service_role)만 부를 수 있어요.
revoke all on function public.check_in() from public, anon;
grant execute on function public.check_in() to authenticated;
revoke all on function public.settle_match(integer, text, timestamptz) from public, anon, authenticated;
grant execute on function public.settle_match(integer, text, timestamptz) to service_role;

grant insert (nickname), update (nickname, team_id, team_name, team_crest) on public.profiles to authenticated;
grant insert (board, title, body), update (title, body, updated_at), delete on public.posts to authenticated;
grant insert (post_id, parent_id, body), delete on public.comments to authenticated;
grant insert (post_id), delete on public.post_likes to authenticated;
grant insert (match_id, side, body), delete on public.match_talks to authenticated;
grant insert (match_id, competition, pick), update (pick) on public.match_predictions to authenticated;

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.post_likes enable row level security;
alter table public.match_talks enable row level security;
alter table public.match_predictions enable row level security;
alter table public.goal_events enable row level security;
-- 정산 기록은 서버(service_role)만 읽고 써서 회원용 규칙을 두지 않아요.
alter table public.settled_matches enable row level security;

-- 골 내역은 내 것만 보여요. 다른 회원에게는 골 합계(등급)만 보여요.
drop policy if exists goal_events_select on public.goal_events;
create policy goal_events_select on public.goal_events for select to authenticated
  using (user_id = (select auth.uid()));

-- 회원
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (true);
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- 게시글. 도배를 막으려고 글은 30초에 한 번만 쓸 수 있어요.
drop policy if exists posts_select on public.posts;
create policy posts_select on public.posts for select using (true);
drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts for insert to authenticated with check (
  user_id = (select auth.uid())
  and not exists (
    select 1 from public.posts p
    where p.user_id = (select auth.uid()) and p.created_at > now() - interval '30 seconds'
  )
);
drop policy if exists posts_update on public.posts;
create policy posts_update on public.posts for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists posts_delete on public.posts;
create policy posts_delete on public.posts for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_cafe_manager()));

-- 댓글. 5초에 한 번만 달 수 있어요.
-- 답글은 같은 글의, 지워지지 않은 맨 위 댓글에만 달 수 있어요.
drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments for select using (true);
drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert to authenticated with check (
  user_id = (select auth.uid())
  and not exists (
    select 1 from public.comments c
    where c.user_id = (select auth.uid()) and c.created_at > now() - interval '5 seconds'
  )
  and (
    comments.parent_id is null
    or exists (
      select 1 from public.comments parent
      where parent.id = comments.parent_id
        and parent.post_id = comments.post_id
        and parent.parent_id is null
        and parent.deleted_at is null
    )
  )
);
drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_cafe_manager()));

-- 추천. 내가 누른 추천만 보이고, 내 글에는 추천할 수 없어요.
drop policy if exists post_likes_select on public.post_likes;
create policy post_likes_select on public.post_likes for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists post_likes_insert on public.post_likes;
create policy post_likes_insert on public.post_likes for insert to authenticated with check (
  user_id = (select auth.uid())
  and not exists (
    select 1 from public.posts p where p.id = post_id and p.user_id = (select auth.uid())
  )
);
drop policy if exists post_likes_delete on public.post_likes;
create policy post_likes_delete on public.post_likes for delete to authenticated
  using (user_id = (select auth.uid()));

-- 응원톡. 3초에 한 번만 보낼 수 있어요.
drop policy if exists match_talks_select on public.match_talks;
create policy match_talks_select on public.match_talks for select using (true);
drop policy if exists match_talks_insert on public.match_talks;
create policy match_talks_insert on public.match_talks for insert to authenticated with check (
  user_id = (select auth.uid())
  and not exists (
    select 1 from public.match_talks t
    where t.user_id = (select auth.uid()) and t.created_at > now() - interval '3 seconds'
  )
);
drop policy if exists match_talks_delete on public.match_talks;
create policy match_talks_delete on public.match_talks for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_cafe_manager()));

-- 승부 예측. 누구나 볼 수 있고, 내 예측만 고칠 수 있어요. 킥오프 확인은 서버와 순위 계산이 맡아요.
drop policy if exists match_predictions_select on public.match_predictions;
create policy match_predictions_select on public.match_predictions for select using (true);
drop policy if exists match_predictions_insert on public.match_predictions;
create policy match_predictions_insert on public.match_predictions for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists match_predictions_update on public.match_predictions;
create policy match_predictions_update on public.match_predictions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------- 실시간 ----------
-- 응원톡에 새 글이 올라오면 보고 있는 사람 화면에 바로 뜨도록 실시간 전송을 켜요.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'match_talks'
  ) then
    alter publication supabase_realtime add table public.match_talks;
  end if;
end $$;
