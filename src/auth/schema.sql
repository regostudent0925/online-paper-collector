-- Supabase SQL Editor에서 실행. 실제 계정/참여 기록은 소스에 넣지 않는다.
begin;
create table if not exists public.member_records (
 user_id uuid primary key references auth.users(id) on delete cascade,
 records jsonb not null,
 revision integer not null default 1 check (revision > 0),
 constraint member_records_shape check (
  jsonb_typeof(records) = 'object' and
  records ?& array['schema','events','npay'] and
  records - array['schema','events','npay'] = '{}'::jsonb and
  coalesce(records->>'schema' = 'paper-collector-backup-v1',false) and
  coalesce(jsonb_typeof(records->'events') = 'array',false) and
  coalesce(jsonb_typeof(records->'npay') = 'array',false) and
  octet_length(records::text) <= 5242880
 )
);
alter table public.member_records enable row level security;
revoke all on public.member_records from public, anon, authenticated;
grant select on public.member_records to authenticated;
drop policy if exists member_read_own on public.member_records;
create policy member_read_own on public.member_records for select to authenticated using ((select auth.uid()) = user_id);
-- 서버의 인증 ID만 사용하고 revision으로 동시 저장 충돌을 검사한다.
create or replace function public.save_member_records(expected_revision integer, next_records jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := auth.uid(); next_revision integer;
begin
 if owner_id is null or not exists (select 1 from auth.users where id=owner_id and email_confirmed_at is not null) then
  raise exception 'authentication required' using errcode='42501';
 end if;
 if expected_revision=0 then
  insert into public.member_records(user_id,records,revision) values(owner_id,next_records,1)
  on conflict (user_id) do nothing returning revision into next_revision;
 else
  update public.member_records set records=next_records,revision=revision+1
  where user_id=owner_id and revision=expected_revision returning revision into next_revision;
 end if;
 if next_revision is null then raise exception 'record conflict' using errcode='PT409'; end if;
 return next_revision;
end;
$$;
revoke all on function public.save_member_records(integer,jsonb) from public, anon;
grant execute on function public.save_member_records(integer,jsonb) to authenticated;
commit;
