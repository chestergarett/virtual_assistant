-- Run if inserts fail with: "violates row-level security policy" (code 42501)
--
-- Cause: SUPABASE_SERVICE_ROLE_KEY in .env is the anon/publishable key, not service_role.
-- Fix: Project Settings → API → copy the service_role secret (never use in frontend).
--
-- This policy allows writes when the JWT role is service_role (belt-and-suspenders).

drop policy if exists recruiter_calls_service_role_all on public.recruiter_calls;

create policy recruiter_calls_service_role_all
  on public.recruiter_calls
  for all
  to service_role
  using (true)
  with check (true);
