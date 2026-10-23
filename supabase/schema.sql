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
-- 작성 시점의 회원을 저장해서 닉네임이 바뀌어도 태그 대상이 바뀌지 않아요.
alter table public.comments add column if not exists mentions jsonb not null default '[]'::jsonb;
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

-- 골 상점. 골로 닉네임 색과 프로필 테두리를 사요.
-- 가격은 여기에만 있고, 사기와 쓰기는 DB 함수(buy_item, equip_item)로만 할 수 있어요.
-- 아이템이 어떻게 보이는지는 src/lib/cafe/shop.ts에 있어요. 아이템을 늘리면 두 곳을 같이 고쳐요.
create table if not exists public.shop_items (
  id text primary key,
  kind text not null check (kind in ('color', 'frame')),
  price integer not null check (price > 0),
  sort integer not null default 0
);
insert into public.shop_items (id, kind, price, sort) values
  ('color-emerald', 'color', 100, 1),
  ('color-sky', 'color', 100, 2),
  ('color-violet', 'color', 100, 3),
  ('color-rose', 'color', 100, 4),
  ('color-gold', 'color', 300, 5),
  ('color-legend', 'color', 800, 6),
  ('frame-emerald', 'frame', 150, 11),
  ('frame-sky', 'frame', 150, 12),
  ('frame-gold', 'frame', 400, 13),
  ('frame-rainbow', 'frame', 1000, 14)
on conflict (id) do update set kind = excluded.kind, price = excluded.price, sort = excluded.sort;

-- 산 아이템. 산 가격도 같이 적어 둬요.
create table if not exists public.owned_items (
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_id text not null references public.shop_items (id) on delete cascade,
  price integer not null,
  created_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

-- 쓴 골과 지금 쓰고 있는 아이템. 등급은 모은 골(goals)로 정해서, 골을 써도 등급은 그대로예요.
alter table public.profiles add column if not exists spent_goals integer not null default 0;
alter table public.profiles add column if not exists name_color text references public.shop_items (id) on delete set null;
alter table public.profiles add column if not exists avatar_frame text references public.shop_items (id) on delete set null;

-- 내 소식. 내 글에 댓글, 내 댓글에 답글, 내 글에 추천이 달리거나 승부 예측이 맞으면 한 줄씩 생겨요.
-- 회원은 직접 만들 수 없고 DB 트리거와 settle_match만 적어요. 본 소식은 read_notifications로 읽음 표시해요.
-- 글이나 댓글, 소식을 만든 회원이 지워지면 소식도 같이 지워져요.
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('comment', 'reply', 'like', 'prediction')),
  actor_id uuid references public.profiles (id) on delete cascade,
  post_id bigint references public.posts (id) on delete cascade,
  comment_id bigint references public.comments (id) on delete cascade,
  -- 승부 예측 소식만 써요. 경기 화면 주소를 만들 경기 번호와 한국 날짜, "토트넘 vs 아스널" 같은 경기 이름, 받은 골이에요.
  match_id integer,
  match_day date,
  label text,
  amount integer,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, id desc);
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('comment', 'reply', 'like', 'prediction', 'mention', 'update'));

-- 같은 버전은 한 번만 등록해요. 등록과 회원 알림은 한 트랜잭션으로 처리해요.
create table if not exists public.site_updates (
  id bigint generated always as identity primary key,
  version text not null unique check (version ~ '^[a-z0-9][a-z0-9._-]{0,59}$'),
  title text not null check (char_length(btrim(title)) between 1 and 100),
  body text not null check (char_length(btrim(body)) between 1 and 3000),
  created_at timestamptz not null default now()
);
alter table public.notifications add column if not exists update_id bigint
  references public.site_updates (id) on delete cascade;
create unique index if not exists notifications_update_key on public.notifications (user_id, update_id)
  where update_id is not null;

-- ---------- 카페 운영 ----------
-- 운영자(is_admin)는 카페 관리 화면(/cafe/admin)에서 배너와 공지, 글쓰기 잠금을 바꾸고 글을 공지로 올려요.
-- 매니저 권한도 같이 가져요. 매니저처럼 SQL Editor에서만 정할 수 있고, 회원은 이 칸을 바꿀 수 없어요.
alter table public.profiles add column if not exists is_admin boolean not null default false;

-- 공지로 올린 글. 게시판 첫 쪽 위에 따로 보여요. 운영자가 pin_post로만 바꿔요.
alter table public.posts add column if not exists pinned_at timestamptz;
create index if not exists posts_pinned_idx on public.posts (pinned_at desc) where pinned_at is not null;

-- 카페 설정. 한 줄만 있고 누구나 읽어요. 운영자가 카페 관리 화면에서 바꿔요.
create table if not exists public.cafe_settings (
  id boolean primary key default true check (id),
  -- 배너
  cafe_name text not null default '해축남',
  tagline text not null default '해외축구에 진심인 사람들 대화하는곳',
  banner_color text not null default 'emerald',
  -- 카페 맨 위 한 줄 공지. 링크는 비워 둘 수 있어요.
  notice_on boolean not null default false,
  notice_text text,
  notice_href text,
  -- 글쓰기 잠금(점검 모드). 켜면 매니저와 운영자만 글·댓글·응원톡을 써요.
  write_locked boolean not null default false,
  lock_message text,
  updated_at timestamptz not null default now()
);
insert into public.cafe_settings (id) values (true) on conflict (id) do nothing;
alter table public.cafe_settings drop constraint if exists cafe_settings_values_check;
alter table public.cafe_settings add constraint cafe_settings_values_check check (
  char_length(btrim(cafe_name)) between 1 and 20
  and char_length(btrim(tagline)) between 1 and 40
  and banner_color in ('emerald', 'teal', 'sky', 'indigo', 'violet', 'rose', 'amber', 'slate')
  and (notice_text is null or char_length(btrim(notice_text)) between 1 and 100)
  -- 공지 링크는 이 사이트 주소(/로 시작)나 https 주소만 받아요.
  and (notice_href is null or (
    char_length(notice_href) <= 300
    and notice_href ~ '^(/([^/[:space:]][^[:space:]]*)?|https://[^[:space:]]+)$'
  ))
  and (not notice_on or notice_text is not null)
  and (lock_message is null or char_length(btrim(lock_message)) between 1 and 100)
);

-- 드림 스쿼드. FC온라인 선수 카드로 짠 꿈의 베스트 11이에요. 누구나 보고 링크로 공유해요.
-- players는 자리 11개의 배열이에요. 빈 자리는 null, 채운 자리는 {"spid": 카드 번호, "name": 선수 이름}이에요.
-- 카드 번호의 끝 6자리가 선수 번호라서, 같은 선수는 시즌이 달라도 한 번만 넣을 수 있어요.
-- 카드 번호와 이름은 서버가 넥슨 Open API의 선수 목록에서 확인해서 적어요.
create table if not exists public.squads (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null,
  formation text not null,
  players jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index if not exists squads_user_idx on public.squads (user_id, id desc);

-- 스쿼드 자리 11개가 모양에 맞는지. 표의 규칙(check)에서 써요.
create or replace function public.squad_players_valid(players jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(players) <> 'array' or jsonb_array_length(players) <> 11 then false else
    not exists (
      select 1 from jsonb_array_elements(players) as slot
      where slot <> 'null'::jsonb and not (
        jsonb_typeof(slot) = 'object'
        and (select count(*) from jsonb_object_keys(slot)) = 2
        and jsonb_typeof(slot -> 'spid') = 'number'
        and (slot ->> 'spid') ~ '^[1-9][0-9]{6,10}$'
        and jsonb_typeof(slot -> 'name') = 'string'
        and char_length(slot ->> 'name') between 1 and 40
      )
    )
    and (
      select count(distinct (s ->> 'spid')::bigint % 1000000) = count(*)
      from jsonb_array_elements(players) as s where s <> 'null'::jsonb
    )
  end;
$$;

alter table public.squads drop constraint if exists squads_values_check;
alter table public.squads add constraint squads_values_check check (
  char_length(btrim(name)) between 1 and 30
  and formation in ('4-3-3', '4-2-3-1', '4-4-2', '4-1-2-1-2', '3-5-2', '3-4-3')
  and public.squad_players_valid(players)
);

-- 글에 붙인 스쿼드. 내 스쿼드만 붙일 수 있고, 스쿼드를 지우면 글에서만 빠져요.
alter table public.posts add column if not exists squad_id bigint references public.squads (id) on delete set null;

-- 운영 기록. 카페 설정을 바꾸거나 글을 공지로 올리고 내리면 DB가 한 줄씩 남겨요.
-- changes에는 바뀐 칸마다 [이전 값, 새 값]을 적어요. 운영자만 보고, 1년이 지나면 지워요.
create table if not exists public.admin_logs (
  id bigint generated always as identity primary key,
  -- SQL Editor에서 직접 바꾸면 비어 있어요.
  actor_id uuid references public.profiles (id) on delete set null,
  area text not null,
  target text,
  changes jsonb not null default '{}',
  created_at timestamptz not null default now()
);

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

-- ---------- 내 소식 만들기 ----------
-- 내가 한 일은 나에게 알리지 않아요.

-- 클라이언트가 보낸 회원 ID를 믿지 않고 본문에서 실제 카페 회원을 찾아요.
-- 이메일·URL, 너무 긴 닉네임은 제외하고 대소문자가 다른 태그와 반복 태그는 한 명으로 합쳐요.
create or replace function public.resolve_comment_mentions() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nickname', p.nickname) order by p.nickname), '[]'::jsonb)
    into new.mentions
  from public.profiles p
  where lower(p.nickname) in (
    select lower(parts[2]) from regexp_matches(new.body,
      '(^|[[:space:]([{])@([가-힣A-Za-z0-9_]{2,12})(?![가-힣A-Za-z0-9_])', 'g') as parts
  );
  return new;
end $$;
drop trigger if exists comments_resolve_mentions on public.comments;
create trigger comments_resolve_mentions before insert on public.comments
  for each row execute function public.resolve_comment_mentions();

-- 댓글이 달리면 글쓴이에게, 답글이 달리면 댓글 쓴 사람에게 알려요.
-- 태그 > 답글 > 댓글 순으로 한 사람에게 알림 하나만 보내요.
create or replace function public.notify_comment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  post_owner uuid;
  parent_owner uuid;
  tagged uuid[];
begin
  select coalesce(array_agg((m->>'id')::uuid), '{}'::uuid[]) into tagged
    from jsonb_array_elements(new.mentions) m;
  insert into public.notifications (user_id, kind, actor_id, post_id, comment_id)
    select target, 'mention', new.user_id, new.post_id, new.id
    from unnest(tagged) target where target <> new.user_id;
  select p.user_id into post_owner from public.posts p where p.id = new.post_id;
  if new.parent_id is not null then
    select c.user_id into parent_owner from public.comments c where c.id = new.parent_id;
    if parent_owner <> new.user_id and not (parent_owner = any(tagged)) then
      insert into public.notifications (user_id, kind, actor_id, post_id, comment_id)
      values (parent_owner, 'reply', new.user_id, new.post_id, new.id);
    end if;
  end if;
  if post_owner <> new.user_id and post_owner is distinct from parent_owner and not (post_owner = any(tagged)) then
    insert into public.notifications (user_id, kind, actor_id, post_id, comment_id)
    values (post_owner, 'comment', new.user_id, new.post_id, new.id);
  end if;
  return null;
end $$;

drop trigger if exists comments_notify on public.comments;
create trigger comments_notify after insert on public.comments
  for each row execute function public.notify_comment();

-- 추천하면 글쓴이에게 알려요. 추천을 껐다 켜도 소식은 하나만 남고, 읽기 전에 추천을 취소하면 소식도 지워요.
create or replace function public.notify_like() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, kind, actor_id, post_id)
    select p.user_id, 'like', new.user_id, p.id from public.posts p
    where p.id = new.post_id
      and p.user_id <> new.user_id
      and not exists (
        select 1 from public.notifications n
        where n.user_id = p.user_id and n.kind = 'like' and n.post_id = p.id and n.actor_id = new.user_id
      );
  else
    delete from public.notifications n
    where n.kind = 'like' and n.post_id = old.post_id and n.actor_id = old.user_id and n.read_at is null;
  end if;
  return null;
end $$;

drop trigger if exists post_likes_notify on public.post_likes;
create trigger post_likes_notify after insert or delete on public.post_likes
  for each row execute function public.notify_like();

-- 내 소식을 모두 읽음으로 바꿔요. 60일 지난 소식은 이때 지워서 표가 끝없이 커지지 않게 해요.
create or replace function public.read_notifications() returns void
language sql security definer set search_path = '' as $$
  update public.notifications set read_at = now() where user_id = (select auth.uid()) and read_at is null;
  delete from public.notifications where user_id = (select auth.uid()) and created_at < now() - interval '60 days';
$$;

-- 화면에 실제로 표시된 소식만 읽어요. 목록을 연 직후 도착한 새 소식은 읽지 않은 채 남아요.
create or replace function public.read_notification_items(targets bigint[]) returns void
language sql security definer set search_path = '' as $$
  update public.notifications set read_at = now()
    where user_id = (select auth.uid()) and id = any(targets) and read_at is null;
  delete from public.notifications where user_id = (select auth.uid()) and created_at < now() - interval '60 days';
$$;

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
-- 맞힌 회원에게는 내 소식을 남겨요. match_label은 소식에 보일 "토트넘 vs 아스널" 같은 경기 이름이에요.
-- 예전에는 경기 이름 없이 불렀어서, 그 모양의 함수는 지우고 새로 만들어요.
drop function if exists public.settle_match(integer, text, timestamptz);
create or replace function public.settle_match(target integer, outcome text, kickoff timestamptz, match_label text default null)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  kick_day date := (kickoff at time zone 'Asia/Seoul')::date;
  participants integer;
  hitters integer;
  minority boolean;
  winner uuid;
  room integer;
  given integer;
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
    given := 0;
    if room > 0 then
      insert into public.goal_events (user_id, kind, ref, day, amount)
      values (winner, 'prediction', target::text, kick_day, least(10, room));
      given := least(10, room);
      room := room - given;
    end if;
    if minority and room > 0 then
      insert into public.goal_events (user_id, kind, ref, day, amount)
      values (winner, 'minority', target::text, kick_day, least(10, room));
      given := given + least(10, room);
    end if;
    -- 하루 상한에 걸려 골을 못 받았어도 맞힌 건 알려 줘요.
    insert into public.notifications (user_id, kind, match_id, match_day, label, amount)
    values (winner, 'prediction', target, kick_day, left(match_label, 40), given);
  end loop;
  return hitters;
end $$;

-- 쓸 수 있는 골. 모은 골에서 상점에 쓴 골을 뺀 값이에요. 쓴 골은 본인만 봐요.
create or replace function public.my_balance()
returns integer
language sql stable security definer set search_path = '' as $$
  select p.goals - p.spent_goals from public.profiles p where p.id = (select auth.uid());
$$;

-- 아이템 사기. 가격은 shop_items에서 읽고, 골이 모자라거나 이미 가졌으면 거절해요. 남은 골을 돌려줘요.
-- 오류 코드: 없는 아이템 P0002, 가입 전 42501, 이미 가짐 23505, 골 모자람 GL001
create or replace function public.buy_item(item text)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  cost integer;
  have integer;
begin
  select s.price into cost from public.shop_items s where s.id = item;
  if not found then
    raise exception '없는 아이템이에요.' using errcode = 'P0002';
  end if;

  -- 두 번 눌러도 골이 두 번 빠지지 않게 내 줄을 잠가요.
  select p.goals - p.spent_goals into have from public.profiles p where p.id = me for update;
  if not found then
    raise exception '가입한 회원만 살 수 있어요.' using errcode = '42501';
  end if;
  if exists (select 1 from public.owned_items o where o.user_id = me and o.item_id = item) then
    raise exception '이미 가진 아이템이에요.' using errcode = '23505';
  end if;
  if have < cost then
    raise exception '골이 모자라요.' using errcode = 'GL001';
  end if;

  insert into public.owned_items (user_id, item_id, price) values (me, item, cost);
  update public.profiles p set spent_goals = p.spent_goals + cost where p.id = me;
  return have - cost;
end $$;

-- 아이템 쓰기와 벗기. item이 null이면 그 종류를 벗어요. 가진 아이템만 쓸 수 있어요.
create or replace function public.equip_item(slot text, item text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
begin
  if slot not in ('color', 'frame') then
    raise exception '없는 꾸미기 종류예요.' using errcode = '22023';
  end if;
  if item is not null and not exists (
    select 1 from public.owned_items o join public.shop_items s on s.id = o.item_id
    where o.user_id = me and o.item_id = item and s.kind = slot
  ) then
    raise exception '가진 아이템만 쓸 수 있어요.' using errcode = '42501';
  end if;

  if slot = 'color' then
    update public.profiles p set name_color = item where p.id = me;
  else
    update public.profiles p set avatar_frame = item where p.id = me;
  end if;
end $$;

-- 조회수 올리기. 로그인하지 않은 방문자도 부를 수 있어요.
create or replace function public.count_post_view(target bigint) returns void
language sql security definer set search_path = '' as $$
  update public.posts set view_count = view_count + 1 where id = target;
$$;
grant execute on function public.count_post_view(bigint) to anon, authenticated;

-- 매니저인지. 운영자는 매니저 권한도 같이 가져요.
create or replace function public.is_cafe_manager() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and (is_manager or is_admin));
$$;

create or replace function public.is_cafe_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin);
$$;

-- 글·댓글·응원톡을 쓸 수 있는지. 글쓰기 잠금(점검 모드) 중에는 매니저와 운영자만 써요.
create or replace function public.can_write() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and (p.is_manager or p.is_admin or not coalesce((select s.write_locked from public.cafe_settings s), false))
  );
$$;

-- ---------- 운영 기록 ----------

-- 카페 설정이 바뀌면 바뀐 칸만 [이전 값, 새 값]으로 남겨요.
create or replace function public.log_admin_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  old_row jsonb := to_jsonb(old);
  new_row jsonb := to_jsonb(new);
  changes jsonb := '{}';
  field text;
begin
  for field in select jsonb_object_keys(new_row) loop
    if field <> 'updated_at' and old_row -> field is distinct from new_row -> field then
      changes := changes || jsonb_build_object(field, jsonb_build_array(old_row -> field, new_row -> field));
    end if;
  end loop;
  if changes <> '{}' then
    perform public.log_admin_action(tg_table_name, null, changes);
  end if;
  return null;
end $$;

-- 운영 동작을 한 줄 남기고, 1년 지난 기록은 지워요. DB 함수와 트리거 안에서만 불러요.
create or replace function public.log_admin_action(action text, target text, details jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into public.admin_logs (actor_id, area, target, changes) values ((select auth.uid()), action, target, details);
  delete from public.admin_logs where created_at < now() - interval '1 year';
$$;

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists cafe_settings_touch on public.cafe_settings;
create trigger cafe_settings_touch before update on public.cafe_settings
  for each row execute function public.touch_updated_at();
drop trigger if exists cafe_settings_log on public.cafe_settings;
create trigger cafe_settings_log after update on public.cafe_settings
  for each row execute function public.log_admin_change();

-- 글을 공지로 올리거나 내려요. 운영자만 할 수 있어요.
create or replace function public.pin_post(target bigint, pinned boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  post_title text;
begin
  if not public.is_cafe_admin() then
    raise exception '운영자만 공지를 정할 수 있어요.' using errcode = '42501';
  end if;
  update public.posts set pinned_at = case when pinned then now() end where id = target
  returning title into post_title;
  if not found then
    raise exception '없는 글이에요.' using errcode = 'P0002';
  end if;
  perform public.log_admin_action('pin', target::text, jsonb_build_object('pinned', pinned, 'title', post_title));
end $$;

-- ---------- 권한 ----------
-- 운영자가 업데이트를 등록하면 당시 가입한 모든 회원에게 한 번씩 알려요.
create or replace function public.notify_site_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, kind, update_id)
    select id, 'update', new.id from public.profiles
    on conflict do nothing;
  perform public.log_admin_action('update', new.id::text, jsonb_build_object('version', new.version, 'title', new.title));
  return null;
end $$;
drop trigger if exists site_updates_notify on public.site_updates;
create trigger site_updates_notify after insert on public.site_updates
  for each row execute function public.notify_site_update();

-- 읽기는 누구나, 쓰기는 가입한 회원 본인만 할 수 있어요.
-- 칸 단위로 권한을 줘서 회원이 매니저 표시나 조회수·추천 수를 직접 바꾸지 못하게 막아요.

revoke all on public.profiles, public.posts, public.comments, public.post_likes, public.match_talks,
  public.match_predictions, public.goal_events, public.settled_matches, public.unsettled_matches,
  public.shop_items, public.owned_items, public.notifications, public.cafe_settings, public.admin_logs, public.squads, public.site_updates
  from anon, authenticated;

grant select on public.posts, public.comments, public.match_talks, public.match_predictions, public.shop_items,
  public.cafe_settings, public.squads, public.site_updates
  to anon, authenticated;
grant select on public.post_likes, public.goal_events, public.owned_items, public.notifications, public.admin_logs
  to authenticated;
-- 회원 정보는 공개해도 되는 칸만 보여요. 언제 들어왔는지 알 수 있는 출석 칸은 본인만 my_attendance로 봐요.
grant select (id, nickname, is_manager, is_admin, goals, team_id, team_name, team_crest, name_color, avatar_frame, created_at)
  on public.profiles to anon, authenticated;
revoke all on function public.my_attendance() from public, anon;
grant execute on function public.my_attendance() to authenticated;

-- 골은 DB 함수로만 생겨요. 출석은 회원이, 예측 정산은 서버의 비밀 키(service_role)만 부를 수 있어요.
revoke all on function public.check_in() from public, anon;
grant execute on function public.check_in() to authenticated;
revoke all on function public.settle_match(integer, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.settle_match(integer, text, timestamptz, text) to service_role;

-- 상점도 DB 함수로만 사고 써요. 쓴 골(spent_goals)은 본인만 my_balance로 봐요.
revoke all on function public.my_balance() from public, anon;
grant execute on function public.my_balance() to authenticated;
revoke all on function public.buy_item(text) from public, anon;
grant execute on function public.buy_item(text) to authenticated;
revoke all on function public.equip_item(text, text) from public, anon;
grant execute on function public.equip_item(text, text) to authenticated;

-- 내 소식은 DB가 만들고, 회원은 읽음 표시만 함수로 해요.
revoke all on function public.read_notifications() from public, anon;
grant execute on function public.read_notifications() to authenticated;
revoke all on function public.read_notification_items(bigint[]) from public, anon;
grant execute on function public.read_notification_items(bigint[]) to authenticated;
grant insert (version, title, body) on public.site_updates to authenticated;

-- 운영 기록은 DB 함수와 트리거 안에서만 남겨요. 회원이 직접 부르면 가짜 기록을 남길 수 있어서 막아요.
revoke all on function public.log_admin_action(text, text, jsonb) from public, anon, authenticated;
-- 공지 고정은 함수 안에서 운영자인지 다시 확인해요.
revoke all on function public.pin_post(bigint, boolean) from public, anon;
grant execute on function public.pin_post(bigint, boolean) to authenticated;
-- 카페 설정은 바꿀 수 있는 칸만 열고, 운영자인지는 아래 규칙이 확인해요.
grant update (cafe_name, tagline, banner_color, notice_on, notice_text, notice_href, write_locked, lock_message)
  on public.cafe_settings to authenticated;

grant insert (nickname), update (nickname, team_id, team_name, team_crest) on public.profiles to authenticated;
grant insert (board, title, body, squad_id), update (title, body, updated_at), delete on public.posts to authenticated;
grant insert (post_id, parent_id, body), delete on public.comments to authenticated;
grant insert (post_id), delete on public.post_likes to authenticated;
grant insert (match_id, side, body), delete on public.match_talks to authenticated;
grant insert (match_id, competition, pick), update (pick) on public.match_predictions to authenticated;
grant insert (name, formation, players), update (name, formation, players, updated_at), delete on public.squads to authenticated;

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.post_likes enable row level security;
alter table public.match_talks enable row level security;
alter table public.match_predictions enable row level security;
alter table public.goal_events enable row level security;
-- 정산 기록은 서버(service_role)만 읽고 써서 회원용 규칙을 두지 않아요.
alter table public.settled_matches enable row level security;
alter table public.shop_items enable row level security;
alter table public.owned_items enable row level security;
alter table public.notifications enable row level security;
alter table public.cafe_settings enable row level security;
alter table public.admin_logs enable row level security;
alter table public.squads enable row level security;
alter table public.site_updates enable row level security;
drop policy if exists site_updates_select on public.site_updates;
create policy site_updates_select on public.site_updates for select using (true);
drop policy if exists site_updates_insert on public.site_updates;
create policy site_updates_insert on public.site_updates for insert to authenticated
  with check ((select public.is_cafe_admin()));

-- 카페 설정은 누구나 보고, 운영자만 바꿔요. 운영 기록은 운영자만 봐요.
drop policy if exists cafe_settings_select on public.cafe_settings;
create policy cafe_settings_select on public.cafe_settings for select using (true);
drop policy if exists cafe_settings_update on public.cafe_settings;
create policy cafe_settings_update on public.cafe_settings for update to authenticated
  using ((select public.is_cafe_admin())) with check ((select public.is_cafe_admin()));
drop policy if exists admin_logs_select on public.admin_logs;
create policy admin_logs_select on public.admin_logs for select to authenticated
  using ((select public.is_cafe_admin()));

-- 상점 아이템은 누구나 보고, 산 아이템은 내 것만 보여요.
drop policy if exists shop_items_select on public.shop_items;
create policy shop_items_select on public.shop_items for select using (true);
drop policy if exists owned_items_select on public.owned_items;
create policy owned_items_select on public.owned_items for select to authenticated
  using (user_id = (select auth.uid()));

-- 내 소식은 나만 봐요.
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

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
-- 글쓰기 잠금 중에는 매니저와 운영자만 쓰고 고칠 수 있어요(can_write).
drop policy if exists posts_select on public.posts;
create policy posts_select on public.posts for select using (true);
drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts for insert to authenticated with check (
  user_id = (select auth.uid())
  and (select public.can_write())
  -- 스쿼드는 내 것만 붙여요.
  and (
    posts.squad_id is null
    or exists (select 1 from public.squads s where s.id = posts.squad_id and s.user_id = (select auth.uid()))
  )
  and not exists (
    select 1 from public.posts p
    where p.user_id = (select auth.uid()) and p.created_at > now() - interval '30 seconds'
  )
);
drop policy if exists posts_update on public.posts;
create policy posts_update on public.posts for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and (select public.can_write()));
drop policy if exists posts_delete on public.posts;
create policy posts_delete on public.posts for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_cafe_manager()));

-- 댓글. 5초에 한 번만 달 수 있고, 글쓰기 잠금 중에는 매니저와 운영자만 달아요.
-- 답글은 같은 글의, 지워지지 않은 맨 위 댓글에만 달 수 있어요.
drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments for select using (true);
drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert to authenticated with check (
  user_id = (select auth.uid())
  and (select public.can_write())
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

-- 응원톡. 3초에 한 번만 보낼 수 있고, 글쓰기 잠금 중에는 매니저와 운영자만 보내요.
drop policy if exists match_talks_select on public.match_talks;
create policy match_talks_select on public.match_talks for select using (true);
drop policy if exists match_talks_insert on public.match_talks;
create policy match_talks_insert on public.match_talks for insert to authenticated with check (
  user_id = (select auth.uid())
  and (select public.can_write())
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

-- 드림 스쿼드. 누구나 보고, 회원은 30개까지 만들어 내 것만 고치고 지워요. 매니저는 아무 스쿼드나 지워요.
-- 도배를 막으려고 새 스쿼드는 10초에 하나만 만들고, 글쓰기 잠금 중에는 만들거나 고칠 수 없어요.
drop policy if exists squads_select on public.squads;
create policy squads_select on public.squads for select using (true);
drop policy if exists squads_insert on public.squads;
create policy squads_insert on public.squads for insert to authenticated with check (
  user_id = (select auth.uid())
  and (select public.can_write())
  and (select count(*) from public.squads s where s.user_id = (select auth.uid())) < 30
  and not exists (
    select 1 from public.squads s
    where s.user_id = (select auth.uid()) and s.created_at > now() - interval '10 seconds'
  )
);
drop policy if exists squads_update on public.squads;
create policy squads_update on public.squads for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and (select public.can_write()));
drop policy if exists squads_delete on public.squads;
create policy squads_delete on public.squads for delete to authenticated
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
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
