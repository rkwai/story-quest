-- Authoritative snapshots and traces are intentionally unreadable by browser roles.
create table public.campaigns (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null, seed jsonb not null, state jsonb not null, revision integer not null default 0,
  lease_turn_id uuid, lease_until timestamptz, last_attempt_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index campaigns_owner on public.campaigns(owner_id);
create table public.turns (
  campaign_id uuid not null references public.campaigns(id) on delete cascade, id uuid not null,
  input text not null check (length(input) between 1 and 2000), status text not null default 'planning' check (status in ('planning','committed')),
  base_revision integer not null, revision integer, proposal jsonb, public_result jsonb, narration_view jsonb,
  engine_version text, narration text, narration_lease_until timestamptz, narration_attempts integer not null default 0,
  created_at timestamptz not null default now(), committed_at timestamptz,
  primary key(campaign_id,id), unique(campaign_id,revision)
);
create table public.turn_traces (
  id bigint generated always as identity primary key, campaign_id uuid not null references public.campaigns(id) on delete cascade,
  turn_id uuid not null, stage text not null, duration_ms integer not null default 0, details jsonb not null default '{}', created_at timestamptz not null default now()
);
create index trace_turn on public.turn_traces(campaign_id,turn_id,created_at);
create table public.request_limits (owner_id uuid primary key references auth.users(id) on delete cascade, day date not null, attempts integer not null default 0);
alter table public.campaigns enable row level security;
alter table public.turns enable row level security;
alter table public.turn_traces enable row level security;
alter table public.request_limits enable row level security;
revoke all on public.campaigns, public.turns, public.turn_traces, public.request_limits from anon, authenticated;
grant all on public.campaigns, public.turns, public.turn_traces, public.request_limits to service_role;
grant usage, select on sequence public.turn_traces_id_seq to service_role;

create function public.create_campaign(p_owner uuid, p_title text, p_state jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare result uuid;
begin
  -- Serialize creation for one owner without any background process.
  perform pg_advisory_xact_lock(hashtext(p_owner::text));
  if (select count(*) from public.campaigns where owner_id = p_owner) >= 5 then raise exception 'CAMPAIGN_LIMIT'; end if;
  insert into public.campaigns(owner_id,title,seed,state) values(p_owner,p_title,p_state,p_state) returning id into result;
  return result;
end; $$;

create function public.reserve_turn(p_campaign uuid, p_owner uuid, p_turn uuid, p_input text, p_revision integer) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare c public.campaigns; t public.turns; n integer;
begin
  select * into c from public.campaigns where id=p_campaign and owner_id=p_owner for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into t from public.turns where campaign_id=p_campaign and id=p_turn;
  if found then
    if t.input <> p_input then raise exception 'TURN_ID_REUSED'; end if;
    if t.status='committed' then return jsonb_build_object('replayed',true,'turn',t.public_result || jsonb_build_object('narration',t.narration)); end if;
  end if;
  if c.lease_until > now() then raise exception 'TURN_BUSY'; end if;
  if c.revision <> p_revision then raise exception 'STALE_REVISION'; end if;
  if c.last_attempt_at > now() - interval '2 seconds' then raise exception 'RATE_LIMIT'; end if;
  insert into public.request_limits(owner_id,day,attempts) values(p_owner,current_date,1)
  on conflict(owner_id) do update set day=current_date, attempts=case when public.request_limits.day=current_date then public.request_limits.attempts+1 else 1 end
  returning attempts into n;
  if n > 100 then raise exception 'DAILY_LIMIT'; end if;
  insert into public.turns(campaign_id,id,input,base_revision) values(p_campaign,p_turn,p_input,p_revision)
  on conflict(campaign_id,id) do update set base_revision=p_revision;
  update public.campaigns set lease_turn_id=p_turn, lease_until=now()+interval '90 seconds', last_attempt_at=now() where id=p_campaign;
  return jsonb_build_object('replayed',false,'state',c.state);
end; $$;

create function public.release_turn(p_campaign uuid, p_owner uuid, p_turn uuid) returns void
language sql security invoker set search_path = '' as $$
  update public.campaigns set lease_turn_id=null, lease_until=null where id=p_campaign and owner_id=p_owner and lease_turn_id=p_turn;
$$;

create function public.commit_turn(p_campaign uuid,p_owner uuid,p_turn uuid,p_revision integer,p_state jsonb,p_proposal jsonb,p_result jsonb,p_view jsonb,p_engine text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare c public.campaigns; t public.turns;
begin
  select * into c from public.campaigns where id=p_campaign and owner_id=p_owner for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into t from public.turns where campaign_id=p_campaign and id=p_turn for update;
  if not found then raise exception 'TURN_NOT_RESERVED'; end if;
  if t.status='committed' then return t.public_result || jsonb_build_object('narration',t.narration); end if;
  if c.revision <> p_revision or (p_state->>'revision')::integer <> p_revision+1 then raise exception 'STALE_REVISION'; end if;
  if c.lease_turn_id is distinct from p_turn or c.lease_until <= now() then raise exception 'LEASE_EXPIRED'; end if;
  update public.turns set status='committed',revision=p_revision+1,proposal=p_proposal,public_result=p_result,narration_view=p_view,engine_version=p_engine,committed_at=now() where campaign_id=p_campaign and id=p_turn;
  update public.campaigns set state=p_state,revision=p_revision+1,lease_turn_id=null,lease_until=null,updated_at=now() where id=p_campaign;
  return p_result;
end; $$;

create function public.reserve_narration(p_campaign uuid,p_owner uuid,p_turn uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare t public.turns;
begin
  perform 1 from public.campaigns where id=p_campaign and owner_id=p_owner;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into t from public.turns where campaign_id=p_campaign and id=p_turn and status='committed' for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if t.narration is not null then return jsonb_build_object('narration',t.narration); end if;
  if t.narration_lease_until > now() then raise exception 'NARRATION_BUSY'; end if;
  if t.narration_attempts >= 2 then raise exception 'NARRATION_LIMIT'; end if;
  update public.turns set narration_lease_until=now()+interval '60 seconds',narration_attempts=narration_attempts+1 where campaign_id=p_campaign and id=p_turn;
  return jsonb_build_object('turn',t.public_result,'view',t.narration_view);
end; $$;

revoke all on function public.create_campaign(uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.reserve_turn(uuid,uuid,uuid,text,integer) from public,anon,authenticated;
revoke all on function public.release_turn(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.commit_turn(uuid,uuid,uuid,integer,jsonb,jsonb,jsonb,jsonb,text) from public,anon,authenticated;
revoke all on function public.reserve_narration(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.create_campaign(uuid,text,jsonb) to service_role;
grant execute on function public.reserve_turn(uuid,uuid,uuid,text,integer) to service_role;
grant execute on function public.release_turn(uuid,uuid,uuid) to service_role;
grant execute on function public.commit_turn(uuid,uuid,uuid,integer,jsonb,jsonb,jsonb,jsonb,text) to service_role;
grant execute on function public.reserve_narration(uuid,uuid,uuid) to service_role;

-- Presentation can finish later; the accepted world transition cannot be edited.
create function public.protect_committed_turn() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status='committed' and (
    new.status is distinct from old.status or new.input is distinct from old.input or
    new.proposal is distinct from old.proposal or new.revision is distinct from old.revision or
    new.base_revision is distinct from old.base_revision or new.public_result is distinct from old.public_result or
    new.narration_view is distinct from old.narration_view or new.engine_version is distinct from old.engine_version or
    new.committed_at is distinct from old.committed_at or new.campaign_id is distinct from old.campaign_id or new.id is distinct from old.id
  ) then raise exception 'IMMUTABLE_TURN'; end if;
  if old.narration is not null and new.narration is distinct from old.narration then raise exception 'IMMUTABLE_NARRATION'; end if;
  return new;
end; $$;
create trigger protect_committed_turn before update on public.turns for each row execute function public.protect_committed_turn();
revoke all on function public.protect_committed_turn() from public,anon,authenticated;
