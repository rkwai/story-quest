-- Claim a one-time playtest before creating an account or making paid calls.
-- Retain every claim, including failed/interrupted runs, so a build retry skips it.
create table public.verification_runs (
  id uuid primary key,
  status text not null default 'running' check (status in ('running', 'passed', 'failed')),
  qa_user_id uuid references auth.users(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  result jsonb not null default '{}',
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

alter table public.verification_runs enable row level security;
revoke all on public.verification_runs from public, anon, authenticated, service_role;
grant select, insert on public.verification_runs to service_role;
grant update (status, qa_user_id, campaign_id, result, finished_at)
  on public.verification_runs to service_role;

create index verification_runs_qa_user on public.verification_runs(qa_user_id);
create index verification_runs_campaign on public.verification_runs(campaign_id);
