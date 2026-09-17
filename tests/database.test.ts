import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { seedWorld } from '../src/engine/seed';
import { applyProposal } from '../src/engine/reducer';
import { playerView } from '../src/engine/view';

const owner='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const turn='33333333-3333-4333-8333-333333333333';
const turn2='44444444-4444-4444-8444-444444444444';
test('Postgres enforces private state, atomic revisions, ownership and turn idempotency',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated; create role service_role bypassrls; insert into auth.users values('${owner}'),('${other}');`);
  await db.exec(await readFile('supabase/migrations/202609170001_story_engine.sql','utf8'));
  const seed=seedWorld();
  const created=await db.query<{id:string}>('select public.create_campaign($1,$2,$3) as id',[owner,seed.title,JSON.stringify(seed)]);
  const campaign=created.rows[0].id;
  await db.exec('set role authenticated');
  await assert.rejects(db.query('select state from public.campaigns'),/permission denied/);
  await assert.rejects(db.query('select public.create_campaign($1,$2,$3)',[owner,'attack','{}']),/permission denied/);
  await db.exec('reset role; set role service_role');
  await assert.rejects(db.query('select public.reserve_turn($1,$2,$3,$4,$5)',[campaign,other,turn,'look',0]),/NOT_FOUND/);
  await db.query('select public.reserve_turn($1,$2,$3,$4,$5)',[campaign,owner,turn,'look',0]);
  await assert.rejects(db.query('select public.reserve_turn($1,$2,$3,$4,$5)',[campaign,owner,turn2,'talk',0]),/TURN_BUSY/);
  const proposal={kind:'action' as const,interpretation:'Look.',clarification:null,elapsedMinutes:5,operations:[]};
  const next=applyProposal(seed,proposal); const result={id:turn,input:'look',interpretation:'Look.',changes:['5 minutes pass.'],narration:null,revision:1};
  const params=[campaign,owner,turn,0,JSON.stringify(next),JSON.stringify(proposal),JSON.stringify(result),JSON.stringify(playerView(next)),'1.0.0'];
  await db.query('select public.commit_turn($1,$2,$3,$4,$5,$6,$7,$8,$9)',params);
  await db.query('select public.commit_turn($1,$2,$3,$4,$5,$6,$7,$8,$9)',params);
  const replay=await db.query<{value:{replayed:boolean}}>('select public.reserve_turn($1,$2,$3,$4,$5) as value',[campaign,owner,turn,'look',0]);
  assert.equal(replay.rows[0].value.replayed,true);
  await assert.rejects(db.query('select public.reserve_turn($1,$2,$3,$4,$5)',[campaign,owner,turn,'different',1]),/TURN_ID_REUSED/);
  const state=await db.query<{revision:number}>('select revision from public.campaigns where id=$1',[campaign]); assert.equal(state.rows[0].revision,1);
  await assert.rejects(db.query('update public.turns set proposal=$1 where campaign_id=$2 and id=$3',['{}',campaign,turn]),/IMMUTABLE_TURN/);
  const count=await db.query<{count:number}>('select count(*)::int as count from public.turns where status=\'committed\''); assert.equal(count.rows[0].count,1);
  await assert.rejects(db.query('select public.reserve_turn($1,$2,$3,$4,$5)',[campaign,owner,turn2,'talk',0]),/STALE_REVISION/);
  const narration=await db.query<{data:{view:unknown}}>('select public.reserve_narration($1,$2,$3) as data',[campaign,owner,turn]);
  assert.ok(!JSON.stringify(narration.rows[0].data.view).includes('Hollow Choir'));
  await assert.rejects(db.query('select public.reserve_narration($1,$2,$3)',[campaign,owner,turn]),/NARRATION_BUSY/);
  await db.query('update public.turns set narration=$1,narration_lease_until=null where campaign_id=$2 and id=$3',['Saved prose.',campaign,turn]);
  const cached=await db.query<{data:{narration:string}}>('select public.reserve_narration($1,$2,$3) as data',[campaign,owner,turn]);
  assert.equal(cached.rows[0].data.narration,'Saved prose.');
 } finally {await db.close();}
});
