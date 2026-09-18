-- Open playtesting deliberately shares all adventures through the application.
-- Raw snapshots, traces, internal scopes and RPCs remain server-only.
alter table public.campaigns drop constraint campaigns_owner_id_fkey;
alter table public.request_limits drop constraint request_limits_owner_id_fkey;

create table public.playtest_scope (
  singleton boolean primary key default true check (singleton),
  id uuid not null unique default gen_random_uuid()
);
insert into public.playtest_scope(singleton) values(true);
alter table public.playtest_scope enable row level security;
revoke all on public.playtest_scope from public, anon, authenticated, service_role;
grant select on public.playtest_scope to service_role;

create function public.list_playtest_campaigns()
returns table(id uuid, title text, character_name text, revision integer,
  created_at timestamptz, updated_at timestamptz, archived_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  select c.id, c.title,
    coalesce((select entity->>'name' from jsonb_array_elements(c.state->'entities') entity
      where entity->>'id'=c.state->>'playerId' limit 1), 'Traveler'),
    c.revision, c.created_at, c.updated_at, c.archived_at
  from public.campaigns c
  order by c.archived_at nulls first, c.updated_at desc, c.id;
$$;

create or replace function public.create_campaign(p_owner uuid, p_title text, p_state jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare result uuid; scope_id uuid;
begin
  select id into scope_id from public.playtest_scope where singleton;
  if not found then raise exception 'NOT_CONFIGURED'; end if;
  -- All public visitors share one active-adventure cap, including older saves.
  perform pg_advisory_xact_lock(hashtext(scope_id::text));
  if (select count(*) from public.campaigns where archived_at is null) >= 5 then raise exception 'CAMPAIGN_LIMIT'; end if;
  insert into public.campaigns(owner_id,title,seed,state) values(p_owner,p_title,p_state,p_state) returning id into result;
  return result;
end; $$;

create or replace function public.reserve_turn(p_campaign uuid, p_owner uuid, p_turn uuid, p_input text, p_revision integer) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare c public.campaigns; t public.turns; n integer; scope_id uuid;
begin
  select * into c from public.campaigns where id=p_campaign and owner_id=p_owner for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into t from public.turns where campaign_id=p_campaign and id=p_turn;
  if found then
    if t.input <> p_input then raise exception 'TURN_ID_REUSED'; end if;
    if t.status='committed' then return jsonb_build_object('replayed',true,'turn',t.public_result || jsonb_build_object('narration',t.narration)); end if;
  end if;
  if c.archived_at is not null then raise exception 'CAMPAIGN_ARCHIVED'; end if;
  if c.lease_until > now() then raise exception 'TURN_BUSY'; end if;
  if c.revision <> p_revision then raise exception 'STALE_REVISION'; end if;
  if c.last_attempt_at > now() - interval '2 seconds' then raise exception 'RATE_LIMIT'; end if;
  select id into scope_id from public.playtest_scope where singleton;
  if not found then raise exception 'NOT_CONFIGURED'; end if;
  -- Deleting/recreating adventures must not reset the shared paid-call budget.
  insert into public.request_limits(owner_id,day,attempts) values(scope_id,current_date,1)
  on conflict(owner_id) do update set day=current_date, attempts=case when public.request_limits.day=current_date then public.request_limits.attempts+1 else 1 end
  returning attempts into n;
  if n > 100 then raise exception 'DAILY_LIMIT'; end if;
  insert into public.turns(campaign_id,id,input,base_revision) values(p_campaign,p_turn,p_input,p_revision)
  on conflict(campaign_id,id) do update set base_revision=p_revision;
  update public.campaigns set lease_turn_id=p_turn, lease_until=now()+interval '90 seconds', last_attempt_at=now() where id=p_campaign;
  return jsonb_build_object('replayed',false,'state',c.state);
end; $$;

create or replace function public.reserve_narration(p_campaign uuid,p_owner uuid,p_turn uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare t public.turns;
begin
  -- Same lock order as commit/delete: campaign, then turn. This prevents a
  -- narration reservation from starting between delete's lease check and delete.
  perform 1 from public.campaigns where id=p_campaign and owner_id=p_owner for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into t from public.turns where campaign_id=p_campaign and id=p_turn and status='committed' for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if t.narration is not null then return jsonb_build_object('narration',t.narration); end if;
  if t.narration_lease_until > now() then raise exception 'NARRATION_BUSY'; end if;
  if t.narration_attempts >= 2 then raise exception 'NARRATION_LIMIT'; end if;
  update public.turns set narration_lease_until=now()+interval '60 seconds',narration_attempts=narration_attempts+1 where campaign_id=p_campaign and id=p_turn;
  return jsonb_build_object('turn',t.public_result,'view',t.narration_view);
end; $$;

create function public.delete_playtest_campaign(p_campaign uuid) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare c public.campaigns;
begin
  select * into c from public.campaigns where id=p_campaign for update;
  if not found then return false; end if;
  if c.lease_until > now() then raise exception 'TURN_BUSY'; end if;
  if exists(select 1 from public.turns where campaign_id=p_campaign and narration_lease_until > now()) then
    raise exception 'NARRATION_BUSY';
  end if;
  -- Foreign keys cascade turns/traces; reset_from_id is ON DELETE SET NULL.
  delete from public.campaigns where id=p_campaign;
  return true;
end; $$;

revoke all on function public.list_playtest_campaigns() from public, anon, authenticated;
revoke all on function public.delete_playtest_campaign(uuid) from public, anon, authenticated;
grant execute on function public.list_playtest_campaigns() to service_role;
grant execute on function public.delete_playtest_campaign(uuid) to service_role;
