-- 베스트 11에 역대 기록을 더해요. 오늘의 베스트 11과 함께 날짜와 상관없는 포지션별 최고 기록(allTime)을 돌려줘요.
-- Supabase SQL Editor에서 전체를 한 번 실행하세요. 다시 실행해도 같은 결과예요. schema.sql 전체를 다시 실행해도 같아요.
begin;

-- 역대 베스트 11은 날짜와 상관없이 포지션별 최고 기록을 찾아요.
create index if not exists career_records_eleven_idx on public.career_records(position, side, score desc);

-- 회원마다 그날 최고 기록 하나로 겨뤄요. 같은 점수는 같은 순위이고, 먼저 달성한 회원이 앞에 보여요.
-- 베스트 11(4-3-3)은 모든 선수 중 포지션별 최고 기록이에요. 같은 회원이 모든 자리를 차지할 수 있어요.
-- 센터백은 두 자리, 윙어·풀백은 왼쪽·오른쪽에 한 자리씩이에요.
-- allTime은 날짜와 상관없는 역대 베스트 11이고, 각 선수가 은퇴한 날(day)을 함께 돌려줘요.
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
  ), all_time as (
    select c.day, c.position, c.side, c.shirt_number, c.player_name, c.score, c.peak_ovr, c.ballon_dor, p.nickname,
      row_number() over (partition by c.position, c.side order by c.score desc, c.achieved_at, c.user_id, c.run_id) as slot
    from public.career_records c join public.profiles p on p.id = c.user_id
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
      where slot <= case when position = 'CB' then 2 else 1 end), '[]'::jsonb),
    'allTime', coalesce((select jsonb_agg(jsonb_build_object(
      'position', position, 'side', side, 'number', shirt_number, 'slot', slot, 'name', player_name, 'nickname', nickname,
      'score', score, 'peakOvr', peak_ovr, 'ballonDor', ballon_dor, 'day', to_char(day, 'YYYY-MM-DD')
    ) order by position, slot) from all_time
      where slot <= case when position = 'CB' then 2 else 1 end), '[]'::jsonb)
  );
$$;

commit;
