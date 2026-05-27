-- Run in Supabase SQL Editor (Dashboard → SQL → New query)

create table if not exists public.recruiter_calls (
  id uuid primary key default gen_random_uuid(),
  conversation_id text not null unique,
  agent_id text,
  called_at timestamptz,
  recruiter_name text,
  recruiter_email text,
  recruiting_company text,
  role_discussed text,
  interest_level text,
  transcript_summary text,
  call_duration_secs integer,
  call_successful text,
  data_collection jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists recruiter_calls_called_at_idx
  on public.recruiter_calls (called_at desc nulls last);

create index if not exists recruiter_calls_created_at_idx
  on public.recruiter_calls (created_at desc);

alter table public.recruiter_calls enable row level security;

-- Backend uses the service_role key and bypasses RLS.
