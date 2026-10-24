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

-- ---------- 선수 맞히기 ----------
-- FC온라인 선수 사진을 보고 보기 4개 중 이름을 고르는 미니게임이에요. 한국 날짜로 하루 5문제까지 풀어요.
-- 정답은 1골인데 연승마다 1골씩 더해서 2연승 2골, 3연승 3골, 5연승부터는 5골이에요. 틀리면 연승이 끊겨요.
-- 규칙은 quiz_start, quiz_answer에 있고, 화면에 보이는 숫자는 src/lib/cafe/config.ts의 QUIZ와 같아야 해요.

-- 문제 은행. 넥슨 Open API의 카드 목록에서 뽑은 유명 선수예요. scripts/quiz-players.mjs가 아래 목록을 다시 만들어요.
-- spid는 사진으로 보여 줄 대표 카드 번호예요. 동작 사진이 없는 선수는 비워 두고 얼굴 사진을 써요.
create table if not exists public.quiz_players (
  pid integer primary key,
  name text not null check (char_length(name) between 1 and 40),
  spid integer
);
-- quiz-players:start
insert into public.quiz_players (pid, name, spid) values
  (1, '데이비드 시먼', 252000001),
  (41, '이니에스타', 877000041),
  (51, '앨런 시어러', 861000051),
  (195, '로비 파울러', 283000195),
  (240, '로이 킨', 877000240),
  (241, '라이언 긱스', 268000241),
  (244, '게리 네빌', 283000244),
  (246, '폴 스콜스', 861000246),
  (250, '데이비드 베컴', 867000250),
  (388, '솔 캠벨', 877000388),
  (393, '테디 셰링엄', 284000393),
  (488, '올리버 칸', 877000488),
  (570, '제이-제이 오코차', 861000570),
  (805, '옌스 레만', 216000805),
  (942, '크리스티안 비에리', 264000942),
  (1025, '후이 코스타', 877001025),
  (1040, '호베르투 카를루스', 867001040),
  (1041, '하비에르 사네티', 877001041),
  (1075, '델피에로', 861001075),
  (1088, '알레산드로 네스타', 867001088),
  (1109, '파올로 말디니', 877001109),
  (1114, '로베르토 바조', 861001114),
  (1116, '마르셀 드사이', 867001116),
  (1179, '잔루이지 부폰', 877001179),
  (1183, '파비오 칸나바로', 867001183),
  (1198, '필리포 인자기', 272001198),
  (1201, '잔프랑코 졸라', 852001201),
  (1238, '프란체스코 토티', 867001238),
  (1256, '클라렌스 세이도르프', 814001256),
  (1397, '지네딘 지단', 868001397),
  (1419, '파트리크 비에이라', 868001419),
  (1605, '로베르 피레스', 877001605),
  (1615, '릴리앙 튀람', 861001615),
  (1620, '에마뉘엘 프티', 861001620),
  (1625, '티에리 앙리', 877001625),
  (1668, '클로드 마켈렐레', 877001668),
  (1845, '올레 군나르 솔샤르', 877001845),
  (3647, '미하엘 발락', 284003647),
  (4000, '데니스 베르캄프', 877004000),
  (4202, '젠나로 가투소', 867004202),
  (4231, '히바우두', 861004231),
  (4833, '스토이치코프', 861004833),
  (5003, '카푸', 877005003),
  (5099, '잔루카 잠브로타', 861005099),
  (5419, '마이클 오언', 861005419),
  (5467, '제이미 캐러거', 861005467),
  (5471, '프랭크 램파드', 877005471),
  (5479, '카시야스', 861005479),
  (5589, '루이스 피구', 868005589),
  (5673, '야리 리트마넨', 827005673),
  (5680, '클라위베르트', 877005680),
  (5681, 'M. 오베르마르스', 256005681),
  (5984, '다비드 트레제게', 813005984),
  (6235, '파벨 네드베드', 867006235),
  (6975, '프레디 융베리', 877006975),
  (7289, '리오 퍼디난드', 868007289),
  (7512, '에르난 크레스포', 868007512),
  (7518, '베론', 867007518),
  (7763, '안드레아 피를로', 877007763),
  (7826, '로빈 반페르시', 861007826),
  (9676, '사뮈엘 에토', 877009676),
  (10264, '뤼트 반니스텔로이', 861010264),
  (10535, '차비', 877010535),
  (11141, '미로슬라프 클로제', 877011141),
  (13038, '카를레스 푸욜', 877013038),
  (13128, '안드리 셰우첸코', 877013128),
  (13383, '나카타 히데토시', 861013383),
  (13743, '스티븐 제라드', 861013743),
  (20170, '비토르 바이아', 256020170),
  (20289, '야야 투레', 861020289),
  (20801, '크리스티아누 호날두', 877020801),
  (23174, '리켈메', 861023174),
  (28130, '호나우지뉴', 877028130),
  (31432, '디디에 드로그바', 877031432),
  (34079, '애슐리 콜', 877034079),
  (37576, '호나우두', 868037576),
  (39943, '박지성', 864039943),
  (41236, '즐라탄', 861041236),
  (45197, '샤비 알론소', 877045197),
  (45661, '라울', 861045661),
  (45674, '마이클 에시앙', 868045674),
  (46747, '알렉시 랄라스', null),
  (48940, '페트르 체흐', 877048940),
  (49369, '페르난도 토레스', 861049369),
  (51539, '에드윈 반데르사르', 861051539),
  (52241, '헨릭 라르손', 868052241),
  (53769, '데쿠', 272053769),
  (54050, '웨인 루니', 877054050),
  (117106, '파울레타', 272117106),
  (121939, '필립 람', 877121939),
  (121944, '슈바인슈타이거', 877121944),
  (135507, '페르난지뉴', 508135507),
  (138412, '제임스 밀너', 846138412),
  (138449, '카카', 877138449),
  (138956, '조르조 키엘리니', 877138956),
  (140601, '네마냐 비디치', 877140601),
  (142754, '하비에르 마스체라노', 877142754),
  (146536, '헤수스 나바스', 818146536),
  (152729, '피케', 511152729),
  (153079, '세르히오 아구에로', 877153079),
  (155862, '세르히오 라모스', 818155862),
  (156353, '루이스 에르난데스', 861156353),
  (156616, '프랑크 리베리', 877156616),
  (157481, '라울 알비올', 840157481),
  (158023, '리오넬 메시', 877158023),
  (161840, '페르난도 이에로', 867161840),
  (162347, '주앙 무티뉴', 845162347),
  (162895, '세스크 파브레가스', 877162895),
  (164240, '티아구 실바', 821164240),
  (165153, '카림 벤제마', 855165153),
  (166120, '안드레아스 브레메', 268166120),
  (166124, '게오르게 하지', 861166124),
  (166149, '우고 산체스', 861166149),
  (166691, '지쿠', 861166691),
  (166906, '프랑코 바레시', 861166906),
  (167135, '카를루스 아우베르투', 861167135),
  (167198, '에릭 칸토나', 877167198),
  (167495, '마누엘 노이어', 856167495),
  (167680, '로날트 쿠만', 867167680),
  (167948, '위고 요리스', 848167948),
  (168473, '베켄바워', 868168473),
  (168542, '다비드 실바', 511168542),
  (168651, '이반 라키티치', 511168651),
  (172871, '얀 베르통언', 815172871),
  (173731, '가레스 베일', 861173731),
  (175943, '드리스 메르턴스', 828175943),
  (176580, '루이스 수아레스', 877176580),
  (176676, '마르셀루', 867176676),
  (177003, '루카 모드리치', 877177003),
  (177413, '악셀 비첼', 834177413),
  (177683, '얀 조머', 856177683),
  (177845, '프랑크 더부르', 283177845),
  (178005, '후이 파트리시우', 845178005),
  (178509, '올리비에 지루', 852178509),
  (178603, '마츠 후멜스', 814178603),
  (179813, '에딘손 카바니', 818179813),
  (180283, '기성용', 864180283),
  (180930, '에딘 제코', 863180930),
  (181291, '조르지뇨 베이날둠', 846181291),
  (181458, '이반 페리시치', 863181458),
  (182521, '토니 크로스', 877182521),
  (183277, '에덴 아자르', 868183277),
  (183711, '조던 헨더슨', 852183711),
  (183898, '앙헬 디마리아', 845183898),
  (184344, '레오나르도 보누치', 511184344),
  (184432, '아스필리쿠에타', 840184432),
  (184941, '알렉시스 산체스', 845184941),
  (186153, '보이치에흐 슈체스니', 852186153),
  (186345, '키어런 트리피어', 856186345),
  (186627, '마리오 발로텔리', 503186627),
  (186942, '일카이 귄도안', 856186942),
  (188350, '마르코 로이스', 852188350),
  (188377, '카일 워커', 848188377),
  (188545, '레반도프스키', 877188545),
  (188567, 'P. 오바메양', 866188567),
  (188943, '케빈 트라프', 840188943),
  (189242, '쿠티뉴', 511189242),
  (189332, '조르디 알바', 852189332),
  (189505, '페드로', 852189505),
  (189509, '티아고', 511189509),
  (189511, '세르지오 부스케츠', 852189511),
  (189513, '파레호', 848189513),
  (189596, '토마스 뮐러', 877189596),
  (190042, '마라도나', 861190042),
  (190043, '펠레', 861190043),
  (190044, '보비 무어', 861190044),
  (190045, '요한 크루이프', 868190045),
  (190046, '소크라테스', 861190046),
  (190048, '게르트 뮐러', 861190048),
  (190053, '페터 슈마이켈', 877190053),
  (190460, '크리스티안 에릭센', 815190460),
  (190815, '데일리 블린트', 852190815),
  (190871, '네이마르 Jr.', 863190871),
  (191043, '알렉스 산드루', 801191043),
  (191189, '로타어 마테우스', 868191189),
  (191208, '차범근', 868191208),
  (191695, '부트라게뇨', 861191695),
  (192119, '티보 쿠르투아', 866192119),
  (192181, '마르코 반바스텐', 868192181),
  (192190, '둥가', 861192190),
  (192318, '마리오 괴체', 848192318),
  (192366, '니콜라스 오타멘디', 863192366),
  (192387, '치로 임모빌레', 852192387),
  (192448, 'M. 테어슈테겐', 852192448),
  (192505, '로멜루 루카쿠', 877192505),
  (192629, '이아고 아스파스', 867192629),
  (192883, '헨릭 미키타리안', 877192883),
  (192985, '케빈 더브라위너', 877192985),
  (193041, '케일러 나바스', 508193041),
  (193080, '데헤아', 877193080),
  (193082, '후안 콰드라도', 834193082),
  (193301, '알렉상드르 라카제트', 840193301),
  (193348, '제르단 샤키리', 825193348),
  (193474, '이드리사 게예', 863193474),
  (193747, '코케', 856193747),
  (194765, '앙투안 그리즈만', 856194765),
  (195864, '폴 포그바', 596195864),
  (197445, '데이비드 알라바', 863197445),
  (197781, '이스코', 867197781),
  (198176, '스테판 더브레이', 848198176),
  (198219, '로렌초 인시녜', 845198219),
  (198710, '하메스 로드리게스', 863198710),
  (199304, '다닐루', 829199304),
  (199503, '그라니트 자카', 877199503),
  (199556, '마르코 베라티', 511199556),
  (199564, '세르지 로베르토', 877199564),
  (200104, '손흥민', 866200104),
  (200145, '카제미루', 877200145),
  (200389, '얀 오블라크', 856200389),
  (200724, '나초 페르난데스', 846200724),
  (201024, '칼리두 쿨리발리', 867201024),
  (201153, '모라타', 815201153),
  (201535, '라파엘 바란', 814201535),
  (201942, '호베르투 피르미누', 845201942),
  (202126, '해리 케인', 866202126),
  (202166, '율리안 드락슬러', 508202166),
  (202371, '토마 뫼니에', 863202371),
  (202556, '멤피스 데파이', 863202556),
  (202652, '라힘 스털링', 836202652),
  (203376, '버질 반다이크', 877203376),
  (203574, '존 스톤스', 877203574),
  (204485, '리야드 마레즈', 863204485),
  (204525, '이니고 마르티네스', 844204525),
  (204639, '스테판 사비치', 810204639),
  (204923, '마르셀 자비처', 863204923),
  (204935, '조던 픽포드', 863204935),
  (204963, '카르바할', 848204963),
  (205452, '안토니오 뤼디거', 863205452),
  (205988, '루크 쇼', 840205988),
  (206113, '세르주 그나브리', 866206113),
  (206517, '잭 그릴리시', 852206517),
  (207410, '마테오 코바치치', 840207410),
  (207862, '마티아스 긴터', 852207862),
  (207865, '마르키뉴스', 863207865),
  (208093, '제라르 모레노', 840208093),
  (208128, '하칸 찰하놀루', 877208128),
  (208333, '엠레 잔', 867208333),
  (208418, '야니크 카라스코', 866208418),
  (208574, '필리프 코스티치', 840208574),
  (208618, '루카스 바스케스', 834208618),
  (208722, '사디오 마네', 877208722),
  (209331, '모하메드 살라', 863209331),
  (209499, '파비뉴', 848209499),
  (209658, '레온 고레츠카', 863209658),
  (209889, '하파엘 게헤이루', 856209889),
  (210008, '아드리앙 라비오', 867210008),
  (210035, '그리말도', 866210035),
  (210257, '에데르송', 863210257),
  (210406, 'P. 지엘린스키', 877210406),
  (210514, '주앙 칸셀루', 863210514),
  (210935, '도메니코 베라르디', 867210935),
  (211110, '파울로 디발라', 877211110),
  (211688, '가야', 867211688),
  (212188, '티모 베르너', 848212188),
  (212190, '니클라스 쥘레', 848212190),
  (212194, '율리안 브란트', 856212194),
  (212198, '브루누 페르난데스', 867212198),
  (212218, '에므리크 라포르트', 863212218),
  (212432, '조현우', 863212432),
  (212622, '요주아 키미히', 866212622),
  (212831, '알리송', 877212831),
  (213331, '요나탄 타', 866213331),
  (213345, '킹슬레 코망', 877213345),
  (214098, '프랑크 레이카르트', 868214098),
  (214100, '루드 굴리트', 868214100),
  (214101, '파울루 푸트리', 867214101),
  (214267, '게리 리네커', 861214267),
  (214649, '다보르 슈케르', 867214649),
  (215558, '슈테판 에펜베르크', 284215558),
  (215698, '마이크 메냥', 866215698),
  (215732, '올리버 비어호프', 861215732),
  (215914, '은골로 캉테', 848215914),
  (216201, '이냐키 윌리암스', 863216201),
  (216267, '앤드루 로버트슨', 877216267),
  (216352, 'M. 브로조비치', 848216352),
  (216354, 'A. 크라마리치', 866216354),
  (216393, '유리 틸레만스', 863216393),
  (216460, 'J. 히메네스', 863216460),
  (216594, '나빌 페키르', 511216594),
  (217870, '조반니 디로렌초', 877217870),
  (218667, '베르나르두 실바', 863218667),
  (219683, '코랑탕 톨리소', 866219683),
  (220814, '루카스 에르난데스', 840220814),
  (221162, '바티스투타', 861221162),
  (222000, '미카엘 라우드루프', 861222000),
  (222077, '마누엘 로카텔리', 867222077),
  (222257, '브리안 라우드루프', 252222257),
  (222481, '로랑 블랑', 868222481),
  (222492, '리로이 사네', 863222492),
  (222665, '마르틴 외데고르', 863222665),
  (222680, '카를로스 발데라마', null),
  (223848, 'S. 밀린코비치-사비치', 867223848),
  (224232, '니콜로 바렐라', 877224232),
  (225193, '미켈 메리노', 867225193),
  (225850, '프레스넬 킴펨베', null),
  (226161, '마르코스 요렌테', 866226161),
  (226271, '파비안 루이스', 863226271),
  (226764, '조지 베스트', 850226764),
  (226851, '뱅자맹 파바르', 877226851),
  (227796, '크리스천 풀리식', 863227796),
  (228093, '마르쿠스 튀람', 877228093),
  (228618, '페를랑 멘디', 846228618),
  (228702, '프렝키 더용', 863228702),
  (229237, '마누엘 아칸지', 866229237),
  (229261, '데니스 자카리아', 863229261),
  (229558, '다요 우파메카노', 866229558),
  (230025, '보비 찰턴', 868230025),
  (230142, '오야르사발', 866230142),
  (230621, '잔루이지 돈나룸마', 866230621),
  (230666, '가브리엘 제주스', 877230666),
  (231281, 'T. 알렉산더-아놀드', 848231281),
  (231443, '우스만 뎀벨레', 866231443),
  (231478, '라우타로', 866231478),
  (231677, '마커스 래시포드', 863231677),
  (231747, '킬리안 음바페', 866231747),
  (231866, '로드리', 877231866),
  (232363, '밀란 슈크리니아르', 848232363),
  (232411, 'C. 은쿤쿠', 852232411),
  (232488, '크리스티안 로메로', 867232488),
  (232656, '테오 에르난데스', 867232656),
  (233049, '제이든 산초', 852233049),
  (233064, '메이슨 마운트', 836233064),
  (233096, '덴젤 둠프리스', 863233096),
  (233419, '하피냐', 866233419),
  (234378, '데클런 라이스', 866234378),
  (234396, '알폰소 데이비스', 863234396),
  (235243, '마테이스 더리흐트', 840235243),
  (235790, '카이 하베르츠', 867235790),
  (235805, '페데리코 키에사', 845235805),
  (237086, '김민재', 863237086),
  (237383, 'A. 바스토니', 856237383),
  (237692, '필 포든', 877237692),
  (238380, '레프 야신', 861238380),
  (238794, '비니시우스', 867238794),
  (239053, '페데리코 발베르데', 866239053),
  (239085, '엘링 홀란', 866239085),
  (239818, '후벵 디아스', 877239818),
  (240130, '에데르 밀리탕', 856240130),
  (241084, '루이스 디아스', 866241084),
  (241486, '쥘 쿤데', 863241486),
  (241637, 'A. 추아메니', 866241637),
  (241721, '하파엘 레앙', 863241721),
  (242444, '주앙 펠릭스', 866242444),
  (242519, '에우제비우', 868242519),
  (243715, '윌리암 살리바', 866243715),
  (243780, '이강인', 879243780),
  (243781, '과르디올라', 256243781),
  (243812, '호드리구', 863243812),
  (244260, '다니 올모', 856244260),
  (246430, '두샨 블라호비치', 856246430),
  (246669, '부카요 사카', 863246669),
  (247515, '존 반스', 861247515),
  (247553, '가린샤', 861247553),
  (247635, '크바라츠헬리아', 866247635),
  (247699, '케니 달글리시', 861247699),
  (247703, '이언 러시', 868247703),
  (248146, '이언 라이트', 867248146),
  (251517, '그바르디올', 863251517),
  (251854, '페드리', 866251854),
  (252371, '주드 벨링엄', 867252371),
  (253149, '제레미 프림퐁', 877253149),
  (254642, '페렌츠 푸스카스', 861254642),
  (256630, '플로리안 비르츠', 877256630),
  (256790, '무시알라', 863256790),
  (268513, '자이르지뉴', 861268513)
on conflict (pid) do update set name = excluded.name, spid = excluded.spid;
-- quiz-players:end

-- 낸 문제. 정답 선수는 서버가 비밀 키로만 읽어서 화면은 사진 주소로 정답을 알 수 없어요.
-- choices는 보기 4개의 선수 이름(화면 순서), answer는 정답 보기 번호(1~4), picked는 회원이 고른 번호예요. 아직 안 풀었으면 null이에요.
create table if not exists public.quiz_rounds (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- 문제를 낸 한국 날짜. 하루 문제 수를 셀 때 써요.
  day date not null,
  answer_pid integer not null,
  answer_spid integer,
  choices text[] not null check (array_length(choices, 1) = 4),
  answer integer not null check (answer between 1 and 4),
  picked integer check (picked between 1 and 4),
  awarded integer not null default 0,
  created_at timestamptz not null default now(),
  answered_at timestamptz
);
create index if not exists quiz_rounds_user_idx on public.quiz_rounds (user_id, id desc);
-- 안 푼 문제는 한 번에 하나만 있어요.
create unique index if not exists quiz_rounds_open_key on public.quiz_rounds (user_id) where picked is null;

-- 연승. 정답마다 1씩 오르고 틀리면 0이 돼요. 날이 바뀌어도 이어져요.
alter table public.profiles add column if not exists quiz_streak integer not null default 0;

-- 골 내역에 선수 맞히기(quiz)를 더해요.
alter table public.goal_events drop constraint if exists goal_events_kind_check;
alter table public.goal_events add constraint goal_events_kind_check
  check (kind in ('attendance', 'streak', 'prediction', 'minority', 'quiz'));

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

-- 선수 맞히기 문제 받기. 안 푼 문제가 있으면 그 문제를 다시 주고, 오늘 5문제를 다 냈으면 round_id가 null이에요.
-- 최근 30문제에 나온 선수는 다시 내지 않고, 보기는 이름이 다른 선수 3명을 섞어요.
-- played는 오늘 받은 문제 수(지금 준 문제 포함), earned는 오늘 받은 골이에요. 가입 전이면 아무것도 돌려주지 않아요.
create or replace function public.quiz_start()
returns table (round_id bigint, choices text[], played integer, earned integer, streak integer)
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  today date := (now() at time zone 'Asia/Seoul')::date;
  my_streak integer;
  done integer;
  got integer;
  pick record;
  names text[];
  spot integer;
  new_id bigint;
begin
  -- 두 번 눌러도 문제가 두 개 생기지 않게 내 줄을 잠가요.
  select p.quiz_streak into my_streak from public.profiles p where p.id = me for update;
  if not found then
    return;
  end if;
  select count(*), coalesce(sum(r.awarded), 0) into done, got
  from public.quiz_rounds r where r.user_id = me and r.day = today;

  return query select r.id, r.choices, done, got, my_streak
    from public.quiz_rounds r where r.user_id = me and r.picked is null;
  if found then
    return;
  end if;
  if done >= 5 then
    return query select null::bigint, null::text[], done, got, my_streak;
    return;
  end if;

  select q.pid, q.name, q.spid into pick from public.quiz_players q
  where q.pid not in (
    select r.answer_pid from public.quiz_rounds r where r.user_id = me order by r.id desc limit 30
  )
  order by random() limit 1;
  if not found then
    -- 문제 은행이 작으면 최근에 나온 선수라도 다시 내요.
    select q.pid, q.name, q.spid into pick from public.quiz_players q order by random() limit 1;
    if not found then
      raise exception '문제로 낼 선수가 없어요.' using errcode = 'P0002';
    end if;
  end if;
  select coalesce(array_agg(o.name), '{}') into names
  from (select q.name from public.quiz_players q where q.name <> pick.name order by random() limit 3) o;
  if coalesce(array_length(names, 1), 0) <> 3 then
    raise exception '보기로 낼 선수가 모자라요.' using errcode = 'P0002';
  end if;
  spot := 1 + floor(random() * 4)::integer;
  names := names[1:spot - 1] || pick.name || names[spot:3];

  insert into public.quiz_rounds (user_id, day, answer_pid, answer_spid, choices, answer)
  values (me, today, pick.pid, pick.spid, names, spot)
  returning id into new_id;
  return query select new_id, names, done + 1, got, my_streak;
end $$;

-- 선수 맞히기 답하기. choice는 보기 번호(1~4)예요. 정답이면 연승을 올리고 연승만큼(최대 5골) 골을 줘요. 틀리면 연승이 0이 돼요.
-- answer_name은 정답 선수 이름, prize는 이번에 받은 골, played와 earned는 오늘 받은 문제 수와 골이에요.
-- 오류 코드: 가입 전 42501, 없거나 이미 푼 문제 P0002, 보기 번호 오류 22023
create or replace function public.quiz_answer(target bigint, choice integer)
returns table (correct boolean, answer_name text, prize integer, streak integer, played integer, earned integer)
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  today date := (now() at time zone 'Asia/Seoul')::date;
  my_streak integer;
  item public.quiz_rounds%rowtype;
  hit boolean;
  given integer := 0;
begin
  if choice is null or choice not between 1 and 4 then
    raise exception '보기 번호가 잘못됐어요.' using errcode = '22023';
  end if;
  -- 문제 받기와 같은 순서로 내 줄부터 잠가서 서로 기다리다 멈추지 않게 해요.
  select p.quiz_streak into my_streak from public.profiles p where p.id = me for update;
  if not found then
    raise exception '가입한 회원만 풀 수 있어요.' using errcode = '42501';
  end if;
  select * into item from public.quiz_rounds q
  where q.id = target and q.user_id = me and q.picked is null for update;
  if not found then
    raise exception '없는 문제이거나 이미 푼 문제예요.' using errcode = 'P0002';
  end if;

  hit := choice = item.answer;
  if hit then
    my_streak := my_streak + 1;
    given := least(my_streak, 5);
    insert into public.goal_events (user_id, kind, ref, day, amount) values (me, 'quiz', target::text, today, given);
  else
    my_streak := 0;
  end if;
  update public.quiz_rounds q set picked = choice, awarded = given, answered_at = now() where q.id = target;
  update public.profiles p set quiz_streak = my_streak where p.id = me;
  return query
    select hit, item.choices[item.answer], given, my_streak, count(*)::integer, coalesce(sum(q.awarded), 0)::integer
    from public.quiz_rounds q where q.user_id = me and q.day = today;
end $$;

-- 내 선수 맞히기 상태. 연승, 오늘 받은 문제 수와 골, 아직 안 푼 문제예요. 본인만 볼 수 있어요.
create or replace function public.my_quiz()
returns table (streak integer, played integer, earned integer, round_id bigint, choices text[])
language sql stable security definer set search_path = '' as $$
  select p.quiz_streak,
    (select count(*)::integer from public.quiz_rounds r
      where r.user_id = p.id and r.day = (now() at time zone 'Asia/Seoul')::date),
    (select coalesce(sum(r.awarded), 0)::integer from public.quiz_rounds r
      where r.user_id = p.id and r.day = (now() at time zone 'Asia/Seoul')::date),
    o.id, o.choices
  from public.profiles p
  left join public.quiz_rounds o on o.user_id = p.id and o.picked is null
  where p.id = (select auth.uid());
$$;

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
  public.shop_items, public.owned_items, public.notifications, public.cafe_settings, public.admin_logs, public.squads, public.site_updates,
  public.quiz_players, public.quiz_rounds
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

-- 선수 맞히기도 DB 함수로만 문제를 받고 답해요. 문제 은행과 낸 문제는 회원이 직접 읽지 못해서 정답이 새지 않아요.
-- 정답 선수의 사진은 서버가 비밀 키(service_role)로만 읽어요.
revoke all on function public.quiz_start() from public, anon;
grant execute on function public.quiz_start() to authenticated;
revoke all on function public.quiz_answer(bigint, integer) from public, anon;
grant execute on function public.quiz_answer(bigint, integer) to authenticated;
revoke all on function public.my_quiz() from public, anon;
grant execute on function public.my_quiz() to authenticated;

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
-- 선수 맞히기 표는 서버(service_role)와 DB 함수만 읽고 써서 회원용 규칙을 두지 않아요.
alter table public.quiz_players enable row level security;
alter table public.quiz_rounds enable row level security;
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

-- ---------- 승부차기 러시 ----------
-- 회원당 진행 중/마지막 게임 하나만 보관해요. 날짜별 최고 기록만 순위에 남아요.
create table if not exists public.penalty_runs (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  id uuid not null unique default gen_random_uuid(),
  day date not null,
  started_at timestamptz not null default clock_timestamp(),
  finished_at timestamptz,
  score integer check (score between 0 and 2250),
  goals integer check (goals between 0 and 10),
  perfects integer check (perfects between 0 and 10),
  best_streak integer check (best_streak between 0 and 10)
);
create table if not exists public.penalty_scores (
  day date not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  score integer not null check (score between 0 and 2250),
  goals integer not null check (goals between 0 and 10),
  perfects integer not null check (perfects between 0 and 10),
  achieved_at timestamptz not null default clock_timestamp(),
  primary key (day, user_id)
);
create index if not exists penalty_scores_board_idx on public.penalty_scores(day, score desc, achieved_at);
alter table public.penalty_runs enable row level security;
alter table public.penalty_scores enable row level security;
revoke all on public.penalty_runs, public.penalty_scores from public, anon, authenticated;

create or replace function public.penalty_start()
returns table(run_id uuid, day date)
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  today date := (clock_timestamp() at time zone 'Asia/Seoul')::date;
  started timestamptz;
begin
  perform 1 from public.profiles p where p.id = me for update;
  if not found then raise exception '로그인하고 닉네임을 정하면 순위에 도전할 수 있어요.'; end if;
  select r.started_at into started from public.penalty_runs r where r.user_id = me;
  if started > clock_timestamp() - interval '3 seconds' then
    raise exception '잠깐만요. 3초 뒤에 다시 시작해 주세요.';
  end if;
  return query
    insert into public.penalty_runs(user_id, day) values(me, today)
    on conflict (user_id) do update set id = gen_random_uuid(), day = excluded.day,
      started_at = clock_timestamp(), finished_at = null, score = null, goals = null, perfects = null, best_streak = null
    returning penalty_runs.id, penalty_runs.day;
end $$;

-- 점수를 받지 않고 10번의 슛 시각으로 다시 계산해요. 시작 날짜와 소유자는 서버 기록을 사용해요.
create or replace function public.penalty_finish(target_run uuid, timings jsonb)
returns table(score integer, goals integer, perfects integer, best_streak integer)
language plpgsql security definer set search_path = public as $$
declare
  item public.penalty_runs%rowtype;
  i integer; shot integer; seed bigint; target integer; width integer; period integer; phase integer;
  part integer; position integer; distance integer; streak integer := 0;
  points integer := 0; scored integer := 0; perfect integer := 0; longest integer := 0;
  duration integer := 9 * 750;
begin
  select * into item from public.penalty_runs r where r.user_id = auth.uid() and r.id = target_run for update;
  if not found then raise exception '다른 게임을 시작했거나 기록이 만료됐어요. 새 게임을 시작해 주세요.'; end if;
  -- 응답을 받기 전에 연결이 끊겨도 같은 게임 재전송은 안전해요.
  if item.finished_at is not null then
    return query select item.score, item.goals, item.perfects, item.best_streak;
    return;
  end if;
  if item.started_at < clock_timestamp() - interval '5 minutes' then
    raise exception '게임 시간이 만료됐어요. 새 게임을 시작해 주세요.';
  end if;
  if timings is null or jsonb_typeof(timings) <> 'array' then raise exception '슛 기록 형식이 맞지 않아요.'; end if;
  if jsonb_array_length(timings) <> 10 then raise exception '10번의 슛 기록이 필요해요.'; end if;
  seed := to_char(item.day, 'YYYYMMDD')::bigint;
  for i in 0..9 loop
    if timings->i = 'null'::jsonb then
      duration := duration + 3500;
      streak := 0;
      continue;
    end if;
    if jsonb_typeof(timings->i) <> 'number' or (timings->>i) !~ '^[0-9]{1,4}$' then
      raise exception '슛 기록 형식이 맞지 않아요.';
    end if;
    shot := (timings->>i)::integer;
    if shot < 120 or shot >= 3500 then raise exception '슛 시각이 범위를 벗어났어요.'; end if;
    duration := duration + shot;
    target := 220 + (seed * 37 + i * 193) % 560;
    width := 260 - i * 10;
    period := 1900 - i * 80 + seed % 150;
    phase := (seed * 53 + i * 211) % period;
    part := (shot + phase) % period;
    position := round(least(part, period - part)::numeric * 2000 / period);
    distance := abs(position - target);
    if distance * 2 <= width then
      streak := streak + 1;
      scored := scored + 1;
      longest := greatest(longest, streak);
      if distance * 6 <= width then
        perfect := perfect + 1;
        points := points + 150;
      else
        points := points + 100;
      end if;
      points := points + least(streak - 1, 4) * 25;
    else
      streak := 0;
    end if;
  end loop;
  if extract(epoch from (clock_timestamp() - item.started_at)) * 1000 < duration - 500 then
    raise exception '진행 시간과 슛 기록이 맞지 않아요. 잠시 뒤 저장을 다시 시도해 주세요.';
  end if;
  update public.penalty_runs r set finished_at = clock_timestamp(), score = points,
    goals = scored, perfects = perfect, best_streak = longest where r.id = item.id;
  insert into public.penalty_scores as s(day, user_id, score, goals, perfects)
    values(item.day, item.user_id, points, scored, perfect)
    on conflict(day, user_id) do update set score = excluded.score, goals = excluded.goals,
      perfects = excluded.perfects, achieved_at = clock_timestamp()
    where excluded.score > s.score;
  return query select points, scored, perfect, longest;
end $$;

-- 같은 점수는 같은 순위. 동점 표시 순서는 먼저 달성한 회원이 앞이에요.
-- 공개 결과에는 닉네임과 게임 기록만 내보내요.
create or replace function public.penalty_board(target_day date)
returns jsonb language sql stable security definer set search_path = public as $$
  with ranked as (
    select s.*, p.nickname, rank() over(order by s.score desc) as place
    from public.penalty_scores s join public.profiles p on p.id = s.user_id where s.day = target_day
  ), leaders as (
    select * from ranked order by score desc, achieved_at, user_id limit 20
  )
  select jsonb_build_object(
    'leaders', coalesce((select jsonb_agg(jsonb_build_object(
      'nickname', nickname, 'score', score, 'goals', goals, 'perfects', perfects,
      'rank', place, 'isMe', coalesce(user_id = auth.uid(), false)
    ) order by score desc, achieved_at, user_id) from leaders), '[]'::jsonb),
    'personal', (select jsonb_build_object('score', score, 'rank', place) from ranked where user_id = auth.uid()),
    'participants', (select count(*) from ranked)
  );
$$;
revoke all on function public.penalty_start() from public, anon;
revoke all on function public.penalty_finish(uuid, jsonb) from public, anon;
revoke all on function public.penalty_board(date) from public;
grant execute on function public.penalty_start(), public.penalty_finish(uuid, jsonb) to authenticated;
grant execute on function public.penalty_board(date) to anon, authenticated;

-- ---------- 레전드 로드 ----------
-- 커리어는 브라우저가 진행하고 저장해요. 순위에 도전하는 회원은 서버가 정한 시드로 시작하고,
-- 은퇴하면 서버가 시드와 선택 기록으로 처음부터 다시 계산한 기록만 남겨요.
-- 회원당 진행 중인 순위 도전 커리어는 하나예요. 새로 시작하면 이전 커리어는 저장할 수 없어요.
create table if not exists public.career_runs (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  id uuid not null unique default gen_random_uuid(),
  seed bigint not null check (seed between 0 and 4294967295),
  start_year integer not null check (start_year between 2020 and 2100),
  started_at timestamptz not null default clock_timestamp(),
  finished_at timestamptz,
  recorded_day date
);
-- 날짜·회원·포지션마다 최고 기록 하나만 남겨요. 순위는 회원별 최고 기록, 베스트 11은 포지션별 최고 기록으로 뽑아요.
create table if not exists public.career_records (
  day date not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  position text not null check (position in ('ST', 'WG', 'AM', 'CM', 'DM', 'FB', 'CB', 'GK')),
  run_id uuid not null,
  player_name text not null check (char_length(player_name) between 1 and 10),
  nation text not null check (nation ~ '^[A-Z]{3}$'),
  club text not null check (char_length(club) between 1 and 30),
  score integer not null check (score between 0 and 100000),
  ballon_dor integer not null check (ballon_dor between 0 and 30),
  peak_ovr integer not null check (peak_ovr between 1 and 99),
  goals integer not null check (goals between 0 and 5000),
  assists integer not null check (assists between 0 and 5000),
  apps integer not null check (apps between 0 and 5000),
  trophies integer not null check (trophies between 0 and 500),
  seasons integer not null check (seasons between 1 and 30),
  achieved_at timestamptz not null default clock_timestamp(),
  primary key (day, user_id, position)
);
create index if not exists career_records_board_idx on public.career_records(day, score desc);
alter table public.career_runs enable row level security;
alter table public.career_records enable row level security;
revoke all on public.career_runs, public.career_records from public, anon, authenticated;

create or replace function public.career_start()
returns table(run_id uuid, seed bigint, start_year integer)
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  seoul_now timestamp := clock_timestamp() at time zone 'Asia/Seoul';
  started timestamptz;
begin
  perform 1 from public.profiles p where p.id = me for update;
  if not found then raise exception '로그인하고 닉네임을 정하면 순위에 도전할 수 있어요.'; end if;
  select r.started_at into started from public.career_runs r where r.user_id = me;
  if started > clock_timestamp() - interval '3 seconds' then
    raise exception '잠깐만요. 3초 뒤에 다시 시작해 주세요.';
  end if;
  -- 7월부터 새 시즌이에요. 화면의 seasonYearOf와 같은 기준이에요.
  return query
    insert into public.career_runs as r(user_id, seed, start_year)
    values (me, floor(random() * 4294967296)::bigint,
      extract(year from seoul_now)::integer - case when extract(month from seoul_now) >= 7 then 0 else 1 end)
    on conflict (user_id) do update set id = gen_random_uuid(), seed = excluded.seed, start_year = excluded.start_year,
      started_at = clock_timestamp(), finished_at = null, recorded_day = null
    returning r.id, r.seed, r.start_year;
end $$;

-- 서버가 다시 계산한 은퇴 기록을 남겨요. 비밀 키(service_role)로만 부를 수 있어요.
-- 응답을 받기 전에 연결이 끊겨도 같은 커리어를 다시 보내면 처음 저장한 날짜를 돌려줘요.
create or replace function public.career_record(target_user uuid, target_run uuid, record jsonb)
returns table(record_day date, is_new boolean)
language plpgsql security definer set search_path = public as $$
declare
  item public.career_runs%rowtype;
  today date := (clock_timestamp() at time zone 'Asia/Seoul')::date;
  played integer := (record->>'seasons')::integer;
begin
  select * into item from public.career_runs r where r.user_id = target_user and r.id = target_run for update;
  if not found then raise exception '다른 곳에서 새 커리어를 시작해서 이 커리어는 순위에 올릴 수 없어요.'; end if;
  if item.finished_at is not null then
    return query select item.recorded_day, false;
    return;
  end if;
  -- 시즌마다 적어도 한 번은 고르니 너무 빨리 끝난 기록은 받지 않아요.
  if clock_timestamp() - item.started_at < make_interval(secs => played) then
    raise exception '커리어 진행 시간이 너무 짧아요. 잠시 뒤 다시 시도해 주세요.';
  end if;
  update public.career_runs r set finished_at = clock_timestamp(), recorded_day = today where r.user_id = target_user;
  insert into public.career_records as c(day, user_id, position, run_id, player_name, nation, club, score, ballon_dor,
    peak_ovr, goals, assists, apps, trophies, seasons)
  values (today, target_user, record->>'position', target_run, record->>'name', record->>'nation', record->>'club',
    (record->>'score')::integer, (record->>'ballonDor')::integer, (record->>'peakOvr')::integer, (record->>'goals')::integer,
    (record->>'assists')::integer, (record->>'apps')::integer, (record->>'trophies')::integer, played)
  on conflict (day, user_id, position) do update set run_id = excluded.run_id, player_name = excluded.player_name,
    nation = excluded.nation, club = excluded.club, score = excluded.score, ballon_dor = excluded.ballon_dor,
    peak_ovr = excluded.peak_ovr, goals = excluded.goals, assists = excluded.assists, apps = excluded.apps,
    trophies = excluded.trophies, seasons = excluded.seasons, achieved_at = clock_timestamp()
  where excluded.score > c.score;
  return query select today, true;
end $$;

-- 회원마다 그날 최고 기록 하나로 겨뤄요. 같은 점수는 같은 순위이고, 먼저 달성한 회원이 앞에 보여요.
-- 베스트 11(4-3-3)은 포지션별 최고 기록이에요. 풀백·센터백·윙어는 두 자리예요.
create or replace function public.career_board(target_day date)
returns jsonb language sql stable security definer set search_path = public as $$
  with best as (
    select distinct on (c.user_id) c.*
    from public.career_records c where c.day = target_day
    order by c.user_id, c.score desc, c.achieved_at
  ), ranked as (
    select b.*, p.nickname, rank() over (order by b.score desc) as place
    from best b join public.profiles p on p.id = b.user_id
  ), leaders as (
    select * from ranked order by score desc, achieved_at, user_id limit 20
  ), eleven as (
    select c.position, c.player_name, c.score, c.peak_ovr, c.ballon_dor, p.nickname,
      row_number() over (partition by c.position order by c.score desc, c.achieved_at, c.user_id) as slot
    from public.career_records c join public.profiles p on p.id = c.user_id where c.day = target_day
  )
  select jsonb_build_object(
    'leaders', coalesce((select jsonb_agg(jsonb_build_object(
      'nickname', nickname, 'name', player_name, 'position', position, 'nation', nation, 'club', club,
      'score', score, 'ballonDor', ballon_dor, 'peakOvr', peak_ovr, 'goals', goals,
      'rank', place, 'isMe', coalesce(user_id = auth.uid(), false)
    ) order by score desc, achieved_at, user_id) from leaders), '[]'::jsonb),
    'personal', (select jsonb_build_object('score', score, 'rank', place) from ranked where user_id = auth.uid()),
    'participants', (select count(*) from ranked),
    'eleven', coalesce((select jsonb_agg(jsonb_build_object(
      'position', position, 'slot', slot, 'name', player_name, 'nickname', nickname,
      'score', score, 'peakOvr', peak_ovr, 'ballonDor', ballon_dor
    ) order by position, slot) from eleven
      where slot <= case when position in ('FB', 'CB', 'WG') then 2 else 1 end), '[]'::jsonb)
  );
$$;
revoke all on function public.career_start() from public, anon;
revoke all on function public.career_record(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.career_board(date) from public;
grant execute on function public.career_start() to authenticated;
grant execute on function public.career_record(uuid, uuid, jsonb) to service_role;
grant execute on function public.career_board(date) to anon, authenticated;

-- 회원의 은퇴 선수 보관함이에요. 화면의 보관함(archive.ts)과 같은 요약을 본인만 저장하고 봐요.
-- 연습 커리어도 남기는 개인 기록이라 서버가 다시 계산하지 않고, 순위에는 쓰지 않아요.
create table if not exists public.career_retirements (
  user_id uuid not null references public.profiles(id) on delete cascade,
  id text not null check (char_length(id) between 1 and 160),
  retired_at timestamptz not null,
  entry jsonb not null check (jsonb_typeof(entry) = 'object' and octet_length(entry::text) <= 16384),
  saved_at timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);
create index if not exists career_retirements_user_idx on public.career_retirements(user_id, retired_at desc);
alter table public.career_retirements enable row level security;
revoke all on public.career_retirements from public, anon, authenticated;

-- 같은 선수는 한 번만 남겨요. 다른 기기에서 다시 보내도 처음 저장한 내용을 지켜요.
create or replace function public.career_archive_save(entries jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  added integer;
begin
  perform 1 from public.profiles p where p.id = me for update;
  if not found then raise exception '로그인하고 닉네임을 정하면 계정에 보관할 수 있어요.'; end if;
  if jsonb_typeof(entries) is distinct from 'array' or jsonb_array_length(entries) > 100 then
    raise exception '한 번에 100명까지 보관할 수 있어요.';
  end if;
  insert into public.career_retirements(user_id, id, retired_at, entry)
    select me, e->>'id', (e->>'retiredAt')::timestamptz, e from jsonb_array_elements(entries) e
    on conflict (user_id, id) do nothing;
  get diagnostics added = row_count;
  if (select count(*) from public.career_retirements r where r.user_id = me) > 2000 then
    raise exception '계정 보관함은 2,000명까지 저장할 수 있어요.';
  end if;
  return added;
end $$;

create or replace function public.career_archive_list()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(r.entry order by r.retired_at desc, r.id), '[]'::jsonb)
  from public.career_retirements r where r.user_id = auth.uid();
$$;
revoke all on function public.career_archive_save(jsonb), public.career_archive_list() from public, anon;
grant execute on function public.career_archive_save(jsonb), public.career_archive_list() to authenticated;

-- 레전드 로드 공유 카드예요. 서버가 시드와 선택 기록으로 다시 계산한 은퇴 기록만 남기고, 주소를 아는 누구나 봐요.
-- 같은 회원이 같은 선수를 다시 공유하면 처음 만든 주소를 돌려줘요.
create table if not exists public.career_cards (
  code text primary key check (code ~ '^[A-Za-z0-9]{10}$'),
  user_id uuid not null references public.profiles(id) on delete cascade,
  career_id text not null check (char_length(career_id) between 1 and 160),
  card jsonb not null check (jsonb_typeof(card) = 'object' and octet_length(card::text) <= 32768),
  created_at timestamptz not null default clock_timestamp(),
  unique (user_id, career_id)
);
alter table public.career_cards enable row level security;
revoke all on public.career_cards from public, anon, authenticated;

-- 비밀 키(service_role)로만 불러요. 카드 내용은 서버가 다시 계산해서 넘겨요.
create or replace function public.career_card_save(target_user uuid, target_career text, target_card jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  made text;
begin
  perform 1 from public.profiles p where p.id = target_user for update;
  if not found then raise exception '로그인하고 닉네임을 정하면 공유 카드를 만들 수 있어요.'; end if;
  select c.code into made from public.career_cards c where c.user_id = target_user and c.career_id = target_career;
  if found then return made; end if;
  if (select count(*) from public.career_cards c where c.user_id = target_user) >= 500 then
    raise exception '공유 카드는 500장까지 만들 수 있어요.';
  end if;
  loop
    made := array_to_string(array(select substr(chars, 1 + floor(random() * length(chars))::integer, 1) from generate_series(1, 10)), '');
    begin
      insert into public.career_cards(code, user_id, career_id, card) values (made, target_user, target_career, target_card)
        on conflict (code) do nothing;
      if found then return made; end if;
    exception when unique_violation then
      -- 같은 선수를 동시에 두 번 공유했어요. 먼저 만든 주소를 돌려줘요.
      select c.code into made from public.career_cards c where c.user_id = target_user and c.career_id = target_career;
      return made;
    end;
  end loop;
end $$;

create or replace function public.career_card(target_code text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('card', c.card, 'nickname', p.nickname, 'createdAt', c.created_at)
  from public.career_cards c join public.profiles p on p.id = c.user_id where c.code = target_code;
$$;
revoke all on function public.career_card_save(uuid, text, jsonb), public.career_card(text) from public, anon, authenticated;
grant execute on function public.career_card_save(uuid, text, jsonb) to service_role;
grant execute on function public.career_card(text) to anon, authenticated;
