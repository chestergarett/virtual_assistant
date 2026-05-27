-- Run only if you already created recruiter_calls from an older 001 migration.

alter table public.recruiter_calls
  add column if not exists called_at timestamptz,
  add column if not exists recruiting_company text,
  add column if not exists role_discussed text,
  add column if not exists interest_level text;

-- Old column name from earlier schema
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'recruiter_calls'
      and column_name = 'recruiter_company'
  ) then
    update public.recruiter_calls
    set recruiting_company = recruiter_company
    where recruiting_company is null and recruiter_company is not null;

    alter table public.recruiter_calls drop column recruiter_company;
  end if;
end $$;

create index if not exists recruiter_calls_called_at_idx
  on public.recruiter_calls (called_at desc nulls last);
