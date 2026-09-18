-- Reset creates a new run from the original seed. Prior truth and traces remain intact.
alter table public.campaigns add column archived_at timestamptz;
alter table public.campaigns add column reset_from_id uuid references public.campaigns(id) on delete set null;
alter table public.campaigns add column reset_request_id uuid;
create unique index campaign_reset_request on public.campaigns(owner_id, reset_request_id) where reset_request_id is not null;

create or replace function public.create_campaign(p_owner uuid, p_title text, p_state jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare result uuid;
begin
  -- Serialize creation for one owner without any background process.
  perform pg_advisory_xact_lock(hashtext(p_owner::text));
  if (select count(*) from public.campaigns where owner_id = p_owner and archived_at is null) >= 5 then raise exception 'CAMPAIGN_LIMIT'; end if;
  insert into public.campaigns(owner_id,title,seed,state) values(p_owner,p_title,p_state,p_state) returning id into result;
  return result;
end; $$;

create or replace function public.reserve_turn(p_campaign uuid, p_owner uuid, p_turn uuid, p_input text, p_revision integer) returns jsonb
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
  if c.archived_at is not null then raise exception 'CAMPAIGN_ARCHIVED'; end if;
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

create function public.reset_campaign(p_campaign uuid, p_owner uuid, p_reset uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare original public.campaigns; previous public.campaigns; result uuid;
begin
  if p_reset is null then raise exception 'INVALID_REQUEST'; end if;
  -- Matches create_campaign's lock, serializing active-run quota changes per owner.
  perform pg_advisory_xact_lock(hashtext(p_owner::text));
  select * into original from public.campaigns where id=p_campaign and owner_id=p_owner for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into previous from public.campaigns where owner_id=p_owner and reset_request_id=p_reset;
  if found then
    if previous.reset_from_id is distinct from p_campaign then raise exception 'RESET_ID_REUSED'; end if;
    return jsonb_build_object('id',previous.id,'replayed',true);
  end if;
  if original.archived_at is not null then raise exception 'CAMPAIGN_ARCHIVED'; end if;
  if original.lease_until > now() then raise exception 'TURN_BUSY'; end if;
  -- Old runs are read-only, so they do not consume the five active-campaign slots.
  update public.campaigns set archived_at=now() where id=p_campaign;
  insert into public.campaigns(owner_id,title,seed,state,reset_from_id,reset_request_id)
    values(p_owner,original.seed->>'title',original.seed,original.seed,p_campaign,p_reset) returning id into result;
  return jsonb_build_object('id',result,'replayed',false);
end; $$;
revoke all on function public.reset_campaign(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.reset_campaign(uuid,uuid,uuid) to service_role;
