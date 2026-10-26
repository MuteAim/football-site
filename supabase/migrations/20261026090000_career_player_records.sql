-- 베스트 11을 회원 구분 없이 선수별 점수로 선발해요. 기존 기록은 유지해요.
-- Supabase SQL Editor에서 전체를 한 번 실행하세요. 다시 실행해도 같은 결과예요.
begin;

-- 기존의 회원·포지션별 한 명 제한을 바꿔도 이미 저장된 기록은 유지해요.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.career_records'::regclass and conname = 'career_records_pkey'
      and pg_get_constraintdef(oid) <> 'PRIMARY KEY (day, user_id, run_id)'
  ) then
    alter table public.career_records drop constraint career_records_pkey;
    alter table public.career_records add primary key (day, user_id, run_id);
  end if;
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
  insert into public.career_records(day, user_id, position, side, shirt_number, foot, run_id, player_name, nation, club, score, ballon_dor,
    peak_ovr, goals, assists, apps, trophies, seasons)
  values (today, target_user, record->>'position', record->>'side', (record->>'number')::integer, record->>'foot', target_run,
    record->>'name', record->>'nation', record->>'club',
    (record->>'score')::integer, (record->>'ballonDor')::integer, (record->>'peakOvr')::integer, (record->>'goals')::integer,
    (record->>'assists')::integer, (record->>'apps')::integer, (record->>'trophies')::integer, played)
  on conflict (day, user_id, run_id) do nothing;
  return query select today, true;
end $$;

-- 회원마다 그날 최고 기록 하나로 겨뤄요. 같은 점수는 같은 순위이고, 먼저 달성한 회원이 앞에 보여요.
-- 베스트 11(4-3-3)은 모든 선수 중 포지션별 최고 기록이에요. 같은 회원이 모든 자리를 차지할 수 있어요.
-- 센터백은 두 자리, 윙어·풀백은 왼쪽·오른쪽에 한 자리씩이에요.
create or replace function public.career_board(target_day date)
returns jsonb language sql stable security definer set search_path = public as $$
  with best as (
    select distinct on (c.user_id) c.*
    from public.career_records c where c.day = target_day
    order by c.user_id, c.score desc, c.achieved_at, c.run_id
  ), ranked as (
    select b.*, p.nickname, rank() over (order by b.score desc) as place
    from best b join public.profiles p on p.id = b.user_id
  ), leaders as (
    select * from ranked order by score desc, achieved_at, user_id limit 20
  ), eleven as (
    select c.position, c.side, c.shirt_number, c.player_name, c.score, c.peak_ovr, c.ballon_dor, p.nickname,
      row_number() over (partition by c.position, c.side order by c.score desc, c.achieved_at, c.user_id, c.run_id) as slot
    from public.career_records c join public.profiles p on p.id = c.user_id where c.day = target_day
  )
  select jsonb_build_object(
    'leaders', coalesce((select jsonb_agg(jsonb_build_object(
      'nickname', nickname, 'name', player_name, 'position', position, 'side', side, 'number', shirt_number,
      'nation', nation, 'club', club,
      'score', score, 'ballonDor', ballon_dor, 'peakOvr', peak_ovr, 'goals', goals,
      'rank', place, 'isMe', coalesce(user_id = auth.uid(), false)
    ) order by score desc, achieved_at, user_id) from leaders), '[]'::jsonb),
    'personal', (select jsonb_build_object('score', score, 'rank', place) from ranked where user_id = auth.uid()),
    'participants', (select count(*) from ranked),
    'eleven', coalesce((select jsonb_agg(jsonb_build_object(
      'position', position, 'side', side, 'number', shirt_number, 'slot', slot, 'name', player_name, 'nickname', nickname,
      'score', score, 'peakOvr', peak_ovr, 'ballonDor', ballon_dor
    ) order by position, slot) from eleven
      where slot <= case when position = 'CB' then 2 else 1 end), '[]'::jsonb)
  );
$$;
revoke all on function public.career_start() from public, anon;
revoke all on function public.career_record(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.career_board(date) from public;
grant execute on function public.career_start() to authenticated;
grant execute on function public.career_record(uuid, uuid, jsonb) to service_role;
grant execute on function public.career_board(date) to anon, authenticated;


commit;
