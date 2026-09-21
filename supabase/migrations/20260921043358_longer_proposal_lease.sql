-- Give a 120s proposal and 150s route room to finish without a second player
-- taking over its reservation. Existing active leases and saved history stay intact.
-- Apply before deploying the longer proposal deadline; safe with the old app.
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
  update public.campaigns set lease_turn_id=p_turn, lease_until=now()+interval '180 seconds', last_attempt_at=now() where id=p_campaign;
  return jsonb_build_object('replayed',false,'state',c.state);
end; $$;

revoke all on function public.reserve_turn(uuid,uuid,uuid,text,integer) from public, anon, authenticated;
grant execute on function public.reserve_turn(uuid,uuid,uuid,text,integer) to service_role;
