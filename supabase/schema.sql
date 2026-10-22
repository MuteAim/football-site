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
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists comments_post_idx on public.comments (post_id, id);
create index if not exists comments_user_idx on public.comments (user_id, created_at desc);

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
  else
    update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end $$;

drop trigger if exists comments_count on public.comments;
create trigger comments_count after insert or delete on public.comments
  for each row execute function public.sync_post_comment_count();

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

revoke all on public.profiles, public.posts, public.comments, public.post_likes, public.match_talks
  from anon, authenticated;

grant select on public.profiles, public.posts, public.comments, public.match_talks to anon, authenticated;
grant select on public.post_likes to authenticated;

grant insert (nickname), update (nickname) on public.profiles to authenticated;
grant insert (board, title, body), update (title, body, updated_at), delete on public.posts to authenticated;
grant insert (post_id, body), delete on public.comments to authenticated;
grant insert (post_id), delete on public.post_likes to authenticated;
grant insert (match_id, side, body), delete on public.match_talks to authenticated;

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.post_likes enable row level security;
alter table public.match_talks enable row level security;

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
drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments for select using (true);
drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert to authenticated with check (
  user_id = (select auth.uid())
  and not exists (
    select 1 from public.comments c
    where c.user_id = (select auth.uid()) and c.created_at > now() - interval '5 seconds'
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
